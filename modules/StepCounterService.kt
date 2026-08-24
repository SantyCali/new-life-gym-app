package com.newlife.app

import android.app.*
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.ServiceInfo
import android.content.res.Configuration
import android.graphics.Color
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import java.util.Calendar

class StepCounterService : Service(), SensorEventListener {

    companion object {
        const val CHANNEL_ID        = "nlg_pasos"
        const val CHANNEL_SILENT_ID = "nlg_pasos_silencioso"
        const val NOTIFICATION_ID   = 7001
        const val PREFS_NAME        = "NLGStepCounter"
        const val KEY_TODAY_STEPS   = "todaySteps"
        const val KEY_LAST_ACC      = "lastAccumulated"
        const val KEY_LAST_DATE     = "lastDate"
        const val KEY_SILENT        = "silentNotification"
        const val KEY_GOAL          = "dailyGoal"
        const val ACTION_UPDATE_NOTIF = "NLG_UPDATE_NOTIFICATION"

        private const val DEFAULT_GOAL              = 10_000
        private const val SENSOR_WATCHDOG_TIMEOUT_MS = 90_000L
        private const val SENSOR_WATCHDOG_CHECK_MS   = 60_000L
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
        createNotificationChannels()
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "NLG::StepCounterWakeLock")
        wakeLock?.acquire()
    }

    @Suppress("DEPRECATION")
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_UPDATE_NOTIF) {
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
            return START_STICKY
        }

        loadSavedData()

        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIFICATION_ID, buildNotification(todaySteps), ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH)
        } else {
            startForeground(NOTIFICATION_ID, buildNotification(todaySteps))
        }

        stepSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL)
        }

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
                lockscreenVisibility = Notification.VISIBILITY_SECRET
            }

            val silent = NotificationChannel(
                CHANNEL_SILENT_ID,
                "Contador de pasos (silencioso)",
                NotificationManager.IMPORTANCE_MIN
            ).apply {
                setShowBadge(false)
                enableVibration(false)
                setSound(null, null)
                lockscreenVisibility = Notification.VISIBILITY_SECRET
            }

            nm.createNotificationChannel(normal)
            nm.createNotificationChannel(silent)
        }
    }

    private fun isDarkMode(): Boolean {
        val flags = resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
        return flags == Configuration.UI_MODE_NIGHT_YES
    }

    private fun buildNotification(steps: Int): Notification {
        val isSilent = prefs.getBoolean(KEY_SILENT, false)
        val channelId = if (isSilent) CHANNEL_SILENT_ID else CHANNEL_ID
        val goal = prefs.getInt(KEY_GOAL, DEFAULT_GOAL)

        val tapIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Layout personalizado: ícono arriba, anillo + pasos abajo
        val views = RemoteViews(packageName, R.layout.notification_steps)

        // Progreso del anillo (0–10000)
        val progress = (steps.toFloat() / goal * 10_000).toInt().coerceIn(0, 10_000)
        views.setProgressBar(R.id.notif_ring, 10_000, progress, false)

        // Texto del contador
        views.setTextViewText(R.id.notif_steps_text, formatSteps(steps))

        // Color del texto según tema del sistema
        val textColor = if (isDarkMode()) Color.WHITE else Color.BLACK
        views.setTextColor(R.id.notif_steps_text, textColor)

        return NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_menu_directions)
            .setContentTitle("New Life")
            .setContentText(formatSteps(steps))
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setSilent(true)
            .setPriority(if (isSilent) NotificationCompat.PRIORITY_MIN else NotificationCompat.PRIORITY_LOW)
            .setVisibility(NotificationCompat.VISIBILITY_SECRET)
            .setCustomContentView(views)
            .setStyle(NotificationCompat.DecoratedCustomViewStyle())
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
