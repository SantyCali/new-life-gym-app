import {
  collection, onSnapshot, addDoc, deleteDoc, doc, getDoc, setDoc,
  serverTimestamp, query, orderBy, where, Timestamp, getDocs, updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { todayDateString } from './stepService';
import { duenoDelDni } from './perfilPrivadoService';

const COL = collection(db, 'ingresosActivos');
export const ACTIVE_MS = 90 * 60 * 1000; // 1 h 30 min
// Ingresos desde la medianoche (o desde hace 90 min, si es más temprano):
// alcanzan para los que están ahora y para el total del día.
export function subscribeToGymCheckins(onData) {
  const medianoche = new Date();
  medianoche.setHours(0, 0, 0, 0);
  const desde = Timestamp.fromMillis(Math.min(medianoche.getTime(), Date.now() - ACTIVE_MS));
  const q = query(COL, where('fechaHora', '>', desde), orderBy('fechaHora', 'desc'));
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

export async function deleteSocio(id) {
  await deleteDoc(doc(db, 'socios', id));

  if (SHEETS_SYNC_URL) {
    try {
      await fetch(SHEETS_SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', dni: id }),
      });
    } catch {
      // sync falla silenciosamente — Firestore ya está actualizado
    }
  }
}

export async function addSocio({ nombre, dni, fechaVencimiento }) {
  const id = dni.trim();
  const data = {
    nombre: nombre.trim(),
    dni: id,
    fechaVencimiento: fechaVencimiento ? Timestamp.fromDate(fechaVencimiento) : null,
  };
  await setDoc(doc(db, 'socios', id), data);

  if (SHEETS_SYNC_URL) {
    try {
      await fetch(SHEETS_SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          nombre: data.nombre,
          dni: id,
          fechaVencimiento: fechaVencimiento ? fechaVencimiento.toISOString() : null,
        }),
      });
    } catch {
      // sync falla silenciosamente — Firestore ya está actualizado
    }
  }
}

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
  const byHour    = Array(24).fill(0);
  const byDay     = Array(7).fill(0);
  const byDayHour = Array(7).fill(null).map(() => Array(24).fill(0)); // [día][hora]
  snap.docs.forEach(d => {
    const date = d.data().fechaHora?.toDate?.();
    if (!date) return;
    const h   = date.getHours();
    const day = date.getDay();
    byHour[h]++;
    byDay[day]++;
    byDayHour[day][h]++;
  });
  return { byHour, byDay, byDayHour };
}

export async function findUserByDni(dni) {
  const buscado = dni.trim();
  let data = null;
  const uid = await duenoDelDni(buscado).catch(() => null);
  if (uid) {
    const snap = await getDoc(doc(db, 'users', uid));
    data = snap.exists() ? snap.data() : null;
  } else {
    // Cuentas que todavía no movieron sus datos personales.
    const snap = await getDocs(query(collection(db, 'users'), where('dni', '==', buscado)));
    data = snap.empty ? null : snap.docs[0].data();
  }
  if (!data) return null;
  return {
    nombre: [data.nombre, data.apellido].filter(Boolean).join(' '),
    dni: buscado,
  };
}

// Advance the user's routine day index on each new gym visit (once per day).
// Returns the index to use today.
export async function advanceRoutineDay(uid, diasCount) {
  if (!uid || !diasCount) return 0;
  const today = todayDateString();
  try {
    const ref  = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return 0;
    const { gymRoutineDayIndex, lastGymVisitDate } = snap.data();
    if (lastGymVisitDate === today) {
      return gymRoutineDayIndex ?? 0;
    }
    const nextIndex = gymRoutineDayIndex == null
      ? 0
      : (gymRoutineDayIndex + 1) % diasCount;
    await updateDoc(ref, { gymRoutineDayIndex: nextIndex, lastGymVisitDate: today });
    return nextIndex;
  } catch { return 0; }
}

// Misma regla de "presente" que usa el panel admin: algún check-in de ese DNI,
// no marcado inactivo, dentro de la ventana ACTIVE_MS y del día de hoy.
// Compartida por subscribeToUserPresence (listener en vivo) y
// getUserPresenceOnce (chequeo puntual, sin listener — ver más abajo).
function computePresence(docs) {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const midnightMs = midnight.getTime();
  const cutoffMs   = Date.now() - ACTIVE_MS;

  let latestCheckinMs = 0;
  const present = docs.some(d => {
    const data = d.data();
    if (data.activo === false) return false;
    const ms = data.fechaHora?.toMillis?.() ?? 0;
    if (ms > latestCheckinMs) latestCheckinMs = ms;
    return ms > midnightMs && ms > cutoffMs;
  });

  return { present, latestCheckinMs };
}

// Subscribe to whether a specific DNI has an active check-in within the last ACTIVE_MS.
// Applies the same 90-min window as the admin panel.
// Also schedules a local timer to auto-clear presence when the window expires,
// so the banner disappears even if Firestore doesn't update.
export function subscribeToUserPresence(gymDni, onPresent) {
  let expiryTimer = null;

  const q = query(COL, where('dni', '==', gymDni.trim()));
  const unsub = onSnapshot(q, snap => {
    if (expiryTimer) { clearTimeout(expiryTimer); expiryTimer = null; }

    const { present, latestCheckinMs } = computePresence(snap.docs);
    onPresent(present, latestCheckinMs);

    if (present && latestCheckinMs > 0) {
      const remaining = ACTIVE_MS - (Date.now() - latestCheckinMs);
      if (remaining > 0) expiryTimer = setTimeout(() => onPresent(false, latestCheckinMs), remaining);
    }
  }, err => {
    console.error('[GymPresence] Firestore error:', err.code, err.message);
    onPresent(false, 0);
  });

  return () => { if (expiryTimer) clearTimeout(expiryTimer); unsub(); };
}

// Chequeo puntual (sin listener) de la misma presencia, para usar desde la
// tarea en background — ahí no hay un componente montado que pueda sostener
// un onSnapshot en vivo. Devuelve { present, latestCheckinMs }.
export async function getUserPresenceOnce(gymDni) {
  const q = query(COL, where('dni', '==', gymDni.trim()));
  const snap = await getDocs(q);
  return computePresence(snap.docs);
}