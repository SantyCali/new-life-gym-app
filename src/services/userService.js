import { doc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const USERS_COLLECTION = 'users';

export async function createUserDocument(uid, profile) {
  const {
    nombre, apellido, email,
    dni, fechaNacimiento, sexo,
    peso, altura,
    objetivo, nivelFitness,
    photoBase64,
  } = profile;

  const userRef = doc(db, USERS_COLLECTION, uid);
  await setDoc(userRef, {
    nombre:          nombre ?? null,
    apellido:        apellido ?? null,
    email:           email ?? null,
    dni:             dni ?? null,
    fechaNacimiento: fechaNacimiento ?? null,
    sexo:            sexo ?? null,
    peso:            peso ?? null,
    altura:          altura ?? null,
    objetivo:        objetivo ?? null,
    nivelFitness:    nivelFitness ?? null,
    photoBase64:     photoBase64 ?? null,
    // Gamificación
    nivelJuego: 1,
    xp:         0,
    monedas:    0,
    racha:      0,
    fechaRegistro: serverTimestamp(),
    rol:       'usuario',
    gimnasio:  null,
  });
}

export async function updateUserProfile(uid, updates) {
  const userRef = doc(db, USERS_COLLECTION, uid);
  await updateDoc(userRef, updates);
}

// Returns { 'YYYY-MM-DD': stepCount } for the last 7 days
export async function fetchWeeklyStepHistory(uid) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const y = sevenDaysAgo.getFullYear();
  const mo = String(sevenDaysAgo.getMonth() + 1).padStart(2, '0');
  const dy = String(sevenDaysAgo.getDate()).padStart(2, '0');
  const fromDate = `${y}-${mo}-${dy}`;
  const colRef = collection(db, USERS_COLLECTION, uid, 'stepsHistory');
  const snap = await getDocs(query(colRef, where('date', '>=', fromDate)));
  const map = {};
  snap.docs.forEach(d => { map[d.id] = d.data().steps ?? 0; });
  return map;
}
