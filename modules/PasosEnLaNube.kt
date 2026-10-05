package com.newlife.app

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

// Sube los pasos a Firestore desde el propio servicio de pasos (StepCounterService),
// sin depender de la app ni de la tarea en segundo plano. La tarea de Android
// (WorkManager) la decide el sistema: en una app que casi no se abre puede
// correr cada varias horas, y el entrenador veía pasos viejos. El servicio de
// pasos, en cambio, está siempre activo (por eso tiene la notificación).
//
// Solo escribe users/{uid}/stepsHistory/{fecha} → { date, steps, actualizadoEn }
// (lo mismo que la app; las reglas lo permiten al dueño). Los puntos los sigue
// acreditando la app: se calculan con xpOtorgado, no con 'steps', así que subir
// los pasos antes no hace dar puntos de más ni de menos.
//
// Para hablar con Firebase usa la sesión del usuario: la app le pasa el uid y
// el refresh token al iniciar sesión (StepCounterModule.setSyncCredentials) y
// los borra al cerrarla. Se guardan en las preferencias privadas de la app,
// igual que los guarda el SDK de Firebase de la app.
object PasosEnLaNube {
    private const val TAG   = "NLGPasosNube"
    private const val PREFS = "NLGPasosNube"

    private const val CADA_PASOS     = 250          // sube cada 250 pasos nuevos...
    private const val CADA_MS        = 5 * 60_000L  // ...o cada 5 min si hubo pasos
    private const val ESPERA_MIN_MS  = 60_000L      // nunca más de una vez por minuto
    private const val TIMEOUT_MS     = 15_000
    private const val PUNTOS_CADA_MS = 5 * 60_000L  // cálculo de puntos: como mucho cada 5 min

    private val hilo    = Executors.newSingleThreadExecutor()
    private val ocupado = AtomicBoolean(false)

    private fun prefs(ctx: Context): SharedPreferences =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun guardarCredenciales(ctx: Context, uid: String, refresh: String, apiKey: String, proyecto: String) {
        val p = prefs(ctx)
        // Otra cuenta: se olvida lo subido por la anterior.
        if (p.getString("uid", null) != uid) p.edit().clear().apply()
        p.edit()
            .putString("uid", uid)
            .putString("refresh", refresh)
            .putString("apiKey", apiKey)
            .putString("proyecto", proyecto)
            .remove("idToken")
            .apply()
    }

    fun borrarCredenciales(ctx: Context) {
        prefs(ctx).edit().clear().apply()
    }

    // Se llama en cada cambio de pasos. Decide si toca subir (barato: solo lee
    // preferencias) y, si toca, sube en otro hilo.
    fun quizasSubir(ctx: Context, fecha: String, pasos: Int, forzar: Boolean = false) {
        if (pasos <= 0 || fecha.isEmpty()) return
        val app = ctx.applicationContext
        val p = prefs(app)
        val uid = p.getString("uid", null) ?: return
        val ahora = System.currentTimeMillis()
        if (!forzar) {
            if (ahora - p.getLong("ultIntento", 0L) < ESPERA_MIN_MS) return
            if (fecha == p.getString("ultFecha", "")) {
                val ultPasos = p.getInt("ultPasos", 0)
                if (pasos <= ultPasos) return
                if (pasos - ultPasos < CADA_PASOS && ahora - p.getLong("ultSubida", 0L) < CADA_MS) return
            }
        }
        if (!ocupado.compareAndSet(false, true)) return
        p.edit().putLong("ultIntento", ahora).apply()
        hilo.execute {
            try {
                if (subir(app, uid, fecha, pasos)) {
                    p.edit()
                        .putString("ultFecha", fecha)
                        .putInt("ultPasos", pasos)
                        .putLong("ultSubida", System.currentTimeMillis())
                        .apply()
                    pedirPuntos(app)
                }
            } catch (e: Exception) {
                Log.w(TAG, "no se pudo subir", e)
            } finally {
                ocupado.set(false)
            }
        }
    }

    // Después de subir pasos (o de que el reloj pase días anteriores):
    // acredita los puntos en JS (PuntosHeadlessService),
    // con la app cerrada. Android deja arrancarlo porque el servicio de pasos
    // está en primer plano.
    fun pedirPuntos(ctx: Context) {
        val p = prefs(ctx)
        val ahora = System.currentTimeMillis()
        if (ahora - p.getLong("ultPuntos", 0L) < PUNTOS_CADA_MS) return
        p.edit().putLong("ultPuntos", ahora).apply()
        try {
            ctx.startService(android.content.Intent(ctx, PuntosHeadlessService::class.java))
            com.facebook.react.HeadlessJsTaskService.acquireWakeLockNow(ctx)
        } catch (e: Exception) {
            Log.w(TAG, "no se pudo lanzar el cálculo de puntos", e)
        }
    }

