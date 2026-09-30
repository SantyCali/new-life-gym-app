package com.newlife.app

import android.app.*
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import androidx.core.app.NotificationCompat
import java.util.Calendar
import org.json.JSONObject

class StepCounterService : Service(), SensorEventListener {

    companion object {
        // _v2: los canales son inmutables una vez creados (Android ignora cambios de
        // lockscreenVisibility/importance en un canal ya existente). Se versiona el ID
        // para que la corrección de visibilidad en pantalla de bloqueo aplique también
        // a instalaciones que ya tenían la app.
        private const val TAG       = "NLGStepCounter"
        const val CHANNEL_ID        = "nlg_pasos_v2"
        const val CHANNEL_SILENT_ID = "nlg_pasos_silencioso_v2"
        const val NOTIFICATION_ID   = 7001
        const val PREFS_NAME        = "NLGStepCounter"
        const val KEY_TODAY_STEPS   = "todaySteps"
        const val KEY_LAST_ACC      = "lastAccumulated"
        const val KEY_LAST_ACC_ELAPSED = "lastAccumulatedElapsed"
        const val KEY_BOOT_TIMESTAMP   = "bootTimestamp"
        const val KEY_LAST_DATE     = "lastDate"
        const val KEY_SILENT        = "silentNotification"
        const val KEY_GOAL          = "dailyGoal"
        // Último día "cerrado" (ya no es hoy) cuyo total todavía no se confirmó
        // subido a Firestore — ver stashPendingSync().
        const val KEY_PENDING_SYNC_DATE  = "pendingSyncDate"
        const val KEY_PENDING_SYNC_STEPS = "pendingSyncSteps"
        // Totales finales de los últimos días cerrados, como JSON
        // {"2026-09-24": 8123, ...}. El slot único de arriba se pisaba si pasaban
        // dos medianoches sin que nadie lo subiera (celular apagado, sistema que
        // no dejó correr la tarea): con el historial no se pierde ningún día.
        const val KEY_DAILY_HISTORY = "dailyHistory"
        const val HISTORY_MAX_DAYS  = 14
        const val ACTION_UPDATE_NOTIF     = "NLG_UPDATE_NOTIFICATION"
        // Disparada por el deleteIntent de la notificación cuando el usuario la desliza.
        const val ACTION_NOTIF_DISMISSED  = "NLG_NOTIF_DISMISSED"

        private const val DEFAULT_GOAL              = 10_000
        private const val SENSOR_WATCHDOG_TIMEOUT_MS = 90_000L
        private const val SENSOR_WATCHDOG_CHECK_MS   = 60_000L

        // Tolerancia para considerar que el "boot timestamp" cambió (reboot real).
        private const val BOOT_TOLERANCE_MS    = 5_000L
        // Cadencia humana máxima razonable (muy por encima de un sprint real) usada
        // solo para descartar saltos físicamente imposibles, nunca pasos genuinos.
        private const val MAX_STEPS_PER_SECOND = 7.0
        // Piso mínimo de delta siempre aceptado, para no rechazar ráfagas cortas reales
        // cuando el tiempo transcurrido entre eventos es muy chico.
        private const val MIN_PLAUSIBLE_DELTA  = 10L
    }

    private lateinit var sensorManager: SensorManager
    private var stepSensor: Sensor? = null
    private lateinit var prefs: SharedPreferences
    private var wakeLock: PowerManager.WakeLock? = null
    private val handler = Handler(Looper.getMainLooper())
    private var lastSensorEventMs = 0L

    private var todaySteps: Int       = 0
    private var lastAccumulated: Long = 0L
    private var lastDate: String      = ""
    // Elapsed-realtime (SystemClock) del último evento aceptado: monótono, no lo
    // afectan cambios de reloj/zona horaria, y sobrevive a reinicios del servicio.
    private var lastAccumulatedElapsed: Long = 0L
    // Wall-clock aproximado del boot del dispositivo (currentTimeMillis - elapsedRealtime).
    // Cambia si y solo si hubo un reboot real; se usa para distinguir un reboot genuino
    // de un simple reset de sesión del sensor.
    private var bootTimestamp: Long = 0L

