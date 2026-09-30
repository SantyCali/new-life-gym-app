// Datos personales separados del perfil público.
//
// users/{uid} lo puede leer cualquier usuario logueado: los torneos necesitan
// el nombre, la foto y los puntos de los demás. Los datos personales van en
// users/{uid}/privado/datos, que solo leen el dueño y los entrenadores (ver
// firestore.rules). El resto de la app no se entera: useUserProfile junta los
// dos documentos y guardarPerfil manda cada campo a donde corresponde.
//
// dnis/{dni} = { uid }: cada DNI pertenece a una sola cuenta. Así nadie puede
// vincular el DNI de otro para ver sus ingresos y su cuota.
import {
  collectionGroup, deleteDoc, deleteField, doc, getDoc, getDocs, runTransaction,
  serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

export const CAMPOS_PRIVADOS = [
  'dni', 'gymDni', 'email', 'fechaNacimiento', 'sexo', 'peso', 'altura', 'expoPushToken',
];

export const refPrivado = (uid) => doc(db, 'users', uid, 'privado', 'datos');
const refDni = (dni) => doc(db, 'dnis', String(dni).trim());

export function separarCampos(datos) {
  const publico = {};
  const privado = {};
  for (const [k, v] of Object.entries(datos ?? {})) {
    if (CAMPOS_PRIVADOS.includes(k)) privado[k] = v;
    else publico[k] = v;
  }
  return { publico, privado };
}

// Perfil completo: el privado manda sobre lo que quede en el público de
// antes de moverlo.
export function juntarPerfil(publico, privado) {
  if (!publico) return null;
  return { ...publico, ...(privado ?? {}) };
}

// Reemplaza a updateDoc(users/{uid}) para cualquier cambio de perfil.
export async function guardarPerfil(uid, cambios) {
  if (!uid) return;
  const { publico, privado } = separarCampos(cambios);
  if (Object.keys(privado).length) {
    await setDoc(refPrivado(uid), privado, { merge: true });
  }
  if (Object.keys(publico).length) {
    await updateDoc(doc(db, 'users', uid), publico);
  }
}

// Lee los datos personales de un usuario (el propio, o cualquiera si es
// entrenador). Si todavía no se movieron, los toma del perfil público.
export async function leerPrivado(uid, publico = null) {
  let privado = {};
  try {
    const snap = await getDoc(refPrivado(uid));
    if (snap.exists()) privado = snap.data();
  } catch {}
  if (publico) return juntarPerfil(publico, privado);
  return privado;
}

// Para entrenadores: datos personales de todos, por uid, en una sola lectura.
export async function leerPrivadoDeTodos() {
  const snap = await getDocs(collectionGroup(db, 'privado'));
  const porUid = {};
  snap.docs.forEach((d) => {
    const uid = d.ref.parent.parent?.id;
    if (uid) porUid[uid] = d.data();
  });
  return porUid;
}

// uid dueño de un DNI, o null.
export async function duenoDelDni(dni) {
  if (!dni?.toString().trim()) return null;
  const snap = await getDoc(refDni(dni));
  return snap.exists() ? snap.data().uid : null;
}

// Vincula la cuenta al gimnasio con su DNI y lo reserva, todo junto. Tiene
// que ser el DNI con el que se registró (un entrenador puede vincular
// cualquiera, para probar). Devuelve 'ok', 'otro-dni' u 'ocupado'.
export async function vincularDni(uid, dni, { dniRegistro, esEntrenador = false } = {}) {
  const id = String(dni).trim();
  if (!esEntrenador && id !== String(dniRegistro ?? '').trim()) return 'otro-dni';
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(refDni(id));
    if (snap.exists() && snap.data().uid !== uid) return 'ocupado';
    if (!snap.exists()) tx.set(refDni(id), { uid, creadoEn: serverTimestamp() });
    tx.set(refPrivado(uid), { gymDni: id }, { merge: true });
    return 'ok';
  });
}

// Desvincula el DNI del gimnasio. La reserva se libera salvo que sea el DNI
// con el que se registró (ese sigue siendo suyo).
export async function desvincularDni(uid) {
  const privado = await leerPrivado(uid);
  const gymDni = privado.gymDni;
  await setDoc(refPrivado(uid), { gymDni: null }, { merge: true });
  if (gymDni && String(gymDni).trim() !== String(privado.dni ?? '').trim()) {
    try {
      const snap = await getDoc(refDni(gymDni));
      if (snap.exists() && snap.data().uid === uid) {
        await deleteDoc(refDni(gymDni));
      }
    } catch {}
  }
}

// Registro: perfil público, datos personales y reserva del DNI, todo o nada.
// Devuelve false si el DNI ya tiene una cuenta.
export async function crearPerfil(uid, publico, privado) {
  const dni = String(privado.dni ?? '').trim();
  return runTransaction(db, async (tx) => {
    if (dni) {
      const snap = await tx.get(refDni(dni));
      if (snap.exists() && snap.data().uid !== uid) return false;
      if (!snap.exists()) tx.set(refDni(dni), { uid, creadoEn: serverTimestamp() });
    }
    tx.set(doc(db, 'users', uid), publico);
    tx.set(refPrivado(uid), privado);
    return true;
  });
}

// Mueve los datos personales que todavía estén en el perfil público (cuentas
// creadas con la versión anterior). Corre al abrir la app; si no hay nada que
// mover no escribe. Si el DNI vinculado al gym ya es de otra cuenta, o no es
// el suyo (solo un entrenador puede tener otro), el vínculo no se mueve:
// tendrá que volver a vincular su propio DNI.
export async function moverDatosPrivados(uid) {
  if (!uid) return;
  try {
    await mover(uid, true);
  } catch {
    await mover(uid, false);
  }
}

async function mover(uid, conVinculo) {
  const ref = doc(db, 'users', uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const { privado: viejos } = separarCampos(snap.data());
    if (!Object.keys(viejos).length) return;

    const privSnap = await tx.get(refPrivado(uid));
    // Lo que ya esté en el privado es más nuevo que lo que quedó en el público.
    const privado = { ...viejos, ...(privSnap.exists() ? privSnap.data() : {}) };
    if (!conVinculo && String(privado.gymDni ?? '').trim() !== String(privado.dni ?? '').trim()) privado.gymDni = null;

    const dnis = [...new Set([privado.dni, privado.gymDni].map((v) => String(v ?? '').trim()).filter(Boolean))];
    const reservas = await Promise.all(dnis.map((d) => tx.get(refDni(d))));
    dnis.forEach((d, i) => {
      const r = reservas[i];
      if (!r.exists()) tx.set(refDni(d), { uid, creadoEn: serverTimestamp() });
      else if (r.data().uid !== uid && String(privado.gymDni ?? '').trim() === d) privado.gymDni = null;
    });

    tx.set(refPrivado(uid), privado, { merge: true });
    tx.update(ref, Object.fromEntries(Object.keys(viejos).map((k) => [k, deleteField()])));
  });
}

// Borrado de cuenta: datos personales y reservas de DNI.
export async function borrarPrivado(uid) {
  const privado = await leerPrivado(uid);
  for (const d of [privado.dni, privado.gymDni]) {
    if (!d) continue;
    try {
      const snap = await getDoc(refDni(d));
      if (snap.exists() && snap.data().uid === uid) await deleteDoc(refDni(d));
    } catch {}
  }
  try { await deleteDoc(refPrivado(uid)); } catch {}
}
