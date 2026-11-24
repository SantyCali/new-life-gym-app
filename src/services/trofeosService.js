// Trofeos de torneos, estilo PlayStation: 🥇 oro (1°), 🥈 plata (2°), 🥉
// bronce (3°) en cada torneo terminado con 2 jugadores o más (igual que los
// premios de XP), y 🏆 platino por cada 3 torneos ganados.
//
// Cada copa queda guardada en el perfil de la persona
// (users/{uid}/trofeos/{torneoId}), aparte del torneo: aunque después se borre
// el torneo, la copa queda. La guarda el celular que cierra el torneo (las del
// podio, ver finalizarTorneo) y, por las dudas, también el de cada ganador al
// abrir la app (ver actualizarMisTorneos). Reglas: firestore.rules, trofeos.
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../firebase';

export const VICTORIAS_POR_PLATINO = 3;
const trofeosCol = (uid) => collection(db, 'users', uid, 'trofeos');
const claveGuardados = (uid) => `trofeosGuardados_${uid}`;

// Puesto de uid en la tabla final ({ uid: { xp, gym } }). Empatados comparten
// el puesto. null si no jugó o si eran menos de 2.
export function puestoEnResultado(resultado, uid) {
  const filas = Object.entries(resultado ?? {}).map(([u, v]) => ({ u, xp: Number(v?.xp) || 0 }));
  if (filas.length < 2) return null;
  const mia = filas.find((f) => f.u === uid);
  if (!mia) return null;
  return 1 + filas.filter((f) => f.xp > mia.xp).length;
}

function copa(t, uid, puesto) {
  return {
    torneoId: t.id,
    nombre: t.nombre ?? 'Torneo',
    puesto,
    jugadores: Object.keys(t.resultado).length,
    xp: Number(t.resultado[uid]?.xp) || 0,
    soloPasos: !!t.soloPasos,
    fecha: t.fechaFin ?? null,
    guardadoEn: serverTimestamp(),
  };
}

// Al cerrar un torneo (o antes de borrarlo): las copas de los 3 del podio, en
// el perfil de cada uno. Las reglas lo permiten a cualquier participante de un
// torneo terminado, y solo si la copa todavía no existe (si ya la guardó el
// dueño, falla y está bien). t: { id, nombre, resultado, soloPasos, fechaFin }.
export async function guardarCopasDelPodio(t) {
  if (!t?.resultado) return;
  await Promise.all(Object.keys(t.resultado).map((uid) => {
    const puesto = puestoEnResultado(t.resultado, uid);
    if (!puesto || puesto > 3) return null;
    return setDoc(doc(trofeosCol(uid), t.id), copa(t, uid, puesto)).catch(() => {});
  }));
}

// torneos: los del usuario ({ id, ...datos }). Guarda las copas que falten.
export async function guardarMisTrofeos(uid, torneos) {
  if (!uid) return;
  let guardados = [];
  try { guardados = JSON.parse((await AsyncStorage.getItem(claveGuardados(uid))) ?? '[]'); } catch {}
  const nuevos = [];
  for (const t of torneos) {
    if (t.activo !== false || !t.resultado || guardados.includes(t.id)) continue;
    const puesto = puestoEnResultado(t.resultado, uid);
    if (!puesto || puesto > 3) continue;
    await setDoc(doc(trofeosCol(uid), t.id), copa(t, uid, puesto));
    nuevos.push(t.id);
  }
  if (nuevos.length) {
    await AsyncStorage.setItem(claveGuardados(uid), JSON.stringify([...guardados, ...nuevos])).catch(() => {});
  }
}

// Las copas guardadas, más nuevas primero, y los totales por tipo.
export function resumirTrofeos(lista) {
  const copas = [...lista].sort((a, b) => (b.fecha?.toMillis?.() ?? 0) - (a.fecha?.toMillis?.() ?? 0));
  const oro = copas.filter((c) => c.puesto === 1).length;
  const plata = copas.filter((c) => c.puesto === 2).length;
  const bronce = copas.filter((c) => c.puesto === 3).length;
  const platino = Math.floor(oro / VICTORIAS_POR_PLATINO);
  return { copas, oro, plata, bronce, platino, haciaPlatino: oro % VICTORIAS_POR_PLATINO };
}

export function subscribeTrofeos(uid, callback) {
  if (!uid) { callback([]); return () => {}; }
  return onSnapshot(trofeosCol(uid), (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => callback([]));
}
