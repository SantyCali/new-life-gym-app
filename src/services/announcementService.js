import { doc, collection, onSnapshot, setDoc, deleteDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const REF = doc(db, 'announcements', 'active');

export function subscribeToAnnouncement(callback) {
  return onSnapshot(REF, snap =>
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null)
  );
}

export async function publishAnnouncement({ title, message, trainerName, trainerId }) {
  await setDoc(REF, { title, message, trainerName, trainerId, createdAt: serverTimestamp() });
}

export async function deleteAnnouncement() {
  await deleteDoc(REF);
}

export async function sendAnnouncementNotification({ title, message }) {
  const snap = await getDocs(collection(db, 'users'));
  const tokens = snap.docs
    .map(d => d.data().expoPushToken)
    .filter(Boolean);

  if (tokens.length === 0) return;

  // Expo push API: max 100 per batch
  for (let i = 0; i < tokens.length; i += 100) {
    const batch = tokens.slice(i, i + 100);
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        batch.map(to => ({ to, title, body: message, sound: 'default', channelId: 'default' }))
      ),
    });
  }
}