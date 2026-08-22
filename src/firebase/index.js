import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseConfig } from './firebaseConfig';

// Evita reinicializar la app en Fast Refresh / hot reload de Expo.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Auth con persistencia de sesión en AsyncStorage (necesario en React Native:
// sin esto el usuario se desloguea cada vez que se recarga la app).
// `initializeAuth` solo puede llamarse una vez por app: si este módulo se
// re-evalúa por Fast Refresh, lanza "auth/already-initialized". En ese caso
// reutilizamos la instancia ya creada con `getAuth`.
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (error) {
  // Solo reutilizar la instancia existente si ya fue inicializada (Fast Refresh).
  // Cualquier otro error se re-lanza para no silenciar problemas de persistencia.
  if (error.code === 'auth/already-initialized') {
    auth = getAuth(app);
  } else {
    throw error;
  }
}
export { auth };

export const db = getFirestore(app);

export default app;
