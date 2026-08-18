import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, ScrollView,
  Modal, Platform, TextInput, RefreshControl, Keyboard,
  Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { typography, spacing, radius } from '../theme';
import useAuth from '../hooks/useAuth';
import useGymCheckins from '../hooks/useGymCheckins';
import { addCheckin, removeCheckin, getTodayHistory, getSociosQuotaStatus, getCheckinAnalytics, getAllSocios, updateSocio, addSocio, deleteSocio } from '../services/gymService';
import DateTimePicker from '@react-native-community/datetimepicker';

const PEAK_HOURS   = [6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22];
const DAY_LABELS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const BAR_MAX_H    = 90; // px — altura máxima de la barra

function MiniBarChart({ values, labels, peakIndex, selectedIndex, onBarPress, colors, styles }) {
  const max = Math.max(...values, 1);
  return (
    <View style={[styles.analyticsChart, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
      {values.map((val, i) => {
        const barH      = Math.round((val / max) * BAR_MAX_H);
        const isSelected = selectedIndex === i;
        const isPeak    = i === peakIndex && val > 0 && selectedIndex === undefined;
        const highlight  = isSelected || isPeak;
        return (
          <TouchableOpacity
            key={i}
            style={styles.analyticsBarCol}
            onPress={() => onBarPress?.(i)}
            activeOpacity={onBarPress ? 0.65 : 1}
            disabled={!onBarPress}
          >
            <Text style={[styles.analyticsBarVal, { color: highlight ? colors.primary : colors.textTertiary }]}>
              {val > 0 ? val : ''}
            </Text>
            <View style={[styles.analyticsBarTrack, { backgroundColor: colors.surfaceActive, height: BAR_MAX_H }]}>
              <View style={[
                styles.analyticsBarFill,
                { height: Math.max(barH, val > 0 ? 3 : 0), backgroundColor: highlight ? colors.primary : colors.primary + '55' },
              ]} />
            </View>
            <Text style={[
              styles.analyticsBarLabel,
              { color: highlight ? colors.primary : colors.textTertiary, fontWeight: isSelected ? '700' : '400' },
            ]}>
              {labels[i]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function AnalyticsChart({ data, colors, styles }) {
  const { byHour, byDay, byDayHour } = data;
  const [selectedDay, setSelectedDay] = useState(null);

  // Resetear selección cuando cambian los datos (cambio de período)
  useEffect(() => { setSelectedDay(null); }, [data]);

  const activeHours = selectedDay !== null ? (byDayHour?.[selectedDay] ?? byHour) : byHour;

  const peakHour = activeHours.indexOf(Math.max(...activeHours));
  const peakDay  = byDay.indexOf(Math.max(...byDay));
  const total    = selectedDay !== null
    ? byDay[selectedDay]
    : byHour.reduce((a, b) => a + b, 0);

  const hourValues  = PEAK_HOURS.map(h => activeHours[h] ?? 0);
  const hourLabels  = PEAK_HOURS.map(h => h < 12 ? `${h}am` : h === 12 ? '12p' : `${h-12}pm`);
  const peakHourIdx = PEAK_HOURS.indexOf(peakHour);

  const handleDayPress = useCallback((i) => {
    setSelectedDay(prev => prev === i ? null : i);
  }, []);

  const dayLabel = selectedDay !== null ? DAY_LABELS[selectedDay] : DAY_LABELS[peakDay];
  const dayCardLabel = selectedDay !== null ? 'Día elegido' : 'Día pico';
  const hourTitle = selectedDay !== null
    ? `Pico de horarios · ${DAY_LABELS[selectedDay]}`
    : 'Pico de horarios';

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing['3xl'] }} showsVerticalScrollIndicator={false}>

      {/* ── Resumen ── */}
      <View style={[styles.analyticsSummary, { marginBottom: spacing.xl }]}>
        {[
          { label: 'Hora pico',   value: `${peakHour}:00 hs`, icon: 'time-outline'     },
          { label: dayCardLabel,  value: dayLabel,             icon: 'calendar-outline' },
          { label: 'Total',       value: String(total),        icon: 'people-outline'   },
        ].map(card => (
          <View key={card.label} style={[styles.analyticsSummaryCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Ionicons name={card.icon} size={20} color={colors.primary} />
            <Text style={[styles.analyticsSummaryVal, { color: colors.text }]}>{card.value}</Text>
            <Text style={[styles.analyticsSummaryLabel, { color: colors.textTertiary }]}>{card.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Horarios ── */}
      <Text style={[styles.analyticsSectionTitle, { color: colors.text }]}>{hourTitle}</Text>
      <MiniBarChart
        values={hourValues}
        labels={hourLabels}
        peakIndex={peakHourIdx}
        colors={colors} styles={styles}
      />

      {/* ── Días de la semana ── */}
      <Text style={[styles.analyticsSectionTitle, { color: colors.text }]}>Días con más gente</Text>
      <MiniBarChart
        values={byDay}
        labels={DAY_LABELS}
        peakIndex={peakDay}
        selectedIndex={selectedDay}
        onBarPress={handleDayPress}
        colors={colors} styles={styles}
      />

    </ScrollView>
  );
}

const QUOTA_SECTIONS = [
  { key: 'vencido', label: 'Tienen que pagar',           color: '#EF4444', icon: 'alert-circle-outline'   },
  { key: 'proximo', label: 'Se acerca el vencimiento',   color: '#EAB308', icon: 'time-outline'           },
  { key: 'aldia',   label: 'Al día',                     color: '#22C55E', icon: 'checkmark-circle-outline'},
];

function formatVencimiento(vencMs) {
  if (!vencMs) return null;
  const d = new Date(vencMs);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function SectionContent({ members, section, colors, styles, spacing, onMemberPress }) {
  return members.length === 0 ? (
    <Text style={[styles.checkinTime, { color: colors.textTertiary, marginTop: spacing.sm }]}>
      Sin socios en esta categoría.
    </Text>
  ) : (
    <>
      {members.map(m => (
        <TouchableOpacity
          key={m.id}
          activeOpacity={0.7}
          onPress={() => onMemberPress?.(m)}
          style={[styles.checkinRow, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, marginTop: spacing.sm }]}
        >
          <View style={[styles.checkinAvatar, { backgroundColor: section.color + '18' }]}>
            <Ionicons name="person-outline" size={18} color={section.color} />
          </View>
          <View style={styles.checkinInfo}>
            <Text style={[styles.checkinName, { color: colors.text }]}>
              {m.nombre}{m.dni ? ` · DNI ${m.dni}` : ''}
            </Text>
            <Text style={[styles.checkinTime, { color: colors.textTertiary }]}>
              {m.vencMs ? `Vence: ${formatVencimiento(m.vencMs)}` : 'Sin fecha de vencimiento'}
            </Text>
          </View>
          <Ionicons name="pencil-outline" size={14} color={colors.textTertiary} />
        </TouchableOpacity>
      ))}
    </>
  );
}

function CollapsibleSection({ section, members, colors, styles, spacing, autoOpen, onMemberPress }) {
  const isOpen = useRef(false);

  const animMaxH    = useSharedValue(0);
  const animOpacity = useSharedValue(0);
  const animChevron = useSharedValue(0);

  const targetH = members.length === 0 ? 60 : members.length * 85 + 20;

  const containerStyle = useAnimatedStyle(() => ({
    maxHeight: animMaxH.value,
    overflow:  'hidden',
  }));
  const innerStyle   = useAnimatedStyle(() => ({ opacity: animOpacity.value }));
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${animChevron.value}deg` }],
  }));

  const open  = useCallback(() => {
    isOpen.current    = true;
    animMaxH.value    = withSpring(targetH, { damping: 26, stiffness: 260, mass: 0.85 });
    animChevron.value = withSpring(90,       { damping: 18, stiffness: 240 });
    animOpacity.value = withTiming(1,        { duration: 220 });
  }, [animMaxH, animChevron, animOpacity, targetH]);

  const close = useCallback(() => {
    isOpen.current    = false;
    animMaxH.value    = withSpring(0, { damping: 26, stiffness: 260, mass: 0.85 });
    animChevron.value = withSpring(0, { damping: 18, stiffness: 240 });
    animOpacity.value = withTiming(0, { duration: 160 });
  }, [animMaxH, animChevron, animOpacity]);

  const toggle = useCallback(() => {
    isOpen.current ? close() : open();
  }, [open, close]);

  // Auto-abrir cuando hay búsqueda con resultados; auto-cerrar cuando se borra.
  // Siempre llama open() cuando autoOpen es true para actualizar la altura
  // si members.length cambió mientras la sección ya estaba abierta.
  useEffect(() => {
    if (autoOpen) open();
    else if (isOpen.current) close();
  }, [autoOpen, open, close]);

  return (
    <View style={{ marginBottom: spacing.xl }}>
      <TouchableOpacity
        style={[styles.quotaSectionHeader, { borderColor: section.color + '40' }]}
        onPress={toggle}
        activeOpacity={0.72}
      >
        <Ionicons name={section.icon} size={16} color={section.color} />
        <Text style={[styles.quotaSectionLabel, { color: section.color }]}>{section.label}</Text>
        <View style={[styles.quotaBadge, { backgroundColor: section.color + '22' }]}>
          <Text style={[styles.quotaBadgeText, { color: section.color }]}>{members.length}</Text>
        </View>
        <Animated.View style={[{ marginLeft: 4, opacity: 0.65 }, chevronStyle]}>
          <Ionicons name="chevron-forward" size={16} color={section.color} />
        </Animated.View>
      </TouchableOpacity>

      <Animated.View style={containerStyle}>
        <Animated.View style={innerStyle}>
          <SectionContent members={members} section={section} colors={colors} styles={styles} spacing={spacing} onMemberPress={onMemberPress} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function QuotaSections({ data, search, colors, styles, spacing, refreshing, onRefresh }) {
  const q = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    // Sin búsqueda: orden alfabético por nombre
    if (!q) {
      return [...data].sort((a, b) =>
        (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es', { sensitivity: 'base' })
      );
    }
    // Con búsqueda: filtrar y ordenar por relevancia
    const matches = data.filter(s =>
      s.nombre?.toLowerCase().includes(q) || s.dni?.includes(q)
    );
    return matches.sort((a, b) => {
      const na = (a.nombre ?? '').toLowerCase();
      const nb = (b.nombre ?? '').toLowerCase();
      // Prioridad: alguna palabra del nombre empieza con el término buscado
      const scoreA = na.split(' ').some(w => w.startsWith(q)) ? 0 : 1;
      const scoreB = nb.split(' ').some(w => w.startsWith(q)) ? 0 : 1;
      if (scoreA !== scoreB) return scoreA - scoreB;
      return na.localeCompare(nb, 'es', { sensitivity: 'base' });
    });
  }, [data, q]);

  const hasSearch = q.length > 0;

  // ── Estado de edición ──────────────────────────────────────────────────────
  const [editSocio,    setEditSocio]    = useState(null);
  const [editNombre,   setEditNombre]   = useState('');
  const [editDni,      setEditDni]      = useState('');
  const [editFecha,    setEditFecha]    = useState(null);   // Date | null
  const [editSaving,   setEditSaving]   = useState(false);
  const [showPicker,   setShowPicker]   = useState(false);

  const openEdit = useCallback((member) => {
    setEditSocio(member);
    setEditNombre(member.nombre ?? '');
    setEditDni(member.dni ?? '');
    setEditFecha(member.vencMs ? new Date(member.vencMs) : null);
    setShowPicker(false);
  }, []);

  const closeEdit = useCallback(() => {
    setEditSocio(null);
    setShowPicker(false);
  }, []);

  const handleDelete = useCallback(() => {
    if (!editSocio) return;
    Alert.alert(
      'Eliminar socio',
      `¿Eliminás a ${editSocio.nombre}? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSocio(editSocio.id);
              setEditSocio(null);
              onRefresh?.();
            } catch {
              Alert.alert('Error', 'No se pudo eliminar el socio.');
            }
          },
        },
      ]
    );
  }, [editSocio, onRefresh]);

  const saveEdit = useCallback(async () => {
    if (!editSocio || editSaving) return;
    setEditSaving(true);
    try {
      await updateSocio(editSocio.id, {
        nombre:           editNombre,
        dni:              editDni,
        fechaVencimiento: editFecha,
      });
      setEditSocio(null);
      onRefresh?.();
    } catch {
      Alert.alert('Error', 'No se pudo guardar los cambios.');
    } finally {
      setEditSaving(false);
    }
  }, [editSocio, editNombre, editDni, editFecha, editSaving, onRefresh]);

  const fechaLabel = editFecha
    ? editFecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : 'Sin fecha';

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing['3xl'] }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {QUOTA_SECTIONS.map(section => {
          const members = filtered.filter(m => m.category === section.key);
          return (
            <CollapsibleSection
              key={section.key}
              section={section}
              members={members}
              autoOpen={hasSearch && members.length > 0}
              onMemberPress={openEdit}
              colors={colors}
              styles={styles}
              spacing={spacing}
            />
          );
        })}
      </ScrollView>

      {/* ── Modal edición de socio ─────────────────────────────────────────── */}
      <Modal visible={!!editSocio} transparent animationType="fade" onRequestClose={closeEdit}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: '#00000060', justifyContent: 'center', alignItems: 'center' }}
          activeOpacity={1}
          onPress={closeEdit}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={Keyboard.dismiss}
            style={{
              width: '88%',
              backgroundColor: colors.surface,
              borderRadius: radius.xl,
              padding: spacing.xl,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}>
              <Text style={[styles.modalTitle, { color: colors.text, flex: 1 }]}>Editar socio</Text>
              <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>

            {/* Nombre */}
            <Text style={[styles.checkinTime, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
              Nombre completo
            </Text>
            <TextInput
              style={{
                color: colors.text,
                backgroundColor: colors.surfaceElevated,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                marginBottom: spacing.md,
                fontSize: 16,
                minHeight: 46,
              }}
              value={editNombre}
              onChangeText={setEditNombre}
              placeholder="Nombre y apellido"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="words"
            />

            {/* DNI */}
            <Text style={[styles.checkinTime, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
              DNI
            </Text>
            <TextInput
              style={{
                color: colors.text,
                backgroundColor: colors.surfaceElevated,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                marginBottom: spacing.md,
                fontSize: 16,
                minHeight: 46,
              }}
              value={editDni}
              onChangeText={setEditDni}
              placeholder="Número de DNI"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />

            {/* Fecha de vencimiento */}
            <Text style={[styles.checkinTime, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
              Vencimiento de cuota
            </Text>
            <TouchableOpacity
              onPress={() => setShowPicker(v => !v)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.surfaceElevated,
                borderWidth: 1,
                borderColor: showPicker ? colors.primary : colors.border,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                marginBottom: spacing.sm,
              }}
            >
              <Ionicons name="calendar-outline" size={16} color={colors.primary} style={{ marginRight: spacing.sm }} />
              <Text style={{ color: editFecha ? colors.text : colors.textTertiary, fontSize: 15, flex: 1 }}>
                {fechaLabel}
              </Text>
              <Ionicons name="chevron-down" size={14} color={colors.textTertiary} />
            </TouchableOpacity>

            {showPicker && (
              <DateTimePicker
                value={editFecha ?? new Date()}
                mode="date"
                display="spinner"
                onChange={(event, date) => {
                  if (Platform.OS === 'android') {
                    setShowPicker(false);
                    if (event.type === 'set' && date) setEditFecha(date);
                  } else {
                    if (date) setEditFecha(date);
                  }
                }}
                locale="es-ES"
                style={{ height: 130, marginBottom: spacing.sm }}
              />
            )}

            {/* Botones */}
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <TouchableOpacity
                onPress={closeEdit}
                style={{
                  flex: 1, alignItems: 'center',
                  paddingVertical: spacing.md,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={saveEdit}
                disabled={editSaving}
                style={{
                  flex: 1, alignItems: 'center',
                  paddingVertical: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: colors.primary,
                  opacity: editSaving ? 0.6 : 1,
                }}
              >
                {editSaving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ color: '#fff', fontWeight: '700' }}>Guardar</Text>
                }
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function statusFor(count) {
  if (count === 0)  return { label: 'Vacío',      color: '#6B7280', emoji: '😴' };
  if (count <= 5)   return { label: 'Tranquilo',  color: '#22C55E', emoji: '🟢' };
  if (count <= 15)  return { label: 'Moderado',   color: '#EAB308', emoji: '🟡' };
  return              { label: 'Concurrido', color: '#EF4444', emoji: '🔴' };
}

function minutesAgo(timestamp) {
  if (!timestamp?.toMillis) return '';
  const diff = Math.floor((Date.now() - timestamp.toMillis()) / 60_000);
  if (diff < 1)  return 'hace un momento';
  if (diff === 1) return 'hace 1 min';
  return `hace ${diff} min`;
}

export default function GymScreen({ navigation }) {
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { isTrainer } = useAuth();
  const { active, activeCount, loading } = useGymCheckins();

  const [pickerVisible, setPickerVisible]     = useState(false);
  const [sociosList, setSociosList]           = useState([]);
  const [sociosLoading, setSociosLoading]     = useState(false);
  const [sociosSearch, setSociosSearch]       = useState('');
  const [historyVisible, setHistoryVisible]   = useState(false);
  const [history, setHistory]                 = useState([]);
  const [historyLoading, setHistoryLoading]   = useState(false);
  const [historySearch, setHistorySearch]     = useState('');
  const [quotaVisible, setQuotaVisible]       = useState(false);
  const [quotaData, setQuotaData]             = useState([]);
  const [quotaLoading, setQuotaLoading]       = useState(false);
  const [quotaRefreshing, setQuotaRefreshing] = useState(false);
  const [quotaSearch, setQuotaSearch]         = useState('');

  const [newSocioVisible, setNewSocioVisible]       = useState(false);
  const [newNombre, setNewNombre]                   = useState('');
  const [newDni, setNewDni]                         = useState('');
  const [newFecha, setNewFecha]                     = useState(null);
  const [newShowPicker, setNewShowPicker]           = useState(false);
  const [newSaving, setNewSaving]                   = useState(false);

  const openNewSocio = useCallback(() => {
    setNewNombre('');
    setNewDni('');
    setNewFecha(null);
    setNewShowPicker(false);
    setNewSocioVisible(true);
  }, []);

  const saveNewSocio = useCallback(async () => {
    if (!newNombre.trim()) { Alert.alert('Falta el nombre', 'Ingresá el nombre completo del socio.'); return; }
    if (!newDni.trim())    { Alert.alert('Falta el DNI',   'Ingresá el DNI del socio.');              return; }
    setNewSaving(true);
    try {
      await addSocio({ nombre: newNombre, dni: newDni, fechaVencimiento: newFecha });
      setNewSocioVisible(false);
      loadQuotaData();
    } catch (err) {
      Alert.alert('Error', err?.message ?? 'No se pudo agregar el socio.');
    } finally {
      setNewSaving(false);
    }
  }, [newNombre, newDni, newFecha, loadQuotaData]);

  const [analyticsVisible, setAnalyticsVisible]   = useState(false);
  const [analyticsData, setAnalyticsData]         = useState({ byHour: Array(24).fill(0), byDay: Array(7).fill(0), byDayHour: Array(7).fill(null).map(() => Array(24).fill(0)) });
  const [analyticsRange, setAnalyticsRange]       = useState(7);
  const [analyticsLoading, setAnalyticsLoading]   = useState(false);

  const openAnalytics = useCallback(async (days = 7) => {
    setAnalyticsRange(days);
    setAnalyticsVisible(true);
    setAnalyticsLoading(true);
    try {
      const data = await getCheckinAnalytics(days);
      setAnalyticsData(data);
    } catch {
      Alert.alert('Error', 'No se pudo cargar el análisis.');
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  const loadQuotaData = useCallback(async ({ isRefresh = false } = {}) => {
    if (isRefresh) setQuotaRefreshing(true);
    else setQuotaLoading(true);
    try {
      const rows = await getSociosQuotaStatus();
      console.log('[Cuotas] socios cargados:', rows.length);
      setQuotaData(rows);
    } catch (err) {
      console.error('[Cuotas] Error Firestore:', err?.code, err?.message);
      Alert.alert('Error al cargar cuotas', err?.message ?? 'Error desconocido');
    } finally {
      if (isRefresh) setQuotaRefreshing(false);
      else setQuotaLoading(false);
    }
  }, []);

  const openQuota = useCallback(() => {
    setQuotaSearch('');
    setQuotaVisible(true);
    loadQuotaData();
  }, [loadQuotaData]);

  const handleQuotaRefresh = useCallback(() => {
    loadQuotaData({ isRefresh: true });
  }, [loadQuotaData]);

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return history;
    return history.filter(item =>
      item.nombre?.toLowerCase().includes(q) || item.dni?.includes(q)
    );
  }, [history, historySearch]);

  const filteredSocios = useMemo(() => {
    const q = sociosSearch.trim().toLowerCase();
    if (!q) return sociosList;
    return sociosList.filter(s =>
      s.nombre?.toLowerCase().includes(q) || s.dni?.includes(q)
    );
  }, [sociosList, sociosSearch]);

  const openHistory = useCallback(async () => {
    setHistorySearch('');
    setHistoryVisible(true);
    setHistoryLoading(true);
    try {
      const rows = await getTodayHistory();
      setHistory(rows);
    } catch {
      Alert.alert('Error', 'No se pudo cargar el historial.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // Fade-in for 120Hz
  const screenOpacity = useSharedValue(0);
  const screenStyle   = useAnimatedStyle(() => ({ flex: 1, opacity: screenOpacity.value }));
  useEffect(() => { screenOpacity.value = withTiming(1, { duration: 120 }); }, []);

  // Animated count bubble scale bump when count changes
  const countScale = useSharedValue(1);
  const countStyle = useAnimatedStyle(() => ({ transform: [{ scale: countScale.value }] }));
  useEffect(() => {
    countScale.value = withSpring(1.12, { damping: 6, stiffness: 280 }, () => {
      countScale.value = withSpring(1, { damping: 12, stiffness: 200 });
    });
  }, [activeCount]);

  const status = statusFor(activeCount);

  const openPicker = useCallback(async () => {
    setSociosSearch('');
    setPickerVisible(true);
    setSociosLoading(true);
    try {
      const rows = await getAllSocios();
      console.log('[Picker] socios cargados:', rows.length);
      setSociosList(rows);
    } catch (err) {
      console.error('[Picker] Error Firestore:', err?.code, err?.message);
      Alert.alert('Error al cargar socios', err?.message ?? 'Error desconocido');
    } finally {
      setSociosLoading(false);
    }
  }, []);

  const handleSelectSocio = useCallback(async (socio) => {
    setPickerVisible(false);
    try {
      await addCheckin(socio.nombre, socio.dni);
      Alert.alert('¡Bienvenido!', `Hola, ${socio.nombre} 👋`);
    } catch (e) {
      if (e.code === 'ALREADY_ACTIVE') {
        Alert.alert('Ya está en el gym', e.message);
      } else {
        Alert.alert('Error', 'No se pudo registrar la entrada.');
      }
    }
  }, []);

  const handleRemove = useCallback((checkin) => {
    Alert.alert(
      'Retirar del gym',
      `¿Retirás a ${checkin.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Retirar',
          style: 'destructive',
          onPress: async () => {
            try { await removeCheckin(checkin.id); }
            catch { Alert.alert('Error', 'No se pudo eliminar la entrada.'); }
          },
        },
      ]
    );
  }, []);

  return (
    <Animated.View style={screenStyle}>
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>En el Gym</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={isTrainer ? active : []}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        ListHeaderComponent={
          <View style={styles.hero}>
            {/* Count bubble */}
            <Animated.View style={[styles.countBubble, { borderColor: status.color + '40', shadowColor: status.color }, countStyle]}>
              <View style={[styles.countBubbleInner, { backgroundColor: status.color + '14' }]}>
                {loading ? (
                  <ActivityIndicator color={status.color} size="large" />
                ) : (
                  <Text style={[styles.countNumber, { color: status.color }]}>{activeCount}</Text>
                )}
                <Text style={styles.countLabel}>PERSONAS{'\n'}EN EL GYM</Text>
              </View>
            </Animated.View>

            {/* Status pill */}
            <View style={[styles.statusPill, { backgroundColor: status.color + '18', borderColor: status.color + '50' }]}>
              <Text style={styles.statusEmoji}>{status.emoji}</Text>
              <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
            </View>

            <Text style={styles.hint}>
              {activeCount === 0
                ? 'El gym está vacío ahora mismo.'
                : `${activeCount === 1 ? 'Hay 1 persona' : `Hay ${activeCount} personas`} entrenando ahora mismo.`}
            </Text>

            {isTrainer && active.length > 0 && (
              <Text style={styles.listTitle}>Quiénes están</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          isTrainer ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>Nadie registrado todavía.</Text>
              <Text style={styles.emptySub}>Usá el botón para registrar una entrada.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={[styles.checkinRow, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <View style={[styles.checkinAvatar, { backgroundColor: colors.primaryDim12 }]}>
              <Ionicons name="person-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.checkinInfo}>
              <Text style={[styles.checkinName, { color: colors.text }]}>
                {item.nombre}{item.dni ? ` · DNI ${item.dni}` : ''}
              </Text>
              <Text style={[styles.checkinTime, { color: colors.textTertiary }]}>
                {minutesAgo(item.fechaHora)} · expira en {Math.max(0, 90 - Math.floor((Date.now() - (item.fechaHora?.toMillis?.() ?? 0)) / 60_000))} min
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => handleRemove(item)}
              style={styles.removeBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="exit-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      />

      {/* Trainer buttons */}
      {isTrainer && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={[styles.footerSecBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              onPress={openHistory}
              activeOpacity={0.82}
            >
              <Ionicons name="calendar-outline" size={16} color={colors.primary} />
              <Text style={[styles.footerSecText, { color: colors.primary }]}>Historial</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.footerSecBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              onPress={openQuota}
              activeOpacity={0.82}
            >
              <Ionicons name="card-outline" size={16} color={colors.primary} />
              <Text style={[styles.footerSecText, { color: colors.primary }]}>Cuotas</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.footerSecBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              onPress={() => openAnalytics(analyticsRange)}
              activeOpacity={0.82}
            >
              <Ionicons name="bar-chart-outline" size={16} color={colors.primary} />
              <Text style={[styles.footerSecText, { color: colors.primary }]}>Análisis</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={openPicker}
            activeOpacity={0.82}
          >
            <Ionicons name="person-add-outline" size={18} color={colors.textInverse} />
            <Text style={[styles.addBtnText, { color: colors.textInverse }]}>Registrar entrada</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* History modal — full screen */}
      <Modal
        visible={historyVisible}
        animationType="slide"
        onRequestClose={() => setHistoryVisible(false)}
      >
        <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setHistoryVisible(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>Historial de hoy</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Search bar */}
          <View style={[styles.searchWrap, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              value={historySearch}
              onChangeText={setHistorySearch}
              placeholder="Buscar por nombre o DNI..."
              placeholderTextColor={colors.textTertiary}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {historySearch.length > 0 && (
              <TouchableOpacity onPress={() => setHistorySearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          {historyLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : (
            <FlatList
              data={filteredHistory}
              keyExtractor={item => item.id}
              contentContainerStyle={[styles.scrollContent, filteredHistory.length === 0 && { flex: 1 }]}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                <Text style={[styles.historyCount, { color: colors.textSecondary }]}>
                  {history.length === 0
                    ? 'Nadie pasó por el gym hoy todavía.'
                    : filteredHistory.length === 0
                    ? 'Sin resultados para esa búsqueda.'
                    : `${filteredHistory.length} de ${history.length} ${history.length === 1 ? 'ingreso' : 'ingresos'} hoy`}
                </Text>
              }
              ListEmptyComponent={
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing['3xl'] }}>
                  <Ionicons name="search-outline" size={48} color={colors.textTertiary} />
                </View>
              }
              ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
              renderItem={({ item }) => (
                <View style={[styles.checkinRow, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                  <View style={[styles.checkinAvatar, { backgroundColor: colors.primaryDim12 }]}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>
                      {history.length - history.indexOf(item)}
                    </Text>
                  </View>
                  <View style={styles.checkinInfo}>
                    <Text style={[styles.checkinName, { color: colors.text }]}>
                      {item.nombre}{item.dni ? ` · DNI ${item.dni}` : ''}
                    </Text>
                    <Text style={[styles.checkinTime, { color: colors.textTertiary }]}>
                      {item.fechaHora?.toDate?.()
                        ? item.fechaHora.toDate().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </Text>
                  </View>
                </View>
              )}
            />
          )}
        </View>
      </Modal>

      {/* Analytics modal — full screen */}
      <Modal
        visible={analyticsVisible}
        animationType="slide"
        onRequestClose={() => setAnalyticsVisible(false)}
      >
        <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setAnalyticsVisible(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>Pico de horarios</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Range toggle */}
          <View style={[styles.analyticsToggle, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            {[{ label: 'Esta semana', days: 7 }, { label: 'Este mes', days: 30 }].map(opt => (
              <TouchableOpacity
                key={opt.days}
                style={[styles.analyticsToggleBtn, analyticsRange === opt.days && { backgroundColor: colors.primary }]}
                onPress={() => openAnalytics(opt.days)}
                activeOpacity={0.8}
              >
                <Text style={[styles.analyticsToggleText, { color: analyticsRange === opt.days ? colors.textInverse : colors.textSecondary }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {analyticsLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : (
            <AnalyticsChart data={analyticsData} colors={colors} styles={styles} />
          )}
        </View>
      </Modal>

      {/* Quota modal — full screen */}
      <Modal
        visible={quotaVisible}
        animationType="slide"
        onRequestClose={() => setQuotaVisible(false)}
      >
        <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setQuotaVisible(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>Estado de cuotas</Text>
            <TouchableOpacity
              style={[styles.backBtn, { backgroundColor: colors.primaryDim12 }]}
              onPress={openNewSocio}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="add" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={[styles.searchWrap, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              value={quotaSearch}
              onChangeText={setQuotaSearch}
              placeholder="Buscar por nombre o DNI..."
              placeholderTextColor={colors.textTertiary}
              returnKeyType="search"
            />
            {quotaSearch.length > 0 && (
              <TouchableOpacity onPress={() => setQuotaSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          {quotaLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : (
            <QuotaSections
              data={quotaData}
              search={quotaSearch}
              colors={colors}
              styles={styles}
              spacing={spacing}
              refreshing={quotaRefreshing}
              onRefresh={handleQuotaRefresh}
            />
          )}

          {/* Modal agregar nuevo socio — anidado en el modal de cuotas para que iOS lo muestre sin esperar */}
          <Modal visible={newSocioVisible} transparent animationType="fade" onRequestClose={() => setNewSocioVisible(false)}>
            <TouchableOpacity style={{ flex: 1, backgroundColor: '#00000060', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={() => { Keyboard.dismiss(); setNewSocioVisible(false); }}>
              <TouchableOpacity activeOpacity={1} onPress={Keyboard.dismiss} style={{ width: '88%', backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={[styles.modalTitle, { color: colors.text, marginBottom: spacing.lg }]}>Agregar socio</Text>

                    <Text style={[styles.checkinTime, { color: colors.textSecondary, marginBottom: spacing.xs }]}>Nombre completo</Text>
                    <TextInput
                      style={{ color: colors.text, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, marginBottom: spacing.md, fontSize: 16, minHeight: 46 }}
                      value={newNombre}
                      onChangeText={setNewNombre}
                      placeholder="Nombre y apellido"
                      placeholderTextColor={colors.textTertiary}
                      autoCapitalize="words"
                    />

                    <Text style={[styles.checkinTime, { color: colors.textSecondary, marginBottom: spacing.xs }]}>DNI</Text>
                    <TextInput
                      style={{ color: colors.text, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, marginBottom: spacing.md, fontSize: 16, minHeight: 46 }}
                      value={newDni}
                      onChangeText={setNewDni}
                      placeholder="Número de DNI"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="numeric"
                    />

                    <Text style={[styles.checkinTime, { color: colors.textSecondary, marginBottom: spacing.xs }]}>Vencimiento de cuota</Text>
                    <TouchableOpacity
                      onPress={() => setNewShowPicker(v => !v)}
                      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: newShowPicker ? colors.primary : colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.sm }}
                    >
                      <Ionicons name="calendar-outline" size={16} color={colors.primary} style={{ marginRight: spacing.sm }} />
                      <Text style={{ color: newFecha ? colors.text : colors.textTertiary, fontSize: 15, flex: 1 }}>
                        {newFecha ? newFecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Sin vencimiento'}
                      </Text>
                      <Ionicons name="chevron-down" size={14} color={colors.textTertiary} />
                    </TouchableOpacity>

                    {newShowPicker && (
                      <DateTimePicker
                        value={newFecha ?? new Date()}
                        mode="date"
                        display="spinner"
                        onChange={(event, date) => {
                          if (Platform.OS === 'android') {
                            setNewShowPicker(false);
                            if (event.type === 'set' && date) setNewFecha(date);
                          } else {
                            if (date) setNewFecha(date);
                          }
                        }}
                        locale="es-ES"
                        style={{ height: 130, marginBottom: spacing.sm }}
                      />
                    )}

                    <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                      <TouchableOpacity onPress={() => setNewSocioVisible(false)} style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }}>
                        <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={saveNewSocio} disabled={newSaving} style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.primary, opacity: newSaving ? 0.6 : 1 }}>
                        {newSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Guardar</Text>}
                      </TouchableOpacity>
                  </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        </View>
      </Modal>

      {/* Picker de socios — pantalla completa */}
      <Modal
        visible={pickerVisible}
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setPickerVisible(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>Registrar entrada</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={[styles.searchWrap, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              value={sociosSearch}
              onChangeText={setSociosSearch}
              placeholder="Buscar por nombre o DNI..."
              placeholderTextColor={colors.textTertiary}
              autoFocus
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {sociosSearch.length > 0 && (
              <TouchableOpacity onPress={() => setSociosSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          {sociosLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : (
            <FlatList
              data={filteredSocios}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.scrollContent, filteredSocios.length === 0 && { flex: 1 }]}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                <Text style={[styles.historyCount, { color: colors.textSecondary }]}>
                  {filteredSocios.length === 0
                    ? 'Sin resultados.'
                    : `${filteredSocios.length} ${filteredSocios.length === 1 ? 'socio' : 'socios'}`}
                </Text>
              }
              ListEmptyComponent={
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing['3xl'] }}>
                  <Ionicons name="search-outline" size={48} color={colors.textTertiary} />
                </View>
              }
              ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.checkinRow, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                  onPress={() => handleSelectSocio(item)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.checkinAvatar, { backgroundColor: colors.primaryDim12 }]}>
                    <Ionicons name="person-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.checkinInfo}>
                    <Text style={[styles.checkinName, { color: colors.text }]}>{item.nombre}</Text>
                    <Text style={[styles.checkinTime, { color: colors.textTertiary }]}>DNI {item.dni}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} style={{ opacity: 0.5 }} />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>

    </SafeAreaView>
    </Animated.View>
  );
}

function makeStyles(colors) { return StyleSheet.create({
  container:  { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  title: {
    flex: 1, textAlign: 'center',
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },

  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['3xl'],
    flexGrow: 1,
  },

  hero: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing['3xl'],
  },

  countBubble: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 10,
  },
  countBubbleInner: {
    width: 176,
    height: 176,
    borderRadius: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  countNumber: {
    fontSize: 72,
    fontWeight: typography.weights.black,
    lineHeight: 80,
    letterSpacing: -4,
  },
  countLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.textTertiary,
    textAlign: 'center',
    letterSpacing: 1.5,
  },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  statusEmoji: { fontSize: 14 },
  statusLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
  },

  hint: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing['3xl'],
    paddingHorizontal: spacing.xl,
    lineHeight: typography.sizes.base * 1.6,
  },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sizes.base,
    paddingVertical: 2,
  },
  historyCount: {
    fontSize: typography.sizes.sm,
    marginBottom: spacing.lg,
  },
  analyticsToggle: {
    flexDirection: 'row',
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  analyticsToggleBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  analyticsToggleText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  analyticsChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: radius.xl,
    borderWidth: 0.5,
    padding: spacing.md,
    paddingTop: spacing.lg,
    marginBottom: spacing.xl,
    gap: 3,
  },
  analyticsBarCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
  },
  analyticsBarVal: {
    fontSize: 8,
    fontWeight: typography.weights.bold,
    height: 11,
  },
  analyticsBarTrack: {
    width: '80%',
    borderRadius: 3,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  analyticsBarFill: {
    width: '100%',
    borderRadius: 3,
  },
  analyticsBarLabel: {
    fontSize: 8,
    textAlign: 'center',
  },
  analyticsSummary: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  analyticsSummaryCard: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  analyticsSummaryVal: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.black,
  },
  analyticsSummaryLabel: {
    fontSize: typography.sizes.xs,
    textAlign: 'center',
  },
  analyticsSectionTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  quotaSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: 1,
    paddingBottom: spacing.sm,
    marginBottom: spacing.xs,
  },
  quotaSectionLabel: {
    flex: 1,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.3,
  },
  quotaBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  quotaBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  listTitle: {
    alignSelf: 'flex-start',
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },

  emptyWrap: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  emptyText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  emptySub: {
    fontSize: typography.sizes.sm,
    color: colors.textTertiary,
    textAlign: 'center',
  },

  checkinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 0.5,
  },
  checkinAvatar: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  checkinInfo: { flex: 1 },
  checkinName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    marginBottom: 2,
  },
  checkinTime: { fontSize: typography.sizes.xs },
  removeBtn: { padding: spacing.sm },

  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 32 : spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  footerSecBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  footerSecText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  addBtnText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 0.5,
    paddingHorizontal: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : spacing.xl,
    paddingTop: spacing.lg,
  },
  handle: {
    width: 36, height: 4, borderRadius: radius.full,
    alignSelf: 'center', marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    marginBottom: 4,
  },
  modalSub: {
    fontSize: typography.sizes.sm,
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.base,
    marginBottom: spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderRadius: radius.lg,
    paddingVertical: spacing.md, alignItems: 'center',
  },
  cancelText: { fontSize: typography.sizes.base, fontWeight: typography.weights.medium },
  saveBtn: {
    flex: 2, borderRadius: radius.lg,
    paddingVertical: spacing.md, alignItems: 'center',
  },
  saveText: { fontSize: typography.sizes.base, fontWeight: typography.weights.semibold },
}); }