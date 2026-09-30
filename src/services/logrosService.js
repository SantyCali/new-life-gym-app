// Estado y cobro de los logros repetibles, más la reparación de los datos que
// rompía el sistema anterior.
//
// Cómo funciona ahora: en users/{uid}.logros.{id} se guarda
//   base        → valor del campo (racha, visitas, xpTotal) al completarlo
//   baseFecha   → para la racha, el último día activo al completarlo
//   completadoEn→ cuándo se completó (ms)
// El progreso es "valor actual − base". Durante VENTANA_LOGRO_MS después de
// completarse se muestra en verde; pasado eso ya cuenta desde cero solo, sin
// temporizadores (el anterior vivía en memoria: si la app se cerraba antes de
// los 5 minutos, el logro quedaba en verde para siempre).
import {
  collection, doc, getDocs, query, runTransaction, updateDoc, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { LOGROS_DEF, VENTANA_LOGRO_MS } from '../constants/logros';
import { applyXPGain, xpToNextLevel } from './gamificationService';
import { localDateString } from './stepService';
import { torneoTerminado } from './torneoService';

function valorCampo(def, perfil) {
  return Math.max(0, Number(perfil?.[def.campo] ?? 0));
}

// Escudo para los celulares con la versión vieja: esa versión da el logro
// cuando su valor llega al total y el id NO está en logrosCompletados (y 5
// minutos después intentaba borrar el dato; eso ahora lo rechazan las reglas
// de Firestore). Para que no lo vuelva a dar, el id tiene que estar en la
// lista apenas el valor alcanza el total. Solo esos: poner los tres dejaba los
// logros en verde fijo en la versión vieja. La versión nueva no usa la lista.
function idsQueFaltanEnLista(perfil) {
  const lista = perfil?.logrosCompletados ?? [];
  return LOGROS_DEF
    .filter((d) => valorCampo(d, perfil) >= d.total && !lista.includes(d.id))
    .map((d) => d.id);
}

function restarDias(fecha, dias) {
  const [y, m, d] = fecha.split('-').map(Number);
  return localDateString(new Date(y, m - 1, d - dias));
}

// Para la racha la base solo vale si sigue siendo la MISMA racha: si se cortó
// y volvió a empezar, el progreso arranca de nuevo desde el valor actual.
function baseVigente(def, estado, perfil) {
  if (!estado) return 0;
  const actual = valorCampo(def, perfil);
  if (actual < estado.base) return 0; // el dato bajó: racha cortada o reset de prueba
  if (def.campo === 'racha') {
    const ultima = perfil?.lastActiveDate;
    if (!ultima || !estado.baseFecha || actual === 0) return 0;
    const inicioRachaActual = restarDias(ultima, actual - 1);
    if (inicioRachaActual > estado.baseFecha) return 0;
  }
  return estado.base;
}

// { progreso, completado } para mostrar en pantalla.
export function estadoLogro(def, perfil, ahora = Date.now()) {
  const estado = perfil?.logros?.[def.id];
  if (estado?.completadoEn && ahora - estado.completadoEn < VENTANA_LOGRO_MS) {
    return { progreso: def.total, completado: true };
  }
  // Completado con el sistema viejo y todavía sin migrar: se muestra en cero
  // (la migración le fija la base al abrir la app).
  if (!estado && (perfil?.logrosCompletados ?? []).includes(def.id)) {
    return { progreso: 0, completado: false };
  }
  const progreso = valorCampo(def, perfil) - baseVigente(def, estado, perfil);
  return { progreso: Math.max(0, Math.min(def.total, progreso)), completado: false };
}

// Completa el logro y da sus puntos, en transacción para que dos celulares
// abiertos a la vez no lo cobren dos veces. `forzar` es para el botón de
// prueba de los testers.
export async function completarLogro(uid, def, { forzar = false } = {}) {
  if (!uid) return false;
  const ref = doc(db, 'users', uid);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return false;
    const perfil = snap.data();
    if (!perfil.logrosMigradoV2) return false; // primero la migración
    const { progreso, completado } = estadoLogro(def, perfil);
    if (completado) return false;
    if (!forzar && progreso < def.total) return false;

    const xpTotal = (perfil.xpTotal ?? 0) + def.xp;
    const despues = { ...perfil, xpTotal };
    tx.update(ref, {
      ...applyXPGain(perfil.xp ?? 0, perfil.nivelJuego ?? 1, def.xp),
      xpTotal,
      // Premio, no actividad: los torneos lo descuentan (ver awardXPAndCoins).
      xpExtra: (perfil.xpExtra ?? 0) + def.xp,
      // escudo para la versión vieja (ver idsQueFaltanEnLista)
      logrosCompletados: [...new Set([...(perfil.logrosCompletados ?? []), ...idsQueFaltanEnLista(despues)])],
      [`logros.${def.id}`]: {
        base: valorCampo(def, despues),
        baseFecha: perfil.lastActiveDate ?? null,
        completadoEn: Date.now(),
      },
    });
    return true;
  });
}

