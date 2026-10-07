package com.newlife.app

import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
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
                .putExtra(GuardiaPasos.EXTRA_MOTIVO, "app")
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
            // A propósito: que la guardia no lo vuelva a arrancar.
            prefsPasos().edit().putBoolean(GuardiaPasos.KEY_DETENIDO, true).commit()
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
            val sensor = if (saved == today) prefs.getInt(StepCounterService.KEY_TODAY_STEPS, 0) else 0
            // Si el reloj contó más hoy (la persona caminó sin el celular), vale el
            // reloj; o solo el reloj, si eligió eso (mismo cálculo que el servicio).
            val reloj = if (prefs.getString(StepCounterService.KEY_RELOJ_FECHA, "") == today)
                prefs.getInt(StepCounterService.KEY_RELOJ_PASOS, 0) else 0
            promise.resolve(StepCounterService.pasosAMostrar(prefs, sensor, reloj))
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

    // Total final de un día ya cerrado que el servicio nativo todavía no confirmó
    // subido a Firestore (ver StepCounterService.stashPendingSync). Devuelve
    // null si no hay nada pendiente. Se consulta al abrir la app y desde la
    // tarea en background — ver src/services/backgroundStepsSync.js.
    @ReactMethod
    fun getPendingHistorySync(promise: Promise) {
        try {
            val prefs = reactApplicationContext
                .getSharedPreferences(StepCounterService.PREFS_NAME, Context.MODE_PRIVATE)
            val date  = prefs.getString(StepCounterService.KEY_PENDING_SYNC_DATE, null)
            val steps = prefs.getInt(StepCounterService.KEY_PENDING_SYNC_STEPS, 0)
            if (date.isNullOrEmpty() || steps <= 0) {
                promise.resolve(null)
            } else {
                val result = Arguments.createMap()
                result.putString("date", date)
                result.putInt("steps", steps)
                promise.resolve(result)
            }
        } catch (e: Exception) {
            promise.reject("ERR_GET_PENDING_SYNC", e.message)
        }
    }

    // Totales de los últimos días cerrados ({"YYYY-MM-DD": pasos}), ver
    // StepCounterService.historyWith. No hace falta "vaciarlo" después de
    // leerlo: la app acredita cada día de forma idempotente.
    @ReactMethod
    fun getStepHistory(promise: Promise) {
        try {
            val prefs = reactApplicationContext
                .getSharedPreferences(StepCounterService.PREFS_NAME, Context.MODE_PRIVATE)
            val json = org.json.JSONObject(
                prefs.getString(StepCounterService.KEY_DAILY_HISTORY, "{}") ?: "{}"
            )
            val result = Arguments.createMap()
            json.keys().forEach { date -> result.putInt(date, json.optInt(date, 0)) }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERR_GET_HISTORY", e.message)
        }
    }

    // Se llama después de subir con éxito el valor de getPendingHistorySync a
    // Firestore, para no volver a subir lo mismo la próxima vez.
    @ReactMethod
    fun clearPendingHistorySync(promise: Promise) {
        try {
            val prefs = reactApplicationContext
                .getSharedPreferences(StepCounterService.PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .remove(StepCounterService.KEY_PENDING_SYNC_DATE)
                .remove(StepCounterService.KEY_PENDING_SYNC_STEPS)
                .apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERR_CLEAR_PENDING_SYNC", e.message)
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

    // Sesión para que el servicio suba los pasos por su cuenta (PasosEnLaNube).
    @ReactMethod
    fun setSyncCredentials(uid: String, refreshToken: String, apiKey: String, projectId: String, promise: Promise) {
        try {
            PasosEnLaNube.guardarCredenciales(reactApplicationContext, uid, refreshToken, apiKey, projectId)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERR_SYNC_CREDS", e.message)
        }
    }

    @ReactMethod
    fun clearSyncCredentials(promise: Promise) {
        try {
            PasosEnLaNube.borrarCredenciales(reactApplicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERR_SYNC_CLEAR", e.message)
        }
    }

    // ── Reloj o pulsera (ver RelojSalud) ───────────────────────────────────────

    private fun prefsPasos() = reactApplicationContext
        .getSharedPreferences(StepCounterService.PREFS_NAME, Context.MODE_PRIVATE)

    // Cómo está la conexión con el reloj, para la pantalla "Reloj".
    @ReactMethod
    fun estadoReloj(promise: Promise) {
        try {
            val ctx = reactApplicationContext
            val p = prefsPasos()
            val hc = RelojSalud.estadoHC(ctx)
            val dados = if (hc == "ok") RelojSalud.permisosDados(ctx) else emptySet()
            val r = Arguments.createMap()
            r.putString("hc", hc)
            r.putBoolean("activa", p.getBoolean(StepCounterService.KEY_RELOJ_ACTIVO, false))
            r.putBoolean("permiso", dados.contains(RelojSalud.PERMISO_PASOS))
            r.putBoolean("fondoDisponible", hc == "ok" && RelojSalud.hayLecturaDeFondo(ctx))
            r.putBoolean("fondo", dados.contains(RelojSalud.PERMISO_FONDO))
            r.putInt("pasosHoy", if (p.getString(StepCounterService.KEY_RELOJ_FECHA, "") == todayString())
                p.getInt(StepCounterService.KEY_RELOJ_PASOS, 0) else 0)
            r.putDouble("ultimaLectura", p.getLong(StepCounterService.KEY_RELOJ_LECTURA, 0L).toDouble())
            val apps = Arguments.createArray()
            if (dados.contains(RelojSalud.PERMISO_PASOS)) RelojSalud.appsQueEscriben(ctx).forEach { apps.pushString(it) }
            r.putArray("apps", apps)
            r.putBoolean("soloReloj", p.getBoolean(StepCounterService.KEY_SOLO_RELOJ, false))
            promise.resolve(r)
        } catch (e: Exception) {
            promise.reject("ERR_RELOJ_ESTADO", e.message)
        }
    }

    // Interruptor "contar solo los pasos del reloj". La notificación se
    // actualiza enseguida con el número nuevo.
    @ReactMethod
    fun setSoloReloj(solo: Boolean, promise: Promise) {
        try {
            prefsPasos().edit().putBoolean(StepCounterService.KEY_SOLO_RELOJ, solo).apply()
            val ctx = reactApplicationContext
            val intent = Intent(ctx, StepCounterService::class.java).apply {
                action = StepCounterService.ACTION_UPDATE_NOTIF
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(intent)
            else ctx.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERR_SOLO_RELOJ", e.message)
        }
    }

    // Registro de la guardia del contador (ver GuardiaPasos), para subirlo a
    // actividad/{uid}: qué le pasó al contador y si la batería tiene
    // restricciones.
    @ReactMethod
    fun getRegistroPasos(promise: Promise) {
        try {
            val ctx = reactApplicationContext
            val r = Arguments.createMap()
            val eventos = Arguments.createArray()
            GuardiaPasos.registro(ctx).forEach { eventos.pushString(it) }
            r.putArray("eventos", eventos)
            r.putBoolean("bateriaSinRestricciones", GuardiaPasos.bateriaSinRestricciones(ctx))
            r.putBoolean("vivo", StepCounterService.vivo)
            promise.resolve(r)
        } catch (e: Exception) {
            promise.reject("ERR_REGISTRO", e.message)
        }
    }

    // Pide el permiso de Health Connect (leer pasos, y leerlos con la app
    // cerrada si el celular lo permite) y, si lo dan, activa la lectura.
    // Devuelve "ok", "negado", "sin_hc" o "actualizar".
    @ReactMethod
    fun conectarReloj(promise: Promise) {
        try {
            val ctx = reactApplicationContext
            val hc = RelojSalud.estadoHC(ctx)
            if (hc != "ok") { promise.resolve(hc); return }
            val pedir = RelojSalud.permisosAPedir(ctx)
            if (RelojSalud.permisosDados(ctx).containsAll(pedir)) {
                activarReloj()
                promise.resolve("ok")
                return
            }
            val act = ctx.currentActivity as? ComponentActivity
            if (act == null) { promise.reject("ERR_RELOJ", "La app no está abierta"); return }
            UiThreadUtil.runOnUiThread {
                try {
                    // Se registra en el momento (sin ciclo de vida) y se da de
                    // baja apenas vuelve la respuesta.
                    var lanzador: ActivityResultLauncher<Set<String>>? = null
                    lanzador = act.activityResultRegistry.register(
                        "nlg_reloj_" + System.nanoTime(),
                        PermissionController.createRequestPermissionResultContract()
                    ) { dados ->
                        lanzador?.unregister()
                        if (dados.contains(RelojSalud.PERMISO_PASOS)) {
                            activarReloj()
                            promise.resolve("ok")
                        } else {
                            promise.resolve("negado")
                        }
                    }
                    lanzador.launch(pedir)
                } catch (e: Exception) {
                    promise.reject("ERR_RELOJ", e.message)
                }
            }
        } catch (e: Exception) {
            promise.reject("ERR_RELOJ", e.message)
        }
    }

    // Deja de leer el reloj. Los pasos que ya pasó hoy se mantienen.
    @ReactMethod
    fun desconectarReloj(promise: Promise) {
        prefsPasos().edit().putBoolean(StepCounterService.KEY_RELOJ_ACTIVO, false).apply()
        promise.resolve(true)
    }

    // Lee el reloj ya (al volver a la pantalla, o después de sincronizar su app).
    @ReactMethod
    fun leerRelojAhora(promise: Promise) {
        try {
            if (prefsPasos().getBoolean(StepCounterService.KEY_RELOJ_ACTIVO, false)) avisarAlServicio()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERR_RELOJ", e.message)
        }
    }

    // Abre Health Connect (para revisar los permisos o ver qué apps le escriben).
    @ReactMethod
    fun abrirHealthConnect(promise: Promise) {
        try {
            val intent = Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERR_RELOJ", e.message)
        }
    }

    private fun activarReloj() {
        prefsPasos().edit().putBoolean(StepCounterService.KEY_RELOJ_ACTIVO, true).apply()
        avisarAlServicio()
    }

    // La app está abierta: se puede arrancar el servicio común (si no estaba
    // corriendo, se pone en primer plano solo al arrancar).
    private fun avisarAlServicio() {
        val ctx = reactApplicationContext
        val intent = Intent(ctx, StepCounterService::class.java).apply {
            action = StepCounterService.ACTION_LEER_RELOJ
        }
        try { ctx.startService(intent) } catch (e: Exception) {}
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
