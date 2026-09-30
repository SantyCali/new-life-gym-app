import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import useSteps from '../hooks/useSteps';
import useAuth from '../hooks/useAuth';
import useUserProfile from '../hooks/useUserProfile';
import {
  calcCalories, calcDistanceKm, computeAge, todayDateString, openHealthConnectInstall,
} from '../services/stepService';
import {
  checkAndAwardGymReward,
  markGymRewardPending, clearGymRewardPending,
} from '../services/gamificationService';
import { subscribeToUserPresence } from '../services/gymService';
import { sincronizarPasosYPuntos } from '../services/backgroundStepsSync';
import { acreditarPasosDelDia, xpPorPasos } from '../services/stepRewardsService';

const DEFAULT_GOAL = 10000;
const GOAL_KEY = 'dailyStepGoal'; // misma clave que usaban Inicio y Racha
const GOAL_MIGRATED_KEY = 'dailyStepGoal_enPerfil';
const StepContext  = createContext(null);

export function StepProvider({ children }) {
  const { user }    = useAuth();
  const { steps, available, loading, hcStatus, connectHC } = useSteps(user?.uid);
  const { profile } = useUserProfile();

  const weightKg = profile?.peso    ? Number(profile.peso)   : 70;
  const heightCm = profile?.altura  ? Number(profile.altura) : 170;
  const ageYears = computeAge(profile?.fechaNacimiento);

  // "calories" = activas (netas, exclusivas de caminar) — es lo que muestra la
  // tarjeta "Quemadas" del Home. "totalCalories" queda disponible para quien
  // necesite el gasto bruto (incluye lo que se hubiese quemado en reposo).
  const { active: calories, total: totalCalories } = calcCalories(steps, weightKg, heightCm, ageYears, profile?.sexo);
  const distanceKm = calcDistanceKm(steps, heightCm);

  // Keep latest profile in a ref so gamification effects don't depend on profile object
  const profileRef = useRef(profile);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  // ── Meta diaria de pasos ─────────────────────────────────────────────────────
  // Una sola, en el perfil (users/{uid}.dailyStepGoal), porque de ahí la leen
  // la racha y los puntos, también con la app cerrada. Antes la pantalla de
  // Inicio la guardaba solo en el celular: el usuario veía su meta (p. ej. 6000)
  // pero la racha se seguía contando con 10000. AsyncStorage queda como copia
  // para mostrarla al instante mientras carga el perfil.
  const [localGoal, setLocalGoal] = useState(null);
  useEffect(() => {
    AsyncStorage.getItem(GOAL_KEY).then((v) => { if (v) setLocalGoal(Number(v)); }).catch(() => {});
  }, []);

  // Primero la migración y recién después el perfil pisa la copia local: al
  // revés, el 10000 del perfil borraba el 6000 local antes de poder subirlo.
  //  - Una sola vez por celular: si la meta local (la de Inicio) no coincide
  //    con la del perfil, gana la local, que es la que el usuario veía.
  //  - De ahí en más manda el perfil (si se cambia en otro celular, acá se
  //    actualiza la copia).
  const perfilCargado = !!profile;
  useEffect(() => {
    if (!user?.uid || !perfilCargado) return;
    let cancelado = false;
    (async () => {
      try {
        const [local, migrado] = await Promise.all([
          AsyncStorage.getItem(GOAL_KEY),
          AsyncStorage.getItem(GOAL_MIGRATED_KEY),
        ]);
        const metaPerfil = profileRef.current?.dailyStepGoal ?? null;
        if (!migrado) {
          await AsyncStorage.setItem(GOAL_MIGRATED_KEY, '1');
          const metaLocal = local ? Number(local) : null;
          if (metaLocal && metaLocal !== metaPerfil) {
            await updateDoc(doc(db, 'users', user.uid), { dailyStepGoal: metaLocal });
            return; // el listener del perfil trae el valor nuevo
          }
        }
        if (metaPerfil && !cancelado) {
          setLocalGoal(metaPerfil);
          await AsyncStorage.setItem(GOAL_KEY, String(metaPerfil));
        }
      } catch {}
    })();
    return () => { cancelado = true; };
  }, [user?.uid, perfilCargado, profile?.dailyStepGoal]);

  const setGoal = useCallback((valor) => {
    const n = Math.max(1000, Math.min(50000, Math.round(Number(valor) || DEFAULT_GOAL)));
    setLocalGoal(n);
    AsyncStorage.setItem(GOAL_KEY, String(n)).catch(() => {});
    AsyncStorage.setItem(GOAL_MIGRATED_KEY, '1').catch(() => {});
    if (user?.uid) updateDoc(doc(db, 'users', user.uid), { dailyStepGoal: n }).catch(() => {});
  }, [user?.uid]);

  const goal = profile?.dailyStepGoal ?? localGoal ?? DEFAULT_GOAL;

  // ── Backfill: recover past day's steps that were in profile before stepsHistory existed
  useEffect(() => {
    if (!user?.uid || !profile?.stepsDate || !profile?.stepsToday) return;
    const today = todayDateString();
    if (profile.stepsDate !== today && profile.stepsToday > 100) {
      setDoc(doc(db, 'users', user.uid, 'stepsHistory', profile.stepsDate), {
        date:  profile.stepsDate,
        steps: profile.stepsToday,
      }, { merge: true }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, profile?.stepsDate]);

  // ── Pasos y puntos de los días anteriores ────────────────────────────────────
  // Al abrir la app se hace lo mismo que la tarea en segundo plano: se leen los
  // pasos que guardó el celular (historial del servicio nativo en Android, los
  // 7 días del sensor en iOS) y se acreditan sus puntos. Es idempotente, así que
  // no importa si la tarea ya lo había hecho.
  const hasSyncedHistoryRef = useRef(false);
  useEffect(() => {
    if (!user?.uid || !available || loading || hasSyncedHistoryRef.current) return;
    hasSyncedHistoryRef.current = true;
    sincronizarPasosYPuntos(user.uid).catch(() => {});
  }, [user?.uid, available, loading]);

  // ── Pasos y puntos de hoy, en vivo ───────────────────────────────────────────
  // Se acredita cada 250 pasos o cuando cambian los puntos que corresponden
  // (cada mil pasos, la meta o un hito). Los puntos ya no se calculan acá: se
  // calculan en stepRewardsService, igual para la app abierta y cerrada.
  const lastSyncedRef = useRef({ steps: 0, xp: 0 });
  const acreditarHoy = useRef(async (uid, currentSteps, goalActual) => {
    if (!uid || !(currentSteps > 0)) return;
    lastSyncedRef.current = { steps: currentSteps, xp: xpPorPasos(currentSteps, goalActual) };
    try {
      await acreditarPasosDelDia(uid, todayDateString(), currentSteps);
    } catch {
      // Sin conexión: se reintenta en el próximo cambio o al ir a segundo plano.
      lastSyncedRef.current = { steps: 0, xp: 0 };
    }
  }).current;

  // `goal` en las dependencias: si el usuario baja la meta y ya la superó, el
  // bono de meta y el día de racha se acreditan en el momento.
  useEffect(() => {
    if (!user?.uid || !available || loading) return;
    const prev = lastSyncedRef.current;
    const xpAhora = xpPorPasos(steps, goal);
    if (steps - prev.steps >= 250 || xpAhora > prev.xp) acreditarHoy(user.uid, steps, goal);
  }, [steps, goal, user?.uid, available, loading, acreditarHoy]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' && user?.uid) acreditarHoy(user.uid, steps, goal);
    });
    return () => sub.remove();
  }, [steps, goal, user?.uid, acreditarHoy]);

  // Racha: la suma stepRewardsService cuando un día llega a la meta, y la corta
  // sincronizarPasosYPuntos (arriba) DESPUÉS de acreditar los días anteriores.
  // Cortarla antes, apenas carga el perfil, la ponía en 0 cuando ayer sí se
  // había llegado a la meta pero todavía no estaba acreditado.

  // ── Gamification: gym presence reward ────────────────────────────────────────
  useEffect(() => {
    const gymDni = profile?.gymDni;
    if (!gymDni || !user?.uid) return;
    return subscribeToUserPresence(gymDni, (isPresent) => {
      if (!isPresent) return;
      // checkAndAwardGymReward ya no traga sus propios errores (para que el
      // flujo offline en GymEventsContext.js pueda distinguir "ya premiado"
      // de "sin conexión") — acá replicamos el mismo manejo para no dejar una
      // promesa sin capturar y para no perder el pendiente si esta ruta es la
      // que efectivamente falla por falta de red.
      checkAndAwardGymReward(user.uid)
        .then(() => clearGymRewardPending(user.uid))
        .catch(() => markGymRewardPending(user.uid));
    });
  }, [profile?.gymDni, user?.uid]);

  const value = {
    steps,
    calories,
    totalCalories,
    distanceKm,
    available,
    loading,
    hcStatus,
    connectHealthConnect: connectHC,
    installHealthConnect: openHealthConnectInstall,
    goal,
    setGoal,
    percent: Math.min(100, Math.round((steps / goal) * 100)),
  };

  return <StepContext.Provider value={value}>{children}</StepContext.Provider>;
}

export function useStepContext() {
  const ctx = useContext(StepContext);
  if (!ctx) throw new Error('useStepContext must be used inside StepProvider');
  return ctx;
}