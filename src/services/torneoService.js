import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs,
  onSnapshot, serverTimestamp, Timestamp, query, where, arrayUnion, runTransaction,
} from 'firebase/firestore';
import { db } from '../firebase';
import { awardXPAndCoins } from './gamificationService';

const DURACION_DIAS = 14;

const PRIZES = [
  { xp: 500 },
  { xp: 250 },
  { xp: 100 },
];

const TORNEOS = collection(db, 'torneos');

export async function searchUsers(q) {
  if (!q.trim()) return [];
  const snap = await getDocs(collection(db, 'users'));
  const lower = q.toLowerCase().trim();
  return snap.docs
    .map(d => ({ uid: d.id, ...d.data() }))
    .filter(u => {
      // Solo por nombre: el email es un dato personal (ver perfilPrivadoService).
      const nombre   = (u.nombre   ?? '').toLowerCase();
      const apellido = (u.apellido ?? '').toLowerCase();
      return (
        nombre.includes(lower) ||
        apellido.includes(lower) ||
        `${nombre} ${apellido}`.includes(lower) ||
        `${apellido} ${nombre}`.includes(lower)
      );
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

export async function addParticipant(torneoId, targetUid) {
  const partsCol = collection(db, 'torneos', torneoId, 'participantes');
  const existing = await getDocs(query(partsCol, where('uid', '==', targetUid)));
  if (!existing.empty) return 'already';

  const userSnap = await getDoc(doc(db, 'users', targetUid));
  if (!userSnap.exists()) return 'not_found';
  const u = userSnap.data();

  await addDoc(partsCol, {
    uid:           targetUid,
    nombre:        u.nombre       ?? '',
    apellido:      u.apellido     ?? '',
    photoBase64:   u.photoBase64  ?? null,
    xpTotalInicio: u.xpTotal      ?? 0,
    xpExtraInicio: u.xpExtra      ?? 0,
    gymInicio:     u.gymVisitCount ?? 0,
    joinedAt:      serverTimestamp(),
  });

  await updateDoc(doc(db, 'torneos', torneoId), {
    participantUids: arrayUnion(targetUid),
  });

  return 'ok';
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

// Actualiza la foto del usuario en sus torneos en curso. Se llama al abrir la
// app, cuando cambian sus puntos y desde la tarea en segundo plano.
export async function actualizarMisTorneos(uid) {
  if (!uid) return;
  const [userSnap, torneos] = await Promise.all([
    getDoc(doc(db, 'users', uid)),
    getDocs(query(TORNEOS, where('participantUids', 'array-contains', uid))),
  ]);
  if (!userSnap.exists()) return;
  const { xpTotal = 0, xpExtra = 0, gymVisitCount = 0 } = userSnap.data();
  const ahora = Date.now();
  for (const t of torneos.docs) {
    if (torneoTerminado(t.data(), ahora)) continue;
    const parts = await getDocs(query(collection(db, 'torneos', t.id, 'participantes'), where('uid', '==', uid)));
    for (const p of parts.docs) {
      const d = p.data();
      if (d.xpTotalFin === xpTotal && d.xpExtraFin === xpExtra && d.gymFin === gymVisitCount) continue;
      await updateDoc(p.ref, { xpTotalFin: xpTotal, xpExtraFin: xpExtra, gymFin: gymVisitCount, finEn: serverTimestamp() });
    }
  }
}

// Cierra el torneo y premia al top 3 (con 2 jugadores o más). Lo hace el
// creador con el botón, o cualquier participante que lo abra después de la
// fecha de fin. La transacción asegura que se cierre (y se premie) una sola
// vez aunque dos lo abran a la vez. Devuelve false si ya estaba cerrado.
// leaderboard: ordenado, con { id, uid, actual } (actual = puntos de ahora).
export async function finalizarTorneo(torneoId, leaderboard) {
  const ref = doc(db, 'torneos', torneoId);
  const cierre = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists() || snap.data().activo === false) return null;
    const vencido = torneoTerminado({ fechaFin: snap.data().fechaFin });
    tx.update(ref, { activo: false, finalizadoAt: serverTimestamp() });
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
        const { xpTotal = 0, xpExtra = 0, gymVisitCount = 0, nivelJuego = 1 } = snap.data();
        results[uid] = { xpTotal, xpExtra, gymVisitCount, nivelJuego };
      }
    } catch {}
  }));
  return results;
}
