import { collection, collectionGroup, doc, getDoc, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { cached } from './cache';

// Vínculo entre el padrón del gimnasio (colección `socios`, ID = DNI) y las
// cuentas de la app mobile (colección `users`, ID = uid de Auth):
//   - `users.gymDni`: DNI que el socio ingresó en la app para vincularse al
//     gimnasio. Es la asociación explícita, así que tiene prioridad.
//   - `users.dni`: el DNI que cargó al registrarse. Sirve de alternativa
//     cuando nunca vinculó la cuenta a mano.
// La foto de perfil vive en `users.photoBase64`.
//
// Los datos personales (DNI, email, nacimiento, sexo, peso, altura) se están
// mudando a users/{uid}/privado/datos, que solo leen el dueño y los
// entrenadores, y dnis/{dni} = { uid } dice de qué cuenta es cada DNI (ver
// src/services/perfilPrivadoService.js de la app). Mientras haya cuentas sin
// mudar, se leen los dos lugares.
const COL = collection(db, 'users');

function juntar(publico, privado) {
  return { ...(publico ?? {}), ...(privado ?? {}) };
}

export async function getUserByDni(dni) {
  const buscado = dni.trim();
  const reserva = await getDoc(doc(db, 'dnis', buscado)).catch(() => null);
  if (reserva?.exists()) {
    const uid = reserva.data().uid;
    const [pub, priv] = await Promise.all([
      getDoc(doc(db, 'users', uid)),
      getDoc(doc(db, 'users', uid, 'privado', 'datos')).catch(() => null),
    ]);
    if (pub.exists()) return { uid, ...juntar(pub.data(), priv?.exists() ? priv.data() : null) };
  }
  for (const campo of ['gymDni', 'dni']) {
    const snap = await getDocs(query(COL, where(campo, '==', buscado), limit(1)));
    if (!snap.empty) {
      const d = snap.docs[0];
      return { uid: d.id, ...d.data() };
    }
  }
  return null;
}

// Mapa dni → cuenta para todo el padrón en una sola lectura, en vez de una
// consulta por socio. Se carga aparte del listado (ver SociosPage) porque las
// fotos son base64 y pesan.
export async function getCuentasPorDni() {
  // TTL más largo que el de socios: las cuentas de la app cambian poco y es
  // la lectura más cara del panel (trae las fotos en base64).
  return cached('cuentasApp', 15 * 60 * 1000, leerCuentas);
}

async function leerCuentas() {
  const [snapUsers, snapPrivados] = await Promise.all([
    getDocs(COL),
    getDocs(collectionGroup(db, 'privado')).catch(() => ({ docs: [] })),
  ]);
  const privados = {};
  snapPrivados.docs.forEach((d) => { privados[d.ref.parent.parent?.id] = d.data(); });
  const snap = { docs: snapUsers.docs.map((d) => ({ id: d.id, data: () => juntar(d.data(), privados[d.id]) })) };
  const cuentas = new Map();

  // Primero las vinculaciones explícitas, para que ganen si un `dni` de
  // registro ajeno apuntara al mismo socio.
  snap.docs.forEach((d) => {
    const data = d.data();
    if (data.gymDni) cuentas.set(String(data.gymDni).trim(), data);
  });
  snap.docs.forEach((d) => {
    const data = d.data();
    if (data.dni && !data.gymDni) {
      const key = String(data.dni).trim();
      if (!cuentas.has(key)) cuentas.set(key, data);
    }
  });

  return cuentas;
}

// Completa los datos del socio con los de su cuenta de la app. No escribe
// nada: la cuenta es la fuente de los campos que el gimnasio nunca cargó.
export function combinarSocioConApp(socio, cuenta) {
  if (!cuenta) return socio;

  // El nombre del padrón (el mismo que tiene el Excel) manda. El de la app
  // solo se usa si el gimnasio nunca cargó uno.
  const nombreApp = [cuenta.nombre, cuenta.apellido].filter(Boolean).join(' ');

  return {
    ...socio,
    nombre:    socio.nombre || nombreApp,
    email:     socio.email || cuenta.email || '',
    fotoApp:   cuenta.photoBase64 ?? null,
    tieneCuentaApp: true,
  };
}