export async function revisarLogros(uid, perfil) {
  if (!uid || !perfil?.logrosMigradoV2) return;
  for (const def of LOGROS_DEF) {
    const { progreso, completado } = estadoLogro(def, perfil);
    if (!completado && progreso >= def.total) {
      try { await completarLogro(uid, def); } catch {}
    }
  }
}

// ── Migración y reparación ────────────────────────────────────────────────────

// Total de puntos ganados en la vida, según el nivel y los puntos dentro del
// nivel. Esos dos datos nunca se borraban, así que sirven para recuperar el
// xpTotal que el sistema anterior ponía en 0.
function xpAcumulado(nivel, xp) {
  let total = xp ?? 0;
  for (let n = 1; n < (nivel ?? 1); n++) total += xpToNextLevel(n);
  return total;
}

// Los torneos miden "xpTotal actual − xpTotal al entrar". Si alguien entró a un
// torneo después de que le borraran el xpTotal, su punto de partida quedó en
// la escala borrada: al recuperar el total hay que correrlo lo mismo, o se le
// sumarían en el torneo puntos que ganó antes de entrar.
async function corregirTorneos(uid, deltaXp, deltaGym, xpAntes, gymAntes) {
  if (!(deltaXp > 0) && !(deltaGym > 0)) return;
  try {
    const torneos = await getDocs(query(collection(db, 'torneos'), where('participantUids', 'array-contains', uid)));
    for (const t of torneos.docs) {
      if (torneoTerminado(t.data())) continue; // la tabla ya quedó congelada
      const parts = await getDocs(query(collection(db, 'torneos', t.id, 'participantes'), where('uid', '==', uid)));
      for (const p of parts.docs) {
        const { xpTotalInicio = 0, gymInicio = 0 } = p.data();
        const upd = {};
        if (deltaXp > 0 && xpTotalInicio <= xpAntes) upd.xpTotalInicio = xpTotalInicio + deltaXp;
        if (deltaGym > 0 && gymInicio <= gymAntes) upd.gymInicio = gymInicio + deltaGym;
        if (Object.keys(upd).length) await updateDoc(p.ref, upd).catch(() => {});
      }
    }
  } catch {}
}

// Racha según el historial de pasos: días seguidos llegando a la meta,
// terminando hoy (si ya se llegó) o ayer. Solo sirve para subir una racha que
// la versión vieja haya borrado; nunca la baja.
function rachaSegunHistorial(pasosPorDia, meta) {
  const hoy = localDateString(new Date());
  let fecha = (pasosPorDia[hoy] ?? 0) >= meta ? hoy : restarDias(hoy, 1);
  const fin = fecha;
  let racha = 0;
  while ((pasosPorDia[fecha] ?? 0) >= meta) {
    racha++;
    fecha = restarDias(fecha, 1);
  }
  return { racha, lastActiveDate: racha > 0 ? fin : null };
}

