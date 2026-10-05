// Actividad en la app (solo la ven los testers, pantalla Actividad):
//   - mientras la app está abierta y al frente, cada 2 minutos "estoy acá"
//     (ultima + enApp) → el círculo verde EN VIVO;
//   - cada vez que se abre (o vuelve después de 5 min en segundo plano),
//     +1 apertura, en total y por día;
//   - plataforma y versión, para saber quién no actualizó.
// En una colección aparte (actividad/{uid}) y no en el perfil: tocar el perfil
// cada minuto haría que se redibujen todas las pantallas que lo usan.
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { collection, doc, increment, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { todayDateString } from './stepService';

function versionDeLaApp() {
  const v = Constants.expoConfig?.version ?? '';
  let update = null;
  try { update = require('expo-updates').updateId ?? null; } catch {}
  return update ? `${v} · update ${update.slice(0, 6)}` : v;
}

export function registrarActividad(uid, { abrio = false, nombre = '', apellido = '' } = {}) {
  if (!uid) return Promise.resolve();
  const datos = {
    ultima: serverTimestamp(),
    enApp: true,
    plataforma: Platform.OS,
    version: versionDeLaApp(),
  };
  // El nombre solo si ya se cargó el perfil (si no, quedaba "Sin nombre").
  if (nombre) datos.nombre = nombre;
  if (apellido) datos.apellido = apellido;
  if (abrio) {
    datos.aperturas = increment(1);
    datos.ultimaApertura = serverTimestamp();
    datos.dias = { [todayDateString()]: increment(1) };
  }
  return setDoc(doc(db, 'actividad', uid), datos, { merge: true }).catch(() => {});
}

export function salirDeLaApp(uid) {
  if (!uid) return Promise.resolve();
  return setDoc(doc(db, 'actividad', uid), { enApp: false, ultima: serverTimestamp() }, { merge: true }).catch(() => {});
}

export function subscribeActividad(callback) {
  return onSnapshot(
    collection(db, 'actividad'),
    (snap) => callback(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))),
    () => callback(null),
  );
}
