import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, AppState } from 'react-native';
import {
  requestPedometerPermission,
  isPedometerAvailable,
  getStepsSinceMidnight,
  watchStepCount,
  loadStepData,
  saveStepData,
  todayDateString,
  HC_STATUS,
} from '../services/stepService';

export default function useSteps() {
  const [steps, setSteps]         = useState(0);
  const [available, setAvailable] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [hcStatus, setHcStatus]   = useState(
    Platform.OS === 'android' ? HC_STATUS.UNKNOWN : HC_STATUS.NOT_ANDROID
  );

  const mountedRef        = useRef(true);
  const dataRef           = useRef({ date: todayDateString(), todaySteps: 0, lastAccumulated: 0 });
  const usingHCRef        = useRef(false);
  const subRef            = useRef(null);
  const midnightTimerRef  = useRef(null);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const setAndPersist = useCallback((todaySteps, lastAccumulated) => {
    const date = todayDateString();
    dataRef.current = { date, todaySteps, lastAccumulated };
    setSteps(todaySteps);
    saveStepData({ date, todaySteps, lastAccumulated });
  }, []);

  const refreshIOS = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const s = await getStepsSinceMidnight();
      if (mountedRef.current) {
        setSteps(s);
        saveStepData({ date: todayDateString(), todaySteps: s, lastAccumulated: 0 });
      }
    } catch {}
  }, []);

  // ── Android: sensor nativo TYPE_STEP_COUNTER ─────────────────────────────────

  const startFallbackPath = useCallback(() => {
    subRef.current?.remove();
    usingHCRef.current = false;

    // If both todaySteps and lastAccumulated are 0, we have no valid baseline yet.
    // The first sensor callback will give us the cumulative steps since device boot,
    // which may include steps from previous days — we must use it as a base, not count them.
    const needsBaseInit =
      dataRef.current.todaySteps === 0 && dataRef.current.lastAccumulated === 0;
    let baseInitialized = !needsBaseInit;

    subRef.current = watchStepCount(({ steps: accumulated }) => {
      if (!mountedRef.current) return;
      const { date: lastDate, todaySteps: prevToday, lastAccumulated: prevAcc } = dataRef.current;
      const currentDate = todayDateString();

      // Midnight rolled over — reset to 0 and use this reading as the new base
      if (currentDate !== lastDate) {
        setAndPersist(0, accumulated);
        baseInitialized = true;
        return;
      }

      // Phone rebooted: sensor counter reset below our saved baseline
      if (accumulated < prevAcc) {
        setAndPersist(prevToday + accumulated, accumulated);
        return;
      }

      // First reading of a fresh session with no prior data for today.
      // Use this reading as our baseline — don't add these steps as "today's".
      if (!baseInitialized) {
        baseInitialized = true;
        setAndPersist(0, accumulated);
        return;
      }

      // Normal: add delta since last reading
      setAndPersist(prevToday + (accumulated - prevAcc), accumulated);
    });
  }, [setAndPersist]);

  // ── Main effect ───────────────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    let appStateSub;

    async function init() {
      // Ask for motion/activity permission upfront (required on Android 10+)
      await requestPedometerPermission();

      const ok = await isPedometerAvailable();
      if (!mountedRef.current) return;

      // ── iOS ────────────────────────────────────────────────────────────────
      if (Platform.OS === 'ios') {
        setAvailable(ok);
        if (!ok) { setLoading(false); return; }
        await refreshIOS();
        if (!mountedRef.current) return;
        setLoading(false);
        subRef.current = watchStepCount(() => refreshIOS());
        appStateSub = AppState.addEventListener('change', s => {
          if (s === 'active') refreshIOS();
        });
        return;
      }

      // ── Android ────────────────────────────────────────────────────────────
      // Siempre usar el sensor nativo TYPE_STEP_COUNTER (expo-sensors Pedometer).
      // Health Connect está completamente deshabilitado en Android.
      setAvailable(ok);

      // Mostrar datos cacheados inmediatamente
      const saved = await loadStepData();
      if (saved.date === todayDateString() && mountedRef.current) {
        setSteps(saved.todaySteps);
        dataRef.current = saved;
      }
      setLoading(false);

      if (ok) startFallbackPath();

      // Al volver al frente: guardar datos actuales
      appStateSub = AppState.addEventListener('change', (state) => {
        if (state === 'active' && mountedRef.current) {
          saveStepData(dataRef.current);
        }
      });
    }

    // ── Midnight auto-reset ───────────────────────────────────────────────────
    // One precise setTimeout to fire at exactly 00:00:00, then reschedule itself.
    // No polling, no interval — only fires when the app is actively open at midnight.
    // AppState 'active' already handles the case where midnight passed in background.

    function msUntilMidnight() {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
      return next.getTime() - now.getTime();
    }

    function scheduleReset() {
      clearTimeout(midnightTimerRef.current);
      midnightTimerRef.current = setTimeout(async () => {
        if (!mountedRef.current) return;
        const today = todayDateString(); // now it's the new day

        if (Platform.OS === 'ios') {
          // CMPedometer returns 0 for the new day automatically
          await refreshIOS();
        } else {
          // Sensor nativo: resetear el contador diario manteniendo lastAccumulated como base.
          // El siguiente callback del sensor sumará el delta desde ese punto.
          dataRef.current = { ...dataRef.current, date: today, todaySteps: 0 };
          setSteps(0);
          saveStepData(dataRef.current);
        }

        scheduleReset(); // arm for the next midnight
      }, msUntilMidnight());
    }

    init().then(scheduleReset);

    return () => {
      mountedRef.current = false;
      subRef.current?.remove();
      appStateSub?.remove();
      clearTimeout(midnightTimerRef.current);
    };
  }, [refreshIOS, startFallbackPath]);

  // No-op en Android: los pasos ya usan el sensor nativo directamente.
  const connectHC = useCallback(async () => {}, []);

  return { steps, available, loading, hcStatus, connectHC };
}