// Visitas al gym acreditadas desde el historial de ingresos, no desde "estar
// en sala" en el momento.
//
// Antes la visita (+XP_GYM_VISIT, +1 visita) solo se acreditaba si la app se
// daba cuenta mientras la persona estaba en sala (90 min): con la app cerrada
// todo ese rato, la visita se perdía para siempre (nivel, logros y torneos).
// Pero cada ingreso con DNI queda guardado en ingresosActivos (es el historial
// del panel web), así que al sincronizar se revisan los últimos 30 días y se
// acreditan las visitas que falten, una por día.
//
// Cada día acreditado queda marcado en users/{uid}/visitasGym/{fecha}, en una
// transacción: se puede llamar muchas veces, desde la app, desde segundo
// plano o desde dos celulares, y nunca da una visita dos veces. (No se usa
// gymHistory porque partes de la app lo reescriben entero y borrarían la marca.)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, where, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { XP_GYM_VISIT, applyXPGain } from './gamificationService';
import { todayDateString, localDateString } from './stepService';
import { getClientRoutine } from './routineService';

const DIAS_ATRAS = 30;
const VENTANA_MS = 90 * 60 * 1000;   // un ingreso dura como mucho 90 min en sala
const MIN_ESTIMADOS = 75;            // sin salida marcada: sesión típica…

// …salvo que su rutina dure más: entonces lo que dura su rutina. Misma cuenta
// que Mi Rutina (8 min por ejercicio, mínimo 15), promedio de sus días (no se
// sabe qué día hizo en cada visita).
function minutosDeRutina(rutina) {
  const dias = (rutina?.dias ?? []).filter((d) => (d.ejercicios ?? []).length > 0);
  if (!dias.length) return 0;
  const total = dias.reduce((acc, d) => acc + Math.max(15, d.ejercicios.length * 8), 0);
  return Math.round(total / dias.length);
}

// Minutos de gym de un día según sus ingresos (para las calorías), cuando la
// app no estuvo abierta para medirlos: entrada → salida marcada (hasta 90
// min), o 60 min si no se marcó la salida. null si todavía está en sala.
function minutosDelDia(ingresos, estimadoSinSalida) {
  let mejor = 0;
  let estimado = false;
  for (const i of ingresos) {
    const entrada = i.fechaHora?.toMillis?.();
    if (!entrada) continue;
    const salida = i.salidaEn?.toMillis?.();
    if (!salida && Date.now() < entrada + VENTANA_MS) return null; // sigue en sala
    const min = salida
      ? Math.max(1, Math.round(Math.min(salida - entrada, VENTANA_MS) / 60000))
      : estimadoSinSalida;
    if (min > mejor) { mejor = min; estimado = !salida; }
  }
  return mejor ? { minutes: mejor, estimado } : null;
}

// Guarda los minutos del día solo si la app abierta no los midió ya.
async function completarMinutos(uid, fecha, ingresos, estimadoSinSalida) {
  const calc = minutosDelDia(ingresos, estimadoSinSalida);
  if (!calc) return;
  const ref = doc(db, 'users', uid, 'gymHistory', fecha);
  const snap = await getDoc(ref);
  if (snap.exists() && snap.data().minutes > 0) return;
  await setDoc(ref, { date: fecha, minutes: calc.minutes, estimado: calc.estimado }, { merge: true });
}
const cacheKey = (uid, fecha) => `gym_acreditado_${uid}_${fecha}`;

// Acredita la visita de un día si todavía no se dio. Devuelve los XP sumados.
export async function acreditarVisitaDelDia(uid, fecha) {
  if (!uid || !fecha) return 0;
  try { if ((await AsyncStorage.getItem(cacheKey(uid, fecha))) === '1') return 0; } catch {}

  const hoy = todayDateString();
  const userRef = doc(db, 'users', uid);
  const visitaRef = doc(db, 'users', uid, 'visitasGym', fecha);

  const sumado = await runTransaction(db, async (tx) => {
    const [userSnap, visitaSnap] = [await tx.get(userRef), await tx.get(visitaRef)];
    if (!userSnap.exists() || visitaSnap.exists()) return 0;
    const user = userSnap.data();

    // Primera vez que corre para esta cuenta: los días anteriores no se tocan
    // (no hay forma de saber si el sistema viejo ya los había dado).
    const desde = user.gymXpDesde ?? hoy;
    const extra = user.gymXpDesde ? {} : { gymXpDesde: hoy };

    if (fecha < desde) {
      tx.set(visitaRef, { fecha, xp: 0, anterior: true, en: serverTimestamp() });
      if (Object.keys(extra).length) tx.update(userRef, extra);
      return 0;
    }
    // Ya la dio el sistema de "en sala" (checkAndAwardGymReward) ese día.
    if (user.lastGymRewardDate === fecha) {
      tx.set(visitaRef, { fecha, xp: XP_GYM_VISIT, en: serverTimestamp() });
      if (Object.keys(extra).length) tx.update(userRef, extra);
      return 0;
    }

    tx.update(userRef, {
      ...extra,
      ...applyXPGain(user.xp ?? 0, user.nivelJuego ?? 1, XP_GYM_VISIT),
      xpTotal: increment(XP_GYM_VISIT),
      gymVisitCount: increment(1),
      // Para que "en sala" no la vuelva a dar si es de hoy.
      ...(fecha === hoy ? { lastGymRewardDate: hoy } : {}),
    });
    tx.set(visitaRef, { fecha, xp: XP_GYM_VISIT, en: serverTimestamp() });
    return XP_GYM_VISIT;
  });

  try { await AsyncStorage.setItem(cacheKey(uid, fecha), '1'); } catch {}
  return sumado;
}

// Revisa los ingresos de los últimos 30 días y acredita los que falten.
export async function acreditarVisitasGym(uid, gymDni) {
  const dni = String(gymDni ?? '').trim();
  if (!uid || !dni) return 0;
  const hoy = todayDateString();
  const limite = new Date();
  limite.setDate(limite.getDate() - DIAS_ATRAS);
  const desde = localDateString(limite);

  // Por DNI solo (sin orderBy: no hace falta índice; los ingresos de una
  // persona son pocos) y la fecha se filtra acá.
  const snap = await getDocs(query(collection(db, 'ingresosActivos'), where('dni', '==', dni)));
  const porDia = {};
  for (const d of snap.docs) {
    const f = d.data().fechaHora?.toDate?.();
    if (!f) continue;
    const fecha = localDateString(f);
    if (fecha < desde || fecha > hoy) continue;
    (porDia[fecha] ??= []).push(d.data());
  }

  // Minutos estimados para las visitas sin salida marcada.
  const rutina = await getClientRoutine(uid).catch(() => null);
  const estimadoSinSalida = Math.max(MIN_ESTIMADOS, minutosDeRutina(rutina));

  let total = 0;
  for (const fecha of Object.keys(porDia).sort()) {
    try { total += await acreditarVisitaDelDia(uid, fecha); } catch {}
    try { await completarMinutos(uid, fecha, porDia[fecha], estimadoSinSalida); } catch {}
  }
  return total;
}
