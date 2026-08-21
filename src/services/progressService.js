import {
  doc, setDoc, onSnapshot, updateDoc, arrayUnion,
  collection, query, orderBy,
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

// Write today's body weight to the history subcollection (called from BodyMeasurementsScreen)
export async function addBodyWeightRecord(uid, weightKg) {
  if (!uid || !(weightKg > 0)) return;
  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  await setDoc(doc(db, 'users', uid, 'weightHistory', date), {
    weight: Number(weightKg), date,
  });
}

// Body weight history — reads from users/{uid}/weightHistory subcollection
// (written by addWeightEntry in userService.js: { weight: Number, date: 'YYYY-MM-DD' })
// Maps to { peso, fecha } format that ClientProgressScreen expects.
export function subscribeToBodyWeightHistory(uid, onChange) {
  const q = query(
    collection(db, 'users', uid, 'weightHistory'),
    orderBy('date', 'asc'),
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(d => ({
      id:    d.id,
      peso:  d.data().weight,
      fecha: d.data().date,
    }))),
    () => onChange([]),
  );
}