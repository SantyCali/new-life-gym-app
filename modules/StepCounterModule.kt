package com.newlife.app

import android.content.Context
import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.*
import java.util.Calendar

class StepCounterModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "NLGStepCounter"

    @ReactMethod
    fun startService(promise: Promise) {
        try {
            val ctx    = reactApplicationContext
            val intent = Intent(ctx, StepCounterService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent)
            } else {
                ctx.startService(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERR_START", e.message)
        }
    }

    @ReactMethod
    fun stopService(promise: Promise) {
        try {
            val ctx    = reactApplicationContext
            val intent = Intent(ctx, StepCounterService::class.java)
            ctx.stopService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERR_STOP", e.message)
        }
    }

    @ReactMethod
    fun getSteps(promise: Promise) {
        try {
            val prefs  = reactApplicationContext
                .getSharedPreferences(StepCounterService.PREFS_NAME, Context.MODE_PRIVATE)
            val today  = todayString()
            val saved  = prefs.getString(StepCounterService.KEY_LAST_DATE, "") ?: ""
            val steps  = if (saved == today) prefs.getInt(StepCounterService.KEY_TODAY_STEPS, 0) else 0
            promise.resolve(steps)
        } catch (e: Exception) {
            promise.reject("ERR_GET", e.message)
        }
    }

    // Cambia el canal de notificación: silent=true → IMPORTANCE_MIN (sin ícono en barra)
    // El servicio sigue corriendo y los pasos siguen contando.
    @ReactMethod
    fun setNotificationSilent(silent: Boolean, promise: Promise) {
        try {
            val ctx   = reactApplicationContext
            val prefs = ctx.getSharedPreferences(StepCounterService.PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putBoolean(StepCounterService.KEY_SILENT, silent).apply()

            // Enviar acción al servicio en ejecución para que actualice la notificación
            val intent = Intent(ctx, StepCounterService::class.java).apply {
                action = StepCounterService.ACTION_UPDATE_NOTIF
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent)
            } else {
                ctx.startService(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERR_SET_SILENT", e.message)
        }
    }

    // Lee el valor actual de la preferencia silenciosa desde SharedPreferences
    @ReactMethod
    fun getNotificationSilent(promise: Promise) {
        try {
            val prefs  = reactApplicationContext
                .getSharedPreferences(StepCounterService.PREFS_NAME, Context.MODE_PRIVATE)
            val silent = prefs.getBoolean(StepCounterService.KEY_SILENT, false)
            promise.resolve(silent)
        } catch (e: Exception) {
            promise.reject("ERR_GET_SILENT", e.message)
        }
    }

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}

    private fun todayString(): String {
        val c = Calendar.getInstance()
        val y = c.get(Calendar.YEAR)
        val m = (c.get(Calendar.MONTH) + 1).toString().padStart(2, '0')
        val d = c.get(Calendar.DAY_OF_MONTH).toString().padStart(2, '0')
        return "$y-$m-$d"
    }
}
