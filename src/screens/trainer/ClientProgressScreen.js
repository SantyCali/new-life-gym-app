import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { typography, spacing, radius } from '../../theme';
import {
  subscribeToGymWeights,
  subscribeToBodyWeightHistory,
} from '../../services/progressService';

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
    </SafeAreaView>
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