// Corre cada vez que se abre la app (no una sola vez): migra el sistema viejo
// y repara lo que una versión vieja instalada en otro celular pueda haber
// borrado mientras tanto.
export async function migrarYRepararLogros(uid) {
  if (!uid) return;
  const ref = doc(db, 'users', uid);

  // Afuera de la transacción: las consultas no pueden ir adentro.
  let diasDeGym = 0;
  const pasosPorDia = {};
  try { diasDeGym = (await getDocs(collection(db, 'users', uid, 'gymHistory'))).size; } catch {}
  try {
    const desde = restarDias(localDateString(new Date()), 60);
    const snap = await getDocs(query(collection(db, 'users', uid, 'stepsHistory'), where('date', '>=', desde)));
    snap.docs.forEach((d) => { pasosPorDia[d.data().date ?? d.id] = d.data().steps ?? 0; });
  } catch {}

  const cambios = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return null;
    const p = snap.data();
    const upd = {};

    // Un tester que usó Reset quiere sus contadores en 0 para probar: no se
    // le reparan hasta que restaure su estado (ver RetosScreen/PerfilScreen).
    const reparar = !p.sinAutoReparar;
    const xpAntes = p.xpTotal ?? 0;
    const gymAntes = p.gymVisitCount ?? 0;
    const xpTotal = reparar ? Math.max(xpAntes, xpAcumulado(p.nivelJuego, p.xp)) : xpAntes;
    const gymVisitCount = reparar ? Math.max(gymAntes, diasDeGym) : gymAntes;
    if (xpTotal > xpAntes) upd.xpTotal = xpTotal;
    if (gymVisitCount > gymAntes) upd.gymVisitCount = gymVisitCount;

    const calc = reparar ? rachaSegunHistorial(pasosPorDia, p.dailyStepGoal ?? 10000) : { racha: 0, lastActiveDate: null };
    const racha = Math.max(p.racha ?? 0, calc.racha);
    if (calc.racha > (p.racha ?? 0)) {
      upd.racha = calc.racha;
      upd.lastActiveDate = calc.lastActiveDate;
      if (calc.racha > (p.mejorRacha ?? 0)) upd.mejorRacha = calc.racha;
    }

    // Primera vez: base de cada logro. Si ya estaba completado con el sistema
    // viejo, o si el valor ya alcanza el total (se completó y el sistema viejo
    // lo reinició borrando el dato), arranca desde el valor actual sin volver
    // a cobrarse. Si no, conserva el progreso.
    if (!p.logrosMigradoV2) {
      upd.logrosMigradoV2 = true;
      const reparado = { ...p, xpTotal, gymVisitCount, racha, lastActiveDate: upd.lastActiveDate ?? p.lastActiveDate };
      const legado = new Set(p.logrosCompletados ?? []);
      for (const def of LOGROS_DEF) {
        if (p.logros?.[def.id]) continue;
        const valor = valorCampo(def, reparado);
        const arrancaDeCero = legado.has(def.id) || valor >= def.total;
        upd[`logros.${def.id}`] = {
          base: arrancaDeCero ? valor : 0,
          baseFecha: arrancaDeCero ? (reparado.lastActiveDate ?? null) : null,
          completadoEn: null,
        };
      }
    }

    const faltan = idsQueFaltanEnLista({ ...p, xpTotal, gymVisitCount, racha });
    if (faltan.length) upd.logrosCompletados = [...(p.logrosCompletados ?? []), ...faltan];

    if (!Object.keys(upd).length) return null;
    tx.update(ref, upd);
    return { deltaXp: xpTotal - xpAntes, deltaGym: gymVisitCount - gymAntes, xpAntes, gymAntes };
  });

  if (cambios) {
    await corregirTorneos(uid, cambios.deltaXp, cambios.deltaGym, cambios.xpAntes, cambios.gymAntes);
  }
}
