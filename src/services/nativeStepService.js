import { NativeModules, Platform } from 'react-native';

const { NLGStepCounter } = NativeModules;

export const nativeServiceAvailable =
  Platform.OS === 'android' && !!NLGStepCounter;

// Le pasa la sesión al servicio de pasos para que suba los pasos a Firebase
// por su cuenta (modules/PasosEnLaNube.kt). Las versiones viejas del módulo
// nativo no tienen estos métodos: ahí no hace nada.
export async function darSesionAlServicio(uid, refreshToken, apiKey, projectId) {
  if (!nativeServiceAvailable || !NLGStepCounter.setSyncCredentials || !uid || !refreshToken) return;
  try { await NLGStepCounter.setSyncCredentials(uid, refreshToken, apiKey, projectId); } catch {}
}

export async function sacarSesionAlServicio() {
  if (!nativeServiceAvailable || !NLGStepCounter.clearSyncCredentials) return;
  try { await NLGStepCounter.clearSyncCredentials(); } catch {}
}

export async function startNativeStepService() {
  if (!nativeServiceAvailable) return false;
  try { return await NLGStepCounter.startService(); } catch { return false; }
}

export async function getNativeSteps() {
  if (!nativeServiceAvailable) return 0;
  try { return await NLGStepCounter.getSteps(); } catch { return 0; }
}

export async function stopNativeStepService() {
  if (!nativeServiceAvailable) return;
  try { await NLGStepCounter.stopService(); } catch {}
}

// Cambia la visibilidad de la notificación. El servicio sigue corriendo siempre.
// silent=true → canal IMPORTANCE_MIN (sin ícono en barra, sin lock screen)
// silent=false → canal IMPORTANCE_LOW (visible normal)
export async function setNotificationSilent(silent) {
  if (!nativeServiceAvailable) return;
  await NLGStepCounter.setNotificationSilent(silent);
}

export async function getNotificationSilent() {
  if (!nativeServiceAvailable) return false;
  try { return await NLGStepCounter.getNotificationSilent(); } catch { return false; }
}

// Total final de un día ya cerrado que el servicio nativo contó pero que
// todavía nadie subió a Firestore (p. ej. el usuario no abrió la app ese día
// y la tarea en background no llegó a correr antes de la medianoche).
// { date: 'YYYY-MM-DD', steps: number } o null si no hay nada pendiente.
export async function getPendingHistorySync() {
  if (!nativeServiceAvailable) return null;
  try { return await NLGStepCounter.getPendingHistorySync(); } catch { return null; }
}

// Totales de los últimos días cerrados: { 'YYYY-MM-DD': pasos }. En builds
// anteriores al historial el método no existe, y se cae al slot único
// de getPendingHistorySync para no perder ese día.
export async function getNativeStepHistory() {
  if (!nativeServiceAvailable) return {};
  try {
    if (typeof NLGStepCounter.getStepHistory === 'function') {
      return (await NLGStepCounter.getStepHistory()) ?? {};
    }
    const pending = await getPendingHistorySync();
    return pending?.date && pending.steps > 0 ? { [pending.date]: pending.steps } : {};
  } catch {
    return {};
  }
}

export async function clearPendingHistorySync() {
  if (!nativeServiceAvailable) return;
  try { await NLGStepCounter.clearPendingHistorySync(); } catch {}
}

// ── Reloj o pulsera (ver modules/RelojSalud.kt) ──────────────────────────────
// El reloj pasa los pasos a su app (Mi Fitness, Samsung Health, Fitbit…), esa
// app los escribe en Health Connect, y el servicio de pasos los lee de ahí
// cada 5 minutos (también con la app cerrada). Las builds anteriores no
// tienen estos métodos.
export const relojDisponible =
  nativeServiceAvailable && typeof NLGStepCounter?.conectarReloj === 'function';

// { hc: 'ok'|'sin_hc'|'actualizar', activa, permiso, fondo, fondoDisponible,
//   pasosHoy, ultimaLectura, apps: ['Mi Fitness', …] } o null.
export async function estadoReloj() {
  if (!relojDisponible) return null;
  try { return await NLGStepCounter.estadoReloj(); } catch { return null; }
}

// 'ok' | 'negado' | 'sin_hc' | 'actualizar' | 'error'
export async function conectarReloj() {
  if (!relojDisponible) return 'error';
  try { return await NLGStepCounter.conectarReloj(); } catch { return 'error'; }
}

export async function desconectarReloj() {
  if (!relojDisponible) return;
  try { await NLGStepCounter.desconectarReloj(); } catch {}
}

export async function leerRelojAhora() {
  if (!relojDisponible) return;
  try { await NLGStepCounter.leerRelojAhora(); } catch {}
}

export async function abrirHealthConnect() {
  if (!relojDisponible) return false;
  try { return await NLGStepCounter.abrirHealthConnect(); } catch { return false; }
}

// ── Solo los pasos del reloj (build 8 en adelante) ───────────────────────────
// Con el interruptor prendido, la app cuenta solo lo que pasa el reloj (no el
// sensor del celular). Las builds anteriores no lo tienen: ahí no se muestra.
export const soloRelojDisponible =
  relojDisponible && typeof NLGStepCounter?.setSoloReloj === 'function';

export async function setSoloReloj(solo) {
  if (!soloRelojDisponible) return;
  try { await NLGStepCounter.setSoloReloj(!!solo); } catch {}
}

// ── Registro del contador (ver modules/GuardiaPasos.kt) ──────────────────────
// { eventos: ['2026-10-07 13:42 arranco (alarma, parado 3 h 10 min)', …],
//   bateriaSinRestricciones, vivo } o null en builds anteriores.
export async function getRegistroPasos() {
  if (!nativeServiceAvailable || typeof NLGStepCounter?.getRegistroPasos !== 'function') return null;
  try { return await NLGStepCounter.getRegistroPasos(); } catch { return null; }
}
