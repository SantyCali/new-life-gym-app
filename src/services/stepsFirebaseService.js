import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// Colección unificada: users/{uid}/stepsHistory/{YYYY-MM-DD} → { date, steps }
// Misma colección que usa StepContext y fetchWeeklyStepHistory.

export async function saveStepsToFirebase(uid, date, steps) {
  if (!uid || !date || steps == null) return;
  try {
    const ref = doc(db, 'users', uid, 'stepsHistory', date);
    const existing = await getDoc(ref);
    const prevSteps = existing.exists() ? (existing.data().steps ?? 0) : 0;
    // merge: el documento del día también guarda cuántos puntos ya se
    // acreditaron por esos pasos (xpOtorgado, ver stepRewardsService). Pisarlo
    // entero borraba ese registro y habilitaba a acreditarlos de nuevo.
    if (steps >= prevSteps) {
      // actualizadoEn: el entrenador ve "actualizado hace X min".
      await setDoc(ref, { date, steps, actualizadoEn: serverTimestamp() }, { merge: true });
    }
  } catch {}
}

export async function loadStepsFromFirebase(uid, date) {
  if (!uid || !date) return null;
  try {
    const ref  = doc(db, 'users', uid, 'stepsHistory', date);
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data().steps ?? null;
    return null;
  } catch {
    return null;
  }
}

export async function syncStepsWithFirebase(uid, date, localSteps) {
  const cloudSteps = await loadStepsFromFirebase(uid, date);
  if (cloudSteps == null) {
    if (localSteps > 0) saveStepsToFirebase(uid, date, localSteps).catch(() => {});
    return localSteps;
  }
  const merged = Math.max(localSteps, cloudSteps);
  return merged;
}
