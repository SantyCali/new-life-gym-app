package com.newlife.app

import android.content.Context
import android.util.Log
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectFeatures
import androidx.health.connect.client.feature.ExperimentalFeatureAvailabilityApi
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import kotlinx.coroutines.runBlocking
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.Period

// Pasos del reloj o la pulsera (Mi Band, Galaxy Watch, Fitbit, Amazfit…).
// El reloj no le habla a nuestra app: se los pasa a su app (Mi Fitness,
// Samsung Health, Fitbit…), y esa app los escribe en Health Connect, el lugar
// de Android donde las apps de salud comparten datos. Acá se leen de ahí.
//
// Se lee el total de Health Connect, que ya junta los pasos de todas las apps
// sin contar dos veces los mismos (si el celular y el reloj registraron la
// misma caminata, cuenta una). Lo usa StepCounterService cada 5 minutos: el
// día cuenta el mayor entre el sensor del celular y este total, nunca la suma.
object RelojSalud {
    private const val TAG = "NLGReloj"

    val PERMISO_PASOS: String = HealthPermission.getReadPermission(StepsRecord::class)
    const val PERMISO_FONDO = HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND

    // Nombres de las apps que más se usan con relojes, para la pantalla "Reloj".
    private val NOMBRES = mapOf(
        "com.mi.health" to "Mi Fitness",
        "com.xiaomi.wearable" to "Mi Fitness",
        "com.xiaomi.hm.health" to "Zepp Life",
        "com.huami.watch.hmwatchmanager" to "Zepp (Amazfit)",
        "com.sec.android.app.shealth" to "Samsung Health",
        "com.fitbit.FitbitMobile" to "Fitbit",
        "com.google.android.apps.fitness" to "Google Fit",
        "com.garmin.android.apps.connectmobile" to "Garmin Connect",
        "com.withings.wiscale2" to "Withings",
        "fi.polar.polarflow" to "Polar Flow",
        "com.suunto.app" to "Suunto",
        "com.coros.coros" to "COROS",
        "com.ouraring.oura" to "Oura",
        "com.whoop.android" to "WHOOP",
        "com.mobvoi.companion" to "Mobvoi",
        "android" to "Este celular",
        "com.google.android.apps.healthdata" to "Este celular",
    )

    // "ok", "sin_hc" (no está Health Connect) o "actualizar" (hay que actualizarlo).
    fun estadoHC(ctx: Context): String = when (HealthConnectClient.getSdkStatus(ctx)) {
        HealthConnectClient.SDK_AVAILABLE -> "ok"
        HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "actualizar"
        else -> "sin_hc"
    }

    private fun cliente(ctx: Context): HealthConnectClient? =
        if (estadoHC(ctx) == "ok") HealthConnectClient.getOrCreate(ctx) else null

    // Leer con la app cerrada necesita un permiso aparte, que no todos los
    // celulares tienen (Android 14+, o Health Connect actualizado).
    @OptIn(ExperimentalFeatureAvailabilityApi::class)
    fun hayLecturaDeFondo(ctx: Context): Boolean = try {
        cliente(ctx)?.features?.getFeatureStatus(
            HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_IN_BACKGROUND
        ) == HealthConnectFeatures.FEATURE_STATUS_AVAILABLE
    } catch (e: Exception) { false }

    fun permisosAPedir(ctx: Context): Set<String> =
        if (hayLecturaDeFondo(ctx)) setOf(PERMISO_PASOS, PERMISO_FONDO) else setOf(PERMISO_PASOS)

    fun permisosDados(ctx: Context): Set<String> {
        val c = cliente(ctx) ?: return emptySet()
        return try {
            runBlocking { c.permissionController.getGrantedPermissions() }
        } catch (e: Exception) { emptySet() }
    }

    // Pasos de Health Connect en un día (hasta ahora si es hoy). null si no se
    // pudo leer (sin permiso, sin Health Connect, app frenada en segundo plano).
    // Bloquea: llamarlo desde un hilo aparte.
    fun pasosDelDia(ctx: Context, dia: LocalDate): Int? {
        val c = cliente(ctx) ?: return null
        return try {
            val desde = dia.atStartOfDay()
            val hasta = minOf(dia.plusDays(1).atStartOfDay(), LocalDateTime.now())
            if (!hasta.isAfter(desde)) return 0
            val r = runBlocking {
                c.aggregate(AggregateRequest(
                    metrics = setOf(StepsRecord.COUNT_TOTAL),
                    timeRangeFilter = TimeRangeFilter.between(desde, hasta),
                ))
            }
            (r[StepsRecord.COUNT_TOTAL] ?: 0L).toInt()
        } catch (e: Exception) {
            Log.w(TAG, "no se pudieron leer los pasos del reloj", e)
            null
        }
    }

    // Pasos de los últimos días cerrados (sin hoy), como {"YYYY-MM-DD": pasos}.
    // Sirve para los pasos que el reloj pasa tarde (p. ej. se sincroniza a la
    // mañana con lo que caminaste ayer a la noche).
    fun pasosDeDiasAnteriores(ctx: Context, dias: Int): Map<String, Int> {
        val c = cliente(ctx) ?: return emptyMap()
        return try {
            val hoy = LocalDate.now()
            val r = runBlocking {
                c.aggregateGroupByPeriod(AggregateGroupByPeriodRequest(
                    metrics = setOf(StepsRecord.COUNT_TOTAL),
                    timeRangeFilter = TimeRangeFilter.between(
                        hoy.minusDays(dias.toLong()).atStartOfDay(), hoy.atStartOfDay()
                    ),
                    timeRangeSlicer = Period.ofDays(1),
                ))
            }
            r.mapNotNull { g ->
                val n = (g.result[StepsRecord.COUNT_TOTAL] ?: 0L).toInt()
                if (n > 0) g.startTime.toLocalDate().toString() to n else null
            }.toMap()
        } catch (e: Exception) {
            Log.w(TAG, "no se pudo leer el historial del reloj", e)
            emptyMap()
        }
    }

    // De qué apps llegaron pasos en los últimos 7 días (nombres para mostrar).
    // Solo para la pantalla "Reloj"; no se usa para contar.
    fun appsQueEscriben(ctx: Context): List<String> {
        val c = cliente(ctx) ?: return emptyList()
        return try {
            val hasta = LocalDateTime.now()
            val r = runBlocking {
                c.readRecords(ReadRecordsRequest(
                    recordType = StepsRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(hasta.minusDays(7), hasta),
                    pageSize = 5000,
                ))
            }
            r.records.map { it.metadata.dataOrigin.packageName }
                .filter { it != ctx.packageName }
                .map { NOMBRES[it] ?: it }
                .distinct()
        } catch (e: Exception) {
            emptyList()
        }
    }
}
