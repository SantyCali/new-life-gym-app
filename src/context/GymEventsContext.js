import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useAuth from '../hooks/useAuth';
import useUserProfile from '../hooks/useUserProfile';
import { subscribeToUserPresence, advanceRoutineDay } from '../services/gymService';
import { subscribeToClientRoutine } from '../services/routineService';
import { checkAndAwardGymReward, XP_GYM_VISIT } from '../services/gamificationService';
import { subscribeToAnnouncement } from '../services/announcementService';
import GymCelebrationModal from '../components/ui/GymCelebrationModal';
import LevelUpModal from '../components/ui/LevelUpModal';

// Show notifications as alerts even when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const GymEventsCtx = createContext({
  isAtGym: false,
  gymDayIndex: 0,
  showGymCelebration: () => {},
});

export function GymEventsProvider({ children }) {
  const { user } = useAuth();
  const { profile } = useUserProfile();

  const [isAtGym, setIsAtGym]           = useState(false);
  const [gymCelebration, setGymCeleb]   = useState(false);
  const [levelUpData, setLevelUpData]   = useState(null);
  const [gymDayIndex, setGymDayIndex]   = useState(0);
  const [routine, setRoutine]           = useState(null);

  const prevIsAtGymRef = useRef(false);
  const prevLevelRef   = useRef(null);

  // Announcement → local notification (works in Expo Go)
  useEffect(() => {
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
      // Si nunca se guardó nada, usar el momento actual como baseline:
      // así los anuncios existentes al abrir la app no notifican,
      // pero cualquier anuncio publicado DESPUÉS sí lo hace (incluyendo el propio entrenador).
      state.lastTime = v ? parseInt(v) : Date.now();

      unsub = subscribeToAnnouncement(async (ann) => {
        if (!ann) return;
        const annTime = ann.createdAt?.toMillis?.() ?? 0;
        if (!annTime) return; // serverTimestamp aún pendiente

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

  // Gym check-in detected
  useEffect(() => {
    const was = prevIsAtGymRef.current;
    prevIsAtGymRef.current = isAtGym;
    if (!isAtGym || was) return;

    const count = routine?.dias?.length ?? 0;
    if (user?.uid && count > 0) {
      advanceRoutineDay(user.uid, count).then(idx => setGymDayIndex(idx));
    }
    if (user?.uid) checkAndAwardGymReward(user.uid);
    setTimeout(() => setGymCeleb(true), 700);
  }, [isAtGym]);

  // Level-up detection
  useEffect(() => {
    const level = profile?.nivelJuego;
    if (level == null) return;
    if (prevLevelRef.current !== null && level > prevLevelRef.current) {
      setLevelUpData({ from: prevLevelRef.current, to: level });
    }
    prevLevelRef.current = level;
  }, [profile?.nivelJuego]);

  return (
    <GymEventsCtx.Provider value={{
      isAtGym,
      gymDayIndex,
      showGymCelebration: () => setGymCeleb(true),
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
    </GymEventsCtx.Provider>
  );
}

export function useGymEvents() { return useContext(GymEventsCtx); }
