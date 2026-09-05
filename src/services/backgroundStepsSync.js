// Tarea única en background que cubre todo lo que antes solo pasaba con la
// app abierta: sincroniza los pasos a Firestore (para que la pantalla de
// progreso del entrenador no dependa de que el cliente abra la app) y además
// detecta presencia en el gym (ver checkGymPresenceInBackground) para
// acreditar minutos/calorías/XP aunque el usuario nunca haya abierto la app
// durante la visita. El nombre del archivo quedó del sync de pasos original;
// el ID de la tarea (BACKGROUND_STEPS_TASK) ya está registrado en dispositivos
// existentes así que no se renombra.
//
// Android usa WorkManager por debajo (vía expo-background-task): el sistema
// operativo decide cuándo correr esto realmente, con un mínimo de 15 minutos
// entre ejecuciones. En fabricantes agresivos con batería (MIUI incluido) el
// usuario puede necesitar habilitar "inicio automático"/sin restricciones de
// batería para que el sistema lo deje correr con regularidad.
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import { Platform } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import {
  getNativeSteps, nativeServiceAvailable,
  getPendingHistorySync, clearPendingHistorySync,
} from './nativeStepService';
import { todayDateString } from './stepService';
import { saveStepsToFirebase } from './stepsFirebaseService';
import { checkGymPresenceInBackground } from './backgroundGymSync';

export const BACKGROUND_STEPS_TASK = 'nlg-background-steps-sync';

// Sube el total de un día ya cerrado que el servicio nativo guardó aparte
// porque nadie llegó a subirlo antes de que cambiara la fecha (ver
// StepCounterService.kt: stashPendingSync). Se llama tanto acá (tarea en
// background) como al abrir la app (StepContext), lo que ocurra primero.
export async function flushPendingHistorySync(uid) {
  if (!uid || !nativeServiceAvailable) return;
  try {
    const pending = await getPendingHistorySync();
    if (!pending?.date || !(pending.steps > 0)) return;
    await saveStepsToFirebase(uid, pending.date, pending.steps);
    await clearPendingHistorySync();
  } catch {}
}

// La sesión de Firebase Auth se restaura de forma asíncrona desde AsyncStorage
// al arrancar — en una tarea headless puede no estar lista todavía apenas se
// importa el módulo, así que se espera a que resuelva (con límite de tiempo).
function waitForAuthUser(timeoutMs = 5000) {
  return new Promise((resolve) => {
    if (auth.currentUser) { resolve(auth.currentUser); return; }
    let done = false;
    let unsub = () => {};
    const finish = (user) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      unsub();
      resolve(user);
    };
    const timer = setTimeout(() => finish(auth.currentUser), timeoutMs);
    unsub = onAuthStateChanged(auth, finish);
  });
}

// defineTask debe correr en el scope global (no dentro de un componente) para
// que el sistema operativo pueda invocar la tarea aunque la app esté cerrada.
TaskManager.defineTask(BACKGROUND_STEPS_TASK, async () => {
  try {
    if (Platform.OS !== 'android') {
      return BackgroundTask.BackgroundTaskResult.Success;
    }
    const user = await waitForAuthUser();
    if (!user?.uid) return BackgroundTask.BackgroundTaskResult.Success;

    // Presencia en el gym (entrada/salida + XP + minutos) — no depende del
    // módulo nativo de pasos, así que corre siempre que haya usuario.
    await checkGymPresenceInBackground(user.uid);

    if (nativeServiceAvailable) {
      await flushPendingHistorySync(user.uid);

      const steps = await getNativeSteps();
      if (steps > 0) {
        await saveStepsToFirebase(user.uid, todayDateString(), steps);
      }
    }
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

// Se llama una vez al iniciar la app (ver useSteps.js) — idempotente.
export async function registerBackgroundStepsSync() {
  if (Platform.OS !== 'android') return;
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_STEPS_TASK);
    if (!isRegistered) {
      await BackgroundTask.registerTaskAsync(BACKGROUND_STEPS_TASK, { minimumInterval: 15 });
    }
  } catch {}
}
