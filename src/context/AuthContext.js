import React, { createContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import {
  registerWithEmail,
  loginWithEmail,
  logout as logoutService,
} from '../services/authService';

const TRAINER_EMAILS = ['santipiedrabuena@gmail.com'];

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // `initializing`: true hasta que Firebase resuelve la sesión persistida
  // (AsyncStorage) por primera vez. Sirve para mostrar un splash/loader
  // y evitar parpadeos entre pantallas de login/app.
  const [initializing, setInitializing] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setInitializing(false);
    });
    return unsubscribe;
  }, []);

  // `profile`: { nombre, apellido, edad, peso, altura, objetivo }
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
    isTrainer: TRAINER_EMAILS.includes(user?.email ?? ''),
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
