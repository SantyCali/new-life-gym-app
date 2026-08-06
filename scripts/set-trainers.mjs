/**
 * Corre este script UNA VEZ para marcar los entrenadores en Firestore:
 *   node scripts/set-trainers.mjs
 *
 * Requiere que firebase esté instalado (ya está en el proyecto).
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            'AIzaSyBbYa9YfqhslIRRdcAjiiP03QK7Xwaa99o',
  authDomain:        'new-life-app-f951c.firebaseapp.com',
  projectId:         'new-life-app-f951c',
  storageBucket:     'new-life-app-f951c.firebasestorage.app',
  messagingSenderId: '579934492145',
  appId:             '1:579934492145:web:09da6f417f6c056c5fe050',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db  = getFirestore(app);

const TRAINER_EMAILS = [
  'santipiedrabuena@gmail.com',
  'lauticabjdbz@gmail.com',
  'myredes2015@gmail.com',
];

async function promoteToTrainer(email) {
  const snap = await getDocs(query(collection(db, 'users'), where('email', '==', email)));
  if (snap.empty) {
    console.log(`⚠️  No se encontró usuario con email: ${email}`);
    return;
  }
  for (const d of snap.docs) {
    await updateDoc(d.ref, { rol: 'entrenador' });
    console.log(`✅  ${email}  (uid: ${d.id})  → rol: entrenador`);
  }
}

for (const email of TRAINER_EMAILS) {
  await promoteToTrainer(email);
}

console.log('\nListo. Cerrando...');
process.exit(0);