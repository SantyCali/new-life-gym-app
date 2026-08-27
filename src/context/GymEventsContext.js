import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Platform, AppState } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useAuth from '../hooks/useAuth';
import useUserProfile from '../hooks/useUserProfile';
import { subscribeToUserPresence, advanceRoutineDay, ACTIVE_MS } from '../services/gymService';
import { subscribeToClientRoutine } from '../services/routineService';
import {
  checkAndAwardGymReward, XP_GYM_VISIT,
  markGymRewardPending, clearGymRewardPending, flushPendingGymReward,
} from '../services/gamificationService';
import { subscribeToAnnouncement } from '../services/announcementService';
import { doc, setDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import GymCelebrationModal from '../components/ui/GymCelebrationModal';
import LevelUpModal from '../components/ui/LevelUpModal';
import LogroCompletadoModal from '../components/ui/LogroCompletadoModal';
import { LOGROS_DEF } from '../constants/logros';

// Dynamic import — evita que expo-notifications se inicialice en Expo Go (SDK 53+)
// y dispare el warning de push. Las notificaciones locales siguen funcionando.
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo';
const Notifications = IS_EXPO_GO ? null : require('expo-notifications');

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

const GymEventsCtx = createContext({
  isAtGym: false,
  gymDayIndex: 0,
  showGymCelebration: () => {},
  showLogroModal: () => {},
});

export function GymEventsProvider({ children }) {
  const { user } = useAuth();
  const { profile } = useUserProfile();

  const [isAtGym, setIsAtGym]           = useState(false);
  const [gymCelebration, setGymCeleb]   = useState(false);
  const [levelUpData, setLevelUpData]   = useState(null);
  const [logroData, setLogroData]       = useState(null);
  const [gymDayIndex, setGymDayIndex]   = useState(0);
  const [routine, setRoutine]           = useState(null);

  const prevIsAtGymRef       = useRef(false);
  const prevLevelRef         = useRef(null);
  const pendingAdvanceRef    = useRef(false);
  const logrosInitRef        = useRef(false);
  const prevLogrosRef        = useRef(new Set());
  const logrosResetTimers    = useRef({});
  const gymEntryTimeRef      = useRef(null);
  const latestGymCheckinMsRef = useRef(0);
  const isAtGymRef           = useRef(false);

  // Announcement → local notification (solo en builds, no en Expo Go SDK 53+)
  useEffect(() => {
    if (!Notifications) return;

    Notifications.requestPermissionsAsync().catch(() => {});
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'New Life',
        importance: Notifications.AndroidImportance.MAX,
      }).catch(() => {});
    }

    let unsub;
    const state = { lastTime: 0 };

    AsyncStorage.getItem('lastAnnNotifAt').then(v => {
      state.lastTime = v ? parseInt(v) : Date.now();

      unsub = subscribeToAnnouncement(async (ann) => {
        if (!ann) return;
        const annTime = ann.createdAt?.toMillis?.() ?? 0;
        if (!annTime) return;

        if (annTime > state.lastTime) {
          state.lastTime = annTime;
          AsyncStorage.setItem('lastAnnNotifAt', String(annTime));
          try {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: `📢 ${ann.title}`,
                body: ann.message,
                sound: 'default',
              },
              trigger: null,
            });
          } catch (e) {
            console.log('[AnnNotif]', e.message);
          }
        }
      });
    });

    return () => { if (unsub) unsub(); };
  }, []);

  // Routine subscription (needed to advance day)
  useEffect(() => {
    if (!user?.uid) return;
    return subscribeToClientRoutine(user.uid, setRoutine);
  }, [user?.uid]);

  // Initialize day index from stored profile
  useEffect(() => {
    if (profile?.gymRoutineDayIndex != null) {
      setGymDayIndex(profile.gymRoutineDayIndex);
    }
  }, [profile?.gymRoutineDayIndex]);

  // ── Backfill: recupera la última sesión de gym que ya vivía en el perfil
  // (gymTodayDate/gymTodayMinutes) antes de que existiera gymHistory, igual que
  // el backfill análogo de pasos en StepContext.js. Solo aplica si esa fecha
  // entra dentro de la ventana de 7 días que se puede navegar.
  useEffect(() => {
    if (!user?.uid || !profile?.gymTodayDate || !(profile?.gymTodayMinutes > 0)) return;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const y = sevenDaysAgo.getFullYear();
    const mo = String(sevenDaysAgo.getMonth() + 1).padStart(2, '0');
    const dy = String(sevenDaysAgo.getDate()).padStart(2, '0');
    const fromDate = `${y}-${mo}-${dy}`;
    if (profile.gymTodayDate < fromDate) return;
    setDoc(doc(db, 'users', user.uid, 'gymHistory', profile.gymTodayDate), {
      date:    profile.gymTodayDate,
      minutes: profile.gymTodayMinutes,
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, profile?.gymTodayDate]);

  // Mantener ref sincronizada para el AppState listener (evita stale closure)
  isAtGymRef.current = isAtGym;

  // Gym presence subscription
  useEffect(() => {
    const dni = profile?.gymDni;
    if (!dni) return;
    return subscribeToUserPresence(dni, (present, checkinMs) => {
      setIsAtGym(present);
      if (checkinMs) latestGymCheckinMsRef.current = checkinMs;
    });
  }, [profile?.gymDni]);

  // Cuando la app vuelve al frente, re-verificar si la sesión de gym ya expiró.
  // El setTimeout interno no dispara cuando la app está en background en Android.
  // Reutilizamos este mismo listener (no se agrega uno nuevo) para además
  // reintentar cualquier recompensa de gym que haya quedado pendiente por
  // falta de conexión — "volver al frente" es un buen proxy de "puede que ya
  // haya internet de nuevo" sin necesitar una librería de conectividad.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      if (user?.uid) flushPendingGymReward(user.uid);
      if (!isAtGymRef.current) return;
      const checkinMs = latestGymCheckinMsRef.current;
      if (checkinMs && Date.now() - checkinMs > ACTIVE_MS) {
        setIsAtGym(false);
      }
    });
    return () => sub.remove();
  }, [user?.uid]);

  // Reintento al abrir la app / iniciar sesión — cubre el caso de haber
  // quedado offline con una recompensa pendiente y cerrado la app del todo
  // (AsyncStorage persiste esa marca; acá se reintenta apenas hay uid).
  useEffect(() => {
    if (user?.uid) flushPendingGymReward(user.uid);
  }, [user?.uid]);

  // Gym check-in / check-out
  useEffect(() => {
    const was = prevIsAtGymRef.current;
    prevIsAtGymRef.current = isAtGym;

    if (isAtGym && !was) {
      // ── ENTRADA ──
      // Si checkAndAwardGymReward no puede confirmarse contra Firestore (sin
      // conexión), se guarda localmente como pendiente para reintentar más
      // tarde (ver AppState/mount arriba) — nunca se "inventa" el XP acá.
      if (user?.uid) {
        checkAndAwardGymReward(user.uid)
          .then(() => clearGymRewardPending(user.uid))
          .catch(() => markGymRewardPending(user.uid));
      }
      setTimeout(() => setGymCeleb(true), 700);

      const count = routine?.dias?.length ?? 0;
      if (user?.uid && count > 0) {
        advanceRoutineDay(user.uid, count).then(idx => setGymDayIndex(idx));
      } else if (user?.uid) {
        pendingAdvanceRef.current = true;
      }

      // Registrar hora de entrada para calorías
      gymEntryTimeRef.current = Date.now();
      if (user?.uid) {
        const d = new Date();
        const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        updateDoc(doc(db, 'users', user.uid), { gymTodayDate: today }).catch(() => {});
      }

    } else if (!isAtGym && was) {
      // ── SALIDA: calcular minutos reales ──
      if (user?.uid && gymEntryTimeRef.current) {
        const minutes = Math.max(1, Math.round((Date.now() - gymEntryTimeRef.current) / 60000));
        updateDoc(doc(db, 'users', user.uid), { gymTodayMinutes: minutes }).catch(() => {});
        // Historial diario de gym (mismo patrón que stepsHistory): si el usuario
        // entra y sale varias veces el mismo día, esto refleja la última sesión,
        // igual que gymTodayMinutes — no se acumulan minutos entre sesiones.
        const d = new Date();
        const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        setDoc(doc(db, 'users', user.uid, 'gymHistory', today), { date: today, minutes }).catch(() => {});
        gymEntryTimeRef.current = null;
      }
    }
  }, [isAtGym]);

  // Retry advance if routine loaded after check-in
  useEffect(() => {
    const count = routine?.dias?.length ?? 0;
    if (!pendingAdvanceRef.current || !user?.uid || count === 0) return;
    pendingAdvanceRef.current = false;
    advanceRoutineDay(user.uid, count).then(idx => setGymDayIndex(idx));
  }, [routine, user?.uid]);

  // Level-up detection
  useEffect(() => {
    const level = profile?.nivelJuego;
    if (level == null) return;
    if (prevLevelRef.current !== null && level > prevLevelRef.current) {
      setLevelUpData({ from: prevLevelRef.current, to: level });
    }
    prevLevelRef.current = level;
  }, [profile?.nivelJuego]);

  // Logro completion detection — dispara el modal en TODOS los dispositivos via Firestore
  useEffect(() => {
    // Esperar que el profile esté cargado (no null) antes de inicializar,
    // así el doble-fire null→datos no dispara el modal en cada recarga
    if (!profile) return;
    const completados = profile.logrosCompletados ?? [];
    if (!logrosInitRef.current) {
      logrosInitRef.current = true;
      prevLogrosRef.current = new Set(completados);
      return;
    }
    const prevSet = prevLogrosRef.current;
    const nuevos  = completados.filter(id => !prevSet.has(id));
    prevLogrosRef.current = new Set(completados);
    nuevos.forEach(id => {
      const def = LOGROS_DEF.find(l => l.id === id);
      if (!def) return;
      setLogroData({ title: def.title, description: def.description, icon: def.icon, xp: def.xp });
      // Auto-reset después de 5 minutos: quita el logro Y resetea el progreso a 0
      clearTimeout(logrosResetTimers.current[id]);
      logrosResetTimers.current[id] = setTimeout(async () => {
        if (!user?.uid) return;
        const update = { logrosCompletados: arrayRemove(id) };
        if (def.resetField) update[def.resetField] = 0;
        await updateDoc(doc(db, 'users', user.uid), update);
      }, 5 * 60 * 1000);
    });
  }, [profile?.logrosCompletados, profile]);

  return (
    <GymEventsCtx.Provider value={{
      isAtGym,
      gymDayIndex,
      showGymCelebration: () => setGymCeleb(true),
      showLogroModal: (logro) => setLogroData(logro),
    }}>
      {children}
      {gymCelebration && (
        <GymCelebrationModal
          xp={XP_GYM_VISIT}
          onClose={() => setGymCeleb(false)}
        />
      )}
      {levelUpData && (
        <LevelUpModal
          fromLevel={levelUpData.from}
          toLevel={levelUpData.to}
          onClose={() => setLevelUpData(null)}
        />
      )}
      {logroData && (
        <LogroCompletadoModal
          logro={logroData}
          onClose={() => setLogroData(null)}
        />
      )}
    </GymEventsCtx.Provider>
  );
}

export function useGymEvents() { return useContext(GymEventsCtx); }
