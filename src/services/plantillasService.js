// Plantillas de rutina: rutinas modelo que arman los entrenadores (ej.
// "Principiante 3 días"). Los entrenadores las crean, modifican, publican y
// borran; las publicadas las ven los alumnos y las pueden usar como su rutina.
// Un entrenador también se la puede asignar a un alumno con un toque.
//
// plantillas/{id} = { nombre, dias, publicada, autorUid, autorNombre,
//                     creadoEn, actualizadoEn }
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp,
  setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getClientRoutine, saveRoutine } from './routineService';
import { cambiarARutina, huellaDias } from './misRutinasService';
import { guardarPerfil } from './perfilPrivadoService';

const COL = collection(db, 'plantillas');

const ordenar = (lista) => lista.sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es'));

// Entrenadores: todas (borradores y publicadas). Alumnos: solo las publicadas.
export function subscribePlantillas({ soloPublicadas }, onChange) {
  const q = soloPublicadas ? query(COL, where('publicada', '==', true)) : COL;
  return onSnapshot(q,
    (snap) => onChange(ordenar(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
    () => onChange([]));
}

export async function guardarPlantilla({ id, nombre, dias, autorUid, autorNombre }) {
  const datos = {
    nombre: (nombre ?? '').trim() || 'Rutina sin nombre',
    dias: dias ?? [],
    actualizadoEn: serverTimestamp(),
  };
  if (id) {
    await updateDoc(doc(db, 'plantillas', id), datos);
    return id;
  }
  const ref = await addDoc(COL, {
    ...datos,
    publicada: false, // se publica aparte, cuando esté lista
    autorUid,
    autorNombre: autorNombre ?? '',
    creadoEn: serverTimestamp(),
  });
  return ref.id;
}

export async function setPublicada(id, publicada) {
  await setDoc(doc(db, 'plantillas', id), { publicada, actualizadoEn: serverTimestamp() }, { merge: true });
}

export async function borrarPlantilla(id) {
  await deleteDoc(doc(db, 'plantillas', id));
}

// Copia los días de la plantilla a la rutina de alguien. Si ya tenía una, la
// reemplaza (mismo documento). quien: 'alumno' (la eligió él) o 'entrenador'
// (se la asignó un entrenador, que queda como su entrenador).
export async function usarPlantilla({ clienteUid, clienteNombre, plantilla, quien, entrenadorUid }) {
  // El alumno la elige él: la que tenía queda guardada en "Tus rutinas".
  if (quien === 'alumno') return cambiarARutina(clienteUid, { nombre: plantilla.nombre, dias: plantilla.dias }, { plantillaId: plantilla.id });
  const actual = await getClientRoutine(clienteUid).catch(() => null);
  const id = await saveRoutine({
    id: actual?.id,
    clienteId: clienteUid,
    entrenadorId: quien === 'entrenador' ? entrenadorUid : (actual?.entrenadorId ?? clienteUid),
    nombre: plantilla.nombre ?? (clienteNombre ? `Rutina de ${clienteNombre}` : 'Rutina'),
    dias: plantilla.dias ?? [],
    creadaPor: quien,
    extra: { plantillaId: plantilla.id ?? null, plantillaHuella: huellaDias(plantilla.dias) },
    editadaPor: quien,
  });
  // Rutina nueva: el alumno arranca en el día 1.
  await guardarPerfil(clienteUid, { gymRoutineDayIndex: 0 }).catch(() => {});
  return id;
}
