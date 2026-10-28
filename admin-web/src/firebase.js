import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
} from 'firebase/firestore';

// Mismo proyecto Firebase que usa la app mobile (new-life-app-f951c) — no es
// un proyecto nuevo. La apiKey no es secreta (va embebida en cualquier
// cliente Firebase, mobile o web); el acceso real lo controlan las reglas de
// seguridad de Firestore, no esta config.
//
// A diferencia de src/firebase/index.js en la app mobile, acá NO se usa
// initializeAuth + getReactNativePersistence(AsyncStorage) — eso es
// específico de React Native y no existe en un navegador. getAuth() sin
// argumentos ya usa persistencia de navegador (localStorage) por default.
const firebaseConfig = {
  apiKey:            'AIzaSyBbYa9YfqhslIRRdcAjiiP03QK7Xwaa99o',
  authDomain:        'new-life-app-f951c.firebaseapp.com',
  projectId:         'new-life-app-f951c',
  storageBucket:     'new-life-app-f951c.firebasestorage.app',
  messagingSenderId: '579934492145',
  appId:             '1:579934492145:web:09da6f417f6c056c5fe050',
  measurementId:     'G-WKPBTKL9T3',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
// Copia de los datos en el navegador (IndexedDB). Al reabrir o recargar el
// panel, los listeners (el padrón de socios, los ingresos de hoy) le piden a
// Firebase solo lo que cambió: si el panel estuvo cerrado menos de 30 min,
// Firestore cobra solo esos documentos y no los 200+ de nuevo. Cuida el cupo
// gratis de 50.000 lecturas por día. Funciona con varias pestañas abiertas.
// Si el navegador no lo permite (modo incógnito viejo), sigue sin copia.
function crearDb() {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (error) {
    console.warn('[admin-web] sin copia local de Firestore:', error);
    return getFirestore(app);
  }
}

export const db   = crearDb();
export default app;
