import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../firebase';
import { mapAuthError } from '../utils/authErrors';
import { createUserDocument } from './userService';

// Registra un usuario nuevo con email y contraseña, y crea su documento
// inicial en Firestore (colección `users`, ID = uid).
// `profile`: { nombre, apellido, edad, peso, altura, objetivo }
export async function registerWithEmail(email, password, profile = {}) {
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);

    const displayName = [profile.nombre, profile.apellido].filter(Boolean).join(' ');
    if (displayName) {
      await updateProfile(credential.user, { displayName });
    }

    await createUserDocument(credential.user.uid, { ...profile, email });

    return credential.user;
  } catch (error) {
    throw mapAuthError(error);
  }
}

export async function loginWithEmail(email, password) {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential.user;
  } catch (error) {
    throw mapAuthError(error);
  }
}

export async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    throw mapAuthError(error);
  }
}
