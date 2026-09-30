import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  onSnapshot,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase';

const ROUTINES_COL = 'routines';
const LOGS_COL     = 'workoutLogs';

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Routines ──────────────────────────────────────────────────────────────────

export async function getClientRoutine(clienteId) {
  const q = query(
    collection(db, ROUTINES_COL),
    where('clienteId', '==', clienteId),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

export function subscribeToClientRoutine(clienteId, onChange) {
  const q = query(
    collection(db, ROUTINES_COL),
    where('clienteId', '==', clienteId),
  );
  return onSnapshot(q, (snap) => {
    if (snap.empty) { onChange(null); return; }
    const d = snap.docs[0];
    onChange({ id: d.id, ...d.data() });
  }, () => onChange(null));
}

// creadaPor: 'entrenador' o 'alumno' (el alumno se arma la suya). Se guarda al
// crearla: si después la edita otro, no cambia.
// editadaPor: quién la guardó por última vez ('entrenador' o 'alumno'), para
// que el entrenador vea si el alumno la cambió.
// extra: campos adicionales, ej. { plantillaId, plantillaHuella } (ver misRutinasService).
export async function saveRoutine({ id, clienteId, entrenadorId, nombre, dias, creadaPor = 'entrenador', editadaPor = creadaPor, extra = {} }) {
  const routineId = id ?? uid();
  const data = {
    id:            routineId,
    clienteId,
    entrenadorId,
    nombre:        nombre ?? 'Rutina',
    dias:          dias   ?? [],
    actualizadoEn: serverTimestamp(),
    editadaPor,
    ...extra,
  };
  if (!id) {
    data.creadoEn = serverTimestamp();
    data.creadaPor = creadaPor;
  }
  await setDoc(doc(db, ROUTINES_COL, routineId), data, { merge: true });
  return routineId;
}

// ── Workout logs ──────────────────────────────────────────────────────────────

export async function saveWorkoutLog(log) {
  const logId = uid();
  await setDoc(doc(db, LOGS_COL, logId), {
    ...log,
    id:    logId,
    fecha: serverTimestamp(),
  });
  return logId;
}

export function subscribeToWorkoutLogs(clienteId, onChange) {
  const q = query(
    collection(db, LOGS_COL),
    where('clienteId', '==', clienteId),
    orderBy('fecha', 'desc'),
    limit(50),
  );
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, () => onChange([]));
}

// ── Helpers: build a fresh day / exercise slot ────────────────────────────────

export function makeDay(numero) {
  return { id: uid(), numero, nombre: '', ejercicios: [] };
}

export function makeExerciseSlot(exercise, orden) {
  return {
    id:            uid(),
    exerciseId:    exercise.id,
    nombre:        exercise.nombre,
    grupoMuscular: exercise.grupoMuscular,
    series:        4,
    repeticiones:  12,
    carga:         null,
    observaciones: '',
    orden,
  };
}
