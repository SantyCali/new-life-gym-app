import { createContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
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
      } else {
        setIsTrainer(false);
        setIsTester(false);
      }
      setUser(firebaseUser);
      setInitializing(false);
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