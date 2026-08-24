import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// Guarda los pasos del día en Firestore: users/{uid}/pasos/{YYYY-MM-DD}
// Si el otro dispositivo ya tiene más pasos para ese día, ganamos el máximo.
export async function saveStepsToFirebase(uid, date, steps) {
  if (!uid || !date || steps == null) return;
  try {
    const ref = doc(db, 'users', uid, 'pasos', date);
    const existing = await getDoc(ref);
    const prevSteps = existing.exists() ? (existing.data().pasos ?? 0) : 0;
    // Solo escribir si tenemos más pasos que lo guardado (evita sobreescribir
    // datos de otro dispositivo que tiene más pasos del mismo día)
    if (steps >= prevSteps) {
      await setDoc(ref, {
        pasos: steps,
        actualizadoEn: serverTimestamp(),
      });
    }
  } catch {}
}

// Carga los pasos de un día desde Firestore.
// Retorna el número de pasos o null si no hay datos.
export async function loadStepsFromFirebase(uid, date) {
  if (!uid || !date) return null;
  try {
    const ref  = doc(db, 'users', uid, 'pasos', date);
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data().pasos ?? null;
    return null;
  } catch {
    return null;
  }
}

// Retorna el mayor valor entre los pasos locales y los de Firebase.
// Úsalo al iniciar la app para sincronizar entre dispositivos.
export async function syncStepsWithFirebase(uid, date, localSteps) {
  const cloudSteps = await loadStepsFromFirebase(uid, date);
  if (cloudSteps == null) {
    // Nada en la nube: subir los locales si son > 0
    if (localSteps > 0) saveStepsToFirebase(uid, date, localSteps).catch(() => {});
    return localSteps;
  }
  const merged = Math.max(localSteps, cloudSteps);
  return merged;
}
