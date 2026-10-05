// Tarea en segundo plano que hace, con la app cerrada, todo lo que antes solo
// pasaba con la app abierta: subir los pasos, acreditar sus puntos (que son los
// que cuentan para los torneos), cortar la racha si se rompió y, en Android,
// detectar la presencia en el gym (ver checkGymPresenceInBackground).
//
// Quién decide cuándo corre es el sistema operativo:
// - Android (WorkManager): cada 15 min como mínimo. En fabricantes agresivos
//   con la batería (Xiaomi/MIUI, por ejemplo) hay que dejar la app "sin
//   restricciones" para que corra con regularidad.
// - iOS (BGTaskScheduler): mucho menos seguido y sin horario garantizado,
//   típicamente de noche o mientras se carga el celular. Como el sensor del
//   iPhone guarda 7 días de pasos, cada vez que corre recupera todos los días
//   que falten, así que los puntos no se pierden aunque tarde.
//
// El nombre del archivo y el ID de la tarea quedaron del sync de pasos original;
// el ID ya está registrado en dispositivos existentes, así que no se renombra.
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import { Platform } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import {
  getNativeSteps, nativeServiceAvailable, getNativeStepHistory,
  getPendingHistorySync, clearPendingHistorySync,
} from './nativeStepService';
import {
  todayDateString, localDateString, getStepsForDate, getStepsSinceMidnight, isPedometerAvailable,
} from './stepService';
import { acreditarDias } from './stepRewardsService';
import { cortarRachaSiSeRompio } from './gamificationService';
import { actualizarMisTorneos } from './torneoService';
import { revisarAvisosDeTorneos } from './avisoTorneoService';
import { checkGymPresenceInBackground } from './backgroundGymSync';
import { programarAvisosDeCuota } from './avisoCuotaService';
import { leerPrivado } from './perfilPrivadoService';
import { doc, getDoc } from 'firebase/firestore';
import { acreditarVisitasGym } from './visitasGymService';
import { avisarSiEstaCerca } from './avisoMetaService';

export const BACKGROUND_STEPS_TASK = 'nlg-background-steps-sync';

// Días que se revisan hacia atrás: 30, para que nadie pierda pasos aunque no
// abra la app en semanas. En iPhone, Salud guarda todo el historial (el
// sensor solo 7 días: getStepsForDate toma el mayor de los dos). En Android
// el servicio nativo guarda los últimos 30 días.
const DIAS_ATRAS = 30;

// Pasos de hoy y de los días anteriores disponibles en este celular, como
// { 'YYYY-MM-DD': pasos }. Lo usan la tarea en segundo plano y StepContext al
// abrir la app, así las dos vías acreditan exactamente lo mismo.
export async function leerPasosDelCelular() {
  const hoy = todayDateString();
  const pasos = {};

  if (Platform.OS === 'android' && nativeServiceAvailable) {
    Object.assign(pasos, await getNativeStepHistory());
    const pendiente = await getPendingHistorySync();
    if (pendiente?.date && pendiente.steps > (pasos[pendiente.date] ?? 0)) {
      pasos[pendiente.date] = pendiente.steps;
    }
    pasos[hoy] = await getNativeSteps();
  } else if (Platform.OS === 'ios' && (await isPedometerAvailable())) {
    for (let i = DIAS_ATRAS; i >= 1; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const n = await getStepsForDate(d);
      if (n > 0) pasos[localDateString(d)] = n;
    }
    try { pasos[hoy] = await getStepsSinceMidnight(); } catch {}
  }

  for (const f of Object.keys(pasos)) if (!(pasos[f] > 0)) delete pasos[f];
  return pasos;
}

// Sube los pasos del celular y acredita sus puntos. Idempotente: se puede
// llamar las veces que sea (ver stepRewardsService).
export async function sincronizarPasosYPuntos(uid) {
  if (!uid) return;
  const pasos = await leerPasosDelCelular();
  await acreditarDias(uid, pasos);

  // El slot viejo de Android ya quedó dentro del historial acreditado.
  if (Platform.OS === 'android' && nativeServiceAvailable) {
    await clearPendingHistorySync();
  }
  await cortarRachaSiSeRompio(uid);
  // Visitas al gym de los últimos 30 días que no se hayan acreditado (aunque
  // la app haya estado cerrada mientras estaba en sala).
  try {
    const pub = await getDoc(doc(db, 'users', uid));
    // Aviso "estás muy cerca de tu meta" (80%), una vez por día.
    const hoy = todayDateString();
    await avisarSiEstaCerca(uid, hoy, pasos[hoy] ?? 0, pub.data()?.dailyStepGoal ?? 10000, pub.data()?.rol).catch(() => {});
    const { gymDni } = await leerPrivado(uid, pub.exists() ? pub.data() : {});
    await acreditarVisitasGym(uid, gymDni);
  } catch {}
  // Foto de sus puntos en los torneos en curso (ver torneoService).
  await actualizarMisTorneos(uid).catch(() => {});
  // Avisos de torneos (te sumaron / terminó), también con la app cerrada.
  await revisarAvisosDeTorneos(uid).catch(() => {});
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
// Lo mismo que la tarea de segundo plano, para llamarlo desde otros lados
// (servicio de pasos de Android, aviso de Salud en iPhone).
let enCurso = null;
export function sincronizarEnSegundoPlano() {
  // Si ya hay una corriendo (tarea + aviso juntos), no se larga otra.
  if (!enCurso) enCurso = sincronizarAhora().finally(() => { enCurso = null; });
  return enCurso;
}

async function sincronizarAhora() {
  const user = await waitForAuthUser();
  if (!user?.uid) return;
  await sincronizarPasosYPuntos(user.uid);
}

TaskManager.defineTask(BACKGROUND_STEPS_TASK, async () => {
  try {
    const user = await waitForAuthUser();
    if (!user?.uid) return BackgroundTask.BackgroundTaskResult.Success;

    // Presencia en el gym (entrada/salida + XP + minutos): solo Android, que
    // es donde la tarea corre con la frecuencia suficiente para detectarla.
    if (Platform.OS === 'android') {
      await checkGymPresenceInBackground(user.uid);
    }

    await sincronizarPasosYPuntos(user.uid);

    // Aviso de cuota: si renovó sin abrir la app, se corre a la fecha nueva.
    try {
      const pub = await getDoc(doc(db, 'users', user.uid));
      const { gymDni } = await leerPrivado(user.uid, pub.exists() ? pub.data() : {});
      await programarAvisosDeCuota(gymDni);
    } catch {}
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

// Se llama una vez al iniciar la app (ver useSteps.js) — idempotente.
export async function registerBackgroundStepsSync() {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_STEPS_TASK);
    if (!isRegistered) {
      await BackgroundTask.registerTaskAsync(BACKGROUND_STEPS_TASK, { minimumInterval: 15 });
    }
  } catch {}
}
