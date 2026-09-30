// Rutinas guardadas de cada persona (users/{uid}/rutinasGuardadas): las que
// tenía antes de cambiar, o las que guardó a mano ("Rutina Cali"). Las ve solo
// el dueño, ni los entrenadores (ver firestore.rules). La rutina en uso sigue
// siendo la de routines/ (la que ve el entrenador).
import {
  addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getClientRoutine, saveRoutine } from './routineService';
import { guardarPerfil } from './perfilPrivadoService';

const col = (uid) => collection(db, 'users', uid, 'rutinasGuardadas');

// JSON con las claves ordenadas: Firestore devuelve los campos en otro orden
// que el guardado, y comparar el JSON común daba "distintas" dos rutinas
// iguales (por eso se duplicaban en "Tus rutinas").
function estable(v) {
  if (Array.isArray(v)) return v.map(estable);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, estable(v[k])]));
  return v;
}
export const huellaDias = (dias) => JSON.stringify(estable(dias ?? []));
const huella = (r) => JSON.stringify({ n: (r.nombre ?? '').trim(), d: estable(r.dias ?? []) });
const tieneEjercicios = (r) => (r?.dias ?? []).some((d) => (d.ejercicios?.length ?? 0) > 0);

export function subscribeMisRutinas(uid, onChange) {
  if (!uid) { onChange([]); return () => {}; }
  return onSnapshot(query(col(uid), orderBy('guardadaEn', 'desc')),
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => onChange([]));
}

// Guarda una copia. Si ya hay una igual (mismo nombre y mismos días), no la
// duplica. Devuelve true si guardó.
export async function guardarMiRutina(uid, { nombre, dias }) {
  if (!uid || !tieneEjercicios({ dias })) return false;
  const nueva = { nombre: (nombre ?? '').trim() || 'Mi rutina', dias: dias ?? [] };
  const existentes = await getDocs(col(uid)).catch(() => null);
  if (existentes?.docs.some((d) => huella(d.data()) === huella(nueva))) return false;
  await addDoc(col(uid), { ...nueva, guardadaEn: serverTimestamp() });
  return true;
}

export async function borrarMiRutina(uid, id) {
  await deleteDoc(doc(db, 'users', uid, 'rutinasGuardadas', id));
}

// Pasa a usar otra rutina (una guardada o una del gym). La que estaba usando
// se guarda antes, así no se pierde; salvo que sea una del gym sin cambios
// (ya está en la lista del gym). Arranca en el día 1.
export async function cambiarARutina(uid, { nombre, dias }, { plantillaId = null } = {}) {
  const actual = await getClientRoutine(uid).catch(() => null);
  const delGymSinCambios = !!actual?.plantillaId && actual.plantillaHuella === huellaDias(actual.dias);
  if (tieneEjercicios(actual) && !delGymSinCambios) {
    await guardarMiRutina(uid, { nombre: actual.nombre, dias: actual.dias }).catch(() => {});
  }
  const id = await saveRoutine({
    id: actual?.id,
    clienteId: uid,
    entrenadorId: actual?.entrenadorId ?? uid,
    nombre: (nombre ?? '').trim() || 'Mi rutina',
    dias: dias ?? [],
    creadaPor: 'alumno',
    editadaPor: 'alumno',
    extra: { plantillaId, plantillaHuella: plantillaId ? huellaDias(dias) : null },
  });
  await guardarPerfil(uid, { gymRoutineDayIndex: 0 }).catch(() => {});
  return id;
}
