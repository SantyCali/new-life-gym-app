package com.newlife.app

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

// Guardia del contador de pasos.
//
// Android a veces cierra la app entera (para liberar memoria, o por reglas del
// fabricante) y el contador se va con ella. Android intenta revivirlo solo,
// pero desde Android 12 no lo deja volver a la notificación fija desde segundo
// plano y queda muerto hasta que alguien abre la app: al otro día, 0 pasos.
//
// Por eso hay un "despertador": una alarma del sistema cada 15 minutos (sigue
// programada aunque la app esté cerrada) que se fija si el contador está vivo
// y, si no, lo vuelve a arrancar. Android deja arrancarlo así cuando la app
// tiene la batería "Sin restricciones". Si no lo deja, avisa con una
// notificación (como mucho cada 6 horas, y no de noche) para que la persona
// toque y siga contando.
//
// También lleva un registro de lo que le pasa al contador (cuándo arrancó, por
// qué, cuánto estuvo muerto, si algo falló). La app lo sube a actividad/{uid}
// para poder ver qué pasó sin tener el celular en la mano.
object GuardiaPasos {
    private const val CADA_MS          = 15 * 60_000L
    private const val PEDIDO_ALARMA    = 7101
    private const val KEY_REGISTRO     = "registroGuardia"
    private const val KEY_ULT_AVISO    = "guardiaUltAviso"
    const val KEY_DETENIDO             = "contadorDetenido"   // lo paró la app a propósito
    const val KEY_LATIDO               = "contadorLatido"     // última vez que se lo vio vivo (ms)
    const val EXTRA_MOTIVO             = "motivo"
    private const val MAX_REGISTRO     = 40
    private const val AVISO_CADA_MS    = 6 * 60 * 60_000L
    private const val CANAL_AVISO      = "nlg_contador_parado"
    private const val ID_AVISO         = 7002

    private fun prefs(ctx: Context) =
        ctx.getSharedPreferences(StepCounterService.PREFS_NAME, Context.MODE_PRIVATE)

    // Programa (o reprograma) el próximo despertador. Una sola alarma: cada
    // llamada reemplaza a la anterior.
    fun programar(ctx: Context, enMs: Long = CADA_MS) {
        try {
            val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val pi = PendingIntent.getBroadcast(
                ctx, PEDIDO_ALARMA, Intent(ctx, GuardiaReceiver::class.java),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val cuando = SystemClock.elapsedRealtime() + enMs
            // "AllowWhileIdle": suena aunque el celular esté quieto y con la
            // pantalla apagada (Android lo puede atrasar unos minutos).
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, cuando, pi)
            } else {
                am.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, cuando, pi)
            }
        } catch (e: Exception) {
            anotar(ctx, "alarma_error", e.javaClass.simpleName)
        }
    }

    // Arranca el contador. Devuelve false si Android no lo dejó.
    fun arrancar(ctx: Context, motivo: String): Boolean {
        val svc = Intent(ctx, StepCounterService::class.java).putExtra(EXTRA_MOTIVO, motivo)
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(svc)
            else ctx.startService(svc)
            true
        } catch (e: Exception) {
            // Android 12+: ForegroundServiceStartNotAllowedException si la app
            // no tiene la batería sin restricciones.
            anotar(ctx, "no_pudo_arrancar", "$motivo: ${e.javaClass.simpleName}")
            false
        }
    }

    fun bateriaSinRestricciones(ctx: Context): Boolean = try {
        val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
        Build.VERSION.SDK_INT < Build.VERSION_CODES.M || pm.isIgnoringBatteryOptimizations(ctx.packageName)
    } catch (e: Exception) { false }

    // Suena el despertador.
    fun revisar(ctx: Context) {
        programar(ctx)
        val p = prefs(ctx)
        if (StepCounterService.vivo || p.getBoolean(KEY_DETENIDO, false)) return
        if (!arrancar(ctx, "alarma")) avisarQueSeParo(ctx)
    }

    // "New Life dejó de contar tus pasos. Tocá para seguir." Solo si Android no
    // dejó revivirlo: tocar la notificación abre la app, y la app lo arranca.
    private fun avisarQueSeParo(ctx: Context) {
        val p = prefs(ctx)
        val ahora = System.currentTimeMillis()
        if (ahora - p.getLong(KEY_ULT_AVISO, 0L) < AVISO_CADA_MS) return
        val hora = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        if (hora < 8 || hora >= 22) return
        try {
            val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                nm.createNotificationChannel(NotificationChannel(
                    CANAL_AVISO, "Contador de pasos parado", NotificationManager.IMPORTANCE_DEFAULT
                ))
            }
            val abrir = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName) ?: return
            val pi = PendingIntent.getActivity(
                ctx, ID_AVISO, abrir, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            nm.notify(ID_AVISO, NotificationCompat.Builder(ctx, CANAL_AVISO)
                .setSmallIcon(R.mipmap.ic_launcher_foreground)
                .setContentTitle("New Life dejó de contar tus pasos")
                .setContentText("Tocá acá para que siga contando.")
                .setContentIntent(pi)
                .setAutoCancel(true)
                .build())
            p.edit().putLong(KEY_ULT_AVISO, ahora).apply()
            anotar(ctx, "aviso_parado", "")
        } catch (e: Exception) {
            anotar(ctx, "aviso_error", e.javaClass.simpleName)
        }
    }

    fun sacarAvisoDeParado(ctx: Context) {
        try { ctx.getSystemService(NotificationManager::class.java)?.cancel(ID_AVISO) } catch (_: Exception) {}
    }

    // ── Registro ────────────────────────────────────────────────────────────────

    fun anotar(ctx: Context, evento: String, detalle: String) {
        try {
            val p = prefs(ctx)
            val lista = try { JSONArray(p.getString(KEY_REGISTRO, "[]") ?: "[]") } catch (e: Exception) { JSONArray() }
            val hora = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US).format(Date())
            lista.put(if (detalle.isEmpty()) "$hora $evento" else "$hora $evento ($detalle)")
            val desde = (lista.length() - MAX_REGISTRO).coerceAtLeast(0)
            val corto = JSONArray()
            for (i in desde until lista.length()) corto.put(lista.getString(i))
            p.edit().putString(KEY_REGISTRO, corto.toString()).apply()
        } catch (_: Exception) {}
    }

    fun registro(ctx: Context): List<String> = try {
        val lista = JSONArray(prefs(ctx).getString(KEY_REGISTRO, "[]") ?: "[]")
        (0 until lista.length()).map { lista.getString(it) }
    } catch (e: Exception) { emptyList() }

    // "hace 3 h 20 min" para el registro.
    fun duracion(ms: Long): String {
        val min = ms / 60_000L
        return if (min < 60) "$min min" else "${min / 60} h ${min % 60} min"
    }
}

class GuardiaReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        GuardiaPasos.revisar(context)
    }
}
