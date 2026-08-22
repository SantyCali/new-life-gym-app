package com.newlife.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

// Reinicia el servicio de pasos automáticamente después de que el dispositivo se reinicia.
// En Xiaomi/MIUI también escucha QUICKBOOT_POWERON (arranque rápido).
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action == Intent.ACTION_BOOT_COMPLETED ||
            action == "android.intent.action.QUICKBOOT_POWERON" ||
            action == "com.htc.intent.action.QUICKBOOT_POWERON"
        ) {
            val svc = Intent(context, StepCounterService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(svc)
            } else {
                context.startService(svc)
            }
        }
    }
}
