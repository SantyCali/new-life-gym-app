import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { mapAuthError } from '../utils/authErrors';
import { createUserDocument } from './userService';
import { borrarPrivado } from './perfilPrivadoService';

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

    const creado = await createUserDocument(credential.user.uid, { ...profile, email });
    if (creado === false) {
      // El DNI ya es de otra cuenta: no queda una cuenta a medias.
      await deleteUser(credential.user).catch(() => {});
      throw { code: 'app/dni-en-uso' };
    }

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

// Borra la cuenta del usuario actual: requerido por las reglas de Apple
// (App Review 5.1.1v) — toda app que permite crear una cuenta tiene que
// permitir borrarla desde adentro, no solo por soporte.
// Firebase exige un login "reciente" para operaciones sensibles como esta
// (auth/requires-recent-login si no), así que reautentica con la contraseña
// antes de borrar nada. Borra las subcolecciones conocidas y el documento de
// perfil en Firestore, y por último la cuenta de Firebase Auth.
export async function deleteAccount(password) {
  const user = auth.currentUser;
  if (!user?.email) throw mapAuthError({ code: 'auth/user-not-found' });

  try {
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
  } catch (error) {
    throw mapAuthError(error);
  }

  const uid = user.uid;
  try {
    await borrarPrivado(uid);
    for (const sub of ['stepsHistory', 'gymHistory', 'weightHistory']) {
      const snap = await getDocs(collection(db, 'users', uid, sub));
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    }
    await deleteDoc(doc(db, 'users', uid));
  } catch {
    // Si falla la limpieza de datos, igual se sigue con el borrado de la
    // cuenta en sí (lo que Apple exige) — no queremos dejar a alguien sin
    // poder borrar su cuenta solo porque una subcolección no se pudo leer.
  }

  try {
    await deleteUser(user);
  } catch (error) {
    throw mapAuthError(error);
  }
}
