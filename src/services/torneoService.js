import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs,
  onSnapshot, serverTimestamp, Timestamp, query, where, arrayUnion,
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
      const nombre   = (u.nombre   ?? '').toLowerCase();
      const apellido = (u.apellido ?? '').toLowerCase();
      const email    = (u.email    ?? '').toLowerCase();
      return (
        nombre.includes(lower) ||
        apellido.includes(lower) ||
        email.includes(lower) ||
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

// Finaliza el torneo y premia al top 3 según el leaderboard recibido
// leaderboard: array ordenado de { uid, nombre, apellido, xpGanado }
export async function finalizarTorneo(torneoId, leaderboard) {
  await updateDoc(doc(db, 'torneos', torneoId), {
    activo: false,
    finalizadoAt: serverTimestamp(),
  });
  await Promise.all(
    leaderboard.slice(0, 3).map((p, i) =>
      awardXPAndCoins(p.uid, PRIZES[i].xp)
    )
  );
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
        const { xpTotal = 0, gymVisitCount = 0, nivelJuego = 1 } = snap.data();
        results[uid] = { xpTotal, gymVisitCount, nivelJuego };
      }
    } catch {}
  }));
  return results;
}
