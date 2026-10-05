import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs,
  onSnapshot, serverTimestamp, Timestamp, query, where, arrayUnion, arrayRemove, runTransaction,
} from 'firebase/firestore';
import { db } from '../firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// En Expo Go las notificaciones locales no se inicializan.
const IS_EXPO_GO_TORNEO = Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo';
import { localDateString } from './stepService';
import { leerPrivado } from './perfilPrivadoService';
import { XP_GYM_VISIT } from './gamificationService';
import { awardXPAndCoins } from './gamificationService';

const DURACION_DIAS = 14;

const PRIZES = [
  { xp: 500 },
  { xp: 250 },
  { xp: 100 },
];

const TORNEOS = collection(db, 'torneos');

// Para comparar nombres: sin mayúsculas, tildes ni espacios de más.
const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();

// ¿La búsqueda alcanza para buscar? Nombre y apellido (dos palabras) o un DNI.
export function busquedaCompleta(q) {
  const t = normalizar(q);
  return /^\d{7,9}$/.test(t.replace(/\./g, '')) || t.split(' ').filter((p) => p.length >= 2).length >= 2;
}

// Buscar a quién sumar a un torneo. Por privacidad, solo coincidencias
// EXACTAS: el nombre y apellido completos, o el DNI. Antes alcanzaba con una
// letra y aparecían socios cualquiera de la app.
//  - DNI: dnis/{dni} dice de qué cuenta es (cualquiera logueado lo puede leer).
//  - Nombre: "Juan Pablo Pérez", "Juan Pérez" (primer nombre + apellido) o
//    "Pérez Juan" (con dos apellidos, también solo el primero), sin
//    importar mayúsculas ni tildes.
export async function searchUsers(q) {
  if (!busquedaCompleta(q)) return [];
  const t = normalizar(q);

  const dni = t.replace(/\./g, '');
  if (/^\d{7,9}$/.test(dni)) {
    const r = await getDoc(doc(db, 'dnis', dni)).catch(() => null);
    const uid = r?.exists() ? r.data().uid : null;
    if (!uid) return [];
    const u = await getDoc(doc(db, 'users', uid)).catch(() => null);
    return u?.exists() ? [{ uid, ...u.data() }] : [];
  }

  const snap = await getDocs(collection(db, 'users'));
  return snap.docs
    .map(d => ({ uid: d.id, ...d.data() }))
    .filter(u => {
      // Solo por nombre: el email es un dato personal (ver perfilPrivadoService).
      const nombre   = normalizar(u.nombre);
      const apellido = normalizar(u.apellido);
      if (!nombre || !apellido) return false;
      const primero = nombre.split(' ')[0];
      const primerApellido = apellido.split(' ')[0];
      return [
        `${nombre} ${apellido}`, `${apellido} ${nombre}`,
        `${primero} ${apellido}`, `${apellido} ${primero}`,
        `${primero} ${primerApellido}`,
      ].includes(t);
    })
    .slice(0, 15);
}

export async function createTorneo({ nombre, creadoPor }) {
  const userSnap = await getDoc(doc(db, 'users', creadoPor));
  const u = userSnap.data() ?? {};

  const fechaFin = Timestamp.fromMillis(Date.now() + DURACION_DIAS * 24 * 60 * 60 * 1000);

  const ref = await addDoc(TORNEOS, {
    nombre: nombre.trim(),
    creadoPor,
    creadoPorNombre: `${u.nombre ?? ''} ${u.apellido ?? ''}`.trim(),
    fechaInicio: serverTimestamp(),
    fechaFin,
    activo: true,
    participantUids: [creadoPor],
  });

  await addDoc(collection(db, 'torneos', ref.id, 'participantes'), {
    uid:           creadoPor,
    nombre:        u.nombre       ?? '',
    apellido:      u.apellido     ?? '',
    photoBase64:   u.photoBase64  ?? null,
    xpTotalInicio: u.xpTotal      ?? 0,
    xpExtraInicio: u.xpExtra      ?? 0,
    gymInicio:     u.gymVisitCount ?? 0,
    joinedAt:      serverTimestamp(),
  });

  return ref.id;
}

