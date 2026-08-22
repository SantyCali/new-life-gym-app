import { NativeModules, Platform } from 'react-native';

const { NLGStepCounter } = NativeModules;

// true solo en Android con el Foreground Service compilado
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
