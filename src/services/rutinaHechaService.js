import { doc, onSnapshot, setDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// Ejercicios de la rutina marcados con el ✓ ("lo hice") en un día:
// users/{uid}/rutinaHecha/{YYYY-MM-DD} → { fecha, ejercicios: { [slotId]: true } }.
// Lo marca el socio; el entrenador lo ve en la rutina del alumno (las reglas
// de users/{uid}/{sub} ya dejan escribir al dueño y leer a los entrenadores).
// Cada día es un documento nuevo, así que al otro día arranca sin marcar.
const ref = (uid, fecha) => doc(db, 'users', uid, 'rutinaHecha', fecha);

export function subscribeHechosDelDia(uid, fecha, onChange) {
  if (!uid || !fecha) { onChange({}); return () => {}; }
  return onSnapshot(
    ref(uid, fecha),
    (snap) => onChange(snap.exists() ? (snap.data().ejercicios ?? {}) : {}),
    () => onChange({}),
  );
}

export function marcarHecho(uid, fecha, slotId, hecho) {
  if (!uid || !fecha || !slotId) return Promise.resolve();
  return setDoc(ref(uid, fecha), {
    fecha,
    ejercicios: { [slotId]: hecho ? true : deleteField() },
    actualizado: serverTimestamp(),
  }, { merge: true }).catch(() => {});
}