    private val sensorWatchdog = object : Runnable {
        override fun run() {
            val elapsed = System.currentTimeMillis() - lastSensorEventMs
            if (lastSensorEventMs > 0L && elapsed > SENSOR_WATCHDOG_TIMEOUT_MS) {
                // Re-registrar el listener es necesario para recuperar la entrega de eventos
                // en fabricantes agresivos con el doze (MIUI, etc.). En algunos HAL esto puede
                // hacer que el sensor reporte un valor de sesión distinto al que veníamos
                // siguiendo. Eso ya no genera pasos falsos: onSensorChanged distingue un
                // reboot real (via bootTimestamp) de un simple reset de sesión, y en ese
                // segundo caso no acredita el salto, solo resincroniza la referencia.
                stepSensor?.let {
                    sensorManager.unregisterListener(this@StepCounterService)
                    sensorManager.registerListener(
                        this@StepCounterService, it, SensorManager.SENSOR_DELAY_NORMAL
                    )
                }
            }
            handler.postDelayed(this, SENSOR_WATCHDOG_CHECK_MS)
        }
    }

    // ── Lifecycle ───────────────────────────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()
        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        createNotificationChannels()
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "NLG::StepCounterWakeLock")
        wakeLock?.acquire()
    }

    // ── Decisión de arquitectura sobre KEY_SILENT (switch OFF) ────────────────────
    // Android exige que, mientras este Service esté en estado foreground, exista una
    // notificación activa (startForeground() no acepta ausencia de notificación, y
    // NotificationManager.cancel() no puede cancelar la de un foreground service
    // activo — solo stopForeground(REMOVE) puede, pero eso también saca al servicio
    // del estado foreground). Es decir: NO existe forma de tener la notificación
    // "A) realmente cancelada/ausente" y, al mismo tiempo, garantizar que el conteo
    // de pasos siga corriendo en background de forma confiable (sobre todo en MIUI,
    // que mata agresivamente cualquier servicio sin privilegio foreground).
    // Decisión tomada: priorizar que el conteo de pasos NUNCA se interrumpa. Con el
    // switch OFF llegamos al máximo que Android permite sin sacrificar eso:
    //   B) silenciosa/minimizada  → canal IMPORTANCE_MIN
    //   C) oculta en lock screen  → VISIBILITY_SECRET
    //   D) ícono oculto en barra  → automático en Android 12+ (SO oculta el ícono de
    //      foreground services de importancia mínima); en Android 8-11 puede
    //      persistir un ícono mínimo, sin sonido ni contenido — límite de la
    //      plataforma, no de esta implementación.
    @Suppress("DEPRECATION")
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_UPDATE_NOTIF) {
            // El usuario cambió el switch de Configuración: se aplica sin condiciones,
            // sea para mostrar o para pasar a silencioso.
            Log.d(TAG, "ACTION_UPDATE_NOTIF recibido, silent=${prefs.getBoolean(KEY_SILENT, false)}")
            republishNotification()
            return START_STICKY
        }

        if (intent?.action == ACTION_NOTIF_DISMISSED) {
            // El usuario deslizó/eliminó la notificación. El switch (KEY_SILENT) es la
            // única fuente de verdad: si sigue "visible", se repone de inmediato con los
            // pasos actuales. Si está en silencioso, se respeta y no se vuelve a mostrar.
            val silent = prefs.getBoolean(KEY_SILENT, false)
            if (!silent) republishNotification()
            return START_STICKY
        }

        loadSavedData()
        republishNotification()

        stepSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL)
        }

        handler.removeCallbacks(sensorWatchdog)
        handler.postDelayed(sensorWatchdog, SENSOR_WATCHDOG_CHECK_MS)

        return START_STICKY
    }

    // Reconstruye y vuelve a publicar la notificación foreground con los pasos
    // actuales — usado al iniciar el servicio, al cambiar el switch de Configuración,
    // y al reponer la notificación tras un swipe (ver ACTION_NOTIF_DISMISSED).
    @Suppress("DEPRECATION")
    private fun republishNotification() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } else {
                stopForeground(true)
            }
            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(NOTIFICATION_ID, buildNotification(todaySteps), ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH)
            } else {
                startForeground(NOTIFICATION_ID, buildNotification(todaySteps))
            }
            Log.d(TAG, "republishNotification OK, silent=${prefs.getBoolean(KEY_SILENT, false)}, canal=${if (prefs.getBoolean(KEY_SILENT, false)) CHANNEL_SILENT_ID else CHANNEL_ID}")
        } catch (e: Exception) {
            // Si esto falla en silencio (p. ej. una restricción del fabricante al
            // reiniciar el foreground state), antes no quedaba ningún rastro —
            // con este log al menos se puede ver la causa real en logcat.
            Log.e(TAG, "republishNotification FALLÓ", e)
        }
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        sensorManager.unregisterListener(this)
        wakeLock?.let { if (it.isHeld) it.release() }
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // ── Sensor callbacks ────────────────────────────────────────────────────────

    override fun onSensorChanged(event: SensorEvent?) {
        val accumulated = event?.values?.get(0)?.toLong() ?: return
        val nowWall    = System.currentTimeMillis()
        val nowElapsed = SystemClock.elapsedRealtime()
        lastSensorEventMs = nowWall
        val today = todayString()
        val currentBoot = nowWall - nowElapsed

        // bootTimestamp == 0L implica que todavía no lo registramos (primer evento tras
        // instalar esta lógica): no asumimos reboot, solo lo fijamos como referencia.
        val rebooted = bootTimestamp != 0L &&
            kotlin.math.abs(currentBoot - bootTimestamp) > BOOT_TOLERANCE_MS

        when {
            today != lastDate -> {
                // Nuevo día: preservamos el total final del día que termina (ver
                // stashPendingSync) antes de arrancar el contador de hoy en cero.
                stashPendingSync(lastDate, todaySteps)
                todaySteps = 0
                lastDate   = today
                resyncBaseline(accumulated, nowElapsed, currentBoot)
            }
            lastAccumulated == 0L -> {
                // Primer evento del día (o primera vez que corre el servicio): solo
                // fijamos la referencia, sin sumar pasos todavía.
                resyncBaseline(accumulated, nowElapsed, currentBoot)
            }
            rebooted -> {
                // Reboot real confirmado por el boot timestamp: TYPE_STEP_COUNTER
                // arrancó de nuevo desde 0, así que 'accumulated' son pasos genuinos
                // ya dados hoy (antes de que este servicio volviera a arrancar).
                todaySteps += accumulated.toInt()
                resyncBaseline(accumulated, nowElapsed, currentBoot)
            }
            accumulated < lastAccumulated -> {
                // El contador "retrocedió" pero el boot timestamp NO cambió: no es un
                // reboot real, es un reset de sesión del sensor (glitch de HAL o efecto
                // de un re-registro del listener). No sumamos el valor completo: solo
                // resincronizamos la referencia para no perder los pasos reales que
                // vengan de acá en adelante.
                resyncBaseline(accumulated, nowElapsed, currentBoot)
            }
            else -> {
                val delta = accumulated - lastAccumulated
                val elapsedSec = (nowElapsed - lastAccumulatedElapsed).coerceAtLeast(0) / 1000.0
                val maxPlausible = maxOf((elapsedSec * MAX_STEPS_PER_SECOND).toLong(), MIN_PLAUSIBLE_DELTA)
                if (delta <= maxPlausible) {
                    todaySteps += delta.toInt()
                }
                // Si el delta es implausible para el tiempo transcurrido (ej: miles de
                // pasos en pocos segundos), lo descartamos sin sumarlo -no restamos ni
                // inventamos nada- y resincronizamos para que el próximo evento vuelva
                // a calcularse bien desde ahí.
                resyncBaseline(accumulated, nowElapsed, currentBoot)
            }
        }

        saveData()
        updateNotification(todaySteps)
    }

    private fun resyncBaseline(accumulated: Long, nowElapsed: Long, currentBoot: Long) {
        lastAccumulated        = accumulated
        lastAccumulatedElapsed = nowElapsed
        bootTimestamp          = currentBoot
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    // ── Helpers ─────────────────────────────────────────────────────────────────

    private fun todayString(): String {
        val c = Calendar.getInstance()
        val y = c.get(Calendar.YEAR)
        val m = (c.get(Calendar.MONTH) + 1).toString().padStart(2, '0')
        val d = c.get(Calendar.DAY_OF_MONTH).toString().padStart(2, '0')
        return "$y-$m-$d"
    }

    private fun loadSavedData() {
        val saved = prefs.getString(KEY_LAST_DATE, "") ?: ""
        val today = todayString()
        if (saved == today) {
            todaySteps             = prefs.getInt(KEY_TODAY_STEPS, 0)
            lastAccumulated        = prefs.getLong(KEY_LAST_ACC, 0L)
            lastAccumulatedElapsed = prefs.getLong(KEY_LAST_ACC_ELAPSED, 0L)
            bootTimestamp          = prefs.getLong(KEY_BOOT_TIMESTAMP, 0L)
            lastDate                = today
        } else {
            // El servicio estuvo parado (matado por el fabricante, reboot, etc.)
            // al menos desde antes de la medianoche pasada: 'saved' es el último
            // día que llegó a guardar, con su conteo final en KEY_TODAY_STEPS.
            // Si no lo preservamos acá, se pisa con el 0 del día nuevo sin que
            // nadie (ni la app ni la tarea en background) haya podido subirlo.
            if (saved.isNotEmpty()) {
                stashPendingSync(saved, prefs.getInt(KEY_TODAY_STEPS, 0))
            }
            todaySteps             = 0
            lastAccumulated        = 0L
            lastAccumulatedElapsed = 0L
            bootTimestamp          = 0L
            lastDate                = today
        }
    }

    // Guarda el total final de un día que ya terminó en un slot aparte, para que
    // la app (o la tarea en background) lo pueda subir a Firestore la próxima vez
    // que tenga oportunidad — ver stepCounterModule.getPendingHistorySync().
    private fun stashPendingSync(outgoingDate: String, outgoingSteps: Int) {
        if (outgoingSteps <= 0) return
        prefs.edit()
            .putString(KEY_PENDING_SYNC_DATE, outgoingDate)
            .putInt(KEY_PENDING_SYNC_STEPS, outgoingSteps)
            .putString(KEY_DAILY_HISTORY, historyWith(outgoingDate, outgoingSteps))
            .apply()
    }

    // Agrega (o mejora) el total de un día al historial y descarta lo más
    // viejo. Las fechas son "YYYY-MM-DD", así que ordenarlas como texto es
    // ordenarlas por fecha.
    private fun historyWith(date: String, steps: Int): String {
        val history = try {
            JSONObject(prefs.getString(KEY_DAILY_HISTORY, "{}") ?: "{}")
        } catch (e: Exception) {
            JSONObject()
        }
        if (steps > history.optInt(date, 0)) history.put(date, steps)

        val dates = history.keys().asSequence().toList().sorted()
        dates.dropLast(HISTORY_MAX_DAYS).forEach { history.remove(it) }
        return history.toString()
    }

    private fun saveData() {
        prefs.edit()
            .putInt(KEY_TODAY_STEPS, todaySteps)
            .putLong(KEY_LAST_ACC, lastAccumulated)
            .putLong(KEY_LAST_ACC_ELAPSED, lastAccumulatedElapsed)
            .putLong(KEY_BOOT_TIMESTAMP, bootTimestamp)
            .putString(KEY_LAST_DATE, lastDate)
            .apply()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(NotificationManager::class.java) ?: return

            val normal = NotificationChannel(
                CHANNEL_ID,
                "Contador de pasos",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                setShowBadge(false)
                enableVibration(false)
                setSound(null, null)
                // PUBLIC = pedirle a Android que muestre el contenido en pantalla de
                // bloqueo. El sistema igual respeta la config. de privacidad del usuario
                // (p. ej. "ocultar contenido sensible") por encima de este valor.
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }

            val silent = NotificationChannel(
                CHANNEL_SILENT_ID,
                "Contador de pasos (silencioso)",
                NotificationManager.IMPORTANCE_MIN
            ).apply {
                setShowBadge(false)
                enableVibration(false)
                setSound(null, null)
                // SECRET a propósito: en modo silencioso no debe revelarse nada en lock screen.
                lockscreenVisibility = Notification.VISIBILITY_SECRET
            }

            nm.createNotificationChannel(normal)
            nm.createNotificationChannel(silent)
        }
    }

    private fun buildNotification(steps: Int): Notification {
        val isSilent = prefs.getBoolean(KEY_SILENT, false)
        val channelId = if (isSilent) CHANNEL_SILENT_ID else CHANNEL_ID

        val tapIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Se dispara si el usuario desliza/elimina la notificación manualmente.
        // Ver ACTION_NOTIF_DISMISSED en onStartCommand: repone solo si el switch
        // sigue en "visible" (KEY_SILENT=false).
        val deleteIntent = Intent(this, StepCounterService::class.java).apply {
            action = ACTION_NOTIF_DISMISSED
        }
        val deletePendingIntent = PendingIntent.getService(
            this, 0, deleteIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Notificación con el template ESTÁNDAR de Android (sin RemoteViews/vista
        // custom). Se probó un layout personalizado (ícono + texto en fila propia)
        // y dejó de mostrarse directamente en pantalla de bloqueo en MIUI — solo
        // aparecía al desplegar la bandeja completa. El sistema no siempre puede
        // inflar una RemoteViews custom en la superficie restringida del lock
        // screen y, quedando en blanco ahí, algunos fabricantes (Xiaomi incluido)
        // optan por no mostrar nada en lugar de mostrarla rota. El template
        // estándar lo renderiza el propio sistema, así que es la única forma de
        // garantizar que se vea igual en todos lados (bandeja y lock screen).
        return NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.mipmap.ic_launcher_foreground)
            .setContentTitle("New Life")
            .setContentText(formatSteps(steps))
            .setContentIntent(pendingIntent)
            .setDeleteIntent(deletePendingIntent)
            .setOngoing(true)
            .setSilent(true)
            .setOnlyAlertOnce(true)
            .setPriority(if (isSilent) NotificationCompat.PRIORITY_MIN else NotificationCompat.PRIORITY_LOW)
            // PUBLIC cuando el switch está activado (pide mostrar en lock screen —
            // Android igual respeta la privacidad del usuario por encima de esto).
            // SECRET en modo silencioso: no se revela nada.
            .setVisibility(if (isSilent) NotificationCompat.VISIBILITY_SECRET else NotificationCompat.VISIBILITY_PUBLIC)
            .build()
    }

    private fun formatSteps(steps: Int): String {
        return if (steps >= 1000) {
            val miles = steps / 1000
            val resto = steps % 1000
            "${miles}.${resto.toString().padStart(3, '0')} pasos"
        } else {
            "$steps pasos"
        }
    }

    private fun updateNotification(steps: Int) {
        getSystemService(NotificationManager::class.java)
            ?.notify(NOTIFICATION_ID, buildNotification(steps))
    }
}
