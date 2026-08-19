import { doc, onSnapshot, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const REF = doc(db, 'config', 'daily_missions');

export function subscribeToDailyMissions(callback) {
  return onSnapshot(REF, snap =>
    callback(snap.exists() ? (snap.data().missions ?? []) : [])
  );
}

export async function addMission({ title, xp, icon }) {
  const snap = await getDoc(REF);
  const existing = snap.exists() ? (snap.data().missions ?? []) : [];
  const mission = {
    id: Date.now().toString(),
    title: title.trim(),
    xp: Number(xp),
    icon,
  };
  await setDoc(REF, { missions: [...existing, mission], updatedAt: serverTimestamp() });
}

export async function deleteMission(id) {
  const snap = await getDoc(REF);
  if (!snap.exists()) return;
  const updated = (snap.data().missions ?? []).filter(m => m.id !== id);
  await setDoc(REF, { missions: updated, updatedAt: serverTimestamp() });
}