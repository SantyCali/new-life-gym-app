import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, AppState, Alert } from 'react-native';
import {
  requestPedometerPermission,
  isPedometerAvailable,
  getStepsSinceMidnight,
  watchStepCount,
  getHCStatus,
  checkHCPermissions,
  initHealthConnect,
  isMIUIDevice,
  openHealthConnectPermissions,
  getStepsFromHC,
  loadStepData,
  saveStepData,
  todayDateString,
  midnightToday,
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
  const hcBaseRef         = useRef(0);
  const sensorBaseRef     = useRef(null);
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

  const refreshFromHC = useCallback(async () => {
    const fresh = await getStepsFromHC(midnightToday(), new Date());
    if (fresh !== null && mountedRef.current) {
      hcBaseRef.current     = fresh;
      sensorBaseRef.current = null;
      setSteps(fresh);
      saveStepData({ date: todayDateString(), todaySteps: fresh, lastAccumulated: 0 });
    }
  }, []);

  // ── Android: start HC path (called on init or when HC becomes available) ────

  const startHCPath = useCallback(async () => {
    subRef.current?.remove();
    usingHCRef.current = true;

    await refreshFromHC();

    subRef.current = watchStepCount(({ steps: accumulated }) => {
      if (!mountedRef.current) return;
      if (sensorBaseRef.current === null) sensorBaseRef.current = accumulated;
      const total = hcBaseRef.current + Math.max(0, accumulated - sensorBaseRef.current);
      setSteps(total);
      saveStepData({ date: todayDateString(), todaySteps: total, lastAccumulated: accumulated });
    });
  }, [refreshFromHC]);

  // ── Android: start fallback path ─────────────────────────────────────────────

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
      // Even if hardware step counter is missing, Health Connect can still work.
      // Don't bail out on !ok — always check HC first.
      setAvailable(ok);

      // Show cached data immediately
      const saved = await loadStepData();
      if (saved.date === todayDateString() && mountedRef.current) {
        setSteps(saved.todaySteps);
        dataRef.current = saved;
      }
      setLoading(false);

      // Check HC status — never call requestPermission automatically on startup
      const status = await getHCStatus();
      if (!mountedRef.current) return;

      if (status === HC_STATUS.AVAILABLE) {
        // Only start HC path if permission was ALREADY granted (no dialog)
        const alreadyGranted = await checkHCPermissions();
        if (!mountedRef.current) return;
        if (alreadyGranted) {
          setHcStatus(HC_STATUS.AVAILABLE);
          setAvailable(true); // HC is our step source regardless of hardware sensor
          await startHCPath();
        } else {
          setHcStatus(HC_STATUS.NOT_AUTHORIZED);
          if (ok) startFallbackPath(); // sensor fallback only if hardware exists
        }
      } else {
        setHcStatus(status);
        if (ok) startFallbackPath(); // sensor fallback only if hardware exists
      }

      // On foreground: re-sync data AND check if HC was just installed/authorized
      appStateSub = AppState.addEventListener('change', async (state) => {
        if (state !== 'active' || !mountedRef.current) return;

        if (usingHCRef.current) {
          // Already on HC path: just refresh
          refreshFromHC();
        } else {
          // On fallback: check if HC became available or permissions granted since last check
          saveStepData(dataRef.current);
          const newStatus = await getHCStatus();
          if (!mountedRef.current) return;

          if (newStatus === HC_STATUS.AVAILABLE) {
            const alreadyGranted = await checkHCPermissions();
            if (!mountedRef.current) return;
            if (alreadyGranted) {
              setHcStatus(HC_STATUS.AVAILABLE);
              setAvailable(true);
              await startHCPath();
            } else {
              setHcStatus(HC_STATUS.NOT_AUTHORIZED);
            }
          } else {
            setHcStatus(newStatus);
          }
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
        } else if (usingHCRef.current) {
          // HC path: reset base refs; refreshFromHC will return 0 or near-0
          hcBaseRef.current     = 0;
          sensorBaseRef.current = null;
          setSteps(0);
          dataRef.current = { date: today, todaySteps: 0, lastAccumulated: 0 };
          saveStepData(dataRef.current);
          refreshFromHC();
        } else {
          // Fallback: reset daily counter; keep lastAccumulated so delta stays correct.
          // Next sensor callback will naturally continue from the current accumulated value.
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
  }, [refreshIOS, refreshFromHC, startHCPath, startFallbackPath]);

  // Called ONLY from explicit user action (button tap) — opens the permission dialog.
  // On MIUI (Xiaomi) requestPermission crashes the app, so we open Health Connect
  // directly and let the AppState listener pick up the granted permission on return.
  const connectHC = useCallback(async () => {
    if (Platform.OS !== 'android') return;

    if (isMIUIDevice()) {
      Alert.alert(
        'Activar Health Connect',
        'Se va a abrir la app de Health Connect. Buscá "New Life" en la lista y activá el permiso de Pasos. Cuando vuelvas, la app lo detecta sola.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Abrir Health Connect', onPress: openHealthConnectPermissions },
        ]
      );
      return;
    }

    const granted = await initHealthConnect();
    if (!mountedRef.current) return;
    if (granted) {
      setHcStatus(HC_STATUS.AVAILABLE);
      setAvailable(true);
      await startHCPath();
    }
  }, [startHCPath]);

  return { steps, available, loading, hcStatus, connectHC };
}