// Push a otro usuario (al código que guarda en pushTokens/{uid}).
async function mandarPush(uid, content) {
  try {
    const tok = await getDoc(doc(db, 'pushTokens', uid));
    const to = tok.exists() ? tok.data().token : null;
    if (!to) return false;
    // priority 'high': en Android, sin esto el sistema retiene el aviso con
    // el celular quieto o la pantalla apagada (llegaba al abrir la app).
    const r = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, sound: 'default', channelId: 'default', priority: 'high', ...content }),
    });
    if (!r.ok) return false;
    // Expo responde 200 aunque el código esté vencido o el celular ya no
    // exista: lo que importa es el estado del aviso.
    const j = await r.json().catch(() => null);
    return j?.data?.status === 'ok';
  } catch {
    return false;
  }
}

// Pases en el torneo: cuando mis puntos suben y supero a alguien,
//   - a esa persona le llega "te pasaron" (push desde mi celular), una vez por
//     día de cada uno que la pase: si la pasan 4, recibe 4; si alguno la
//     vuelve a pasar ese día, no le llega nada más de él;
//   - a mí me aparece "¡pasaste a …!" (notificación local) todas las veces.
// Solo se compara con quienes ya tienen puntos por día (xpTorneo).
async function avisarSiPase(torneoId, torneo, uid, antes, ahora, filas, miNombre) {
  if (!(ahora > antes)) return;
  const otros = filas.filter((r) => r.uid !== uid && typeof r.xpTorneo === 'number');
  const pasados = otros.filter((r) => r.xpTorneo >= antes && r.xpTorneo < ahora);
  const hoy = localDateString(new Date());
  for (const otro of pasados) {
    const clave = `pase_${torneoId}_${otro.uid}_${hoy}`;
    try {
      if ((await AsyncStorage.getItem(clave)) === '1') continue; // ya le avisé hoy
      await AsyncStorage.setItem(clave, '1');
    } catch {}
    // Su puesto nuevo: los que quedan por encima de él, contándome a mí.
    const suPuesto = 2 + otros.filter((r) => r.uid !== otro.uid && r.xpTorneo > otro.xpTorneo).length;
    mandarPush(otro.uid, {
      title: '🔥 ¡Te pasaron en el torneo!',
      body: `${miNombre || 'Alguien'} te pasó en "${torneo.nombre}". Ahora vas ${suPuesto}°, ¡salí a sumar pasos!`,
      data: { tipo: 'torneo', torneoId, nombre: torneo.nombre },
    }).catch(() => {});
  }
  if (!pasados.length || IS_EXPO_GO_TORNEO) return;
  const avisados = pasados;

  // "¡Pasaste a …!" para mí.
  const nombres = await Promise.all(avisados.map(async (o) => {
    const u = (await getDoc(doc(db, 'users', o.uid)).catch(() => null))?.data() ?? {};
    return `${u.nombre ?? ''} ${u.apellido ?? ''}`.trim() || 'alguien';
  }));
  const lista = nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(', ')} y a ${nombres.at(-1)}`;
  const miPuesto = 1 + otros.filter((r) => r.xpTorneo > ahora).length;
  const Notifications = require('expo-notifications');
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🚀 ¡Subiste en el torneo!',
      body: `¡Pasaste a ${lista} en "${torneo.nombre}"! Ahora vas ${miPuesto}°.`,
      sound: 'default',
      data: { tipo: 'torneo', torneoId, nombre: torneo.nombre },
    },
    trigger: null,
  }).catch(() => {});
}

// Push "te sumaron a un torneo" desde el celular de quien invita: le llega al
// invitado en el momento, con la app cerrada. El código para mandarle está en
// pushTokens/{uid} (lo escribe cada usuario al abrir la app).
async function avisarInvitacion(targetUid, torneoId, quien, nombreTorneo) {
  try {
    const nombre = nombreTorneo ?? 'un torneo';
    return await mandarPush(targetUid, {
      title: '🏆 Te sumaron a un torneo',
      body: `${quien} te agregó a "${nombre}". ¡A sumar pasos y visitas al gym!`,
      data: { tipo: 'torneo', torneoId, nombre },
    });
  } catch {
    return false;
  }
}

export async function addParticipant(torneoId, targetUid, invitadoPorUid = null) {
  const partsCol = collection(db, 'torneos', torneoId, 'participantes');
  const existing = await getDocs(query(partsCol, where('uid', '==', targetUid)));
  if (!existing.empty) return 'already';

  const userSnap = await getDoc(doc(db, 'users', targetUid));
  if (!userSnap.exists()) return 'not_found';
  const u = userSnap.data();

  // Nombre de quien invita, para el aviso.
  let quien = 'Alguien';
  if (invitadoPorUid) {
    const yo = (await getDoc(doc(db, 'users', invitadoPorUid)).catch(() => null))?.data();
    quien = `${yo?.nombre ?? ''} ${yo?.apellido ?? ''}`.trim() || quien;
  }
  // El push va primero, y la fila guarda si salió de verdad (avisoPush): si
  // salió, su celular no repite el aviso al abrir la app (ver
  // avisoTorneoService). Antes alcanzaba con tener un código guardado, y si
  // estaba vencido no le llegaba ni el push ni el aviso de respaldo.
  const tSnap = await getDoc(doc(db, 'torneos', torneoId)).catch(() => null);
  const avisoPush = await avisarInvitacion(targetUid, torneoId, quien, tSnap?.data()?.nombre);

  await addDoc(partsCol, {
    uid:           targetUid,
    nombre:        u.nombre       ?? '',
    apellido:      u.apellido     ?? '',
    photoBase64:   u.photoBase64  ?? null,
    xpTotalInicio: u.xpTotal      ?? 0,
    xpExtraInicio: u.xpExtra      ?? 0,
    gymInicio:     u.gymVisitCount ?? 0,
    joinedAt:      serverTimestamp(),
    avisoPush,
  });

  await updateDoc(doc(db, 'torneos', torneoId), {
    participantUids: arrayUnion(targetUid),
  });

  return 'ok';
}

// El creador saca a alguien del torneo. Sin ningún aviso al que sacaron: el
// torneo simplemente deja de aparecerle.
export async function eliminarParticipante(torneoId, participanteId, uid) {
  await deleteDoc(doc(db, 'torneos', torneoId, 'participantes', participanteId));
  await updateDoc(doc(db, 'torneos', torneoId), { participantUids: arrayRemove(uid) });
}

export function subscribeTorneosForUser(uid, callback) {
  const q = query(TORNEOS, where('participantUids', 'array-contains', uid));
  return onSnapshot(q, snap => {
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    docs.sort((a, b) => (b.fechaInicio?.toMillis?.() ?? 0) - (a.fechaInicio?.toMillis?.() ?? 0));
    callback(docs);
  }, () => callback([]));
}

export function subscribeTorneoParticipantes(torneoId, callback) {
  return onSnapshot(
    collection(db, 'torneos', torneoId, 'participantes'),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    () => callback([])
  );
}

export function subscribeTorneo(torneoId, callback) {
  return onSnapshot(doc(db, 'torneos', torneoId), snap => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  }, () => callback(null));
}

// ── Cierre del torneo ─────────────────────────────────────────────────────────
// La tabla es "puntos de ahora − puntos al entrar", así que sin un corte seguía
// sumando después de la fecha de fin. Cada participante guarda en su fila del
// torneo sus puntos del momento (xpTotalFin, xpExtraFin, gymFin) mientras el
// torneo está en curso, también desde la tarea en segundo plano; al terminar
// deja de actualizarse y la tabla usa esa última foto.

// El torneo se cierra (tabla fija y premios) apenas llega la fecha de fin, sin
// margen: lo que no se sincronizó hasta ahí no cuenta.
export function torneoCerrado(torneo, ahora = Date.now()) {
  return torneoTerminado(torneo, ahora);
}

export function torneoTerminado(torneo, ahora = Date.now()) {
  if (!torneo) return false;
  if (torneo.activo === false) return true;
  const fin = torneo.fechaFin?.toMillis?.() ?? (torneo.fechaFin ? new Date(torneo.fechaFin).getTime() : null);
  return fin != null && ahora >= fin;
}

// Puntos de un participante en el torneo. Solo lo ganado por actividad
// (pasos, gym): se descuentan los premios (logros, otros torneos), que se
// acumulan en xpExtra. Con el torneo terminado se usa la foto del cierre; si
// no hay (cuenta con la versión anterior de la app), los puntos de ahora.
export function puntosEnTorneo(p, actual = {}, terminado = false) {
  // Versión nueva: puntos por día de actividad (ver puntosDelTorneo), los
  // calcula el celular de cada participante.
  if (p.xpTorneo != null) return { xpGanado: p.xpTorneo, gymGanado: p.gymTorneo ?? 0 };
  const foto = terminado && p.xpTotalFin != null;
  const xpTotal = foto ? p.xpTotalFin : (actual.xpTotal ?? 0);
  const xpExtra = foto ? (p.xpExtraFin ?? 0) : (actual.xpExtra ?? 0);
  const gym = foto ? (p.gymFin ?? 0) : (actual.gymVisitCount ?? 0);
  const xpBruto   = xpTotal - (p.xpTotalInicio ?? 0);
  const xpPremios = xpExtra - (p.xpExtraInicio ?? 0);
  return {
    xpGanado:  Math.max(0, xpBruto - Math.max(0, xpPremios)),
    gymGanado: Math.max(0, gym - (p.gymInicio ?? 0)),
  };
}

// Puntos del torneo por DÍA DE ACTIVIDAD: los puntos de pasos (xpOtorgado de
// cada día) y las visitas al gym de los días que duró el torneo, desde el día
// en que entró. No importa cuándo se sincronizaron: si alguien abre la app
// tarde (dentro del margen de cierre), sus días del torneo igual cuentan.
// No incluye premios (logros, otros torneos).
// Visitas al gym: un día cuenta si hay CUALQUIER prueba de que fue, sin
// importar qué sistema la acreditó (el viejo, "en sala", no dejaba marca en
// visitasGym, y el cálculo le sacaba visitas a quien ya las tenía):
//   - un ingreso con su DNI en el historial (ingresosActivos);
//   - una visita acreditada con el sistema nuevo (visitasGym, xp > 0);
//   - minutos de gym ese día (gymHistory: el sistema viejo los guardaba al
//     salir; cubre ingresos que el "Retirar" viejo borró).
async function puntosDelTorneo(uid, desde, hasta, gymDni) {
  const dni = String(gymDni ?? '').trim();
  const [pasos, visitas, minutos, ingresos] = await Promise.all([
    getDocs(query(collection(db, 'users', uid, 'stepsHistory'), where('date', '>=', desde), where('date', '<=', hasta))),
    getDocs(collection(db, 'users', uid, 'visitasGym')),
    getDocs(query(collection(db, 'users', uid, 'gymHistory'), where('date', '>=', desde), where('date', '<=', hasta))),
    dni ? getDocs(query(collection(db, 'ingresosActivos'), where('dni', '==', dni))) : Promise.resolve({ docs: [] }),
  ]);
  let xp = 0;
  pasos.forEach((d) => { xp += d.data().xpOtorgado ?? 0; });

  const dias = new Set();
  const enRango = (f) => f && f >= desde && f <= hasta;
  visitas.forEach((d) => { const v = d.data(); if (enRango(v.fecha) && v.xp > 0) dias.add(v.fecha); });
  // Los minutos solo valen si no hay DNI para mirar los ingresos reales: se
  // guardaban con la fecha en que la app vio la salida, y una visita del 1/10
  // aparecía como del 2/10 (un día de gym que no existió).
  if (!dni) minutos.forEach((d) => { const g = d.data(); if (enRango(g.date) && g.minutes > 0) dias.add(g.date); });
  ingresos.docs.forEach((d) => {
    const f = d.data().fechaHora?.toDate?.();
    const fecha = f ? localDateString(f) : null;
    if (enRango(fecha)) dias.add(fecha);
  });
  const gym = dias.size;
  return { xp: xp + gym * XP_GYM_VISIT, gym };
}

// Actualiza la foto del usuario en sus torneos en curso. Se llama al abrir la
// app, cuando cambian sus puntos y desde la tarea en segundo plano.
export async function actualizarMisTorneos(uid) {
  if (!uid) return;
  const [userSnap, torneos] = await Promise.all([
    getDoc(doc(db, 'users', uid)),
    getDocs(query(TORNEOS, where('participantUids', 'array-contains', uid))),
  ]);
  if (!userSnap.exists()) return;
  const { xpTotal = 0, xpExtra = 0, gymVisitCount = 0, photoBase64 = null } = userSnap.data();
  const miNombre = `${userSnap.data().nombre ?? ''} ${userSnap.data().apellido ?? ''}`.trim();
  const { gymDni } = await leerPrivado(uid, userSnap.data()).catch(() => ({}));
  const ahora = Date.now();
  for (const t of torneos.docs) {
    const td = t.data();
    if (torneoCerrado(td, ahora)) continue;
    const terminado = torneoTerminado(td, ahora);
    const parts = await getDocs(query(collection(db, 'torneos', t.id, 'participantes'), where('uid', '==', uid)));
    for (const p of parts.docs) {
      const d = p.data();
      const upd = {};
      // Foto vieja (para versiones anteriores de la app): solo mientras dura.
      if (!terminado && !(d.xpTotalFin === xpTotal && d.xpExtraFin === xpExtra && d.gymFin === gymVisitCount)) {
        Object.assign(upd, { xpTotalFin: xpTotal, xpExtraFin: xpExtra, gymFin: gymVisitCount, finEn: serverTimestamp() });
      }
      // Puntos por día de actividad (solo mientras el torneo está en curso).
      const ini = td.fechaInicio?.toDate?.();
      const entro = d.joinedAt?.toDate?.();
      const fin = td.fechaFin?.toDate?.();
      if (ini && fin) {
        const desde = localDateString(entro && entro > ini ? entro : ini);
        const hasta = localDateString(fin);
        try {
          const r = await puntosDelTorneo(uid, desde, hasta, gymDni);
          // Nunca más que los totales reales (las reglas lo exigen).
          const xpT = Math.min(r.xp, xpTotal);
          const gymT = Math.min(r.gym, gymVisitCount);
          if (d.xpTorneo !== xpT || d.gymTorneo !== gymT) {
            Object.assign(upd, { xpTorneo: xpT, gymTorneo: gymT });
            // ¿Pasé a alguien? (solo si ya tenía puntos por día: la primera
            // vez no se compara, para no avisar de golpe a todos)
            if (typeof d.xpTorneo === 'number' && !terminado) {
              const todas = (await getDocs(collection(db, 'torneos', t.id, 'participantes')).catch(() => ({ docs: [] }))).docs.map((x) => x.data());
              avisarSiPase(t.id, td, uid, d.xpTorneo, xpT, todas, miNombre).catch(() => {});
            }
          }
        } catch {}
      }
      // La foto de la fila es la de cuando lo sumaron: si cambió, se actualiza.
      if ((d.photoBase64 ?? null) !== photoBase64) upd.photoBase64 = photoBase64;
      if (Object.keys(upd).length) await updateDoc(p.ref, upd);
    }
  }
}

// Cierra el torneo y premia al top 3 (con 2 jugadores o más). Lo hace el
// creador con el botón, o cualquier participante que lo abra después de la
// fecha de fin. La transacción asegura que se cierre (y se premie) una sola
// vez aunque dos lo abran a la vez. Devuelve false si ya estaba cerrado.
// leaderboard: ordenado, con { id, uid, actual } (actual = puntos de ahora).
// Tabla final congelada en el propio torneo: { uid: { xp, gym } }. Con esto,
// un torneo terminado muestra siempre los mismos números (antes, las filas sin
// foto de cierre mostraban los puntos de ahora y el torneo viejo seguía subiendo).
function armarResultado(leaderboard) {
  return Object.fromEntries(leaderboard
    .filter((p) => p.uid)
    .map((p) => [p.uid, { xp: p.xpGanado ?? 0, gym: p.gymGanado ?? 0 }]));
}

// Torneos que se cerraron antes de que existiera la tabla congelada: se
// congelan con los números de ahora la primera vez que alguien los abre.
export async function congelarResultado(torneoId, leaderboard) {
  await updateDoc(doc(db, 'torneos', torneoId), { resultado: armarResultado(leaderboard) });
}

// Puntos de una fila: los de la tabla congelada si el torneo ya cerró.
export function puntosDeFila(torneo, p, actual = {}, terminado = false) {
  const r = torneo?.resultado?.[p.uid];
  if (r) return { xpGanado: r.xp ?? 0, gymGanado: r.gym ?? 0 };
  return puntosEnTorneo(p, actual, terminado);
}

// Salir del torneo (cualquiera, también el creador). Sin avisos para nadie.
// Si sale el creador, el torneo pasa a otro participante; si era el último,
// el torneo se elimina.
export async function salirDelTorneo(torneoId, uid) {
  const ref = doc(db, 'torneos', torneoId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return 'eliminado';
  const t = snap.data();
  const otros = (t.participantUids ?? []).filter((u) => u !== uid);
  if (!otros.length) {
    await deleteDoc(ref);
    return 'eliminado';
  }
  const filas = await getDocs(query(collection(db, 'torneos', torneoId, 'participantes'), where('uid', '==', uid)));
  await Promise.all(filas.docs.map((d) => deleteDoc(d.ref)));
  const upd = { participantUids: arrayRemove(uid) };
  const yo = (await getDoc(doc(db, 'users', uid)).catch(() => null))?.data() ?? {};
  const miNombre = `${yo.nombre ?? ''} ${yo.apellido ?? ''}`.trim() || 'Alguien';
  let avisarA = t.creadoPor;
  let aviso = { title: '👋 Se fue alguien del torneo', body: `${miNombre} salió del torneo "${t.nombre}".` };
  if (t.creadoPor === uid) {
    const nuevo = otros[0];
    const u = (await getDoc(doc(db, 'users', nuevo)).catch(() => null))?.data() ?? {};
    upd.creadoPor = nuevo;
    upd.creadoPorNombre = `${u.nombre ?? ''} ${u.apellido ?? ''}`.trim();
    avisarA = nuevo;
    aviso = { title: '👑 Quedaste a cargo del torneo', body: `${miNombre} salió del torneo y te dejó a cargo de "${t.nombre}".` };
  }
  await updateDoc(ref, upd);
  // Solo al creador (o al nuevo a cargo); al que se fue y al resto, nada.
  if (avisarA && avisarA !== uid) {
    mandarPush(avisarA, { ...aviso, data: { tipo: 'torneo', torneoId, nombre: t.nombre } }).catch(() => {});
  }
  return 'salio';
}

export async function finalizarTorneo(torneoId, leaderboard) {
  const ref = doc(db, 'torneos', torneoId);
  const cierre = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists() || snap.data().activo === false) return null;
    const vencido = torneoTerminado({ fechaFin: snap.data().fechaFin });
    tx.update(ref, { activo: false, finalizadoAt: serverTimestamp(), resultado: armarResultado(leaderboard) });
    return { vencido };
  });
  if (!cierre) return false;

  // Cerrado a mano antes de la fecha: la foto de todos queda en este momento.
  if (!cierre.vencido) {
    await Promise.all(leaderboard.filter((p) => p.id && p.actual).map((p) =>
      updateDoc(doc(db, 'torneos', torneoId, 'participantes', p.id), {
        xpTotalFin: p.actual.xpTotal ?? 0,
        xpExtraFin: p.actual.xpExtra ?? 0,
        gymFin:     p.actual.gymVisitCount ?? 0,
        finEn:      serverTimestamp(),
      }).catch(() => {})
    ));
  }

  if (leaderboard.length >= 2) {
    await Promise.all(
      leaderboard.slice(0, 3).map((p, i) =>
        // extra: el premio de un torneo no cuenta en otros torneos en curso.
        awardXPAndCoins(p.uid, PRIZES[i].xp, { extra: true })
      )
    );
  }
  return true;
}

export { PRIZES };

export async function eliminarTorneo(torneoId) {
  await deleteDoc(doc(db, 'torneos', torneoId));
}

export function tiempoRestante(fechaFin) {
  if (!fechaFin) return null;
  const ms = (fechaFin.toMillis?.() ?? new Date(fechaFin).getTime()) - Date.now();
  if (ms <= 0) return { texto: 'Terminado', vencido: true };
  const dias  = Math.floor(ms / (1000 * 60 * 60 * 24));
  const horas = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (dias > 1) return { texto: `${dias} días restantes`, vencido: false };
  if (dias === 1) return { texto: '1 día restante', vencido: false };
  return { texto: `${horas}h restantes`, vencido: false };
}

export async function fetchParticipantStats(uids) {
  const results = {};
  await Promise.all(uids.map(async uid => {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const { xpTotal = 0, xpExtra = 0, gymVisitCount = 0, nivelJuego = 1, photoBase64 = null } = snap.data();
        results[uid] = { xpTotal, xpExtra, gymVisitCount, nivelJuego, photoBase64 };
      }
    } catch {}
  }));
  return results;
}
