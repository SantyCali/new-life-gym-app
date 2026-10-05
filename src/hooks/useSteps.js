import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, AppState } from 'react-native';
import {
  requestPedometerPermission,
  isPedometerAvailable,
  getStepsSinceMidnight,
  pedirPermisoSalud,
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
  leerRelojAhora,
} from '../services/nativeStepService';
import {
  syncStepsWithFirebase,
  saveStepsToFirebase,
} from '../services/stepsFirebaseService';
import { registerBackgroundStepsSync } from '../services/backgroundStepsSync';

export default function useSteps(uid) {
  const [steps, setStepsState]    = useState(0);
  // Día al que corresponden esos pasos. Se guarda junto con ellos porque se
  // usan después (al guardar en Firebase, al acreditar puntos): si mientras
  // tanto pasó la medianoche, los pasos de ayer quedaban guardados como de hoy.
  const [stepsDate, setStepsDate] = useState(todayDateString());
  const setSteps = useCallback((n, fecha = todayDateString()) => {
    setStepsState(n);
    setStepsDate(fecha);
  }, []);
  const [available, setAvailable] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [hcStatus, setHcStatus]   = useState(
    Platform.OS === 'android' ? HC_STATUS.UNKNOWN : HC_STATUS.NOT_ANDROID
  );

  // Mantener uid actualizado
  useEffect(() => { uidRef.current = uid ?? null; }, [uid]);

  const mountedRef        = useRef(true);
  const dataRef           = useRef({ date: todayDateString(), todaySteps: 0, lastAccumulated: 0 });
  const usingHCRef        = useRef(false);
  const subRef            = useRef(null);
  const midnightTimerRef  = useRef(null);
  const lastCallbackMsRef = useRef(0);
  const pollIntervalRef   = useRef(null);
  const fbSaveTimerRef    = useRef(null);
  const uidRef            = useRef(null);
  const saludTimerRef     = useRef(null);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const setAndPersist = useCallback((todaySteps, lastAccumulated) => {
    const date = todayDateString();
    dataRef.current = { date, todaySteps, lastAccumulated };
    setSteps(todaySteps, date);
    saveStepData({ date, todaySteps, lastAccumulated });
  }, [setSteps]);

  const refreshIOS = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const fecha = todayDateString();
      const s = await getStepsSinceMidnight();
      if (mountedRef.current) {
        setSteps(s, fecha);
        saveStepData({ date: fecha, todaySteps: s, lastAccumulated: 0 });
      }
    } catch {}
  }, [setSteps]);

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
        // Permiso para leer Salud (pasos del iPhone + Apple Watch).
        await pedirPermisoSalud();
        await refreshIOS();
        if (!mountedRef.current) return;
        setLoading(false);
        // Para que iOS acredite pasos y puntos con la app cerrada.
        registerBackgroundStepsSync().catch(() => {});
        subRef.current = watchStepCount(() => refreshIOS());
        appStateSub = AppState.addEventListener('change', s => {
          if (s === 'active') refreshIOS();
        });
        // Los pasos del Apple Watch llegan a Salud de a tandas, sin que el
        // sensor del iPhone se mueva: se relee cada 30 s con la app abierta.
        saludTimerRef.current = setInterval(() => {
          if (AppState.currentState === 'active') refreshIOS();
        }, 30 * 1000);
        return;
      }

      // ── Android: Foreground Service nativo ─────────────────────────────────
      // Si el APK incluye el servicio nativo (nativeServiceAvailable = true),
      // el servicio cuenta pasos 24/7 aunque la app esté cerrada o la pantalla
      // bloqueada. El JS solo lee los pasos del servicio vía polling.
      if (nativeServiceAvailable) {
        setAvailable(true);

        await startNativeStepService();
        registerBackgroundStepsSync().catch(() => {});

        // Leer pasos locales y sincronizar con Firebase al arrancar
        const today = todayDateString();
        const raw = await getNativeSteps();
        const synced = await syncStepsWithFirebase(uidRef.current, today, raw);
        if (mountedRef.current) setSteps(synced, today);
        setLoading(false);

        // Guardar en Firebase cada 30s (throttle para no abusar de escrituras).
        // Con la fecha de cuando se midieron: antes se tomaba la de cuando se
        // guardaba, y si en esos 30 s pasaba la medianoche, los pasos de ayer
        // (p. ej. 831) quedaban guardados como de hoy.
        const scheduleFbSave = (s, fecha) => {
          clearTimeout(fbSaveTimerRef.current);
          fbSaveTimerRef.current = setTimeout(() => {
            saveStepsToFirebase(uidRef.current, fecha, s).catch(() => {});
          }, 30_000);
        };

        // Poll cada 1 s para animación fluida. Con la app abierta, además, el
        // reloj (Health Connect) se lee cada minuto en vez de cada 5: apenas
        // la app del reloj (Mi Fitness…) sincroniza, el contador sube. Si no
        // hay reloj conectado, el servicio no hace nada.
        let segundos = 0;
        const startPoll = () => {
          clearInterval(pollIntervalRef.current);
          leerRelojAhora();
          segundos = 0;
          pollIntervalRef.current = setInterval(async () => {
            if (!mountedRef.current) return;
            if (++segundos % 60 === 0) leerRelojAhora();
            const fecha = todayDateString();
            const s = await getNativeSteps();
            if (mountedRef.current) {
              setSteps(s, fecha);
              scheduleFbSave(s, fecha);
            }
          }, 1000);
        };
        startPoll();

        appStateSub = AppState.addEventListener('change', async (state) => {
          if (!mountedRef.current) return;
          if (state === 'active') {
            const fecha = todayDateString();
            const s = await getNativeSteps();
            // Sincronizar con Firebase al volver al frente (multi-dispositivo)
            const merged = await syncStepsWithFirebase(uidRef.current, fecha, s);
            if (mountedRef.current) setSteps(merged, fecha);
            startPoll();
          } else if (state === 'background' || state === 'inactive') {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
            // Se guarda ya (abajo): el guardado pendiente se descarta, que si
            // no salía al volver (horas después, con otra fecha).
            clearTimeout(fbSaveTimerRef.current);
            const fecha = todayDateString();
            const s = await getNativeSteps();
            saveStepsToFirebase(uidRef.current, fecha, s).catch(() => {});
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
        setSteps(saved.todaySteps, saved.date);
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
      clearInterval(saludTimerRef.current);
      clearTimeout(fbSaveTimerRef.current);
      subRef.current?.remove();
      appStateSub?.remove();
      clearTimeout(midnightTimerRef.current);
    };
  }, [refreshIOS, startFallbackPath, setSteps]);

  const connectHC = useCallback(async () => {}, []);

  return { steps, stepsDate, available, loading, hcStatus, connectHC };
}
