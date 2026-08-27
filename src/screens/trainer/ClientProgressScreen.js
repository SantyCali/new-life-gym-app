import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Modal,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
  Easing,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { typography, spacing, radius } from '../../theme';
import {
  subscribeToGymWeights,
  subscribeToBodyWeightHistory,
} from '../../services/progressService';
import { fetchWeeklyStepHistory } from '../../services/userService';
import { todayDateString, localDateString, calcCalories, computeAge } from '../../services/stepService';

const DAY_ABBR = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
// Polling: solo mientras el entrenador tiene esta pantalla abierta, para ESTE
// cliente únicamente. No es un listener permanente — es un getDocs puntual
// (vía fetchWeeklyStepHistory) repetido cada 30s y cancelado al salir/perder foco.
const STEPS_POLL_MS = 30_000;

export default function ClientProgressScreen({ route, navigation }) {
  const { cliente } = route.params;
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [gymWeights, setGymWeights]   = useState(null); // null = cargando
  const [pesoHistory, setPesoHistory] = useState(null);

  useEffect(() => {
    const unsub1 = subscribeToGymWeights(cliente.uid, (data) => setGymWeights(data));
    const unsub2 = subscribeToBodyWeightHistory(cliente.uid, (arr) => setPesoHistory(arr));
    return () => { unsub1(); unsub2(); };
  }, [cliente.uid]);

  // ── Pasos: reutiliza stepsHistory (mismo historial de 7 días que Home/Perfil,
  // vía fetchWeeklyStepHistory) — sin colección ni lógica nueva. Se consulta con
  // polling (getDocs puntual, no onSnapshot) solo mientras esta pantalla está
  // enfocada, y solo para cliente.uid — se corta al salir o cambiar de cliente.
  const [stepsMap, setStepsMap]         = useState({});
  const [stepsLoading, setStepsLoading] = useState(true);
  const [dayOffset, setDayOffset]       = useState(0); // 0=hoy, -1=ayer, …, -6

  useFocusEffect(useCallback(() => {
    if (!cliente?.uid) return;
    let cancelled = false;

    const load = () => {
      fetchWeeklyStepHistory(cliente.uid)
        .then(map => { if (!cancelled) { setStepsMap(map); setStepsLoading(false); } })
        .catch(() => { if (!cancelled) setStepsLoading(false); });
    };

    load();
    const interval = setInterval(load, STEPS_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [cliente?.uid]));

  const getOffsetDate = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d;
  };

  const isStepsHistory = dayOffset < 0;
  const selectedDate   = getOffsetDate(dayOffset);
  const selectedDateKey = dayOffset === 0 ? todayDateString() : localDateString(selectedDate);
  const selectedSteps  = stepsMap[selectedDateKey] ?? 0;

  const stepsDayLabel = dayOffset === 0 ? 'HOY'
    : dayOffset === -1 ? 'AYER'
    : DAY_ABBR[selectedDate.getDay()];
  const stepsDateLabel = dayOffset < 0
    ? selectedDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
    : null;

  // ── Detalle del día (kcal + tiempo caminando) ─────────────────────────────
  // Replica EXACTAMENTE el cálculo de "Quemadas"/"Caminado" de HomeScreen.js
  // (displayCalories / walkLabel) — misma función (calcCalories de stepService.js),
  // mismos parámetros, y la MISMA regla de gym: Home solo suma kcal de gym para
  // HOY (gymMinHoy siempre da 0 en isHistoryMode — Home no tiene historial de
  // gym), así que acá se replica ese mismo comportamiento, no uno "mejorado".
  // No hay storage propio de "minutos caminados" ni "kcal" — por eso no hace
  // falta ninguna consulta extra: se recalcula a partir de selectedSteps (mismo
  // polling de 30s) y del perfil de cliente que ya está en route.params
  // (peso/altura/sexo/fechaNacimiento/gymTodayDate/gymTodayMinutes).
  const [detailVisible, setDetailVisible] = useState(false);

  const clienteWeightKg = cliente?.peso   ? Number(cliente.peso)   : 70;
  const clienteHeightCm = cliente?.altura ? Number(cliente.altura) : 170;
  const clienteAgeYears = computeAge(cliente?.fechaNacimiento);

  // Gym: mismo campo y misma fórmula que gymMinHoy/displayCalories de Home, pero
  // solo aplica a HOY (dayOffset===0) — igual que Home, que jamás suma gym en
  // días anteriores. Diferencia honesta respecto a Home: Home además exige
  // !isAtGym (no contar una sesión todavía en curso); acá no tenemos esa
  // presencia en vivo del cliente sin agregar un listener nuevo, así que si el
  // cliente está actualmente en el gym con una sesión previa del mismo día ya
  // registrada, ese valor podría mostrarse un poco antes que en Home.
  const selectedGymMin = dayOffset === 0 && cliente?.gymTodayDate === todayDateString() && (cliente?.gymTodayMinutes ?? 0) > 0
    ? cliente.gymTodayMinutes
    : 0;

  const selectedCalories = calcCalories(
    selectedSteps, clienteWeightKg, clienteHeightCm, clienteAgeYears, cliente?.sexo
  ).active + (selectedGymMin > 0 ? Math.round(5.0 * clienteWeightKg * selectedGymMin / 60) : 0);

  const selectedWalkMin = Math.round(selectedSteps / 100);
  const selectedWalkH   = Math.floor(selectedWalkMin / 60);
  const selectedWalkM   = selectedWalkMin % 60;
  const selectedWalkLabel = selectedWalkH > 0 ? `${selectedWalkH}h ${selectedWalkM}m` : `${selectedWalkM}m`;

  // Swipe (mismo patrón que Home/Perfil: shared value sobre RNGH, sin tocar el ScrollView)
  const stepsTranslateX = useSharedValue(0);
  const dayOffsetShared  = useSharedValue(0);
  useEffect(() => { dayOffsetShared.value = dayOffset; }, [dayOffset]);

  const navigateStepsDay = useCallback((dir) => {
    const cur  = dayOffsetShared.value;
    const next = Math.max(-6, Math.min(0, cur + dir));
    if (next === cur) {
      stepsTranslateX.value = withSpring(0, { damping: 35, stiffness: 400 });
      return;
    }
    const exitSide = dir < 0 ? 150 : -150;
    stepsTranslateX.value = withTiming(exitSide, { duration: 150 }, () => {
      'worklet';
      runOnJS(setDayOffset)(next);
      stepsTranslateX.value = -exitSide;
      stepsTranslateX.value = withSpring(0, { damping: 35, stiffness: 400 });
    });
  }, [stepsTranslateX, dayOffsetShared]);

  const stepsCardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: stepsTranslateX.value }],
    opacity: interpolate(Math.abs(stepsTranslateX.value), [0, 100], [1, 0.25], Extrapolation.CLAMP),
  }));

  const stepsPanGesture = useMemo(() => Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-20, 20])
    .onUpdate((e) => {
      'worklet';
      let dx = e.translationX;
      if (dx > 0 && dayOffsetShared.value <= -6) dx *= 0.1;
      if (dx < 0 && dayOffsetShared.value >= 0)  dx *= 0.1;
      stepsTranslateX.value = dx * 0.7;
    })
    .onEnd((e) => {
      'worklet';
      const cur = dayOffsetShared.value;
      if      (e.translationX >  40 && cur > -6) runOnJS(navigateStepsDay)(-1);
      else if (e.translationX < -40 && cur <  0) runOnJS(navigateStepsDay)(1);
      else stepsTranslateX.value = withSpring(0, { damping: 35, stiffness: 400 });
    }),
  [navigateStepsDay, dayOffsetShared, stepsTranslateX]);

  const sortedPeso = useMemo(() => {
    if (!pesoHistory) return [];
    return [...pesoHistory].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }, [pesoHistory]);

  const gymList = useMemo(() => {
    if (!gymWeights) return [];
    return Object.entries(gymWeights)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }, [gymWeights]);

  const loading = gymWeights === null || pesoHistory === null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Progreso de {cliente.nombre}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Pasos (deslizable: mismo gesto de días que Home/Perfil; tocable: detalle) ── */}
          <Text style={styles.sectionLabel}>Pasos</Text>
          <GestureDetector gesture={stepsPanGesture}>
            <Animated.View style={stepsCardAnimStyle}>
              <TouchableOpacity
                activeOpacity={0.75}
                disabled={stepsLoading}
                onPress={() => setDetailVisible(true)}
                style={[styles.card, styles.stepsCard, isStepsHistory && styles.stepsCardHistory]}
              >
                {stepsLoading ? (
                  <View style={{ paddingVertical: 8 }}>
                    <ActivityIndicator color={colors.primary} />
                  </View>
                ) : (
                  <View style={styles.stepsRow}>
                    <Ionicons name="walk-outline" size={26} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stepsBig}>{selectedSteps.toLocaleString('es-AR')}</Text>
                      <Text style={styles.stepsSub}>
                        pasos · {stepsDayLabel}{stepsDateLabel ? ` · ${stepsDateLabel}` : ''}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          </GestureDetector>

          {/* ── Peso corporal ─────────────────────────────────────── */}
          <Text style={styles.sectionLabel}>Peso corporal</Text>
          <View style={styles.card}>
            {sortedPeso.length === 0 ? (
              <EmptyState
                icon="scale-outline"
                text="Sin registros de peso aún"
                sub="El cliente todavía no guardó su peso"
                colors={colors} styles={styles}
              />
            ) : (
              <>
                <WeightSummary records={sortedPeso} colors={colors} styles={styles} />
                <View style={styles.divider} />
                <Text style={styles.histLabel}>Historial</Text>
                {groupPesoByMonth(sortedPeso).map(({ label, entries }, idx) => (
                  <CollapsiblePesoMonth
                    key={label}
                    label={label}
                    entries={entries}
                    defaultExpanded={idx === 0}
                    colors={colors}
                    styles={styles}
                  />
                ))}
              </>
            )}
          </View>

          {/* ── Pesos en el gym ───────────────────────────────────── */}
          <Text style={styles.sectionLabel}>Pesos en el gym</Text>
          <View style={styles.card}>
            {gymList.length === 0 ? (
              <EmptyState
                icon="barbell-outline"
                text="Sin registros de gym aún"
                sub="Aparecerán cuando el cliente entrene"
                colors={colors} styles={styles}
              />
            ) : (
              gymList.map((ex, i) => (
                <GymRow key={ex.id} ex={ex} last={i === gymList.length - 1} colors={colors} styles={styles} />
              ))
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── Detalle del día seleccionado (pasos / kcal / tiempo caminando) ── */}
      <Modal visible={detailVisible} transparent animationType="fade" onRequestClose={() => setDetailVisible(false)}>
        <TouchableOpacity
          style={styles.detailOverlay}
          activeOpacity={1}
          onPress={() => setDetailVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.detailCard} onPress={() => {}}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>
                {stepsDayLabel === 'HOY' ? 'Hoy' : stepsDayLabel === 'AYER' ? 'Ayer' : stepsDayLabel}
                {stepsDateLabel ? ` · ${stepsDateLabel}` : ''}
              </Text>
              <TouchableOpacity onPress={() => setDetailVisible(false)} hitSlop={10}>
                <Ionicons name="close-circle" size={22} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <DetailRow icon="walk-outline"  label="Pasos"           value={selectedSteps.toLocaleString('es-AR')} colors={colors} styles={styles} />
            <DetailRow icon="flame-outline" label="Kcal quemadas"   value={`${selectedCalories} kcal`}            colors={colors} styles={styles} />
            <DetailRow icon="time-outline"  label="Tiempo caminando" value={selectedWalkLabel}                    colors={colors} styles={styles} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function DetailRow({ icon, label, value, colors, styles }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailRowLeft}>
        <Ionicons name={icon} size={18} color={colors.primary} />
        <Text style={styles.detailRowLabel}>{label}</Text>
      </View>
      <Text style={styles.detailRowValue}>{value}</Text>
    </View>
  );
}

