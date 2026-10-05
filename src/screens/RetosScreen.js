import { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { fetchWeeklyStepHistory } from '../services/userService';
import { localDateString } from '../services/stepService';
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
import { useEspacioBarra } from '../navigation/PremiumTabBar';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../firebase';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS,
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
import { estadoLogro, completarLogro } from '../services/logrosService';
import { useGymEvents } from '../context/GymEventsContext';
import { LOGROS_DEF } from '../constants/logros';
import ComoSumarPuntos from '../components/ui/ComoSumarPuntos';

const { width } = Dimensions.get('window');

const INSPIRATION_IMG =
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80';

export default function RetosScreen({ navigation }) {
  // Espacio al final para que la barra flotante no tape lo último.
  const espacioBarra = useEspacioBarra();
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { steps: currentSteps, goal } = useStepContext();
  const { profile } = useUserProfile();
  const { user, isTester } = useAuth();
  useGymEvents(); // mantiene contexto activo
  const [logroPicker, setLogroPicker] = useState(false);

  // Reloj propio para que, pasados los 5 minutos en verde, el logro vuelva a
  // mostrarse desde cero sin tener que salir y entrar de la pantalla.
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  // Cobrarlos lo hace GymEventsContext (siempre montado); acá solo se muestran.
  const logros = useMemo(() => LOGROS_DEF.map((def) => {
    const { progreso, completado } = estadoLogro(def, profile, ahora);
    return { ...def, progress: progreso, isCompleted: completado };
  }), [profile, ahora]);
  // Hitos de días anteriores: 0 = hoy, -1 = ayer, … hasta 7 días atrás.
  const DIAS_ATRAS = 7;
  const [dia, setDia] = useState(0);
  const [historial, setHistorial] = useState({});
  useFocusEffect(useCallback(() => {
    if (!user?.uid) return;
    fetchWeeklyStepHistory(user.uid).then(setHistorial).catch(() => {});
  }, [user?.uid]));
  const fechaDia = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + dia);
    return d;
  }, [dia]);
  const pasosDia = dia === 0 ? currentSteps : (historial[localDateString(fechaDia)] ?? 0);
  const nombreDia = dia === 0 ? 'Hoy'
    : dia === -1 ? 'Ayer'
    : fechaDia.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '');

  // Dónde va cada hito en la barra (%): los tres primeros cerca entre sí y
  // el de 25K lejos, cada uno con su lugar (con la escala lineal 2K, 5K y
  // 7.4K quedaban amontonados y lejos de sus números). El relleno avanza por
  // tramos entre un hito y el siguiente, así pasa justo por cada circulito, y
  // cada número va centrado debajo del suyo.
  const POS_HITOS = [14, 27, 45, 100];
  const posHito = (i) => POS_HITOS[i] ?? ((i + 1) / stepMilestones.length) * 100;
  const progressPercent = (() => {
    let desde = 0;
    for (let i = 0; i < stepMilestones.length; i++) {
      const hasta = stepMilestones[i].steps;
      const inicio = i === 0 ? 0 : posHito(i - 1);
      if (pasosDia < hasta) return inicio + (Math.max(pasosDia - desde, 0) / (hasta - desde)) * (posHito(i) - inicio);
      desde = hasta;
    }
    return 100;
  })();
  const nextMilestone = stepMilestones.find((m) => m.steps > pasosDia);
  const hitosLogrados = stepMilestones.filter((m) => pasosDia >= m.steps).length;

  // Cambio de día animado: lo de ahora sale deslizándose hacia un costado y el
  // otro día entra desde el lado contrario (hacia atrás entra desde la
  // izquierda, como pasar páginas). La barra se llena hasta los pasos del día.
  const deslizSV = useSharedValue(0);
  const opacSV   = useSharedValue(1);
  const llenoSV  = useSharedValue(0);
  const diaRef   = useRef(0);
  const entradaRef = useRef(0);
  const cambiarDia = useCallback((delta) => {
    const nuevo = Math.max(-DIAS_ATRAS, Math.min(0, diaRef.current + delta));
    if (nuevo === diaRef.current) return;
    diaRef.current = nuevo;
    Haptics.selectionAsync().catch(() => {});
    const sale = delta < 0 ? 36 : -36;
    entradaRef.current = -sale;
    opacSV.value = withTiming(0, { duration: 130 });
    deslizSV.value = withTiming(sale, { duration: 130 }, (ok) => {
      if (ok) runOnJS(setDia)(nuevo);
    });
  }, []);
  useEffect(() => {
    if (!entradaRef.current) return;
    deslizSV.value = entradaRef.current;
    entradaRef.current = 0;
    deslizSV.value = withSpring(0, { damping: 18, stiffness: 220, mass: 0.8 });
    opacSV.value = withTiming(1, { duration: 200 });
  }, [dia]);
  useEffect(() => {
    llenoSV.value = withTiming(progressPercent, { duration: 550 });
  }, [progressPercent]);
  const diaStyle   = useAnimatedStyle(() => ({ opacity: opacSV.value, transform: [{ translateX: deslizSV.value }] }));
  const nombreStyle = useAnimatedStyle(() => ({ opacity: opacSV.value, transform: [{ translateX: deslizSV.value * 0.4 }] }));
  const llenoStyle = useAnimatedStyle(() => ({ width: `${llenoSV.value}%` }));

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
        contentContainerStyle={[styles.scroll, { paddingBottom: espacioBarra }]}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.logo}>New Life</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ComoSumarPuntos />
          <TouchableOpacity
            style={styles.rachaBtn}
            onPress={() => navigation.navigate('Inicio')}
          >
            <Ionicons name="flame" size={14} color={colors.streak} />
            <Text style={styles.rachaBtnText}>Ir a Racha</Text>
          </TouchableOpacity>
          </View>
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
          <View style={styles.hitosTitulo}>
            <Text style={styles.sectionTitle}>Hitos de Pasos</Text>
            {/* Ver los hitos de los días anteriores */}
            <View style={styles.hitosNav}>
              <TouchableOpacity
                onPress={() => cambiarDia(-1)}
                disabled={dia <= -DIAS_ATRAS}
                hitSlop={10}
                style={{ opacity: dia <= -DIAS_ATRAS ? 0.25 : 1 }}
              >
                <Ionicons name="chevron-back" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
              <Animated.Text style={[styles.hitosDia, { color: colors.textSecondary }, nombreStyle]}>{nombreDia}</Animated.Text>
              <TouchableOpacity
                onPress={() => cambiarDia(1)}
                disabled={dia >= 0}
                hitSlop={10}
                style={{ opacity: dia >= 0 ? 0.25 : 1 }}
              >
                <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>

          <Animated.View style={diaStyle}>
          {/* Barra de hitos */}
          <View style={styles.milestonesContainer}>
            <View style={styles.milestoneBar}>
              <View style={styles.milestoneTrack} />
              <Animated.View style={[styles.milestoneFill, llenoStyle]} />
              {stepMilestones.map((m, i) => {
                const pos = posHito(i);
                const reached = pasosDia >= m.steps;
                const isCurrent =
                  pasosDia >= m.steps &&
                  (!nextMilestone || m.steps < nextMilestone.steps ||
                    !stepMilestones.find((mm) => mm.steps > m.steps && pasosDia < mm.steps));
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
              {stepMilestones.map((m, i) => (
                <Text
                  key={m.steps}
                  style={[
                    styles.milestoneLabel,
                    { left: `${posHito(i)}%` },
                    pasosDia >= m.steps && styles.milestoneLabelReached,
                  ]}
                >
                  {m.label}
                </Text>
              ))}
            </View>
          </View>

          <View style={styles.stepsDisplay}>
            <Text style={styles.stepsCount}>
              {pasosDia.toLocaleString('es-AR')}
            </Text>
            <Text style={styles.stepsUnit}>{dia === 0 ? 'pasos hoy' : `pasos · ${nombreDia}`}</Text>
          </View>

          {/* "¡Casi llegás!" solo cuando de verdad falta poco. */}
          <Text style={styles.motivText}>
            {dia < 0 ? (
              hitosLogrados === 0
                ? 'Ese día no llegaste a ningún premio.'
                : hitosLogrados === stepMilestones.length
                  ? '¡Ese día ganaste todos los premios!'
                  : <>Ese día ganaste <Text style={{ color: colors.primary }}>{hitosLogrados} de {stepMilestones.length}</Text> premios.</>
            ) : nextMilestone ? (
              <>
                {nextMilestone.steps - pasosDia <= 1000 ? '¡Casi llegás! Te faltan ' : 'Te faltan '}
                <Text style={{ color: colors.primary }}>
                  {(nextMilestone.steps - pasosDia).toLocaleString('es-AR')} pasos
                </Text>
                {` para el premio de ${nextMilestone.label}`}
              </>
            ) : '¡Ganaste todos los premios de hoy!'}
          </Text>
          </Animated.View>
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
                      await updateDoc(doc(db, 'users', user.uid), { ...snap, sinAutoReparar: deleteField() });
                      await AsyncStorage.removeItem('tester_xp_snap'); // limpiar para la próxima sesión
                    } else {
                      await updateDoc(doc(db, 'users', user.uid), { nivelJuego: 1, xp: 0, xpTotal: 0, xpExtra: 0, gymVisitCount: 0, logros: {}, logrosCompletados: [], sinAutoReparar: true });
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
              {currentSteps >= goal
                ? '¡Ya cumpliste tu meta de hoy! Seguí sumando.'
                : `Seguí así, estás a ${(goal - currentSteps).toLocaleString('es-AR')} pasos de tu meta diaria.`}
            </Text>
          </LinearGradient>
        </ImageBackground>

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      {/* ── Picker tester: Forzar Logro ── */}
      <Modal visible={logroPicker} transparent animationType="fade" onRequestClose={() => setLogroPicker(false)} statusBarTranslucent navigationBarTranslucent>
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
                        xpExtra: profile.xpExtra ?? 0,
                        nivelJuego: profile.nivelJuego ?? 1,
                        gymVisitCount: profile.gymVisitCount ?? 0,
                        logros: profile.logros ?? {},
                      }));
                    }
                  }
                  await completarLogro(user.uid, l, { forzar: true });
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
  hitosTitulo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hitosNav:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hitosDia:    { fontSize: 12, fontWeight: '700', minWidth: 74, textAlign: 'center', textTransform: 'capitalize' },
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
  // Cada número centrado debajo de su hito (mismo margen que la barra).
  milestoneLabels: {
    height: 16,
    marginHorizontal: spacing.sm,
  },
  milestoneLabel: {
    position: 'absolute',
    width: 44,
    marginLeft: -22,
    textAlign: 'center',
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
