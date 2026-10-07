package com.newlife.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

// Arranca el contador de pasos solo:
//   - después de que el celular se reinicia (en Xiaomi/MIUI también con
//     QUICKBOOT_POWERON, el arranque rápido);
//   - después de que Play Store actualiza la app (la actualización cierra la
//     app y el contador se iba con ella hasta que alguien la abría).
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        val motivo = when (action) {
            Intent.ACTION_BOOT_COMPLETED,
            "android.intent.action.QUICKBOOT_POWERON",
            "com.htc.intent.action.QUICKBOOT_POWERON" -> "reinicio"
            Intent.ACTION_MY_PACKAGE_REPLACED -> "actualizacion"
            else -> return
        }
        val p = context.getSharedPreferences(StepCounterService.PREFS_NAME, Context.MODE_PRIVATE)
        if (p.getBoolean(GuardiaPasos.KEY_DETENIDO, false)) return
        GuardiaPasos.programar(context)
        GuardiaPasos.arrancar(context, motivo)
    }
}
