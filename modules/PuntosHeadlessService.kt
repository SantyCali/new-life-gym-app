package com.newlife.app

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

// Corre en JS la acreditación de puntos (nivel, racha, torneos) aunque la app
// esté cerrada. Lo dispara PasosEnLaNube después de subir pasos, como mucho
// cada 5 minutos. La tarea JS se registra en index.js
// ("NLGPuntosEnSegundoPlano") y usa la misma lógica que la app abierta
// (sincronizarPasosYPuntos), así los puntos dan siempre lo mismo.
class PuntosHeadlessService : HeadlessJsTaskService() {
    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig =
        HeadlessJsTaskConfig(
            "NLGPuntosEnSegundoPlano",
            Arguments.createMap(),
            60_000L, // si tarda más de 1 minuto se corta
            true,    // también si la app está abierta (no hace daño: es idempotente)
        )
}
