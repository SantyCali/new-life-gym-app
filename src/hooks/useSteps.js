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
import {
  nativeServiceAvailable,
  startNativeStepService,
  getNativeSteps,
} from '../services/nativeStepService';

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
  const lastCallbackMsRef = useRef(0);
  const pollIntervalRef   = useRef(null);

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

  // ── Android: sensor expo-sensors (fallback cuando el Foreground Service no está disponible)

  const startFallbackPath = useCallback(() => {
    subRef.current?.remove();
    usingHCRef.current = false;

    const needsBaseInit =
      dataRef.current.todaySteps === 0 && dataRef.current.lastAccumulated === 0;
    let baseInitialized = !needsBaseInit;

    subRef.current = watchStepCount(({ steps: accumulated }) => {
      if (!mountedRef.current) return;
      lastCallbackMsRef.current = Date.now();
      const { date: lastDate, todaySteps: prevToday, lastAccumulated: prevAcc } = dataRef.current;
      const currentDate = todayDateString();

      if (currentDate !== lastDate) {
        setAndPersist(0, accumulated);
        baseInitialized = true;
        return;
      }
      if (accumulated < prevAcc) {
        setAndPersist(prevToday + accumulated, accumulated);
        return;
      }
      if (!baseInitialized) {
        baseInitialized = true;
        setAndPersist(0, accumulated);
        return;
      }
      setAndPersist(prevToday + (accumulated - prevAcc), accumulated);
    });
  }, [setAndPersist]);

  // ── Main effect ───────────────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    let appStateSub;

    async function init() {
      await requestPedometerPermission();

      // ── iOS ────────────────────────────────────────────────────────────────
      if (Platform.OS === 'ios') {
        const ok = await isPedometerAvailable();
        if (!mountedRef.current) return;
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

      // ── Android: Foreground Service nativo ─────────────────────────────────
      // Si el APK incluye el servicio nativo (nativeServiceAvailable = true),
      // el servicio cuenta pasos 24/7 aunque la app esté cerrada o la pantalla
      // bloqueada. El JS solo lee los pasos del servicio vía polling.
      if (nativeServiceAvailable) {
        setAvailable(true);

        // Arrancar el servicio (si ya está corriendo, el intent es ignorado)
        await startNativeStepService();

        // Leer pasos iniciales
        const initial = await getNativeSteps();
        if (mountedRef.current) setSteps(initial);
        setLoading(false);

        // Poll cada 2 s cuando la app está en primer plano
        const startPoll = () => {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = setInterval(async () => {
            if (!mountedRef.current) return;
            const s = await getNativeSteps();
            if (mountedRef.current) setSteps(s);
          }, 2000);
        };
        startPoll();

        appStateSub = AppState.addEventListener('change', async (state) => {
          if (!mountedRef.current) return;
          if (state === 'active') {
            // Leer inmediatamente al volver al frente
            const s = await getNativeSteps();
            if (mountedRef.current) setSteps(s);
            startPoll();
          } else if (state === 'background' || state === 'inactive') {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        });
        return;
      }

      // ── Android: fallback con expo-sensors (sin Foreground Service) ────────
      const ok = await isPedometerAvailable();
      if (!mountedRef.current) return;
      setAvailable(ok);

      const saved = await loadStepData();
      if (saved.date === todayDateString() && mountedRef.current) {
        setSteps(saved.todaySteps);
        dataRef.current = saved;
      }
      setLoading(false);

      if (ok) startFallbackPath();

      appStateSub = AppState.addEventListener('change', (state) => {
        if (state === 'active' && mountedRef.current && ok) {
          const msSinceLast = Date.now() - lastCallbackMsRef.current;
          if (msSinceLast > 3000) startFallbackPath();
        }
      });
    }

    // Midnight reset para iOS y el fallback de Android
    function msUntilMidnight() {
      const now  = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
      return next.getTime() - now.getTime();
    }

    function scheduleReset() {
      clearTimeout(midnightTimerRef.current);
      midnightTimerRef.current = setTimeout(async () => {
        if (!mountedRef.current) return;
        if (Platform.OS === 'ios') {
          await refreshIOS();
        } else if (!nativeServiceAvailable) {
          const today = todayDateString();
          dataRef.current = { ...dataRef.current, date: today, todaySteps: 0 };
          setSteps(0);
          saveStepData(dataRef.current);
        }
        // Con Foreground Service: el servicio Kotlin maneja el reset de medianoche solo.
        scheduleReset();
      }, msUntilMidnight());
    }

    init().then(scheduleReset);

    return () => {
      mountedRef.current = false;
      clearInterval(pollIntervalRef.current);
      subRef.current?.remove();
      appStateSub?.remove();
      clearTimeout(midnightTimerRef.current);
    };
  }, [refreshIOS, startFallbackPath]);

  const connectHC = useCallback(async () => {}, []);

  return { steps, available, loading, hcStatus, connectHC };
}
