import { createContext, useEffect, useState, useCallback, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../firebase';
import { firebaseConfig } from '../firebase/firebaseConfig';
import { darSesionAlServicio, sacarSesionAlServicio } from '../services/nativeStepService';
import { respaldarSesion, borrarRespaldoSesion, recuperarSesion } from '../services/respaldoSesion';

const SESSION_KEY = 'nlg_session_active';
import {
  registerWithEmail,
  loginWithEmail,
  logout as logoutService,
  deleteAccount as deleteAccountService,
} from '../services/authService';

export const AuthContext = createContext(null);

// getDoc() de Firestore no tiene timeout propio: si la red se cuelga (o el
// build tiene algún problema para llegar al backend), la promesa nunca resuelve
// ni rechaza. Como ese await está en el único camino que puede dejar
// "initializing" en true para siempre (ver más abajo), lo acotamos acá.
const FIRESTORE_ROLE_LOOKUP_TIMEOUT_MS = 8000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('firestore-timeout')), ms)),
  ]);
}

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null);
  const [isTrainer, setIsTrainer] = useState(false);
  const [isTester,  setIsTester]  = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [authLoading, setAuthLoading]   = useState(false);
  const [authError, setAuthError]       = useState(null);
  const isFirstAuthRef = useRef(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Sesión activa — guardar flag para el retry al próximo arranque
        AsyncStorage.setItem(SESSION_KEY, '1').catch(() => {});
        // Android: el servicio de pasos sube los pasos con esta sesión aunque
        // la app esté cerrada (ver modules/PasosEnLaNube.kt).
        darSesionAlServicio(
          firebaseUser.uid, firebaseUser.refreshToken,
          firebaseConfig.apiKey, firebaseConfig.projectId,
        );
        try {
          // Acotado con timeout: la identidad ya la confirmó Firebase Auth
          // (rápido, no depende de Firestore). Si la búsqueda del rol se
          // cuelga por red, no debe bloquear el arranque — el usuario entra
          // igual, como "usuario" normal (se puede corregir el rol después,
          // una vez que Firestore responda en otra pantalla/reintento).
          const snap = await withTimeout(
            getDoc(doc(db, 'users', firebaseUser.uid)),
            FIRESTORE_ROLE_LOOKUP_TIMEOUT_MS
          );
          const data  = snap.exists() ? snap.data() : {};
          const rawRol = data.rol ?? 'usuario';
          const roles  = Array.isArray(rawRol)
            ? rawRol
            : rawRol.split(',').map(r => r.trim());
          setIsTrainer(roles.includes('entrenador'));
          setIsTester(roles.includes('tester'));
        } catch {
          setIsTrainer(false);
          setIsTester(false);
        }
        isFirstAuthRef.current = false;
        setUser(firebaseUser);
        setInitializing(false);
        // Copia de la sesión, por si Firebase la borra al arrancar (ver respaldoSesion).
        setTimeout(() => respaldarSesion(firebaseUser.uid), 1500);
      } else {
        // Firebase dice null sin que la persona haya cerrado sesión (el botón
        // borra SESSION_KEY antes): primero se espera un poco por si el SDK
        // todavía la está restaurando, y si no, se recupera con el respaldo.
        isFirstAuthRef.current = false;
        const hadSession = await AsyncStorage.getItem(SESSION_KEY).catch(() => null);
        if (hadSession) {
          await new Promise(r => setTimeout(r, 800));
          if (auth.currentUser) return; // el SDK restauró la sesión; onAuthStateChanged va a volver a disparar
          // Se vuelve a poner la sesión y se recarga la app: no mostrar el login.
          if (await recuperarSesion()) return;
        }
        AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
        setIsTrainer(false);
        setIsTester(false);
        setUser(null);
        setInitializing(false);
      }
    });
    return unsubscribe;
  }, []);

  const signUp = useCallback(async (email, password, profile) => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      return await registerWithEmail(email, password, profile);
    } catch (error) {
      setAuthError(error.message);
      throw error;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const signIn = useCallback(async (email, password) => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      return await loginWithEmail(email, password);
    } catch (error) {
      setAuthError(error.message);
      throw error;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      await AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
      await borrarRespaldoSesion();
      await sacarSesionAlServicio();
      await logoutService();
    } catch (error) {
      setAuthError(error.message);
      throw error;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const deleteAccount = useCallback(async (password) => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      await deleteAccountService(password);
      await AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
      await borrarRespaldoSesion();
    } catch (error) {
      setAuthError(error.message);
      throw error;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const value = {
    user,
    isAuthenticated: !!user,
    isTrainer,
    isTester,
    initializing,
    authLoading,
    authError,
    signUp,
    signIn,
    signOut,
    deleteAccount,
    clearAuthError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}