import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext(null);

// Mismo criterio de rol que usa la app mobile (ver src/context/AuthContext.js
// del proyecto Expo): el campo `rol` en users/{uid} puede ser un string
// separado por comas o un array; alcanza con que incluya 'entrenador'.
function hasTrainerRole(rol) {
  if (!rol) return false;
  const roles = Array.isArray(rol) ? rol : String(rol).split(',').map((r) => r.trim());
  return roles.includes('entrenador');
}

export function AuthProvider({ children }) {
  const [user, setUser]                 = useState(null);
  const [isTrainer, setIsTrainer]       = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [verificandoRol, setVerificandoRol] = useState(false);
  const [authError, setAuthError]       = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setIsTrainer(false);
        setInitializing(false);
        return;
      }
      setVerificandoRol(true);
      try {
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
        const rol = snap.exists() ? snap.data().rol : null;
        setIsTrainer(hasTrainerRole(rol));
      } catch {
        setIsTrainer(false);
      }
      setUser(firebaseUser);
      setVerificandoRol(false);
      setInitializing(false);
    });
    return unsubscribe;
  }, []);

  // `recordar` decide si la sesión sobrevive al cierre del navegador. En la
  // PC de mostrador conviene desmarcarlo: la sesión muere al cerrar.
  async function signIn(email, password, recordar = true) {
    setAuthError(null);
    try {
      await setPersistence(auth, recordar ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setAuthError(mapAuthError(error.code));
      throw error;
    }
  }

  async function resetPassword(email) {
    setAuthError(null);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      setAuthError(mapAuthError(error.code));
      throw error;
    }
  }

  async function signOut() {
    await firebaseSignOut(auth);
  }

  const value = {
    user,
    isTrainer,
    initializing,
    verificandoRol,
    authError,
    signIn,
    resetPassword,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function mapAuthError(code) {
  const messages = {
    'auth/invalid-email':        'El email ingresado no es válido.',
    'auth/user-not-found':       'No existe una cuenta con ese email.',
    'auth/wrong-password':       'La contraseña es incorrecta.',
    'auth/invalid-credential':   'Email o contraseña incorrectos.',
    'auth/too-many-requests':    'Demasiados intentos. Probá de nuevo más tarde.',
    'auth/network-request-failed': 'Error de conexión. Revisá tu internet.',
  };
  return messages[code] ?? 'Ocurrió un error al iniciar sesión.';
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
