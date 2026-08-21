import { useMemo, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  Dimensions,
  Modal,
  Pressable,
} from 'react-native';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming,
  withRepeat, withSequence, Easing,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { typography, spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { stepMilestones } from '../constants/mockData';
import { useStepContext } from '../context/StepContext';
import useUserProfile from '../hooks/useUserProfile';
import useAuth from '../hooks/useAuth';
import { awardXPAndCoins } from '../services/gamificationService';
import { useGymEvents } from '../context/GymEventsContext';
import { LOGROS_DEF } from '../constants/logros';

const { width } = Dimensions.get('window');

const INSPIRATION_IMG =
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80';

export default function RetosScreen({ navigation }) {
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { steps: currentSteps } = useStepContext();
  const { profile } = useUserProfile();
  const { user, isTester } = useAuth();
  useGymEvents(); // mantiene contexto activo
  const awardedRef = useRef(new Set());
  const [logroPicker, setLogroPicker] = useState(false);

  const completados = useMemo(
    () => new Set(profile?.logrosCompletados ?? []),
    [profile?.logrosCompletados],
  );

  const logros = useMemo(() => LOGROS_DEF.map(def => ({
    ...def,
    progress:    def.getProgress(profile),
    isCompleted: completados.has(def.id),
  })), [profile, completados]);

  // Detecta logros recién completados y otorga XP (una sola vez)
  useEffect(() => {
    if (!user?.uid || !profile) return;
    logros.forEach(async (l) => {
      if (l.progress < l.total) return;
      if (l.isCompleted) return;
      if (awardedRef.current.has(l.id)) return;
      awardedRef.current.add(l.id);
      await awardXPAndCoins(user.uid, l.xp);
      await updateDoc(doc(db, 'users', user.uid), {
        logrosCompletados: arrayUnion(l.id),
      });
      // El modal se dispara automáticamente en todos los dispositivos via GymEventsContext → Firestore onSnapshot
    });
  }, [logros, user?.uid, profile]);
  const maxSteps = stepMilestones[stepMilestones.length - 1].steps;
  const progressPercent = Math.min((currentSteps / maxSteps) * 100, 100);
  const nextMilestone = stepMilestones.find((m) => m.steps > currentSteps);

  const screenOpacity = useSharedValue(0);
  const screenStyle   = useAnimatedStyle(() => ({ flex: 1, opacity: screenOpacity.value }));
  useEffect(() => {
    screenOpacity.value = withTiming(1, { duration: 280 });
  }, []);

  const trophyY = useSharedValue(0);
  const trophyStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: trophyY.value }],
  }));
  useEffect(() => {
    trophyY.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming( 0, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
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
          <Text style={styles.logo}>New Life</Text>
          <TouchableOpacity
            style={styles.rachaBtn}
            onPress={() => navigation.navigate('Inicio')}
          >
            <Ionicons name="flame" size={14} color={colors.streak} />
            <Text style={styles.rachaBtnText}>Ir a Racha</Text>
          </TouchableOpacity>
        </View>

        {/* ── Torneos ── */}
        <TouchableOpacity
          style={[styles.torneosCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
          onPress={() => navigation.navigate('Torneos')}
          activeOpacity={0.82}
        >
          <View style={[styles.torneosIconWrap, { backgroundColor: '#FBBF2415', borderColor: '#FBBF2440' }]}>
            <Animated.View style={trophyStyle}>
              <Ionicons name="trophy" size={22} color="#FBBF24" />
            </Animated.View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.torneosTitle, { color: colors.text }]}>Torneos entre amigos</Text>
            <Text style={[styles.torneosSub, { color: colors.textSecondary }]}>Competí por XP, nivel y visitas al gym</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>

        {/* ── Progreso Diario: Hitos de Pasos ── */}
        <View style={styles.section}>
          <Text style={styles.sectionMeta}>PROGRESO DIARIO</Text>
          <Text style={styles.sectionTitle}>Hitos de Pasos</Text>

          {/* Barra de hitos */}
          <View style={styles.milestonesContainer}>
            <View style={styles.milestoneBar}>
              <View style={styles.milestoneTrack} />
              <View
                style={[
                  styles.milestoneFill,
                  { width: `${progressPercent}%` },
                ]}
              />
              {stepMilestones.map((m) => {
                const pos = Math.min((m.steps / maxSteps) * 100, 100);
                const reached = currentSteps >= m.steps;
                const isCurrent =
                  currentSteps >= m.steps &&
                  (!nextMilestone || m.steps < nextMilestone.steps ||
                    !stepMilestones.find((mm) => mm.steps > m.steps && currentSteps < mm.steps));
                return (
                  <View
                    key={m.steps}
                    style={[
                      styles.milestoneDot,
                      { left: `${pos}%` },
                      reached && styles.milestoneDotReached,
                      m.isPremium && styles.milestoneDotPremium,
                    ]}
                  >
                    {m.isPremium && (
                      <Text style={styles.milestoneStar}>★</Text>
                    )}
                  </View>
                );
              })}
            </View>
            <View style={styles.milestoneLabels}>
              {stepMilestones.map((m) => (
                <Text
                  key={m.steps}
                  style={[
                    styles.milestoneLabel,
                    currentSteps >= m.steps && styles.milestoneLabelReached,
                  ]}
                >
                  {m.label}
                </Text>
              ))}
            </View>
          </View>

          <View style={styles.stepsDisplay}>
            <Text style={styles.stepsCount}>
              {currentSteps.toLocaleString('es-AR')}
            </Text>
            <Text style={styles.stepsUnit}>pasos hoy</Text>
          </View>

          {nextMilestone && (
            <Text style={styles.motivText}>
              ¡Casi llegás al gran premio de hoy!{' '}
              <Text style={{ color: colors.primary }}>
                {(nextMilestone.steps - currentSteps).toLocaleString('es-AR')} pasos más
              </Text>
            </Text>
          )}
        </View>

        {/* ── Logros ── */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <Text style={styles.sectionTitle}>Logros</Text>
            {isTester && (
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  onPress={() => setLogroPicker(true)}
                  style={{ backgroundColor: '#059669', borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10 }}
                >
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>🏆 Forzar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    if (!user?.uid) return;
                    const raw = await AsyncStorage.getItem('tester_xp_snap');
                    if (raw) {
                      const snap = JSON.parse(raw);
                      await updateDoc(doc(db, 'users', user.uid), snap);
                      await AsyncStorage.removeItem('tester_xp_snap'); // limpiar para la próxima sesión
                    } else {
                      await updateDoc(doc(db, 'users', user.uid), { nivelJuego: 1, xp: 0, xpTotal: 0, gymVisitCount: 0, logrosCompletados: [] });
                    }
                  }}
                  style={{ backgroundColor: '#92400e', borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10 }}
                >
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>↩ Reset</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          <View style={styles.logrosList}>
            {logros.map((l) => (
              <LogroCard key={l.id} logro={l} isCompleted={l.isCompleted} />
            ))}
          </View>
        </View>

        {/* ── Banner inspiracional ── */}
        <ImageBackground
          source={{ uri: INSPIRATION_IMG }}
          style={styles.inspirationBanner}
          imageStyle={{ borderRadius: radius.xl }}
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.85)']}
            style={styles.inspirationGradient}
          >
            <Text style={styles.inspirationQuote}>
              La disciplina supera al talento
            </Text>
            <Text style={styles.inspirationSub}>
              Seguí así, estás a solo{' '}
              {nextMilestone
                ? (nextMilestone.steps - currentSteps).toLocaleString('es-AR')
                : '0'}{' '}
              pasos de tu meta diaria.
            </Text>
          </LinearGradient>
        </ImageBackground>

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      {/* ── Picker tester: Forzar Logro ── */}
      <Modal visible={logroPicker} transparent animationType="fade" onRequestClose={() => setLogroPicker(false)} statusBarTranslucent>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setLogroPicker(false)}>
          <Pressable style={{ backgroundColor: '#1a1a1a', borderRadius: 18, width: 300, overflow: 'hidden' }} onPress={() => {}}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#ffffff12' }}>
              <Text style={{ flex: 1, color: '#fff', fontSize: 16, fontWeight: '800' }}>Forzar Logro</Text>
              <TouchableOpacity onPress={() => setLogroPicker(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color="#888" />
              </TouchableOpacity>
            </View>
            {/* Opciones */}
            {LOGROS_DEF.map((l, i) => (
              <TouchableOpacity
                key={l.id}
                onPress={async () => {
                  setLogroPicker(false);
                  if (!user?.uid) return;
                  // Guardar snapshot solo la primera vez (no sobreescribir si ya existe)
                  if (profile) {
                    const existing = await AsyncStorage.getItem('tester_xp_snap');
                    if (!existing) {
                      await AsyncStorage.setItem('tester_xp_snap', JSON.stringify({
                        xp: profile.xp ?? 0,
                        xpTotal: profile.xpTotal ?? 0,
                        nivelJuego: profile.nivelJuego ?? 1,
                        gymVisitCount: profile.gymVisitCount ?? 0,
                        logrosCompletados: profile.logrosCompletados ?? [],
                      }));
                    }
                  }
                  await awardXPAndCoins(user.uid, l.xp);
                  await updateDoc(doc(db, 'users', user.uid), { logrosCompletados: arrayUnion(l.id) });
                  // Modal se dispara via Firestore onSnapshot en todos los dispositivos
                }}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: '#ffffff08' }}
              >
                <Ionicons name={l.icon} size={20} color="#22c55e" />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{l.title}</Text>
                  <Text style={{ color: '#888', fontSize: 12, marginTop: 1 }}>+{l.xp} XP</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#555" />
              </TouchableOpacity>
            ))}
            <View style={{ height: 8 }} />
          </Pressable>
        </Pressable>
      </Modal>

    </SafeAreaView>
    </Animated.View>
  );
}

