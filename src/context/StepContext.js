import { createContext, useContext, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import useSteps from '../hooks/useSteps';
import useAuth from '../hooks/useAuth';
import useUserProfile from '../hooks/useUserProfile';
import {
  calcCalories, calcDistanceKm, todayDateString, localDateString, openHealthConnectInstall, getStepsForDate,
} from '../services/stepService';
import {
  awardXPAndCoins, checkAndAwardGymReward, updateStreak,
  XP_PER_1K_STEPS, COINS_PER_1K_STEPS, XP_GOAL_BONUS, COINS_GOAL_BONUS,
  STEPS_FOR_STREAK,
} from '../services/gamificationService';
import { subscribeToUserPresence } from '../services/gymService';

const DEFAULT_GOAL = 10000;
const StepContext  = createContext(null);

function computeAge(fechaNacimiento) {
  if (!fechaNacimiento) return 30;
  try {
    // Firestore Timestamp → .toDate(), ISO string → new Date(...)
    const birth = fechaNacimiento?.toDate ? fechaNacimiento.toDate() : new Date(fechaNacimiento);
    if (isNaN(birth.getTime())) return 30;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return Math.max(10, Math.min(100, age));
  } catch { return 30; }
}

export function StepProvider({ children }) {
  const { steps, available, loading, hcStatus, connectHC } = useSteps();
  const { user }    = useAuth();
  const { profile } = useUserProfile();

  const weightKg = profile?.peso    ? Number(profile.peso)   : 70;
  const heightCm = profile?.altura  ? Number(profile.altura) : 170;
  const ageYears = computeAge(profile?.fechaNacimiento);

  const calories   = calcCalories(steps, weightKg, ageYears);
  const distanceKm = calcDistanceKm(steps, heightCm);

  // Keep latest profile in a ref so gamification effects don't depend on profile object
  const profileRef = useRef(profile);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  // ── Backfill: recover past day's steps that were in profile before stepsHistory existed
  useEffect(() => {
    if (!user?.uid || !profile?.stepsDate || !profile?.stepsToday) return;
    const today = todayDateString();
    if (profile.stepsDate !== today && profile.stepsToday > 100) {
      setDoc(doc(db, 'users', user.uid, 'stepsHistory', profile.stepsDate), {
        date:  profile.stepsDate,
        steps: profile.stepsToday,
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, profile?.stepsDate]);

  // ── Backfill histórico: consulta CMPedometer / HC para los últimos 6 días ──
  // Corre una vez por sesión cuando el pedómetro ya está listo.
  // Asegura que si el usuario caminó sin abrir la app, igual queda guardado.
  const hasBackfilledRef = useRef(false);
  useEffect(() => {
    if (!user?.uid || !available || loading) return;
    if (hasBackfilledRef.current) return;
    hasBackfilledRef.current = true;

    async function backfill() {
      for (let i = 1; i <= 6; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = localDateString(d);

        const count = await getStepsForDate(d);
        if (!count || count <= 0) continue;

        const ref  = doc(db, 'users', user.uid, 'stepsHistory', dateStr);
        const snap = await getDoc(ref);
        const stored = snap.exists() ? (snap.data().steps ?? 0) : 0;

        if (count > stored) {
          await setDoc(ref, { date: dateStr, steps: count });
        }
      }
    }

    backfill().catch(() => {});
  }, [user?.uid, available, loading]);

  // ── Firestore step sync ───────────────────────────────────────────────────────
  const lastSyncedRef = useRef(0);

  const syncFirestore = useRef(async (currentSteps) => {
    if (!user?.uid) return;
    const today = todayDateString();
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        stepsToday:     currentSteps,
        stepsDate:      today,
        stepsUpdatedAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'users', user.uid, 'stepsHistory', today), {
        date:  today,
        steps: currentSteps,
      });
      lastSyncedRef.current = currentSteps;
    } catch {}
  }).current;

  useEffect(() => {
    if (!available || loading) return;
    if (Math.abs(steps - lastSyncedRef.current) >= 250) syncFirestore(steps);
  }, [steps, available, loading, syncFirestore]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') syncFirestore(steps);
    });
    return () => sub.remove();
  }, [steps, syncFirestore]);

  // ── Gamification: XP/coins from step milestones ───────────────────────────────
  const rewardedKRef = useRef(0);
  const prevStepsRef = useRef(-1);

  // Restore today's already-rewarded milestone from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(`rewarded_k_${todayDateString()}`)
      .then(v => { if (v) rewardedKRef.current = parseInt(v, 10) || 0; })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.uid || loading || steps === 0) return;

    // First real reading after mount — set baseline without awarding
    if (prevStepsRef.current < 0) {
      prevStepsRef.current = steps;
      return;
    }

    // Midnight reset: useSteps drops steps to 0 when the date rolls over
    if (steps < prevStepsRef.current && prevStepsRef.current > 100) {
      rewardedKRef.current = 0;
      AsyncStorage.setItem(`rewarded_k_${todayDateString()}`, '0').catch(() => {});
    }
    prevStepsRef.current = steps;

    const newK = Math.floor(steps / 1000);
    const oldK = rewardedKRef.current;
    if (newK <= oldK) return;

    const diff     = newK - oldK;
    let xpGain     = diff * XP_PER_1K_STEPS;
    let coinGain   = diff * COINS_PER_1K_STEPS;

    // Daily goal bonus (only once, when crossing the threshold)
    if (steps >= DEFAULT_GOAL && oldK * 1000 < DEFAULT_GOAL) {
      xpGain   += XP_GOAL_BONUS;
      coinGain += COINS_GOAL_BONUS;
    }

    rewardedKRef.current = newK;
    AsyncStorage.setItem(`rewarded_k_${todayDateString()}`, String(newK)).catch(() => {});
    awardXPAndCoins(user.uid, xpGain, coinGain);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, user?.uid, loading]);

  // ── Gamification: streak ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid || !profile || steps < STEPS_FOR_STREAK) return;
    const today = todayDateString();
    if (profile.lastActiveDate === today) return;
    updateStreak(user.uid, profile.racha ?? 0, profile.lastActiveDate ?? null);
  }, [steps, user?.uid, profile]);

  // ── Gamification: gym presence reward ────────────────────────────────────────
  useEffect(() => {
    const gymDni = profile?.gymDni;
    if (!gymDni || !user?.uid) return;
    return subscribeToUserPresence(gymDni, (isPresent) => {
      if (isPresent) checkAndAwardGymReward(user.uid);
    });
  }, [profile?.gymDni, user?.uid]);

  const value = {
    steps,
    calories,
    distanceKm,
    available,
    loading,
    hcStatus,
    connectHealthConnect: connectHC,
    installHealthConnect: openHealthConnectInstall,
    goal:    DEFAULT_GOAL,
    percent: Math.min(100, Math.round((steps / DEFAULT_GOAL) * 100)),
  };

  return <StepContext.Provider value={value}>{children}</StepContext.Provider>;
}

export function useStepContext() {
  const ctx = useContext(StepContext);
  if (!ctx) throw new Error('useStepContext must be used inside StepProvider');
  return ctx;
}