import { doc, setDoc, deleteDoc, serverTimestamp, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { crearPerfil, guardarPerfil, separarCampos } from './perfilPrivadoService';

const USERS_COLLECTION = 'users';

export async function createUserDocument(uid, profile) {
  const {
    nombre, apellido, email,
    dni, fechaNacimiento, sexo,
    peso, altura,
    objetivo, nivelFitness,
    photoBase64,
  } = profile;

  const datos = {
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
    racha:      0,
    fechaRegistro: serverTimestamp(),
    rol:       'usuario',
    gimnasio:  null,
  };
  // Los datos personales van aparte (ver perfilPrivadoService). false = el
  // DNI ya es de otra cuenta.
  const { publico, privado } = separarCampos(datos);
  return crearPerfil(uid, publico, privado);
}

export async function updateUserProfile(uid, updates) {
  await guardarPerfil(uid, updates);
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export async function fetchWeightHistory(uid) {
  const colRef = collection(db, USERS_COLLECTION, uid, 'weightHistory');
  const snap = await getDocs(query(colRef, orderBy('date', 'asc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addWeightEntry(uid, weight) {
  const date = todayStr();
  await setDoc(doc(db, USERS_COLLECTION, uid, 'weightHistory', date), {
    weight: Number(weight), date,
  });
  await guardarPerfil(uid, { peso: Number(weight) });
}

export async function deleteWeightEntry(uid, date) {
  await deleteDoc(doc(db, USERS_COLLECTION, uid, 'weightHistory', date));
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

// Returns { 'YYYY-MM-DD': gymMinutes } for the last 7 days — mismo patrón que
// fetchWeeklyStepHistory, sobre la subcolección gymHistory.
export async function fetchWeeklyGymHistory(uid) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const y = sevenDaysAgo.getFullYear();
  const mo = String(sevenDaysAgo.getMonth() + 1).padStart(2, '0');
  const dy = String(sevenDaysAgo.getDate()).padStart(2, '0');
  const fromDate = `${y}-${mo}-${dy}`;
  const colRef = collection(db, USERS_COLLECTION, uid, 'gymHistory');
  const snap = await getDocs(query(colRef, where('date', '>=', fromDate)));
  const map = {};
  snap.docs.forEach(d => { map[d.id] = d.data().minutes ?? 0; });
  return map;
}
