import { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  Image,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring,
  interpolate, runOnJS, Extrapolation,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { typography, spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';
import ProgressRing from '../components/ui/ProgressRing';
import { todayStats, todayWorkout } from '../constants/mockData';
import useAuth from '../hooks/useAuth';
import useUserProfile from '../hooks/useUserProfile';
import GoalModal from '../components/ui/GoalModal';
import AnnouncementCard from '../components/ui/AnnouncementCard';
import AnnouncementEditSheet from '../components/ui/AnnouncementEditSheet';
import { subscribeToClientRoutine } from '../services/routineService';
import { subscribeToAnnouncement } from '../services/announcementService';
import { MUSCLE_GROUPS } from '../constants/exercises';
import { useStepContext } from '../context/StepContext';
import { fetchWeeklyStepHistory } from '../services/userService';
import useGymCheckins from '../hooks/useGymCheckins';
import { XP_GYM_VISIT } from '../services/gamificationService';
import { useGymEvents } from '../context/GymEventsContext';

const DAY_ABBR = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

const RING_RADIUS = 108;
const RING_STROKE = 16;

export default function HomeScreen({ navigation }) {
  const { theme: { colors, isDark } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user, isTrainer } = useAuth();
  const { profile } = useUserProfile();
  const { steps: realSteps, calories: realCalories, hcStatus, installHealthConnect, connectHealthConnect } = useStepContext();
  const { activeCount: gymCount } = useGymCheckins();

  const weightKgHome = profile?.peso ? Number(profile.peso) : 70;

  const [goal, setGoal]                     = useState(todayStats.stepsGoal);
  const [goalInput, setGoalInput]           = useState('');
  const [goalModalVisible, setGoalModal]    = useState(false);

  const saveGoal = useCallback((n) => {
    const clamped = Math.max(1000, Math.min(50000, n));
    setGoal(clamped);
    AsyncStorage.setItem('dailyStepGoal', String(clamped));
    setGoalModal(false);
  }, []);

  const firstName    = profile?.nombre    ?? 'Atleta';
  const streakDays   = profile?.racha     ?? 0;
  const mejorRacha   = profile?.mejorRacha ?? streakDays;
  const nivelJuego   = profile?.nivelJuego ?? 1;
  const nextMilestone = streakDays < 7 ? 7 : streakDays < 14 ? 14 : 30;
  const streakBadge   =
    mejorRacha >= 30 ? 'Leyenda' :
    mejorRacha >= 14 ? 'Campeón' :
    mejorRacha >= 7  ? 'Guerrero' : null;
  const photoUrl    = profile?.photoBase64
    ? `data:image/jpeg;base64,${profile.photoBase64}`
    : (user?.photoURL ?? null);

  // ── Day navigation ───────────────────────────────────────────────────────
  const [dayOffset, setDayOffset]   = useState(0); // 0=hoy, -1=ayer, …, -6
  const [historyMap, setHistoryMap] = useState({});

  useFocusEffect(useCallback(() => {
    if (!user?.uid) return;
    fetchWeeklyStepHistory(user.uid).then(setHistoryMap).catch(() => {});
  }, [user?.uid]));

  const getOffsetDate = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d;
  };

  const displaySteps = dayOffset === 0
    ? realSteps
    : (historyMap[getOffsetDate(dayOffset).toISOString().split('T')[0]] ?? 0);

  const displayPercent = Math.min(100, Math.round((displaySteps / goal) * 100));

  const dayLabel = dayOffset === 0 ? 'PASOS HOY'
    : dayOffset === -1 ? 'AYER'
    : DAY_ABBR[getOffsetDate(dayOffset).getDay()];

  const dateLabel = dayOffset < 0
    ? getOffsetDate(dayOffset).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
    : null;

  const isHistoryMode = dayOffset < 0;

  const safeSteps      = Number.isFinite(displaySteps) ? displaySteps : 0;
  const displayWalkMin = Math.round(safeSteps / 100);
  const displayWalkH   = Math.floor(displayWalkMin / 60);
  const displayWalkM   = displayWalkMin % 60;
  const walkLabel      = displayWalkH > 0 ? `${displayWalkH}h ${displayWalkM}m` : `${displayWalkM}m`;
  const baseCalories = isHistoryMode
    ? Math.round(safeSteps * 0.04 * (weightKgHome / 70))
    : (Number.isFinite(realCalories) ? realCalories : 0);

  const stepPercent = displayPercent;
  const [replayKey, setReplayKey] = useState(0);

  // ── Swipe animation (RNGH — runs on UI thread, no ScrollView conflict) ──
  const translateX      = useSharedValue(0);
  const dayOffsetShared = useSharedValue(0);
  useEffect(() => { dayOffsetShared.value = dayOffset; }, [dayOffset]);

  const doNavigate = useCallback((dir) => {
    const cur  = dayOffsetShared.value;
    const next = Math.max(-6, Math.min(0, cur + dir));
    if (next === cur) {
      translateX.value = withSpring(0, { damping: 35, stiffness: 400 });
      return;
    }
    const exitSide = dir < 0 ? 150 : -150;
    translateX.value = withTiming(exitSide, { duration: 150 }, () => {
      'worklet';
      runOnJS(setDayOffset)(next);
      runOnJS(setReplayKey)(k => k + 1);
      translateX.value = -exitSide;
      translateX.value = withSpring(0, { damping: 35, stiffness: 400 });
    });
  }, [translateX, dayOffsetShared]);

  const ringContentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: interpolate(Math.abs(translateX.value), [0, 100], [1, 0.25], Extrapolation.CLAMP),
  }));

  const panGesture = useMemo(() => Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-20, 20])
    .onUpdate((e) => {
      'worklet';
      let dx = e.translationX;
      if (dx > 0 && dayOffsetShared.value <= -6) dx *= 0.1;
      if (dx < 0 && dayOffsetShared.value >= 0)  dx *= 0.1;
      translateX.value = dx * 0.7;
    })
    .onEnd((e) => {
      'worklet';
      const cur = dayOffsetShared.value;
      if      (e.translationX >  40 && cur > -6) runOnJS(doNavigate)(-1);
      else if (e.translationX < -40 && cur <  0) runOnJS(doNavigate)(1);
      else translateX.value = withSpring(0, { damping: 35, stiffness: 400 });
    }),
  [doNavigate, dayOffsetShared, translateX]);

  const navigateDay = doNavigate;

  const { isAtGym, showGymCelebration } = useGymEvents();

  // Calorías totales: caminata + gym (solo si ya salió del gym hoy)
  const gymMinHoy = useMemo(() => {
    if (isHistoryMode || isAtGym) return 0;
    const d = new Date();
    const hoy = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return profile?.gymTodayDate === hoy && (profile?.gymTodayMinutes ?? 0) > 0
      ? profile.gymTodayMinutes
      : 0;
  }, [isHistoryMode, isAtGym, profile?.gymTodayDate, profile?.gymTodayMinutes]);

  const displayCalories = baseCalories + (gymMinHoy > 0 ? Math.round(5.0 * weightKgHome * gymMinHoy / 60) : 0);

  const [routine, setRoutine] = useState(null);
  useEffect(() => {
    if (!user?.uid) return;
    return subscribeToClientRoutine(user.uid, setRoutine);
  }, [user?.uid]);

  const todayDay = routine?.dias?.[profile?.gymRoutineDayIndex ?? 0];
  const todayMuscleGroups = useMemo(() => {
    const exs = todayDay?.ejercicios ?? [];
    return [...new Set(exs.map(e => {
      const g = MUSCLE_GROUPS.find(m => m.id === e.grupoMuscular);
      return g?.label ?? e.grupoMuscular;
    }))];
  }, [todayDay]);
  const todayDayTitle = todayDay?.nombre?.trim()
    ? todayDay.nombre
    : todayMuscleGroups.slice(0, 2).join(' + ');

  const [announcement, setAnnouncement]   = useState(null);
  const [annEditOpen,  setAnnEditOpen]    = useState(false);
  useEffect(() => subscribeToAnnouncement(setAnnouncement), []);

  // Load goal from storage on focus (but don't restart ring animation needlessly)
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem('dailyStepGoal').then(v => {
        if (v) setGoal(Number(v));
      });
      setReplayKey(k => k + 1);
    }, [])
  );

  // Fade-in triggers Reanimated's 120Hz display link for the entire screen,
  // enabling ProMotion scroll from the moment the screen appears.
  const screenOpacity = useSharedValue(0);
  const screenStyle   = useAnimatedStyle(() => ({ flex: 1, opacity: screenOpacity.value }));
  useEffect(() => {
    screenOpacity.value = withTiming(1, { duration: 80 });
  }, []);

  return (
    <Animated.View style={screenStyle}>
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Perfil')}
              activeOpacity={0.8}
            >
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitial}>
                    {firstName[0]?.toUpperCase() ?? 'A'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.logoBlock}>
              <Text style={styles.logo}>New Life</Text>
              {isTrainer && (
                <View style={styles.trainerBadge}>
                  <Text style={styles.trainerBadgeText}>✦ ENTRENADOR</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity
            style={styles.streakPill}
            onPress={() => navigation.navigate('Racha')}
            activeOpacity={0.75}
          >
            <Text style={styles.streakFire}>🔥</Text>
            <Text style={styles.streakPillText}>{streakDays} Day Streak</Text>
          </TouchableOpacity>
        </View>

        {/* ── Barra "En el gym" ── */}
        {isAtGym && (
          <TouchableOpacity
            style={styles.gymBar}
            onPress={showGymCelebration}
            activeOpacity={0.85}
          >
            <View style={styles.gymDot} />
            <Text style={styles.gymBarText}>En el gym</Text>
            <Text style={styles.gymBarXP}>+{XP_GYM_VISIT} XP</Text>
          </TouchableOpacity>
        )}

        {/* ── Saludo ── */}
        <View style={styles.greeting}>
          <Text style={styles.greetingTitle}>¡Hola, {firstName}! 👋</Text>
          <Text style={styles.greetingSubtitle}>
            Estás en racha. Sigue así para subir al Nivel {nivelJuego + 1}.
          </Text>
        </View>

        {/* ── Announcement ── */}
        {announcement && (
          <AnnouncementCard
            announcement={announcement}
            colors={colors}
            onPress={isTrainer ? () => setAnnEditOpen(true) : undefined}
          />
        )}

        {/* ── Trainer panel (solo visible para entrenadores) ── */}
        {isTrainer && (
          <TouchableOpacity
            style={styles.trainerCard}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('MisClientes')}
          >
            <View style={styles.trainerCardLeft}>
              <View style={styles.trainerCardIcon}>
                <Ionicons name="people" size={22} color="#FF3891" />
              </View>
              <View>
                <Text style={styles.trainerCardTitle}>Mis Clientes</Text>
                <Text style={styles.trainerCardSub}>Buscá, editá y asigná rutinas</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#FF3891" />
          </TouchableOpacity>
        )}

        {/* ── Anillo de pasos ── */}
        <View style={styles.ringSection}>
          <View style={styles.ringRow}>
            {/* Flecha atrás — gris, sutil */}
            <TouchableOpacity
              hitSlop={12}
              disabled={dayOffset <= -6}
              onPress={() => navigateDay(-1)}
              style={styles.navArrow}
            >
              <Ionicons
                name="chevron-back"
                size={22}
                color={colors.textTertiary}
                style={{ opacity: dayOffset > -6 ? 0.5 : 0.15 }}
              />
            </TouchableOpacity>

            <GestureDetector gesture={panGesture}>
              <Animated.View style={ringContentStyle}>
                <ProgressRing
                  progress={stepPercent}
                  replayKey={replayKey}
                  radius={RING_RADIUS}
                  strokeWidth={RING_STROKE}
                  color={isHistoryMode ? colors.primary + 'AA' : colors.primary}
                  trackColor={colors.surfaceContainerLow}
                >
                  <View style={styles.ringInner}>
                    <Text style={styles.stepCount}>
                      {displaySteps.toLocaleString('es-AR')}
                    </Text>
                    <Text style={styles.stepLabel}>{dayLabel}</Text>
                    {dateLabel && (
                      <Text style={[styles.stepDateLabel, { color: colors.primary }]}>
                        {dateLabel}
                      </Text>
                    )}
                  </View>
                </ProgressRing>
              </Animated.View>
            </GestureDetector>

            {/* Flecha adelante — gris, sutil */}
            <View style={styles.navArrow}>
              {isHistoryMode && (
                <TouchableOpacity hitSlop={12} onPress={() => navigateDay(1)}>
                  <Ionicons name="chevron-forward" size={22} color={colors.textTertiary} style={{ opacity: 0.5 }} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.stepMeta}>
            <TouchableOpacity
              style={[styles.goalChip, { backgroundColor: colors.primaryDim12, borderColor: colors.primary + '55' }]}
              onPress={() => { setGoalInput(String(goal)); setGoalModal(true); }}
              activeOpacity={0.72}
            >
              <Ionicons name="flag-outline" size={13} color={colors.primary} />
              <Text style={[styles.goalChipText, { color: colors.primary }]}>
                {goal.toLocaleString('es-AR')} pasos
              </Text>
              <Ionicons name="create-outline" size={12} color={colors.primary + 'AA'} />
            </TouchableOpacity>
            <Text style={styles.stepMetaProgress}>Progreso: {displayPercent}%</Text>
          </View>
        </View>


        {/* ── Racha ── */}
        <TouchableOpacity
          style={styles.rachaCard}
          onPress={() => navigation.navigate('Racha')}
          activeOpacity={0.82}
        >
          <View style={styles.rachaHeader}>
            <View>
              <Text style={styles.rachaTitle}>Racha de {streakDays} días 🔥</Text>
              <Text style={styles.rachaSubtitle}>
                {mejorRacha > 0
                  ? `Mejor Racha: ${mejorRacha}${streakBadge ? ` · ${streakBadge}` : ''}`
                  : 'Empezá tu primera racha'}
              </Text>
            </View>
            <View style={styles.rachaBadge}>
              <Text style={styles.rachaBadgeText}>{streakDays}</Text>
            </View>
          </View>
          <View style={styles.rachaBarTrack}>
            <View
              style={[
                styles.rachaBarFill,
                { width: `${Math.min((streakDays / nextMilestone) * 100, 100)}%` },
              ]}
            />
          </View>
          <View style={styles.rachaFooter}>
            <Text style={styles.rachaFooterText}>0</Text>
            <Text style={styles.rachaFooterText}>{nextMilestone} días</Text>
          </View>
        </TouchableOpacity>

        {/* ── Estadísticas ── */}
        <View style={styles.statsRow}>
          <StatCard
            icon="flame"
            value={`${displayCalories}`}
            unit="kcal"
            label="Quemadas"
            iconColor={colors.streak}
            highlighted={isHistoryMode}
            highlightColor={colors.primary}
          />
          <StatCard
            icon="time"
            value={walkLabel}
            unit=""
            label="Caminado"
            iconColor={colors.textSecondary}
            highlighted={isHistoryMode}
            highlightColor={colors.primary}
          />
        </View>

        {/* ── Gym en vivo ── */}
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() => navigation.navigate('Gym')}
          style={[styles.gymCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={[styles.gymCircle, { backgroundColor: gymStatusColor(gymCount) + '22', borderColor: gymStatusColor(gymCount) }]}>
            <Text style={[styles.gymCircleCount, { color: gymStatusColor(gymCount) }]}>{gymCount}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.gymCardTitle, { color: colors.text }]}>En el gym ahora</Text>
            <Text style={[styles.gymCardSub, { color: colors.textSecondary }]}>{gymStatusLabel(gymCount)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </TouchableOpacity>

        {/* ── Entrenamiento de hoy ── */}
        <View style={styles.sectionHeader}>
          <View style={{ gap: 3 }}>
            <Text style={styles.sectionTitle}>Tu Entrenamiento</Text>
            <Text style={styles.sectionSub}>
              {todayDay
                ? `Hoy estás en tu día ${todayDay.numero} de ${todayDayTitle}`
                : 'Cargando rutina...'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => navigation.navigate('Rutina')}
        >
          <ImageBackground
            source={{ uri: todayWorkout.image }}
            style={styles.workoutCard}
            imageStyle={styles.workoutImage}
          >
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.96)']}
              style={styles.workoutGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            >
              <View style={styles.workoutMeta}>
                <View style={styles.durationChip}>
                  <Ionicons name="body-outline" size={11} color={colors.textSecondary} />
                  <Text style={styles.durationText}>
                    {todayDay ? todayMuscleGroups.slice(0, 2).join(' · ') : todayWorkout.type}
                  </Text>
                </View>
              </View>
              <Text style={styles.workoutTitle}>
                {todayDay ? `Día ${todayDay.numero}: ${todayDayTitle}` : todayWorkout.title}
              </Text>
              <TouchableOpacity
                style={styles.workoutBtn}
                onPress={() => navigation.navigate('Rutina')}
                activeOpacity={0.85}
              >
                <Ionicons name="play" size={14} color={colors.textInverse} style={{ marginRight: 6 }} />
                <Text style={styles.workoutBtnText}>Comenzar Entrenamiento</Text>
              </TouchableOpacity>
            </LinearGradient>
          </ImageBackground>
        </TouchableOpacity>

        <View style={{ height: spacing['2xl'] }} />
      </ScrollView>

      {goalModalVisible && (
        <GoalModal
          input={goalInput}
          onChangeInput={setGoalInput}
          onSave={saveGoal}
          onClose={() => setGoalModal(false)}
          colors={colors}
        />
      )}

      <AnnouncementEditSheet
        visible={annEditOpen}
        announcement={announcement}
        onClose={() => setAnnEditOpen(false)}
      />
    </SafeAreaView>

    </Animated.View>
  );
}

