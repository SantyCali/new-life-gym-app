import {
  collection, onSnapshot, addDoc, deleteDoc, doc, getDoc,
  serverTimestamp, query, orderBy, where, Timestamp, getDocs, updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

const COL = collection(db, 'ingresosActivos');
const ACTIVE_MS = 75 * 60 * 1000; // 1 h 15 min
const ACTIVE_CUTOFF = () => Timestamp.fromMillis(Date.now() - ACTIVE_MS);

export function subscribeToGymCheckins(onData) {
  const q = query(COL, where('fechaHora', '>', ACTIVE_CUTOFF()), orderBy('fechaHora', 'desc'));
  return onSnapshot(q,
    snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => console.error('[GymCheckins] Firestore error:', err.message, err.code)
  );
}

// Registro manual desde la app (entrenador) — compatible con los mismos campos
export async function addCheckin(nombre, dni = '') {
  await addDoc(COL, {
    nombre,
    dni,
    estado:    'manual',
    fechaHora: serverTimestamp(),
    activo:    true,
  });
}

export async function removeCheckin(id) {
  await deleteDoc(doc(db, 'ingresosActivos', id));
}

// URL del Web App de Apps Script para sincronizar ediciones al Excel.
// Dejá vacío para saltear la sincronización hasta tener la URL.
const SHEETS_SYNC_URL = 'https://script.google.com/macros/s/AKfycbwsM2B2MFSzH9QHGBQnaGaDJ29CpUlhJgTrKwjetjNejrxSYu_HM8NBpH-y3rRNbiO6/exec';

export async function updateSocio(id, { nombre, dni, fechaVencimiento }) {
  const data = { nombre: nombre.trim(), dni: dni.trim() };
  data.fechaVencimiento = fechaVencimiento
    ? Timestamp.fromDate(fechaVencimiento)
    : null;
  await updateDoc(doc(db, 'socios', id), data);

  if (SHEETS_SYNC_URL) {
    try {
      await fetch(SHEETS_SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalDni: id,
          nombre: nombre.trim(),
          dni: dni.trim(),
          fechaVencimiento: fechaVencimiento ? fechaVencimiento.toISOString() : null,
        }),
      });
    } catch {
      // La sync al sheet falla silenciosamente — Firestore ya está actualizado
    }
  }
}

export async function getAllSocios() {
  const snap = await getDocs(collection(db, 'socios'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(s => s.nombre && s.dni)
    .sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es'));
}

export async function getSociosQuotaStatus() {
  const snap = await getDocs(collection(db, 'socios'));
  console.log('[gymService] socios en Firestore:', snap.docs.length);
  const now        = Date.now();
  const twoDaysMs  = 1  * 24 * 60 * 60 * 1000; // gracia: solo el día del vencimiento
  const fourDaysMs = 4  * 24 * 60 * 60 * 1000; // "se acerca" = vence en ≤4 días
  const fifteenDaysMs = 15 * 24 * 60 * 60 * 1000; // ocultar si vencido hace >15 días

  const results = [];
  snap.docs.forEach(d => {
    const data  = d.data();
    const vencMs = data.fechaVencimiento?.toMillis?.() ?? null;
    let category;

    if (vencMs === null) {
      category = 'aldia';
    } else if (vencMs < now - fifteenDaysMs) {
      return; // vencido hace más de 15 días → no mostrar
    } else if (vencMs < now - twoDaysMs) {
      category = 'vencido'; // vencido hace más de 2 días → Tienen que pagar
    } else if (vencMs < now + fourDaysMs) {
      category = 'proximo'; // vence en ≤4 días (o venció hace ≤2 días) → Se acerca
    } else {
      category = 'aldia'; // vence en más de 4 días
    }

    results.push({ id: d.id, ...data, vencMs, category });
  });
  return results;
}

export async function getTodayHistory() {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const q = query(
    COL,
    where('fechaHora', '>', Timestamp.fromDate(midnight)),
    orderBy('fechaHora', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getSocioByDni(dni) {
  const snap = await getDoc(doc(db, 'socios', dni.trim()));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function getCheckinAnalytics(days = 30) {
  const cutoff = Timestamp.fromMillis(Date.now() - days * 24 * 60 * 60 * 1000);
  const snap = await getDocs(query(COL, where('fechaHora', '>', cutoff)));
  const byHour = Array(24).fill(0);
  const byDay  = Array(7).fill(0); // 0=Dom, 1=Lun … 6=Sab
  snap.docs.forEach(d => {
    const date = d.data().fechaHora?.toDate?.();
    if (!date) return;
    byHour[date.getHours()]++;
    byDay[date.getDay()]++;
  });
  return { byHour, byDay };
}

export async function findUserByDni(dni) {
  const q = query(collection(db, 'users'), where('dni', '==', dni.trim()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const data = snap.docs[0].data();
  return {
    nombre: [data.nombre, data.apellido].filter(Boolean).join(' '),
    dni: data.dni,
  };
}

// Subscribe to whether a specific DNI has an active check-in today
export function subscribeToUserPresence(gymDni, onPresent) {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const q = query(
    COL,
    where('dni', '==', gymDni.trim()),
    where('fechaHora', '>', Timestamp.fromDate(midnight)),
  );
  return onSnapshot(q, snap => onPresent(!snap.empty), () => {});
}