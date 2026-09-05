import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, updateDoc, increment, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { todayDateString, localDateString } from './stepService';

// ── XP constants ──────────────────────────────────────────────────────────────
export const XP_PER_1K_STEPS  = 20;
export const XP_GOAL_BONUS    = 50;
export const XP_GYM_VISIT     = 150;
export const STEPS_FOR_STREAK = 5000;

// XP needed to go from level N to N+1
export function xpToNextLevel(level) { return Math.max(1, level) * 1000; }

function applyXPGain(currentXP, currentLevel, xpGain) {
  let xp    = (currentXP ?? 0) + xpGain;
  let level = (currentLevel ?? 1);
  while (xp >= xpToNextLevel(level)) {
    xp -= xpToNextLevel(level);
    level++;
  }
  return { xp: Math.max(0, xp), nivelJuego: level };
}

let _awarding = false;
export async function awardXPAndCoins(uid, xpGain) {
  if (!uid || !xpGain || _awarding) return;
  _awarding = true;
  try {
    const ref  = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const { xp = 0, nivelJuego = 1 } = snap.data();
    const updated = applyXPGain(xp, nivelJuego, xpGain);
    await updateDoc(ref, { ...updated, xpTotal: increment(xpGain) });
  } catch {}
  finally { _awarding = false; }
}

// Otorga los XP de "asistencia al gym" una sola vez por día (por fecha, no por
// sesión) — mismo campo lastGymRewardDate de siempre. Usa una transacción para
// que el chequeo "¿ya se premió hoy?" y la escritura sean atómicos: si esta
// función se llega a llamar dos veces casi al mismo tiempo (p.ej. una segunda
// detección de "entrada" tras cerrar/reabrir la app dentro de la ventana de
// presencia), Firestore reintenta la segunda transacción con el dato ya
// actualizado y esta corta por el mismo chequeo — no puede duplicarse.
//
// A propósito NO atrapa errores acá: si falla por falta de conexión, el error
// se propaga para que el llamador pueda distinguir "ya premiado hoy" (false)
// de "no se pudo confirmar" (excepción) y decidir si guardar un pendiente
// offline — ver markGymRewardPending/flushPendingGymReward más abajo.
export async function checkAndAwardGymReward(uid) {
  if (!uid) return false;
  const today = todayDateString();
  const ref = doc(db, 'users', uid);
  return await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return false;
    const { lastGymRewardDate, xp = 0, nivelJuego = 1 } = snap.data();
    if (lastGymRewardDate === today) return false;
    const updated = applyXPGain(xp, nivelJuego, XP_GYM_VISIT);
    tx.update(ref, {
      ...updated,
      lastGymRewardDate: today,
      gymVisitCount:     increment(1),
    });
    return true;
  });
}

// ── Recompensa de gym pendiente de sincronizar (offline) ───────────────────────
// No es un sistema de recompensas alternativo: es solo una marca local ("hubo
// una entrada hoy que no se pudo confirmar contra Firestore") que sobrevive al
// cierre/reapertura de la app vía AsyncStorage. checkAndAwardGymReward (arriba,
// con su transacción) sigue siendo la única autoridad que efectivamente otorga
// XP — esto solo recuerda "reintentar esa misma llamada más tarde".
const gymRewardPendingKey = (uid) => `gymRewardPending_${uid}`;

// Idempotente: si el usuario entra varias veces offline el mismo día, cada
// intento fallido vuelve a escribir la MISMA fecha — nunca se acumulan marcas.
export async function markGymRewardPending(uid) {
  if (!uid) return;
  try { await AsyncStorage.setItem(gymRewardPendingKey(uid), todayDateString()); } catch {}
}

export async function clearGymRewardPending(uid) {
  if (!uid) return;
  try { await AsyncStorage.removeItem(gymRewardPendingKey(uid)); } catch {}
}

// Reintenta la recompensa pendiente contra Firestore. Se llama en puntos ya
// existentes del ciclo de vida (montaje del provider, AppState → 'active') —
// no agrega ningún listener nuevo.
export async function flushPendingGymReward(uid) {
  if (!uid) return;
  let pendingDate;
  try { pendingDate = await AsyncStorage.getItem(gymRewardPendingKey(uid)); } catch { return; }
  if (!pendingDate) return;

  if (pendingDate !== todayDateString()) {
    // Quedó pendiente de un día anterior sin haber recuperado conexión a
    // tiempo. checkAndAwardGymReward siempre opera sobre "hoy", así que
    // reintentarlo ahora ya no correspondería al día real de esa visita —
    // se descarta en vez de adjudicar XP al día equivocado.
    await clearGymRewardPending(uid);
    return;
  }

  try {
    // Resuelve (true u false) ⇒ Firestore ya tiene una respuesta autoritativa
    // para hoy (se otorgó ahora, o ya estaba otorgado) — el pendiente deja de
    // ser necesario en cualquiera de los dos casos.
    await checkAndAwardGymReward(uid);
    await clearGymRewardPending(uid);
  } catch {
    // Sigue sin poder confirmarse (todavía sin conexión) — se deja la marca
    // para el próximo intento.
  }
}

export async function updateStreak(uid, currentRacha, lastActiveDate) {
  if (!uid) return;
  const today = todayDateString();
  if (lastActiveDate === today) return;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = localDateString(yesterday);
  const newRacha = lastActiveDate === yStr ? (currentRacha ?? 0) + 1 : 1;
  try {
    const ref  = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    const mejorRacha = snap.exists() ? (snap.data().mejorRacha ?? 0) : 0;
    const updates = { lastActiveDate: today, racha: newRacha };
    if (newRacha > mejorRacha) updates.mejorRacha = newRacha;
    await updateDoc(ref, updates);
  } catch {}
}

// updateStreak (arriba) solo se llama cuando el usuario SÍ llega al objetivo del
// día — nunca escribe nada si falla, así que la racha quedaba con el último
// valor guardado hasta la próxima vez que volviera a cumplir el objetivo (se
// veía "trabada" durante los días de por medio en vez de mostrar 0). Esta
// función corta esa racha apenas se detecta el corte real: si ya pasó al menos
// un día completo sin actividad (lastActiveDate no es hoy NI ayer, o sea que
// ayer no se llegó al objetivo), la reinicia a 0 sin esperar a que el usuario
// vuelva a cumplir el objetivo.
export async function resetStreakIfBroken(uid, currentRacha, lastActiveDate) {
  if (!uid || !((currentRacha ?? 0) > 0)) return;
  const today = todayDateString();
  if (lastActiveDate === today) return;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = localDateString(yesterday);
  // Si el último día activo fue ayer, todavía puede salvar la racha hoy —
  // no se corta hasta que efectivamente pase el día sin lograrlo.
  if (lastActiveDate === yStr) return;
  try {
    await updateDoc(doc(db, 'users', uid), { racha: 0 });
  } catch {}
}