const TYPE_PALETTE = {
  bronze: { accent: '#CD7F32', bg: 'rgba(205,127,50,0.08)', border: 'rgba(205,127,50,0.25)' },
  silver: { accent: '#A8A8A8', bg: 'rgba(168,168,168,0.08)', border: 'rgba(168,168,168,0.25)' },
  gold:   { accent: '#FFD700', bg: 'rgba(255,215,0,0.08)',   border: 'rgba(255,215,0,0.25)'   },
};
const COMPLETED_PALETTE = { accent: '#22c55e', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.3)' };

function LogroCard({ logro, isCompleted }) {
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const progressPercent = isCompleted ? 100 : Math.round((logro.progress / logro.total) * 100);
  const palette = isCompleted ? COMPLETED_PALETTE : (TYPE_PALETTE[logro.type] ?? TYPE_PALETTE.bronze);

  return (
    <View style={[styles.logroCard, { backgroundColor: palette.bg, borderWidth: 1, borderColor: palette.border }]}>
      <View style={[styles.logroIcon, { backgroundColor: `${palette.accent}22` }]}>
        <Ionicons name={isCompleted ? 'checkmark-circle' : logro.icon} size={22} color={palette.accent} />
      </View>
      <View style={styles.logroContent}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.logroTitle}>{logro.title}</Text>
          {isCompleted && (
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#22c55e', letterSpacing: 0.3 }}>
              ¡Completado!
            </Text>
          )}
        </View>
        <Text style={styles.logroDesc}>{logro.description}</Text>
        <View style={styles.logroProgressRow}>
          <View style={styles.logroTrack}>
            <View style={[styles.logroFill, { width: `${progressPercent}%`, backgroundColor: palette.accent }]} />
          </View>
          <Text style={[styles.logroProgressText, { color: palette.accent }]}>
            {isCompleted ? `${logro.total}/${logro.total}` : `${logro.progress}/${logro.total}`}
          </Text>
        </View>
      </View>
    </View>
  );
}

