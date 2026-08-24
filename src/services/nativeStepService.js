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
  try { await NLGStepCounter.setNotificationSilent(silent); } catch {}
}

export async function getNotificationSilent() {
  if (!nativeServiceAvailable) return false;
  try { return await NLGStepCounter.getNotificationSilent(); } catch { return false; }
}
