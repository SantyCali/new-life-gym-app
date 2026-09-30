import { NativeModules, Platform } from 'react-native';

const { NLGStepCounter } = NativeModules;

export const nativeServiceAvailable =
  Platform.OS === 'android' && !!NLGStepCounter;

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
