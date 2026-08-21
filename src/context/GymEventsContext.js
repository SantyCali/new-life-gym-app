import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useAuth from '../hooks/useAuth';
import useUserProfile from '../hooks/useUserProfile';
import { subscribeToUserPresence, advanceRoutineDay } from '../services/gymService';
import { subscribeToClientRoutine } from '../services/routineService';
import { checkAndAwardGymReward, XP_GYM_VISIT } from '../services/gamificationService';
import { subscribeToAnnouncement } from '../services/announcementService';
import { doc, updateDoc, arrayRemove } from 'firebase/firestore';
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

  const prevIsAtGymRef    = useRef(false);
  const prevLevelRef      = useRef(null);
  const pendingAdvanceRef = useRef(false);
  const logrosInitRef     = useRef(false);
  const prevLogrosRef     = useRef(new Set());
  const logrosResetTimers = useRef({});
  const gymEntryTimeRef   = useRef(null);

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

  // Gym presence subscription
  useEffect(() => {
    const dni = profile?.gymDni;
    if (!dni) return;
    return subscribeToUserPresence(dni, setIsAtGym);
  }, [profile?.gymDni]);

  // Gym check-in / check-out
  useEffect(() => {
    const was = prevIsAtGymRef.current;
    prevIsAtGymRef.current = isAtGym;

    if (isAtGym && !was) {
      // ── ENTRADA ──
      if (user?.uid) checkAndAwardGymReward(user.uid);
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
