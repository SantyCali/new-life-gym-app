import {
  doc, setDoc, onSnapshot, updateDoc, arrayUnion,
} from 'firebase/firestore';
import { db } from '../firebase';

const GYM_WEIGHTS_COL = 'gymWeights';

// Save the weight used for one exercise. Keeps current + previous for trend display.
export async function saveGymWeight(uid, exerciseId, exerciseName, peso, previousPeso) {
  if (!uid || !exerciseId || !(peso > 0)) return;
  await setDoc(doc(db, GYM_WEIGHTS_COL, uid), {
    [exerciseId]: {
      nombre:   exerciseName ?? exerciseId,
      peso,
      anterior: previousPeso ?? null,
      fecha:    new Date().toISOString(),
    },
  }, { merge: true });
}

export function subscribeToGymWeights(uid, onChange) {
  return onSnapshot(
    doc(db, GYM_WEIGHTS_COL, uid),
    (snap) => onChange(snap.exists() ? snap.data() : {}),
    () => onChange({}),
  );
}

// Body weight history stored as an array in the user document.
export async function addBodyWeightRecord(uid, peso) {
  if (!uid || !(peso > 0)) return;
  await updateDoc(doc(db, 'users', uid), {
    pesoRegistros: arrayUnion({ peso, fecha: new Date().toISOString() }),
  });
}

export function subscribeToBodyWeightHistory(uid, onChange) {
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => onChange(snap.data()?.pesoRegistros ?? []),
    () => onChange([]),
  );
}