function makeStyles(colors) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing['3xl'] },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  logo: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.black,
    color: colors.primary,
    letterSpacing: -0.5,
  },
  rachaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.streakDim,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
  },
  rachaBtnText: {
    fontSize: typography.sizes.sm,
    color: colors.streak,
    fontWeight: typography.weights.semibold,
  },

  // Torneos card
  torneosCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 0.5,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  torneosIconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  torneosTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    marginBottom: 2,
  },
  torneosSub: {
    fontSize: typography.sizes.sm,
  },

  // Section
  section: { marginBottom: spacing['3xl'] },
  sectionMeta: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.black,
    color: colors.text,
    marginBottom: spacing.xl,
  },

  // Milestones
  milestonesContainer: { marginBottom: spacing.lg },
  milestoneBar: {
    height: 28,
    justifyContent: 'center',
    position: 'relative',
    marginHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  milestoneTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.full,
  },
  milestoneFill: {
    position: 'absolute',
    left: 0,
    height: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
  },
  milestoneDot: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.surfaceActive,
    borderWidth: 2,
    borderColor: colors.border,
    transform: [{ translateX: -8 }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneDotReached: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  milestoneDotPremium: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.coin,
    borderColor: colors.coin,
    transform: [{ translateX: -11 }],
  },
  milestoneStar: {
    fontSize: 10,
    color: colors.textInverse,
    fontWeight: typography.weights.black,
  },
  milestoneLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  milestoneLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textTertiary,
    fontWeight: typography.weights.medium,
  },
  milestoneLabelReached: { color: colors.primary },

  stepsDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  stepsCount: {
    fontSize: typography.sizes['3xl'],
    fontWeight: typography.weights.black,
    color: colors.text,
  },
  stepsUnit: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
  },
  motivText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: typography.sizes.sm * 1.6,
  },

  // Logros
  logrosList: { gap: spacing.sm },
  logroCard: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  logroIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  logroContent: { flex: 1 },
  logroTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 2,
  },
  logroDesc: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    lineHeight: typography.sizes.sm * 1.4,
  },
  logroProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logroTrack: {
    flex: 1,
    height: 5,
    backgroundColor: colors.surfaceActive,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  logroFill: { height: '100%', borderRadius: radius.full },
  logroProgressText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    minWidth: 32,
  },

  // Inspiration
  inspirationBanner: {
    width: '100%',
    height: 180,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  inspirationGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.xl,
  },
  inspirationQuote: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.black,
    color: colors.text,
    marginBottom: 6,
  },
  inspirationSub: {
    fontSize: typography.sizes.sm,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: typography.sizes.sm * 1.5,
  },
}); }
