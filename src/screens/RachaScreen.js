import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated as RNAnimated, Easing as RNEasing, Dimensions, BackHandler,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSpring, withTiming, withDelay,
  Easing, interpolate, runOnJS,
} from 'react-native-reanimated';
import GoalModal from '../components/ui/GoalModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import useUserProfile from '../hooks/useUserProfile';
import useAuth from '../hooks/useAuth';
import { useStepContext } from '../context/StepContext';
import { spacing, radius } from '../theme';
import { fetchWeeklyStepHistory } from '../services/userService';

// ── Constants ─────────────────────────────────────────────────────────────────
const { width: SW } = Dimensions.get('window');
const RING_SIZE = Math.min(SW - 64, 240);
const RING_CX = RING_SIZE / 2;
const RING_CY = RING_SIZE / 2;
const RING_R = RING_CX - 14;
const RING_STROKE = 12;
const RING_C = 2 * Math.PI * RING_R;

const DEFAULT_GOAL  = 10000;
const STORAGE_KEY   = 'dailyStepGoal';
const CHART_H       = 140;
const FIRE_H        = 28;
const SCREEN_H      = Dimensions.get('window').height;
const DAY_LETTERS   = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const AnimatedCircle = RNAnimated.createAnimatedComponent(Circle);

// ── Screen ────────────────────────────────────────────────────────────────────
export default function RachaScreen({ navigation }) {
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { profile } = useUserProfile();
  const { user }    = useAuth();
  const { steps }   = useStepContext();

  // ── Weekly step history ───────────────────────────────────────────────────
  const [weekData, setWeekData] = useState(null);

  useEffect(() => {
    if (!user?.uid) return;
    fetchWeeklyStepHistory(user.uid).then(setWeekData).catch(() => setWeekData({}));
  }, [user?.uid]);

  // Build rolling 7-day array; today is always index 6
  const realWeeklyStats = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toISOString().split('T')[0];
      const dayIdx  = (d.getDay() + 6) % 7; // Mon=0…Sun=6
      const daySteps = i === 6 ? steps : (weekData?.[dateStr] ?? 0);
      return { day: DAY_LETTERS[dayIdx], steps: daySteps, trained: daySteps >= 5000 };
    });
  }, [weekData, steps]);

  const TODAY_IDX = 6; // today is always the last bar

  // ── Reanimated shared values ──────────────────────────────────────────────
  const slideAnim      = useSharedValue(SCREEN_H);
  const heroAnim       = useSharedValue(0);
  const gridAnim       = useSharedValue(0);
  const chartReveal    = useSharedValue(0);
  const nextGoalReveal = useSharedValue(0);
  const footerReveal   = useSharedValue(0);

  // ── Legacy Animated (SVG + bar height — can't run on UI thread) ──────────
  const ringAnim = useRef(new RNAnimated.Value(0)).current;
  const barAnims = useRef(Array.from({ length: 7 }, () => new RNAnimated.Value(0))).current;

  // ── Animated styles ───────────────────────────────────────────────────────
  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideAnim.value }],
  }));
  const heroStyle = useAnimatedStyle(() => ({ opacity: heroAnim.value }));
  const gridStyle = useAnimatedStyle(() => ({
    opacity: gridAnim.value,
    transform: [{ translateY: interpolate(gridAnim.value, [0, 1], [20, 0]) }],
  }));
  const chartStyle = useAnimatedStyle(() => ({
    opacity: chartReveal.value,
    transform: [{ translateY: interpolate(chartReveal.value, [0, 1], [28, 0]) }],
  }));
  const nextGoalStyle = useAnimatedStyle(() => ({
    opacity: nextGoalReveal.value,
    transform: [{ translateY: interpolate(nextGoalReveal.value, [0, 1], [28, 0]) }],
  }));
  const footerStyle = useAnimatedStyle(() => ({
    opacity: footerReveal.value,
    transform: [{ translateY: interpolate(footerReveal.value, [0, 1], [28, 0]) }],
  }));

  // ── Navigation ────────────────────────────────────────────────────────────
  const goBack = useCallback(() => navigation.goBack(), [navigation]);

  const handleBack = useCallback(() => {
    slideAnim.value = withTiming(SCREEN_H, { duration: 300, easing: Easing.in(Easing.cubic) }, (finished) => {
      'worklet';
      if (finished) runOnJS(goBack)();
    });
  }, [slideAnim, goBack]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => sub.remove();
  }, [handleBack]);

  // ── Goal state ────────────────────────────────────────────────────────────
  const [goal, setGoal]             = useState(DEFAULT_GOAL);
  const [goalInput, setGoalInput]   = useState('');
  const [goalModalVisible, setGoalModal] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(v => { if (v) setGoal(Number(v)); });
  }, []);

  const saveGoal = useCallback((val) => {
    const n = Math.max(1000, Math.min(50000, Number(val) || DEFAULT_GOAL));
    setGoal(n);
    AsyncStorage.setItem(STORAGE_KEY, String(n));
    setGoalModal(false);
  }, []);

  // ── Entry animation — ALL sections animate on mount, no scroll needed ─────
  useEffect(() => {
    slideAnim.value  = withSpring(0, { damping: 22, stiffness: 200, mass: 0.9 });
    heroAnim.value   = withTiming(1, { duration: 220 });
    gridAnim.value   = withDelay(220, withTiming(1, { duration: 160 }));
    chartReveal.value    = withDelay(340, withTiming(1, { duration: 180 }));
    nextGoalReveal.value = withDelay(460, withTiming(1, { duration: 180 }));
    footerReveal.value   = withDelay(560, withTiming(1, { duration: 180 }));

    RNAnimated.timing(ringAnim, {
      toValue: 1, duration: 600, delay: 80,
      easing: RNEasing.out(RNEasing.cubic), useNativeDriver: false,
    }).start();

    RNAnimated.sequence([
      RNAnimated.delay(380),
      RNAnimated.stagger(25, barAnims.map(a =>
        RNAnimated.spring(a, { toValue: 1, damping: 16, stiffness: 260, useNativeDriver: false })
      )),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived values ────────────────────────────────────────────────────────
  const streakDays    = profile?.racha      ?? 0;
  const bestStreak    = profile?.mejorRacha ?? streakDays;
  const nextMilestone = streakDays < 7 ? 7 : streakDays < 14 ? 14 : 30;
  const daysLeft      = nextMilestone - streakDays;
  const ringProgress  = Math.min(streakDays / nextMilestone, 1);
  const maxSteps      = Math.max(...realWeeklyStats.map(d => d.steps), goal, 1);
  const weightKg      = profile?.peso ? Number(profile.peso) : 70;

  const weeklyTotalSteps = realWeeklyStats.reduce((s, d) => s + d.steps, 0);
  const weeklyWalkCal    = Math.round(weeklyTotalSteps * 0.04 * (weightKg / 70));
  const weeklyTotalMin   = Math.round(weeklyTotalSteps / 100);
  const weeklyH          = Math.floor(weeklyTotalMin / 60);
  const weeklyM          = weeklyTotalMin % 60;
  const weeklyWalkTime   = weeklyH > 0 ? `${weeklyH}h ${weeklyM}m` : `${weeklyM}m`;

  const dashOffset = ringAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [RING_C, RING_C * (1 - ringProgress)],
  });

  const streakMsg = streakDays === 0
    ? 'Cada entrenamiento cuenta para alcanzar tu próximo objetivo.'
    : streakDays < 7
      ? '¡Buen comienzo! Seguí así y llegás a la semana.'
      : streakDays < 14
        ? '¡Imparable! Vas camino al récord personal.'
        : '¡Leyenda! Récord personal en riesgo 🏅';

  return (
    <Animated.View style={[styles.container, slideStyle]}>
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            onPress={handleBack}
            hitSlop={12}
            style={[styles.headerBtn, { backgroundColor: colors.surfaceContainer }]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mi Racha</Text>
          <View style={[styles.streakPill, { backgroundColor: colors.surfaceContainer, borderColor: colors.borderLight }]}>
            <Text style={{ fontSize: 15 }}>🔥</Text>
            <Text style={[styles.streakPillText, { color: colors.text }]}>{streakDays} Días</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        >

          {/* ── Hero: SVG ring ─────────────────────────────────────────── */}
          <Animated.View style={[styles.heroSection, heroStyle]}>
            <View style={[styles.ringWrap, { width: RING_SIZE, height: RING_SIZE }]}>
              <Svg
                width={RING_SIZE} height={RING_SIZE}
                viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
                style={[StyleSheet.absoluteFill, { transform: [{ rotate: '-90deg' }] }]}
              >
                <Circle
                  cx={RING_CX} cy={RING_CY} r={RING_R}
                  fill="none"
                  stroke={colors.surfaceContainerHigh}
                  strokeWidth={RING_STROKE}
                />
                <AnimatedCircle
                  cx={RING_CX} cy={RING_CY} r={RING_R}
                  fill="none"
                  stroke={colors.primary}
                  strokeWidth={RING_STROKE}
                  strokeLinecap="round"
                  strokeDasharray={`${RING_C}`}
                  strokeDashoffset={dashOffset}
                />
              </Svg>
              <View style={styles.ringCenter}>
                <Text style={[styles.heroNumber, { color: colors.text }]}>{streakDays}</Text>
                <Text style={[styles.heroDays, { color: colors.textSecondary }]}>DÍAS SEGUIDOS</Text>
              </View>
            </View>
            <View style={styles.heroMsg}>
              <Text style={[styles.heroMsgTitle, { color: colors.text }]}>¡Seguí así!</Text>
              <Text style={[styles.heroMsgSub, { color: colors.textSecondary }]}>{streakMsg}</Text>
            </View>
          </Animated.View>

          {/* ── 2×2 Stats grid ─────────────────────────────────────────── */}
          <Animated.View style={[styles.statsGrid, gridStyle]}>
            {[
              { icon: 'flash',     iconColor: colors.primary,       label: 'RACHA ACTUAL',     value: `${streakDays} días` },
              { icon: 'medal',     iconColor: colors.streak,        label: 'RÉCORD PERSONAL',  value: `${bestStreak} días` },
              { icon: 'footsteps', iconColor: colors.textSecondary, label: 'PASOS HOY',        value: steps.toLocaleString('es-AR') },
              { icon: 'calendar',  iconColor: colors.textTertiary,  label: 'PASOS ESTA SEM.',  value: weeklyTotalSteps > 0 ? weeklyTotalSteps.toLocaleString('es-AR') : '—' },
            ].map((item, i) => (
              <View key={i} style={[styles.statCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.borderLight }]}>
                <Ionicons name={item.icon} size={20} color={item.iconColor} />
                <Text style={[styles.statCardLabel, { color: colors.textTertiary }]}>{item.label}</Text>
                <Text style={[styles.statCardValue, { color: colors.text }]}>{item.value}</Text>
              </View>
            ))}
          </Animated.View>

          {/* ── Weekly activity chart ───────────────────────────────────── */}
          <Animated.View
            style={[
              styles.card,
              { backgroundColor: colors.surfaceContainer, borderColor: colors.borderLight },
              chartStyle,
            ]}
          >
            <View style={styles.chartHeader}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Actividad Semanal</Text>
              <TouchableOpacity
                style={[styles.goalBtn, { backgroundColor: colors.primaryDim12, borderColor: colors.primary + '66' }]}
                onPress={() => { setGoalInput(String(goal)); setGoalModal(true); }}
                activeOpacity={0.75}
              >
                <Ionicons name="footsteps-outline" size={13} color={colors.primary} />
                <Text style={[styles.goalBtnText, { color: colors.primary }]}>
                  {goal.toLocaleString('es-AR')} pasos
                </Text>
                <Ionicons name="create-outline" size={12} color={colors.primary + 'BB'} />
              </TouchableOpacity>
            </View>

            <View style={styles.barsRow}>
              {realWeeklyStats.map((day, i) => {
                const isToday = i === TODAY_IDX;
                const goalMet = day.steps >= goal;
                const hasSteps = day.steps > 0;
                const barH = barAnims[i].interpolate({
                  inputRange:  [0, 1],
                  outputRange: [0, Math.round((day.steps / maxSteps) * CHART_H)],
                });
                const barColor = goalMet
                  ? colors.primary
                  : hasSteps
                    ? colors.primary + '60'
                    : colors.surfaceContainerHigh;

                return (
                  <View key={i} style={styles.barColumn}>
                    <View style={styles.fireSlot}>
                      {goalMet && <Text style={styles.fireEmoji}>🔥</Text>}
                    </View>
                    <View style={styles.barTrack}>
                      <RNAnimated.View style={[styles.bar, { height: barH, backgroundColor: barColor }]} />
                    </View>
                    <Text style={[
                      styles.dayLabel,
                      { color: isToday ? colors.primary : colors.textTertiary },
                      isToday && { fontWeight: '900' },
                    ]}>
                      {day.day}
                    </Text>
                    <View style={[
                      styles.todayDot,
                      { backgroundColor: isToday ? colors.primary : 'transparent' },
                    ]} />
                  </View>
                );
              })}
            </View>
          </Animated.View>

          {/* ── Next goal card ──────────────────────────────────────────── */}
          {daysLeft > 0 && (
            <Animated.View style={nextGoalStyle}>
              <View style={[styles.nextGoalCard, { backgroundColor: colors.primary }]}>
                <View style={styles.nextGoalBlob} />
                <View style={styles.nextGoalTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nextGoalLabel}>PRÓXIMO OBJETIVO</Text>
                    <Text style={styles.nextGoalTitle}>{nextMilestone} días consecutivos</Text>
                  </View>
                  <View style={[styles.nextGoalIconBox, { backgroundColor: 'rgba(0,0,0,0.15)' }]}>
                    <Ionicons name="trophy" size={24} color="#fff" />
                  </View>
                </View>
                <View style={{ gap: 6, zIndex: 1 }}>
                  <View style={styles.nextGoalMeta}>
                    <Text style={styles.nextGoalMetaText}>Progreso: {streakDays}/{nextMilestone}</Text>
                    <Text style={styles.nextGoalMetaText}>
                      {daysLeft === 1 ? '¡Falta 1 día!' : `¡Faltan ${daysLeft} días!`}
                    </Text>
                  </View>
                  <View style={styles.nextGoalTrack}>
                    <View style={[styles.nextGoalFill, { width: `${Math.round(ringProgress * 100)}%` }]} />
                  </View>
                </View>
                <Text style={styles.nextGoalReward}>
                  🏅 Recompensa: Insignia "Guerrero de Hierro"
                </Text>
              </View>
            </Animated.View>
          )}

          {/* ── Weekly walk stats ───────────────────────────────────────── */}
          <Animated.View style={[{ gap: 8 }, footerStyle]}>
            <View style={styles.footerGrid}>
              {[
                { label: 'Pasos Sem.',  sub: 'últimos 7 días',  value: weeklyTotalSteps > 0 ? weeklyTotalSteps.toLocaleString('es-AR') : '—', icon: 'footsteps-outline' },
                { label: 'Cal. Sem.',   sub: 'caminata',        value: weeklyWalkCal > 0 ? `${weeklyWalkCal}` : '—',                         icon: 'flame-outline' },
                { label: 'Tiempo Sem.', sub: 'caminado',        value: weeklyTotalSteps > 0 ? weeklyWalkTime : '—',                          icon: 'time-outline' },
              ].map((item, i) => (
                <View
                  key={i}
                  style={[styles.footerCell, { backgroundColor: colors.surfaceContainer, borderColor: colors.borderLight }]}
                >
                  <Ionicons name={item.icon} size={15} color={colors.primary} />
                  <Text style={[styles.footerLabel, { color: colors.textTertiary }]}>{item.label}</Text>
                  <Text style={[styles.footerValue, { color: colors.text }]}>{item.value}</Text>
                  <Text style={[styles.footerSub, { color: colors.textTertiary }]}>{item.sub}</Text>
                </View>
              ))}
            </View>
          </Animated.View>

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
      </SafeAreaView>
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
function makeStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: spacing.lg, paddingBottom: spacing.lg,
      gap: 12,
    },
    headerBtn: {
      width: 40, height: 40, borderRadius: 20,
      alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: {
      flex: 1, fontSize: 20, fontWeight: '900', color: colors.text, letterSpacing: -0.4,
    },
    streakPill: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 12, paddingVertical: 7,
      borderRadius: radius.full, borderWidth: 1,
    },
    streakPillText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },

    scroll: { paddingHorizontal: spacing.lg, gap: 20 },

    heroSection: { alignItems: 'center', paddingTop: 8, paddingBottom: 4, gap: 28 },
    ringWrap:    { alignItems: 'center', justifyContent: 'center' },
    ringCenter:  { alignItems: 'center', gap: 4 },
    heroNumber:  { fontSize: 80, fontWeight: '900', letterSpacing: -4, lineHeight: 82 },
    heroDays:    { fontSize: 10, fontWeight: '800', letterSpacing: 3, textTransform: 'uppercase' },
    heroMsg:     { alignItems: 'center', gap: 6, maxWidth: 280 },
    heroMsgTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
    heroMsgSub:   { fontSize: 14, textAlign: 'center', lineHeight: 20 },

    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    statCard: {
      width: '48%', flexGrow: 1,
      borderRadius: radius.xl, borderWidth: 1,
      padding: spacing.lg, gap: 4,
    },
    statCardLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 4 },
    statCardValue: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },

    card: { borderRadius: radius.xl, borderWidth: 1, padding: spacing.lg },
    cardTitle: { fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },

    chartHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 20,
    },
    goalBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 10, paddingVertical: 7,
      borderRadius: radius.full, borderWidth: 1.5,
    },
    goalBtnText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },

    barsRow:   { flexDirection: 'row' },
    barColumn: { flex: 1, alignItems: 'center' },
    fireSlot:  { height: FIRE_H, justifyContent: 'center', alignItems: 'center' },
    fireEmoji: { fontSize: 14 },
    barTrack:  { width: 24, height: CHART_H, justifyContent: 'flex-end', alignItems: 'center' },
    bar:       { width: 24, borderRadius: 12 },
    dayLabel:  { fontSize: 11, fontWeight: '700', marginTop: 10 },
    todayDot:  { width: 4, height: 4, borderRadius: 2, marginTop: 4 },

    nextGoalCard:   { borderRadius: radius.xl, padding: spacing.xl, gap: 16, overflow: 'hidden' },
    nextGoalBlob:   { position: 'absolute', right: -40, bottom: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.15)' },
    nextGoalTop:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12, zIndex: 1 },
    nextGoalLabel:  { fontSize: 9, fontWeight: '800', letterSpacing: 1.6, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase' },
    nextGoalTitle:  { fontSize: 22, fontWeight: '900', color: '#000', marginTop: 2, letterSpacing: -0.4 },
    nextGoalIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    nextGoalMeta:   { flexDirection: 'row', justifyContent: 'space-between', zIndex: 1 },
    nextGoalMetaText: { fontSize: 11, fontWeight: '700', color: 'rgba(0,0,0,0.65)' },
    nextGoalTrack:  { height: 8, backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: radius.full, overflow: 'hidden', zIndex: 1 },
    nextGoalFill:   { height: '100%', backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: radius.full },
    nextGoalReward: { fontSize: 11, fontWeight: '600', color: 'rgba(0,0,0,0.55)', zIndex: 1, fontStyle: 'italic' },

    footerGrid: { flexDirection: 'row', gap: 8 },
    footerCell: {
      flex: 1, borderRadius: radius.lg, borderWidth: 1,
      padding: spacing.md, alignItems: 'center', gap: 3,
    },
    footerLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
    footerSub:   { fontSize: 9, fontWeight: '500' },
    footerValue: { fontSize: 16, fontWeight: '900', letterSpacing: -0.4 },
  });
}