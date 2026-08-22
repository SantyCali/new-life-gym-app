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
import android.os.IBinder
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
    }

    private lateinit var sensorManager: SensorManager
    private var stepSensor: Sensor? = null
    private lateinit var prefs: SharedPreferences

    private var todaySteps: Int   = 0
    private var lastAccumulated: Long = 0L
    private var lastDate: String  = ""

    // ── Lifecycle ───────────────────────────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()
        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        createNotificationChannel()
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
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

        return START_STICKY
    }

    override fun onDestroy() {
        sensorManager.unregisterListener(this)
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // ── Sensor callbacks ────────────────────────────────────────────────────────

    override fun onSensorChanged(event: SensorEvent?) {
        val accumulated = event?.values?.get(0)?.toLong() ?: return
        val today = todayString()

        when {
            today != lastDate -> {
                // Midnight rolled over — start fresh for new day
                todaySteps      = 0
                lastDate        = today
                lastAccumulated = accumulated
            }
            lastAccumulated == 0L -> {
                // First ever reading — use as baseline, don't add steps
                lastAccumulated = accumulated
            }
            accumulated < lastAccumulated -> {
                // Device rebooted, counter reset from somewhere above us
                todaySteps      += accumulated.toInt()
                lastAccumulated  = accumulated
            }
            else -> {
                // Normal delta
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
            // New day — reset (keep lastAccumulated unknown; first callback sets baseline)
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
            .setContentTitle("New Life")
            .setContentText("$steps pasos hoy")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    private fun updateNotification(steps: Int) {
        getSystemService(NotificationManager::class.java)
            ?.notify(NOTIFICATION_ID, buildNotification(steps))
    }
}
