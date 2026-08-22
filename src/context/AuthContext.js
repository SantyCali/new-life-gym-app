import { createContext, useEffect, useState, useCallback, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../firebase';

const SESSION_KEY = 'nlg_session_active';
import {
  registerWithEmail,
  loginWithEmail,
  logout as logoutService,
} from '../services/authService';

export const AuthContext = createContext(null);

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
        try {
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
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
      } else {
        // Firebase dice null — si es el primer evento y había sesión guardada,
        // esperar 2 s para que el SDK termine de refrescar el token (error de red transitorio).
        if (isFirstAuthRef.current) {
          isFirstAuthRef.current = false;
          const hadSession = await AsyncStorage.getItem(SESSION_KEY).catch(() => null);
          if (hadSession) {
            await new Promise(r => setTimeout(r, 800));
            if (auth.currentUser) return; // el SDK restauró la sesión; onAuthStateChanged va a volver a disparar
          }
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
      await logoutService();
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
    clearAuthError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}