import { useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { typography, spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { stepMilestones, logros } from '../constants/mockData';
import { useStepContext } from '../context/StepContext';

const { width } = Dimensions.get('window');

const INSPIRATION_IMG =
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80';

export default function RetosScreen({ navigation }) {
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { steps: currentSteps } = useStepContext();
  const maxSteps = stepMilestones[stepMilestones.length - 1].steps;
  const progressPercent = Math.min((currentSteps / maxSteps) * 100, 100);
  const nextMilestone = stepMilestones.find((m) => m.steps > currentSteps);

  const screenOpacity = useSharedValue(0);
  const screenStyle   = useAnimatedStyle(() => ({ flex: 1, opacity: screenOpacity.value }));
  useEffect(() => {
    screenOpacity.value = withTiming(1, { duration: 280 });
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
            <Ionicons name="trophy" size={22} color="#FBBF24" />
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

        {/* ── Logros Premium ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Logros Premium</Text>
          <View style={styles.logrosList}>
            {logros.map((l) => (
              <LogroCard key={l.id} logro={l} />
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
    </SafeAreaView>
    </Animated.View>
  );
}

function LogroCard({ logro }) {
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const progressPercent = Math.round((logro.progress / logro.total) * 100);
  const typeColors = {
    bronze: colors.bronze,
    silver: colors.silver,
    gold: colors.gold,
  };
  const tColor = typeColors[logro.type] ?? colors.primary;

  return (
    <View style={styles.logroCard}>
      <View style={[styles.logroIcon, { backgroundColor: `${tColor}22` }]}>
        <Ionicons name={logro.icon} size={22} color={tColor} />
      </View>
      <View style={styles.logroContent}>
        <Text style={styles.logroTitle}>{logro.title}</Text>
        <Text style={styles.logroDesc}>{logro.description}</Text>
        <View style={styles.logroProgressRow}>
          <View style={styles.logroTrack}>
            <View
              style={[
                styles.logroFill,
                { width: `${progressPercent}%`, backgroundColor: tColor },
              ]}
            />
          </View>
          <Text style={[styles.logroProgressText, { color: tColor }]}>
            {logro.progress}/{logro.total}
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
