// Acreditación de puntos por pasos, válida con la app abierta o cerrada.
//
// Antes los puntos se calculaban solo dentro de la pantalla (StepContext),
// comparando contra marcas guardadas en el celular: si el usuario no abría la
// app, los pasos se contaban y se subían, pero nunca sumaban puntos, ni para él
// ni para los torneos (que se miden por xpTotal).
//
// Ahora cada día tiene su registro en users/{uid}/stepsHistory/{fecha}:
//   steps       → mejor total conocido de ese día
//   xpOtorgado  → cuántos puntos ya se dieron por esos pasos
//   metaCumplida→ si ese día ya contó para la racha
// Los puntos que corresponden a un total de pasos siempre dan lo mismo
// (xpPorPasos), así que acreditar es sumar la diferencia entre lo que
// corresponde y lo que ya se dio. Se hace en una transacción: se puede llamar
// muchas veces, desde la app, desde segundo plano o desde dos celulares a la
// vez, y nunca da puntos de más ni pierde ninguno.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { stepMilestones } from '../constants/mockData';
import { XP_PER_1K_STEPS, XP_GOAL_BONUS, applyXPGain } from './gamificationService';
import { todayDateString, localDateString } from './stepService';

const DEFAULT_GOAL = 10000;

// Mismas reglas que tenía StepContext: 20 puntos cada mil pasos, 50 al llegar a
// la meta diaria y los hitos fijos (2K, 5K, 7.4K, 25K).
export function xpPorPasos(steps, goal = DEFAULT_GOAL) {
  if (!steps || steps <= 0) return 0;
  let xp = Math.floor(steps / 1000) * XP_PER_1K_STEPS;
  if (steps >= goal) xp += XP_GOAL_BONUS;
  for (const m of stepMilestones) {
    if (steps >= m.steps) xp += m.xp;
  }
  return xp;
}

function diaAnterior(fecha) {
  const [y, m, d] = fecha.split('-').map(Number);
  return localDateString(new Date(y, m - 1, d - 1));
}

// ── Migración desde el sistema anterior ───────────────────────────────────────
// El día que este código corre por primera vez para un usuario, los puntos de
// hoy ya pudieron haberse dado con el método viejo, que dejaba marcas en el
// celular. Se leen para no volver a darlos. Los días anteriores a esa fecha no
// se acreditan: no hay forma de saber qué se había dado y se darían dos veces.
async function leerMarcasViejas(fecha) {
  try {
    const [k, hitos] = await Promise.all([
      AsyncStorage.getItem(`rewarded_k_${fecha}`),
      AsyncStorage.getItem(`milestones_${fecha}`),
    ]);
    return {
      miles: parseInt(k ?? '0', 10) || 0,
      hitos: new Set(hitos ? JSON.parse(hitos) : []),
    };
  } catch {
    return { miles: 0, hitos: new Set() };
  }
}

function xpDeMarcasViejas({ miles, hitos }, goal) {
  let xp = miles * XP_PER_1K_STEPS;
  if (miles * 1000 >= goal) xp += XP_GOAL_BONUS;
  for (const m of stepMilestones) if (hitos.has(m.steps)) xp += m.xp;
  return xp;
}

// Para no gastar lecturas repitiendo días que ya están al día: se recuerda
// localmente el último total acreditado de cada fecha.
const cacheKey = (uid, fecha) => `pasos_acreditados_${uid}_${fecha}`;

// Acredita los pasos de un día. Devuelve los puntos sumados en esta llamada.
export async function acreditarPasosDelDia(uid, fecha, steps) {
  if (!uid || !fecha || !(steps > 0)) return 0;

  try {
    const cacheado = parseInt((await AsyncStorage.getItem(cacheKey(uid, fecha))) ?? '0', 10) || 0;
    if (steps <= cacheado) return 0;
  } catch {}

  const hoy = todayDateString();
  // Afuera de la transacción porque Firestore puede reintentarla; solo se usa
  // el día de la migración.
  const marcasViejas = await leerMarcasViejas(fecha);

  const userRef = doc(db, 'users', uid);
  const dayRef  = doc(db, 'users', uid, 'stepsHistory', fecha);

  const resultado = await runTransaction(db, async (tx) => {
    const [userSnap, daySnap] = [await tx.get(userRef), await tx.get(dayRef)];
    if (!userSnap.exists()) return { sumado: 0, pasos: steps };

    const user = userSnap.data();
    const dia  = daySnap.exists() ? daySnap.data() : {};
    const goal = user.dailyStepGoal ?? DEFAULT_GOAL;
    const pasos = Math.max(steps, dia.steps ?? 0);

    const updatesUser = {};
    const desde = user.pasosXpDesde ?? hoy;
    if (!user.pasosXpDesde) updatesUser.pasosXpDesde = hoy;

    const updatesDia = { date: fecha, steps: pasos };
    let sumado = 0;

    if (fecha >= desde) {
      let yaDado = dia.xpOtorgado;
      if (yaDado == null) {
        yaDado = fecha === desde ? xpDeMarcasViejas(marcasViejas, goal) : 0;
      }

      const corresponde = xpPorPasos(pasos, goal);
      sumado = Math.max(0, corresponde - yaDado);
      updatesDia.xpOtorgado = Math.max(corresponde, yaDado);

      if (sumado > 0) {
        Object.assign(
          updatesUser,
          applyXPGain(user.xp ?? 0, user.nivelJuego ?? 1, sumado),
          { xpTotal: (user.xpTotal ?? 0) + sumado },
        );
      }

      // Racha: el día cuenta una sola vez, cuando llega a la meta.
      if (pasos >= goal && !dia.metaCumplida) {
        updatesDia.metaCumplida = true;
        const ultima = user.lastActiveDate ?? null;
        let racha = null;
        if (ultima === fecha)                 racha = null;           // ya contado
        else if (ultima === diaAnterior(fecha)) racha = (user.racha ?? 0) + 1;
        else if (!ultima || ultima < fecha)     racha = 1;
        // ultima > fecha: se está completando un día viejo después de uno más
        // nuevo; no se toca la racha para no romperla.
        if (racha != null) {
          updatesUser.racha = racha;
          updatesUser.lastActiveDate = fecha;
          if (racha > (user.mejorRacha ?? 0)) updatesUser.mejorRacha = racha;
        }
      }
    }

    // Lo que ve el entrenador en el progreso del cliente.
    if (fecha === hoy) {
      updatesUser.stepsToday = pasos;
      updatesUser.stepsDate = hoy;
      updatesUser.stepsUpdatedAt = serverTimestamp();
    }

    tx.set(dayRef, updatesDia, { merge: true });
    if (Object.keys(updatesUser).length) tx.update(userRef, updatesUser);
    return { sumado, pasos };
  });

  try { await AsyncStorage.setItem(cacheKey(uid, fecha), String(resultado.pasos)); } catch {}
  return resultado.sumado;
}

// Acredita varios días en orden de fecha (importa para la racha).
export async function acreditarDias(uid, pasosPorFecha) {
  const fechas = Object.keys(pasosPorFecha).sort();
  let total = 0;
  for (const fecha of fechas) {
    try {
      total += await acreditarPasosDelDia(uid, fecha, pasosPorFecha[fecha]);
    } catch {
      // sin conexión o conflicto: se reintenta en la próxima pasada
    }
  }
  return total;
}