// ── Collapsible month group ───────────────────────────────────────────────────
function CollapsiblePesoMonth({ label, entries, defaultExpanded, colors, styles }) {
  const [expanded, setExpanded]  = useState(defaultExpanded);
  const heightRef   = useRef(defaultExpanded ? 1000 : 0);
  const heightAnim  = useSharedValue(defaultExpanded ? 1000 : 0);
  const opacityAnim = useSharedValue(defaultExpanded ? 1 : 0);
  const chevronAnim = useSharedValue(defaultExpanded ? 1 : 0);

  const onContentLayout = useCallback((e) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) {
      heightRef.current = h;
      if (expanded) heightAnim.value = h;
    }
  }, [expanded]);

  const toggle = useCallback(() => {
    const next = !expanded;
    setExpanded(next);
    heightAnim.value  = withTiming(next ? heightRef.current : 0,  { duration: 300, easing: Easing.bezier(0.4, 0, 0.2, 1) });
    opacityAnim.value = withTiming(next ? 1 : 0, { duration: 240 });
    chevronAnim.value = withTiming(next ? 1 : 0, { duration: 280, easing: Easing.out(Easing.ease) });
  }, [expanded]);

  const containerStyle = useAnimatedStyle(() => ({
    height: heightAnim.value,
    opacity: opacityAnim.value,
    overflow: 'hidden',
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronAnim.value * 180}deg` }],
  }));

  return (
    <View>
      <TouchableOpacity onPress={toggle} activeOpacity={0.7}
        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
      >
        <Text style={[styles.monthLabel, { flex: 1, marginTop: 0, marginBottom: 0 }]}>{label}</Text>
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-down" size={14} color={colors.textTertiary} />
        </Animated.View>
      </TouchableOpacity>

      <Animated.View style={containerStyle}>
        <View onLayout={onContentLayout}>
          {entries.map((r, i) => (
            <View key={i} style={styles.histRow}>
              <Text style={styles.histPeso}>{r.peso} kg</Text>
              <Text style={styles.histFecha}>{fmtDate(r.fecha)}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

// ── Weight summary card (current + trend) ─────────────────────────────────────
function WeightSummary({ records, colors, styles }) {
  const current  = records[0];
  const previous = records[1] ?? null;
  const delta    = previous ? (current.peso - previous.peso) : null;

  const { icon, iconColor, label } = weightTrend(delta, colors);

  return (
    <View style={styles.weightSummaryRow}>
      <View>
        <Text style={styles.weightBig}>{current.peso} kg</Text>
        <Text style={styles.weightSub}>último registro · {fmtDate(current.fecha)}</Text>
      </View>
      <View style={styles.trendBadge}>
        <Ionicons name={icon} size={18} color={iconColor} />
        <Text style={[styles.trendLabel, { color: iconColor }]}>{label}</Text>
      </View>
    </View>
  );
}

// ── Gym exercise row ──────────────────────────────────────────────────────────
function GymRow({ ex, last, colors, styles }) {
  const delta = ex.anterior != null ? (ex.peso - ex.anterior) : null;
  const { icon, iconColor, label } = gymTrend(delta, ex.anterior, colors);

  return (
    <View style={[styles.gymRow, !last && styles.gymRowBorder]}>
      <View style={styles.gymLeft}>
        <Text style={styles.gymName} numberOfLines={1}>{ex.nombre}</Text>
        <Text style={styles.gymFecha}>{fmtDate(ex.fecha)}</Text>
      </View>
      <View style={styles.gymRight}>
        <Text style={styles.gymPeso}>{ex.peso} kg</Text>
        <View style={styles.gymTrend}>
          <Ionicons name={icon} size={13} color={iconColor} />
          <Text style={[styles.gymTrendText, { color: iconColor }]}>{label}</Text>
        </View>
      </View>
    </View>
  );
}

function EmptyState({ icon, text, sub, colors, styles }) {
  return (
    <View style={styles.emptyWrap}>
      <Ionicons name={icon} size={32} color={colors.textTertiary} />
      <Text style={styles.emptyText}>{text}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function weightTrend(delta, colors) {
  if (delta == null)   return { icon: 'remove-outline',        iconColor: colors.textSecondary, label: 'primer registro' };
  if (delta < -0.4)    return { icon: 'trending-down-outline', iconColor: '#22c55e',            label: `${Math.abs(delta).toFixed(1)} kg menos` };
  if (delta > 0.4)     return { icon: 'trending-up-outline',   iconColor: '#ef4444',            label: `${delta.toFixed(1)} kg más` };
  return               { icon: 'remove-outline',               iconColor: colors.textSecondary, label: 'sin cambios' };
}

function gymTrend(delta, anterior, colors) {
  if (anterior == null) return { icon: 'remove-outline',        iconColor: colors.textSecondary, label: 'primer dato' };
  if (delta > 0)        return { icon: 'trending-up-outline',   iconColor: '#22c55e',            label: `+${delta.toFixed(1)} kg` };
  if (delta < 0)        return { icon: 'trending-down-outline', iconColor: '#ef4444',            label: `${delta.toFixed(1)} kg` };
  return                { icon: 'remove-outline',               iconColor: colors.textSecondary, label: 'igual que antes' };
}

const MONTH_FULL_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function groupPesoByMonth(sortedDesc) {
  const groups = [];
  const map = {};
  for (const r of sortedDesc) {
    if (!r.fecha) continue;
    const d = new Date(r.fecha);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    const key = `${y}-${String(m).padStart(2,'0')}`;
    if (!map[key]) {
      map[key] = { label: `${MONTH_FULL_ES[m-1]} ${y}`, entries: [] };
      groups.push(map[key]);
    }
    map[key].entries.push(r);
  }
  return groups;
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────
function makeStyles(colors) {
  return StyleSheet.create({
    container:   { flex: 1, backgroundColor: colors.background },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingVertical: 12,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.surfaceContainerHigh,
      alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: {
      flex: 1, textAlign: 'center',
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.black,
      color: colors.text, letterSpacing: -0.3,
      marginHorizontal: 8,
    },

    scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },

    sectionLabel: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
      color: colors.textTertiary,
      letterSpacing: 1.4, textTransform: 'uppercase',
      marginBottom: spacing.sm, marginTop: spacing.lg,
    },
    card: {
      backgroundColor: colors.surfaceContainer,
      borderRadius: radius['2xl'],
      borderWidth: 1, borderColor: colors.borderLight,
      padding: spacing.lg,
    },
    divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: spacing.md },

    // Pasos
    stepsCard: { marginBottom: 0 },
    // Mismo tratamiento que el "highlighted" de Home/Perfil al navegar un día anterior.
    stepsCardHistory: {
      borderColor: colors.primary,
      borderWidth: 1.5,
      shadowColor: colors.primary,
      shadowOpacity: 0.35,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 0 },
      elevation: 4,
    },
    stepsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    stepsBig: {
      fontSize: 28, fontWeight: typography.weights.black,
      color: colors.text, letterSpacing: -0.5,
    },
    stepsSub: { fontSize: typography.sizes.xs, color: colors.textTertiary, marginTop: 2 },

    // Detalle del día (modal)
    detailOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing['2xl'],
    },
    detailCard: {
      width: '100%',
      backgroundColor: colors.surfaceContainer,
      borderRadius: radius['2xl'],
      borderWidth: 1, borderColor: colors.borderLight,
      padding: spacing.lg,
    },
    detailHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: spacing.md,
    },
    detailTitle: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.black,
      color: colors.text,
    },
    detailRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 10,
      borderTopWidth: 1, borderTopColor: colors.borderLight,
    },
    detailRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    detailRowLabel: { fontSize: typography.sizes.sm, color: colors.textSecondary },
    detailRowValue: { fontSize: typography.sizes.base, fontWeight: typography.weights.bold, color: colors.text },

    // Weight summary
    weightSummaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    weightBig: {
      fontSize: 36, fontWeight: typography.weights.black,
      color: colors.text, letterSpacing: -1,
    },
    weightSub: { fontSize: typography.sizes.xs, color: colors.textTertiary, marginTop: 2 },
    trendBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: colors.surfaceContainerHigh,
      paddingHorizontal: 12, paddingVertical: 8,
      borderRadius: radius.full,
    },
    trendLabel: { fontSize: typography.sizes.sm, fontWeight: typography.weights.bold },

    // Peso history
    histLabel: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
      color: colors.textTertiary,
      letterSpacing: 1, textTransform: 'uppercase',
      marginBottom: spacing.sm,
    },
    monthLabel: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
      color: colors.textTertiary,
      letterSpacing: 1.2, textTransform: 'uppercase',
      marginTop: spacing.md, marginBottom: 2,
    },
    histRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 7,
    },
    histPeso:  { fontSize: typography.sizes.base, fontWeight: typography.weights.bold, color: colors.text },
    histFecha: { fontSize: typography.sizes.sm, color: colors.textSecondary },

    // Gym rows
    gymRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
    gymRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
    gymLeft:  { flex: 1, marginRight: 12 },
    gymName:  { fontSize: typography.sizes.base, fontWeight: typography.weights.bold, color: colors.text },
    gymFecha: { fontSize: typography.sizes.xs, color: colors.textTertiary, marginTop: 2 },
    gymRight: { alignItems: 'flex-end' },
    gymPeso:  { fontSize: typography.sizes.lg, fontWeight: typography.weights.black, color: colors.text },
    gymTrend: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
    gymTrendText: { fontSize: typography.sizes.xs, fontWeight: typography.weights.bold },

    // Empty state
    emptyWrap: { alignItems: 'center', paddingVertical: 28, gap: 8 },
    emptyText: { fontSize: typography.sizes.base, fontWeight: typography.weights.bold, color: colors.textSecondary },
    emptySub:  { fontSize: typography.sizes.sm, color: colors.textTertiary, textAlign: 'center' },
  });
}