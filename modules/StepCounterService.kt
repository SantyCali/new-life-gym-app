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
import androidx.core.app.NotificationCompat
import java.util.Calendar

class StepCounterService : Service(), SensorEventListener {

    companion object {
        const val CHANNEL_ID       = "nlg_pasos"
        const val NOTIFICATION_ID  = 7001
        const val PREFS_NAME       = "NLGStepCounter"
        const val KEY_TODAY_STEPS  = "todaySteps"
        const val KEY_LAST_ACC     = "lastAccumulated"
        const val KEY_LAST_DATE    = "lastDate"
        // Tiempo sin evento de sensor antes de re-registrar el listener (90s)
        private const val SENSOR_WATCHDOG_TIMEOUT_MS = 90_000L
        private const val SENSOR_WATCHDOG_CHECK_MS   = 60_000L
    }

    private lateinit var sensorManager: SensorManager
    private var stepSensor: Sensor? = null
    private lateinit var prefs: SharedPreferences
    private var wakeLock: PowerManager.WakeLock? = null
    private val handler = Handler(Looper.getMainLooper())
    private var lastSensorEventMs = 0L

    private var todaySteps: Int    = 0
    private var lastAccumulated: Long = 0L
    private var lastDate: String   = ""

    // Watchdog: si el sensor deja de enviar datos, lo re-registramos.
    // En MIUI el sensor puede "congelarse" cuando el sistema agresivo de batería
    // suspende el proceso. Re-registrar el listener lo despierta.
    private val sensorWatchdog = object : Runnable {
        override fun run() {
            val elapsed = System.currentTimeMillis() - lastSensorEventMs
            if (lastSensorEventMs > 0L && elapsed > SENSOR_WATCHDOG_TIMEOUT_MS) {
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
        createNotificationChannel()
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

        // WakeLock PARTIAL: mantiene la CPU activa para que el sensor no se congele
        // en MIUI/Xiaomi aunque la pantalla esté apagada.
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "NLG::StepCounterWakeLock"
        )
        wakeLock?.acquire()
    }

    @Suppress("DEPRECATION")
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        loadSavedData()

        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(
                NOTIFICATION_ID,
                buildNotification(todaySteps),
                ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH
            )
        } else {
            startForeground(NOTIFICATION_ID, buildNotification(todaySteps))
        }

        stepSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL)
        }

        // Iniciar watchdog
        handler.removeCallbacks(sensorWatchdog)
        handler.postDelayed(sensorWatchdog, SENSOR_WATCHDOG_CHECK_MS)

        return START_STICKY
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
        lastSensorEventMs = System.currentTimeMillis()
        val today = todayString()

        when {
            today != lastDate -> {
                todaySteps      = 0
                lastDate        = today
                lastAccumulated = accumulated
            }
            lastAccumulated == 0L -> {
                lastAccumulated = accumulated
            }
            accumulated < lastAccumulated -> {
                todaySteps      += accumulated.toInt()
                lastAccumulated  = accumulated
            }
            else -> {
                todaySteps      += (accumulated - lastAccumulated).toInt()
                lastAccumulated  = accumulated
            }
        }

        saveData()
        updateNotification(todaySteps)
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
            todaySteps      = prefs.getInt(KEY_TODAY_STEPS, 0)
            lastAccumulated = prefs.getLong(KEY_LAST_ACC, 0L)
            lastDate        = today
        } else {
            todaySteps      = 0
            lastAccumulated = 0L
            lastDate        = today
        }
    }

    private fun saveData() {
        prefs.edit()
            .putInt(KEY_TODAY_STEPS, todaySteps)
            .putLong(KEY_LAST_ACC, lastAccumulated)
            .putString(KEY_LAST_DATE, lastDate)
            .apply()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Contador de pasos",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Muestra tus pasos diarios en tiempo real"
                setShowBadge(false)
                enableVibration(false)
                setSound(null, null)
                // No mostrar en pantalla de bloqueo como notificación expandida
                lockscreenVisibility = Notification.VISIBILITY_SECRET
            }
            getSystemService(NotificationManager::class.java)
                ?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(steps: Int): Notification {
        val tapIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("New Life · Pasos hoy")
            .setContentText(formatSteps(steps))
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setVisibility(NotificationCompat.VISIBILITY_SECRET)
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
