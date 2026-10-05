// Detecta entrada/salida del gym y acredita los minutos + XP de la visita
// aunque la app esté completamente cerrada. Replica la misma lógica que
// GymEventsContext.js (que solo corre con la app abierta, vía un listener de
// Firestore en vivo) pero como chequeo puntual, invocado desde la tarea en
// background (ver backgroundStepsSync.js) cada vez que el sistema operativo
// decide ejecutarla.
//
// El estado de "sesión en curso" (hora de entrada) no puede vivir en memoria
// como en la versión en vivo (gymEntryTimeRef) porque cada corrida de la tarea
// es un proceso headless nuevo — se persiste en AsyncStorage entre corridas.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getUserPresenceOnce, ACTIVE_MS, TOPE_MINUTOS_GYM } from './gymService';
import { checkAndAwardGymReward } from './gamificationService';
import { leerPrivado } from './perfilPrivadoService';

const sessionKey = (uid) => `gymBgSessionEntryMs_${uid}`;
// Ninguna visita real al gym dura más que esto — cota de seguridad para no
// convertir una sesión vieja/huérfana en una entrada de minutos absurda.
const MAX_SESSION_MS = 4 * 60 * 60 * 1000; // 4 horas

function todayLocalDateString(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function checkGymPresenceInBackground(uid) {
  if (!uid) return;
  try {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (!userSnap.exists()) return;
    const { gymDni } = await leerPrivado(uid, userSnap.data());
    if (!gymDni) return;

    const { present, latestCheckinMs } = await getUserPresenceOnce(gymDni);
    const storedRaw = await AsyncStorage.getItem(sessionKey(uid));
    const storedEntryMs = storedRaw ? parseInt(storedRaw, 10) : 0;

    if (present) {
      if (!storedEntryMs) {
        // Entrada detectada que la app no vio en vivo: arranca la sesión usando
        // el horario real del check-in (no "ahora", que ya puede ser bastante
        // más tarde si el sistema tardó en ejecutar esta tarea).
        await AsyncStorage.setItem(sessionKey(uid), String(latestCheckinMs || Date.now()));
        try { await checkAndAwardGymReward(uid); } catch {}
      }
      // Sigue presente: no hay nada más que hacer hasta que se detecte la salida.
      return;
    }

    if (!storedEntryMs) return; // no había sesión abierta, nada que cerrar

    const now = Date.now();
    // getUserPresenceOnce no filtra por fecha: latestCheckinMs es el check-in
    // más reciente de ESE dni en TODA la historia, sea de hoy o de hace
    // semanas. Si la sesión guardada quedó vieja (p.ej. la app abierta ya
    // procesó la salida real en vivo y esta tarea nunca llegó a limpiar el
    // flag), no hay que combinarla con un check-in viejo no relacionado —
    // se descarta sin escribir nada en vez de inventar minutos.
    if (now - storedEntryMs > MAX_SESSION_MS) {
      await AsyncStorage.removeItem(sessionKey(uid));
      return;
    }

    // Salida real: el fin de sesión se acota al último check-in + ACTIVE_MS
    // (nunca a "ahora"), igual que en GymEventsContext.js, para no inflar los
    // minutos si esta tarea recién corre mucho después de que la persona ya
    // se fue. Solo se usa si ese check-in es posterior a la propia entrada
    // guardada (si no, es de una visita anterior y no dice nada de esta).
    // Sin un check-in posterior, la sesión dura como mucho lo que dura un
    // ingreso en sala (ACTIVE_MS) desde la entrada: antes se tomaba "ahora",
    // y si la tarea corría horas después daba 200 o 375 minutos de gym (y
    // 1500 o 2900 kcal) en un día de 90.
    const presenceEnd = (latestCheckinMs && latestCheckinMs > storedEntryMs)
      ? Math.min(now, latestCheckinMs + ACTIVE_MS)
      : Math.min(now, storedEntryMs + ACTIVE_MS);
    const minutes = Math.max(1, Math.min(
      Math.round((presenceEnd - storedEntryMs) / 60000),
      MAX_SESSION_MS / 60000,
      TOPE_MINUTOS_GYM,
    ));
    // El día es el de la entrada: si la salida se detecta recién al día
    // siguiente, los minutos no van a ese otro día (el torneo lo contaba
    // como una visita que no existió).
    const dia = todayLocalDateString(new Date(storedEntryMs));

    await updateDoc(doc(db, 'users', uid), { gymTodayDate: dia, gymTodayMinutes: minutes });
    await setDoc(doc(db, 'users', uid, 'gymHistory', dia), { date: dia, minutes });
    await AsyncStorage.removeItem(sessionKey(uid));
  } catch {}
}