function gymStatusColor(count) {
  if (count === 0) return '#9CA3AF';
  if (count <= 5)  return '#22C55E';
  if (count <= 15) return '#F59E0B';
  return '#EF4444';
}

function gymStatusLabel(count) {
  if (count === 0) return 'Sin gente por ahora';
  if (count === 1) return '1 persona';
  if (count <= 5)  return `${count} personas · Tranquilo`;
  if (count <= 15) return `${count} personas · Moderado`;
  return `${count} personas · Lleno`;
}

function StatCard({ icon, value, unit, label, iconColor, highlighted, highlightColor }) {
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[
      styles.statCard,
      highlighted && {
        borderColor: highlightColor,
        borderWidth: 1.5,
        shadowColor: highlightColor,
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
        elevation: 4,
      },
    ]}>
      <View style={[styles.statIconBg, { backgroundColor: iconColor + '18' }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      {!!unit && <Text style={styles.statUnit}>{unit}</Text>}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function makeStyles(colors) { return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['3xl'],
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primaryDim12,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 15,
    fontWeight: typography.weights.black,
    color: colors.primary,
  },
  logoBlock: {
    gap: 3,
  },
  logo: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.black,
    color: colors.primary,
    letterSpacing: -0.5,
  },
  trainerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FF3891',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    shadowColor: '#FF3891',
    shadowOpacity: 0.55,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  trainerBadgeText: {
    fontSize: 9,
    fontWeight: typography.weights.black,
    color: '#fff',
    letterSpacing: 1,
  },
  gymBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A28',
    borderWidth: 1,
    borderColor: '#22C55E55',
    borderRadius: radius.lg,
    paddingVertical: 12,
    gap: 8,
    marginBottom: spacing.lg,
  },
  gymDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  gymBarText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: '#22C55E',
    letterSpacing: 0.3,
  },
  gymBarXP: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: '#22C55E',
    opacity: 0.7,
    marginLeft: 4,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.streakDim,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.streakBorder,
    gap: 5,
  },
  streakFire: { fontSize: 13 },
  streakPillText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.streak,
  },

  // Greeting
  greeting: {
    marginBottom: spacing['2xl'],
  },
  greetingTitle: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.black,
    color: colors.text,
    marginBottom: 6,
  },
  greetingSubtitle: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    lineHeight: typography.sizes.base * 1.55,
  },

  // Trainer card
  trainerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,56,145,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,56,145,0.25)',
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing['2xl'],
  },
  trainerCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  trainerCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,56,145,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trainerCardTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.black,
    color: '#FF3891',
    marginBottom: 2,
  },
  trainerCardSub: {
    fontSize: typography.sizes.xs,
    color: 'rgba(255,56,145,0.7)',
    fontWeight: '500',
  },

  // Progress ring
  ringSection: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  ringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrow: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    alignItems: 'center',
  },
  stepCount: {
    fontSize: 48,
    fontWeight: typography.weights.black,
    color: colors.text,
    letterSpacing: -2,
  },
  stepLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.textSecondary,
    letterSpacing: 2.5,
    marginTop: 4,
  },
  stepDateLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 3,
  },
  stepMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '90%',
    marginTop: spacing.lg,
  },
  goalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1.5,
  },
  goalChipText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  stepMetaProgress: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    textShadowColor: colors.primaryShadow,
    textShadowRadius: 6,
  },

  // Racha
  rachaCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.streakFaint,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  rachaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  rachaTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 2,
  },
  rachaSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  rachaBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.streakFaint,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.streakBorder,
  },
  rachaBadgeText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.black,
    color: colors.streak,
  },
  rachaBarTrack: {
    height: 7,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radius.full,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  rachaBarFill: {
    height: '100%',
    backgroundColor: colors.streak,
    borderRadius: radius.full,
    shadowColor: colors.streak,
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  rachaFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  rachaFooterText: {
    fontSize: typography.sizes.xs,
    color: colors.textTertiary,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  gymCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  gymCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gymCircleCount: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.black,
  },
  gymCardTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    marginBottom: 2,
  },
  gymCardSub: {
    fontSize: typography.sizes.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    alignItems: 'center',
    gap: 3,
  },
  statIconBg: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.black,
    color: colors.text,
  },
  statUnit: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  statLabel: {
    fontSize: 10,
    color: colors.textTertiary,
    textAlign: 'center',
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  sectionLink: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  sectionSub: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },

  // Workout card
  workoutCard: {
    width: '100%',
    height: 290,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  workoutImage: {
    borderRadius: radius.xl,
  },
  workoutGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.xl,
  },
  workoutMeta: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  durationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    gap: 4,
  },
  durationText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: typography.weights.medium,
  },
  workoutTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.black,
    color: colors.text,
    marginBottom: 6,
  },
  workoutDesc: {
    fontSize: typography.sizes.sm,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: typography.sizes.sm * 1.5,
    marginBottom: spacing.lg,
  },
  workoutBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  workoutBtnText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.textInverse,
    letterSpacing: 0.2,
  },
}); }