    private fun subir(ctx: Context, uid: String, fecha: String, pasos: Int): Boolean {
        val p = prefs(ctx)
        val proyecto = p.getString("proyecto", null) ?: return false
        val token = tokenValido(ctx) ?: return false
        val base = "projects/$proyecto/databases/(default)/documents"
        val nombreDoc = "$base/users/$uid/stepsHistory/$fecha"
        val url = "https://firestore.googleapis.com/v1/$nombreDoc"

        // No pisar un total mayor (otro celular, o la app ya subió más).
        val (codigoLeer, actual) = pedir("GET", url, token, null)
        if (codigoLeer == 401 || codigoLeer == 403) { p.edit().remove("idToken").apply(); return false }
        if (codigoLeer == 200) {
            val steps = JSONObject(actual).optJSONObject("fields")?.optJSONObject("steps")
            val enLaNube = when {
                steps == null -> 0L
                steps.has("integerValue") -> steps.optString("integerValue").toLongOrNull() ?: 0L
                steps.has("doubleValue") -> steps.optDouble("doubleValue").toLong()
                else -> 0L
            }
            if (enLaNube >= pasos) return true
        }

        // :commit (es un POST de verdad: HttpURLConnection no hace PATCH, y
        // Firestore no acepta el override de método). updateMask: solo date y
        // steps; xpOtorgado, metaCumplida, etc. no se tocan. La hora la pone
        // el servidor (REQUEST_TIME), no el reloj del celular.
        val escritura = JSONObject()
            .put("update", JSONObject()
                .put("name", nombreDoc)
                .put("fields", JSONObject()
                    .put("date", JSONObject().put("stringValue", fecha))
                    .put("steps", JSONObject().put("integerValue", pasos.toString()))))
            .put("updateMask", JSONObject().put("fieldPaths", org.json.JSONArray().put("date").put("steps")))
            .put("updateTransforms", org.json.JSONArray().put(JSONObject()
                .put("fieldPath", "actualizadoEn")
                .put("setToServerValue", "REQUEST_TIME")))
        val cuerpo = JSONObject().put("writes", org.json.JSONArray().put(escritura))
        val (codigo, _) = pedir("POST", "https://firestore.googleapis.com/v1/$base:commit", token, cuerpo.toString())
        if (codigo == 401 || codigo == 403) p.edit().remove("idToken").apply()
        return codigo in 200..299
    }

    // ID token de Firebase (dura 1 hora). Se renueva con el refresh token.
    private fun tokenValido(ctx: Context): String? {
        val p = prefs(ctx)
        val guardado = p.getString("idToken", null)
        if (guardado != null && System.currentTimeMillis() < p.getLong("idVence", 0L) - 120_000L) return guardado

        val refresh = p.getString("refresh", null) ?: return null
        val apiKey  = p.getString("apiKey", null) ?: return null
        val form = "grant_type=refresh_token&refresh_token=" + URLEncoder.encode(refresh, "UTF-8")
        val (codigo, cuerpo) = pedirForm("https://securetoken.googleapis.com/v1/token?key=$apiKey", form)
        if (codigo != 200) {
            // Sesión vencida o cuenta borrada: no insistir hasta que la app la renueve.
            val motivo = try { JSONObject(cuerpo).optJSONObject("error")?.optString("message") ?: "" } catch (e: Exception) { "" }
            if (motivo in listOf("TOKEN_EXPIRED", "INVALID_REFRESH_TOKEN", "USER_DISABLED", "USER_NOT_FOUND")) {
                borrarCredenciales(ctx)
            }
            Log.w(TAG, "no se pudo renovar la sesión: $codigo $motivo")
            return null
        }
        val j = JSONObject(cuerpo)
        val nuevo = j.optString("id_token", "")
        if (nuevo.isEmpty()) return null
        val segundos = j.optString("expires_in", "3600").toLongOrNull() ?: 3600L
        p.edit()
            .putString("idToken", nuevo)
            .putLong("idVence", System.currentTimeMillis() + segundos * 1000L)
            .putString("refresh", j.optString("refresh_token", refresh))
            .apply()
        return nuevo
    }

    private fun pedir(metodo: String, url: String, token: String, cuerpo: String?): Pair<Int, String> {
        val con = URL(url).openConnection() as HttpURLConnection
        try {
            con.requestMethod = metodo
            con.connectTimeout = TIMEOUT_MS
            con.readTimeout = TIMEOUT_MS
            con.setRequestProperty("Authorization", "Bearer $token")
            if (cuerpo != null) {
                con.doOutput = true
                con.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                con.outputStream.use { it.write(cuerpo.toByteArray(Charsets.UTF_8)) }
            }
            return leer(con)
        } finally {
            con.disconnect()
        }
    }

    private fun pedirForm(url: String, form: String): Pair<Int, String> {
        val con = URL(url).openConnection() as HttpURLConnection
        try {
            con.requestMethod = "POST"
            con.connectTimeout = TIMEOUT_MS
            con.readTimeout = TIMEOUT_MS
            con.doOutput = true
            con.setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
            con.outputStream.use { it.write(form.toByteArray(Charsets.UTF_8)) }
            return leer(con)
        } finally {
            con.disconnect()
        }
    }

    private fun leer(con: HttpURLConnection): Pair<Int, String> {
        val codigo = con.responseCode
        val stream = if (codigo in 200..299) con.inputStream else con.errorStream
        val texto = stream?.bufferedReader()?.use { it.readText() } ?: ""
        return codigo to texto
    }

}
