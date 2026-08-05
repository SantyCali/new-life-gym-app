import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, Modal, Pressable, FlatList, useWindowDimensions, Image,
  LayoutAnimation, UIManager,
} from 'react-native';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  runOnJS, Easing,
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import useAuth from '../../hooks/useAuth';
import { typography, spacing, radius } from '../../theme';
import { MUSCLE_GROUPS, EXERCISES_BY_GROUP, EXERCISES } from '../../constants/exercises';
import { saveRoutine, makeDay, makeExerciseSlot } from '../../services/routineService';
import { getExerciseImage, getExerciseGif } from '../../constants/exerciseMedia';

const ITEM_HEIGHT = 104; // approximate card height for DnD calculations

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function RoutineEditorScreen({ route, navigation }) {
  const { cliente, routine: existingRoutine } = route.params;
  const { theme: { colors } } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [days, setDays] = useState(() =>
    existingRoutine?.dias?.length ? existingRoutine.dias : [makeDay(1)]
  );
  const [activeDayId, setActiveDayId] = useState(() => days[0]?.id);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [addSheetOpen, setAddSheet]   = useState(false);
  const [editTarget, setEditTarget]   = useState(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const draggingIndexSV = useSharedValue(-1);
  const hoverIndexSV    = useSharedValue(-1);
  // Track routine ID in a ref so repeated saves update the same document
  const routineIdRef = React.useRef(existingRoutine?.id ?? null);

  const activeDay = days.find(d => d.id === activeDayId) ?? days[0];

  // ── Day management ──────────────────────────────────────────────────────────
  const addDay = useCallback(() => {
    if (days.length >= 6) return;
    const d = makeDay(days.length + 1);
    setDays(p => [...p, d]);
    setActiveDayId(d.id);
  }, [days.length]);

  const removeDay = useCallback((dayId) => {
    if (days.length === 1) return;
    Alert.alert('Eliminar día', '¿Eliminar este día y sus ejercicios?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: () => setDays(p => {
          const filtered = p.filter(d => d.id !== dayId).map((d, i) => ({ ...d, numero: i + 1 }));
          setActiveDayId(filtered[0]?.id);
          return filtered;
        }),
      },
    ]);
  }, [days.length]);

  // ── Exercise management ─────────────────────────────────────────────────────
  const addExercise = useCallback((exercise) => {
    setDays(p => p.map(day => {
      if (day.id !== activeDayId) return day;
      // Avoid duplicates
      if (day.ejercicios.some(e => e.exerciseId === exercise.id)) return day;
      const slot = makeExerciseSlot(exercise, day.ejercicios.length + 1);
      return { ...day, ejercicios: [...day.ejercicios, slot] };
    }));
    setAddSheet(false);
  }, [activeDayId]);

  const deleteExercise = useCallback((slotId) => {
    setDays(p => p.map(day => {
      if (day.id !== activeDayId) return day;
      return {
        ...day,
        ejercicios: day.ejercicios
          .filter(e => e.id !== slotId)
          .map((e, i) => ({ ...e, orden: i + 1 })),
      };
    }));
  }, [activeDayId]);

  const updateExercise = useCallback((slotId, fields) => {
    setDays(p => p.map(day => {
      if (day.id !== activeDayId) return day;
      return {
        ...day,
        ejercicios: day.ejercicios.map(e => e.id === slotId ? { ...e, ...fields } : e),
      };
    }));
    setEditTarget(null);
  }, [activeDayId]);

  const reorderExercises = useCallback((fromIndex, toIndex) => {
    LayoutAnimation.configureNext({
      duration: 300,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
    });
    setDays(p => p.map(day => {
      if (day.id !== activeDayId) return day;
      const arr = [...day.ejercicios];
      const [item] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, item);
      return { ...day, ejercicios: arr.map((e, i) => ({ ...e, orden: i + 1 })) };
    }));
  }, [activeDayId]);

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const totalEx = days.reduce((s, d) => s + d.ejercicios.length, 0);
    if (totalEx === 0) { Alert.alert('Rutina vacía', 'Agregá al menos un ejercicio.'); return; }
    setSaving(true);
    try {
      const savedId = await saveRoutine({
        id:           routineIdRef.current,
        clienteId:    cliente.uid,
        entrenadorId: user?.uid,
        nombre:       `Rutina de ${cliente.nombre ?? 'cliente'}`,
        dias:         days,
      });
      routineIdRef.current = savedId;
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('[saveRoutine]', err);
      Alert.alert('Error', 'No se pudo guardar. Verificá tu conexión.');
    } finally {
      setSaving(false);
    }
  }, [days, cliente, user]);

  const sortedExercises = useMemo(
    () => (activeDay?.ejercicios ?? []).slice().sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)),
    [activeDay]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* ── Top bar: back + days + save — all in one compact row ── */}
      <View style={styles.topBar}>
        {/* Back */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>

        {/* Day tabs — horizontal scroll fills the remaining space */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.dayTabsScroll}
          contentContainerStyle={styles.dayTabsContent}
          keyboardShouldPersistTaps="handled"
        >
          {days.map(day => {
            const isActive = activeDayId === day.id;
            const count    = day.ejercicios?.length ?? 0;
            return (
              <TouchableOpacity
                key={day.id}
                style={[styles.dayTab, isActive && styles.dayTabActive]}
                onPress={() => setActiveDayId(day.id)}
              >
                <Text style={[styles.dayTabText, isActive && styles.dayTabTextActive]}>
                  Día {day.numero}
                </Text>
                {count > 0 && (
                  <View style={[styles.dayTabBadge, isActive && styles.dayTabBadgeActive]}>
                    <Text style={[styles.dayTabBadgeText, isActive && styles.dayTabBadgeTextActive]}>
                      {count}
                    </Text>
                  </View>
                )}
                {/* Delete button — only shown when more than 1 day */}
                {days.length > 1 && (
                  <TouchableOpacity
                    style={styles.dayTabClose}
                    onPress={() => removeDay(day.id)}
                    hitSlop={6}
                  >
                    <Ionicons
                      name="close"
                      size={11}
                      color={isActive ? colors.primary : colors.textTertiary}
                    />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })}
          {/* Add day — hidden after 6 days */}
          {days.length < 6 && (
            <TouchableOpacity style={styles.addDayBtn} onPress={addDay}>
              <Ionicons name="add" size={16} color={colors.primary} />
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Save */}
        <TouchableOpacity style={[styles.saveBtn, saved && styles.saveBtnDone]} onPress={handleSave} disabled={saving || saved}>
          {saving
            ? <ActivityIndicator size="small" color={colors.textInverse} />
            : <Text style={styles.saveBtnText}>{saved ? '✓ Listo' : 'Guardar'}</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Client name — compact subtitle line */}
      <Text style={styles.clientName} numberOfLines={1}>
        {cliente.nombre} {cliente.apellido}
      </Text>

      {/* ── Exercise list ── */}
      <ScrollView
        style={styles.listScroll}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={scrollEnabled}
      >
        {sortedExercises.length === 0 ? (
          <View style={styles.emptyDay}>
            <Ionicons name="barbell-outline" size={40} color={colors.textTertiary} />
            <Text style={styles.emptyDayText}>Sin ejercicios</Text>
            <Text style={styles.emptyDayHint}>Tocá + para agregar</Text>
          </View>
        ) : (
          sortedExercises.map((slot, index) => (
            <ExerciseCard
              key={slot.id}
              slot={slot}
              index={index}
              total={sortedExercises.length}
              colors={colors}
              styles={styles}
              onEdit={() => setEditTarget(slot)}
              onDelete={() => deleteExercise(slot.id)}
              onReorder={reorderExercises}
              onDragStart={() => setScrollEnabled(false)}
              onDragEnd={() => setScrollEnabled(true)}
              draggingIndexSV={draggingIndexSV}
              hoverIndexSV={hoverIndexSV}
            />
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Floating add button ── */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 24 }]}
        onPress={() => setAddSheet(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color={colors.textInverse} />
      </TouchableOpacity>

      {/* ── Add Exercise Modal ── */}
      <ExercisePickerModal
        visible={addSheetOpen}
        onDismiss={() => setAddSheet(false)}
        onSelect={addExercise}
        colors={colors}
      />

      {/* ── Edit Exercise Sheet ── */}
      {editTarget && (
        <EditExerciseSheet
          slot={editTarget}
          onDismiss={() => setEditTarget(null)}
          onSave={(fields) => updateExercise(editTarget.id, fields)}
          colors={colors}
        />
      )}
    </SafeAreaView>
  );
}

// ── Exercise Card (drag-to-reorder + delete button) ──────────────────────────
function ExerciseCard({ slot, index, total, colors, styles, onEdit, onDelete, onReorder, onDragStart, onDragEnd, draggingIndexSV, hoverIndexSV }) {
  const cardOffset = useSharedValue(0);

  const commitReorder = useCallback((from, to) => {
    if (from !== to) onReorder(from, to);
    onDragEnd();
  }, [onReorder, onDragEnd]);

  const dragGesture = Gesture.Pan()
    .activateAfterLongPress(300)
    .onStart(() => {
      cardOffset.value      = 0;   // cancel any spring from a previous drop
      draggingIndexSV.value = index;
      hoverIndexSV.value    = index;
      runOnJS(onDragStart)();
    })
    .onUpdate((e) => {
      cardOffset.value   = e.translationY;
      hoverIndexSV.value = Math.max(0, Math.min(total - 1, index + Math.round(e.translationY / ITEM_HEIGHT)));
    })
    .onEnd(() => {
      const target = hoverIndexSV.value;
      // Snap cardOffset to the EXACT pixel delta the layout will travel.
      // This ensures withTiming starts from (target-index)*ITEM_HEIGHT — the same
      // distance LayoutAnimation covers — so both cancel perfectly with no snap.
      cardOffset.value      = (target - index) * ITEM_HEIGHT;
      hoverIndexSV.value    = -1;
      draggingIndexSV.value = -1;
      runOnJS(commitReorder)(index, target);
    })
    .onFinalize(() => {
      // Always reset state — covers gesture cancellation (no onEnd fired)
      hoverIndexSV.value    = -1;
      draggingIndexSV.value = -1;
      runOnJS(onDragEnd)();
    });

  const cardStyle = useAnimatedStyle(() => {
    const dragFrom   = draggingIndexSV.value;
    const dragTo     = hoverIndexSV.value;
    const amDragging = dragFrom === index;

    // Compute how much this card should shift to show the insertion point
    let shiftY = 0;
    if (!amDragging && dragFrom !== -1 && dragTo !== -1) {
      if (dragFrom < dragTo && index > dragFrom && index <= dragTo) {
        shiftY = -ITEM_HEIGHT; // dragging downward — shift these cards up
      } else if (dragFrom > dragTo && index < dragFrom && index >= dragTo) {
        shiftY = ITEM_HEIGHT;  // dragging upward — shift these cards down
      }
    }

    const isDimmed = dragFrom !== -1 && !amDragging;
    // Live drag: snappy spring.
    // Post-drop: withTiming with easeInOut — same curve as LayoutAnimation so they cancel
    // exactly and the card appears stationary. withSpring has a different easing profile
    // and can't cancel LayoutAnimation perfectly (causes the visible bounce).
    const shiftTranslate = amDragging
      ? cardOffset.value
      : dragFrom !== -1
        ? withSpring(shiftY, { damping: 24, stiffness: 300 })
        : withTiming(shiftY, { duration: 300, easing: Easing.inOut(Easing.ease) });
    return {
      transform: [
        { translateY: shiftTranslate },
        { scale: withTiming(amDragging ? 1.03 : 1, { duration: 200 }) },
      ],
      zIndex:        amDragging ? 100 : 1,
      opacity:       withTiming(isDimmed ? 0.55 : 1, { duration: 160 }),
      shadowOpacity: withTiming(amDragging ? 0.40 : 0, { duration: 180 }),
      shadowRadius:  amDragging ? 18 : 0,
      shadowColor:   '#000',
      shadowOffset:  { width: 0, height: 8 },
      elevation:     amDragging ? 10 : 0,
    };
  });

  const handleStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(
      draggingIndexSV.value === index ? colors.primaryDim12 : colors.surfaceContainerHigh,
      { duration: 200 }
    ),
  }));

  const handleDelete = () => {
    Alert.alert(
      'Eliminar ejercicio',
      `¿Eliminar "${slot.nombre}" de este día?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: onDelete },
      ]
    );
  };

  const [gifOpen, setGifOpen] = useState(false);
  const exRef    = { exerciseId: slot.exerciseId, id: slot.id };
  const thumbUri = getExerciseImage(exRef);
  const gifUri   = getExerciseGif(exRef) ?? thumbUri;

  const groupMeta = MUSCLE_GROUPS.find(g => g.id === slot.grupoMuscular);

  return (
    <>
      <Animated.View style={[styles.cardWrap, cardStyle]}>
        <GestureDetector gesture={dragGesture}>
          <Animated.View style={[styles.dragHandle, handleStyle]}>
            <Ionicons name="reorder-three" size={22} color={colors.textTertiary} />
          </Animated.View>
        </GestureDetector>

        <View style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            {/* Thumbnail — tap to see animated GIF */}
            <TouchableOpacity style={styles.cardThumb} onPress={() => setGifOpen(true)} activeOpacity={0.8}>
              <Image source={{ uri: thumbUri }} style={styles.cardThumbImg} resizeMode="contain" />
            </TouchableOpacity>

            <View style={styles.cardNameWrap}>
              <Text style={styles.cardName} numberOfLines={1}>{slot.nombre}</Text>
              {groupMeta && (
                <View style={styles.cardGroupPill}>
                  <Text style={styles.cardGroupText}>{groupMeta.label}</Text>
                </View>
              )}
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.editBtn} onPress={onEdit} hitSlop={8}>
                <Ionicons name="create-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} hitSlop={8}>
                <Ionicons name="trash-outline" size={16} color="#E5302A" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.cardMetaRow}>
            <MetaPill icon="repeat-outline"  label={`${slot.series} series`}     colors={colors} styles={styles} />
            <MetaPill icon="barbell-outline" label={`${slot.repeticiones} reps`} colors={colors} styles={styles} />
            {slot.carga != null && (
              <MetaPill icon="scale-outline" label={`${slot.carga} kg`}          colors={colors} styles={styles} />
            )}
            {slot.descanso && (
              <MetaPill icon="timer-outline" label={`${slot.descanso}s`}         colors={colors} styles={styles} />
            )}
          </View>

          {!!slot.observaciones && (
            <Text style={styles.cardObs} numberOfLines={1}>{slot.observaciones}</Text>
          )}
        </View>
      </Animated.View>

      {/* GIF preview modal */}
      {gifOpen && (
        <Modal transparent visible animationType="fade" onRequestClose={() => setGifOpen(false)} statusBarTranslucent>
          <Pressable style={gifSt.backdrop} onPress={() => setGifOpen(false)}>
            <Pressable style={gifSt.card} onPress={() => {}}>
              <View style={gifSt.imgWrap}>
                <Image source={{ uri: gifUri }} style={gifSt.img} resizeMode="contain" />
              </View>
              <Text style={gifSt.name} numberOfLines={2}>{slot.nombre}</Text>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

function MetaPill({ icon, label, colors, styles }) {
  return (
    <View style={styles.metaPill}>
      <Ionicons name={icon} size={11} color={colors.primary} />
      <Text style={styles.metaPillText}>{label}</Text>
    </View>
  );
}


// ── Exercise Picker — centered modal with scale+fade animation ─────────────────
function ExercisePickerModal({ visible, onDismiss, onSelect, colors }) {
  const { height: screenH } = useWindowDimensions();
  const [mounted, setMounted]         = useState(visible);
  const [search, setSearch]           = useState('');
  const [activeGroup, setActiveGroup] = useState(null);
  const [gifItem, setGifItem]         = useState(null);
  const scale   = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      scale.value   = withSpring(1,   { damping: 18, stiffness: 280 });
      opacity.value = withTiming(1,   { duration: 220 });
    } else if (mounted) {
      scale.value   = withSpring(0.95, { damping: 18, stiffness: 280 });
      opacity.value = withTiming(0,    { duration: 200 }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
  }, [visible]);

  const modalAnim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const filteredExercises = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (q) return EXERCISES.filter(e => e.nombre.toLowerCase().includes(q));
    if (activeGroup) return EXERCISES_BY_GROUP[activeGroup] ?? [];
    return [];
  }, [search, activeGroup]);

  const showList = search.length > 0 || activeGroup !== null;

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onDismiss} statusBarTranslucent>
      {/* Outer Pressable = full-screen backdrop + dismiss handler */}
      <Pressable
        style={[pmSt.backdrop, { backgroundColor: 'rgba(0,0,0,0.72)' }]}
        onPress={onDismiss}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={pmSt.kav}
        >
          {/* Inner Pressable claims the touch so backdrop doesn't fire when tapping card */}
          <Pressable style={pmSt.cardWrap} onPress={() => {}}>
            <Animated.View
              style={[pmSt.card, { backgroundColor: colors.surfaceContainer, maxHeight: screenH * 0.70 }, modalAnim]}
            >
              {/* Header */}
              <View style={pmSt.cardHeader}>
                <Text style={[pmSt.cardTitle, { color: colors.text }]}>Agregar ejercicio</Text>
                <TouchableOpacity onPress={onDismiss} hitSlop={10}>
                  <Ionicons name="close-circle" size={22} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>

              {/* Search */}
              <View style={[pmSt.searchRow, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.borderLight }]}>
                <Ionicons name="search-outline" size={14} color={colors.textTertiary} />
                <TextInput
                  style={[pmSt.searchInput, { color: colors.text }]}
                  placeholder="Buscar ejercicio…"
                  placeholderTextColor={colors.textTertiary}
                  value={search}
                  onChangeText={v => { setSearch(v); setActiveGroup(null); }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => { setSearch(''); setActiveGroup(null); }}>
                    <Ionicons name="close-circle" size={14} color={colors.textTertiary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Category chips */}
              {!search && (
                <View style={pmSt.chipRow}>
                  {MUSCLE_GROUPS.map(g => {
                    const active = activeGroup === g.id;
                    return (
                      <TouchableOpacity
                        key={g.id}
                        style={[pmSt.chip, {
                          backgroundColor: active ? colors.primaryDim12 : colors.surfaceContainerHigh,
                          borderColor: active ? colors.primary : 'transparent',
                        }]}
                        onPress={() => setActiveGroup(p => p === g.id ? null : g.id)}
                      >
                        <Ionicons name={g.icon} size={11} color={active ? colors.primary : colors.textSecondary} />
                        <Text style={[pmSt.chipText, { color: active ? colors.primary : colors.textSecondary }]}>
                          {g.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Results */}
              {showList ? (
                <FlatList
                  data={filteredExercises}
                  keyExtractor={item => item.id}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  style={{ maxHeight: screenH * 0.38 }}
                  ListEmptyComponent={
                    <Text style={[pmSt.empty, { color: colors.textTertiary }]}>Sin resultados</Text>
                  }
                  renderItem={({ item }) => (
                    <View style={[pmSt.exRow, { borderBottomColor: colors.borderLight }]}>
                      <TouchableOpacity
                        style={pmSt.exThumb}
                        onPress={() => setGifItem(item)}
                        activeOpacity={0.8}
                      >
                        <Image source={{ uri: getExerciseImage(item) }} style={pmSt.exThumbImg} resizeMode="contain" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={pmSt.exInfo}
                        onPress={() => { setSearch(''); setActiveGroup(null); onSelect(item); }}
                        activeOpacity={0.7}
                      >
                        <Text style={[pmSt.exName, { color: colors.text }]}>{item.nombre}</Text>
                        <Text style={[pmSt.exMeta, { color: colors.textTertiary }]}>{item.maquina}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[pmSt.addBtn, { backgroundColor: colors.primaryDim12 }]}
                        onPress={() => { setSearch(''); setActiveGroup(null); onSelect(item); }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="add" size={16} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  )}
                />
              ) : (
                <View style={pmSt.hint}>
                  <Text style={[pmSt.hintText, { color: colors.textTertiary }]}>
                    Buscá por nombre o elegí una categoría
                  </Text>
                </View>
              )}
            </Animated.View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>

      {/* GIF preview — stacks on top of the picker */}
      {gifItem && (
        <Modal transparent visible animationType="fade" onRequestClose={() => setGifItem(null)} statusBarTranslucent>
          <Pressable style={gifSt.backdrop} onPress={() => setGifItem(null)}>
            <Pressable style={gifSt.card} onPress={() => {}}>
              <View style={gifSt.imgWrap}>
                <Image
                  source={{ uri: getExerciseGif(gifItem) ?? getExerciseImage(gifItem) }}
                  style={gifSt.img}
                  resizeMode="contain"
                />
              </View>
              <Text style={gifSt.name} numberOfLines={2}>{gifItem.nombre}</Text>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </Modal>
  );
}

const pmSt = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kav: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  cardWrap: { width: '100%' },
  card: {
    width: '100%',
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
    elevation: 18,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 14,
  },
  cardTitle: { fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 12, height: 38, marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 14 },
  chipRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1.5,
  },
  chipText: { fontSize: 11, fontWeight: '700' },
  exRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, gap: 10,
  },
  exThumb: {
    width: 44, height: 44, borderRadius: 8,
    backgroundColor: '#fff', overflow: 'hidden', flexShrink: 0,
  },
  exThumbImg: { width: '100%', height: '100%' },
  exInfo: { flex: 1 },
  exName:  { fontSize: 14, fontWeight: '700', marginBottom: 1 },
  exMeta:  { fontSize: 11 },
  addBtn: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  empty:    { textAlign: 'center', paddingVertical: 20, fontSize: 13 },
  hint:     { paddingVertical: 20, alignItems: 'center' },
  hintText: { fontSize: 13 },
});

const gifSt = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center', justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%', borderRadius: 20, overflow: 'hidden',
    backgroundColor: '#111',
  },
  imgWrap: { height: 280, backgroundColor: '#fff' },
  img: { width: '100%', height: '100%' },
  name: {
    fontSize: 15, fontWeight: '800', color: '#fff',
    paddingHorizontal: 16, paddingVertical: 14,
    textAlign: 'center',
  },
});

// ── Edit Exercise Sheet — same centered modal as ExercisePickerModal ──────────
function EditExerciseSheet({ slot, onDismiss, onSave, colors }) {
  const { height: screenH } = useWindowDimensions();
  const scale   = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  const [form, setForm] = useState({
    series:        slot.series?.toString()        ?? '4',
    repeticiones:  slot.repeticiones?.toString()  ?? '12',
    carga:         slot.carga != null ? slot.carga.toString() : '',
    descanso:      slot.descanso?.toString()      ?? '90',
    observaciones: slot.observaciones             ?? '',
  });

  useEffect(() => {
    scale.value   = withSpring(1,  { damping: 18, stiffness: 280 });
    opacity.value = withTiming(1,  { duration: 220 });
  }, []);

  const modalAnim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const handleSave = () => {
    onSave({
      series:        parseInt(form.series)        || 4,
      repeticiones:  parseInt(form.repeticiones)  || 12,
      carga:         form.carga ? parseFloat(form.carga) : null,
      descanso:      parseInt(form.descanso)      || 90,
      observaciones: form.observaciones,
    });
  };

  const dismiss = () => {
    scale.value   = withSpring(0.95, { damping: 18, stiffness: 280 });
    opacity.value = withTiming(0, { duration: 200 }, (done) => {
      if (done) runOnJS(onDismiss)();
    });
  };

  return (
    <Modal transparent visible animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <Pressable
        style={[pmSt.backdrop, { backgroundColor: 'rgba(0,0,0,0.72)' }]}
        onPress={dismiss}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={pmSt.kav}
        >
          <Pressable style={pmSt.cardWrap} onPress={() => {}}>
            <Animated.View
              style={[pmSt.card, { backgroundColor: colors.surfaceContainer, maxHeight: screenH * 0.70 }, modalAnim]}
            >
              {/* Header */}
              <View style={pmSt.cardHeader}>
                <Text style={[editSt.title, { color: colors.text, marginBottom: 0, flex: 1, marginRight: 8 }]} numberOfLines={1}>
                  {slot.nombre}
                </Text>
                <TouchableOpacity onPress={dismiss} hitSlop={10}>
                  <Ionicons name="close-circle" size={22} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>

              {/* Numeric fields */}
              <View style={editSt.row}>
                <EditField label="Series"     value={form.series}       onChangeText={v => set('series', v)}       keyboard="numeric"      colors={colors} />
                <EditField label="Reps"       value={form.repeticiones} onChangeText={v => set('repeticiones', v)} keyboard="numeric"      colors={colors} />
                <EditField label="Carga kg"   value={form.carga}        onChangeText={v => set('carga', v)}        keyboard="decimal-pad"  placeholder="—" colors={colors} />
                <EditField label="Descanso s" value={form.descanso}     onChangeText={v => set('descanso', v)}     keyboard="numeric"      colors={colors} />
              </View>

              {/* Observaciones */}
              <Text style={[editSt.label, { color: colors.textTertiary }]}>Observaciones</Text>
              <TextInput
                style={[editSt.obsInput, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.borderLight, color: colors.text }]}
                value={form.observaciones}
                onChangeText={v => set('observaciones', v)}
                placeholder="Notas para el cliente…"
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={3}
              />

              {/* Actions */}
              <View style={editSt.actions}>
                <TouchableOpacity style={[editSt.cancelBtn, { borderColor: colors.borderLight }]} onPress={dismiss}>
                  <Text style={[editSt.cancelText, { color: colors.textSecondary }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[editSt.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave}>
                  <Text style={[editSt.saveText, { color: colors.textInverse }]}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

function EditField({ label, value, onChangeText, keyboard, placeholder, colors }) {
  return (
    <View style={editSt.field}>
      <Text style={[editSt.label, { color: colors.textTertiary }]}>{label}</Text>
      <TextInput
        style={[editSt.input, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.borderLight, color: colors.text }]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboard}
        placeholder={placeholder ?? '0'}
        placeholderTextColor={colors.textTertiary}
        selectTextOnFocus
        textAlign="center"
      />
    </View>
  );
}

const editSt = StyleSheet.create({
  title: {
    fontSize: typography.sizes.lg, fontWeight: typography.weights.black,
    marginBottom: spacing.lg,
  },
  row: { flexDirection: 'row', gap: 8, marginBottom: spacing.lg },
  field: { flex: 1 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 },
  input: {
    borderRadius: radius.lg, borderWidth: 1,
    paddingVertical: 10, fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
  },
  obsInput: {
    borderRadius: radius.lg, borderWidth: 1,
    padding: 12, fontSize: typography.sizes.sm,
    minHeight: 72, textAlignVertical: 'top',
    marginBottom: spacing.lg,
  },
  actions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderRadius: radius.full,
    paddingVertical: 14, alignItems: 'center',
  },
  cancelText: { fontSize: typography.sizes.base, fontWeight: '600' },
  saveBtn: {
    flex: 2, borderRadius: radius.full,
    paddingVertical: 14, alignItems: 'center',
  },
  saveText: { fontSize: typography.sizes.base, fontWeight: typography.weights.bold },
});

// ── Styles ────────────────────────────────────────────────────────────────────
function makeStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    // Header
    // ── Top bar: back + day tabs + save in one flex row ──────────────────────
    topBar: {
      flexDirection: 'row', alignItems: 'center',
      paddingLeft: spacing.md, paddingRight: spacing.md,
      paddingTop: 6, paddingBottom: 6,
      gap: spacing.sm,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.surfaceContainerHigh,
      alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    },
    dayTabsScroll: { flex: 1 },
    dayTabsContent: {
      flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2,
    },
    dayTab: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 10, paddingVertical: 7,
      borderRadius: radius.full, borderWidth: 1.5,
      backgroundColor: colors.surfaceContainerHigh,
      borderColor: 'transparent',
    },
    dayTabActive: {
      backgroundColor: colors.primaryDim12, borderColor: colors.primary,
    },
    dayTabText: {
      fontSize: typography.sizes.sm, fontWeight: '700', color: colors.textSecondary,
    },
    dayTabTextActive: { color: colors.primary },
    dayTabBadge: {
      width: 16, height: 16, borderRadius: 8,
      backgroundColor: colors.surfaceContainer,
      alignItems: 'center', justifyContent: 'center',
    },
    dayTabBadgeActive: { backgroundColor: colors.primary },
    dayTabBadgeText: { fontSize: 9, fontWeight: '800', color: colors.textTertiary },
    dayTabBadgeTextActive: { color: colors.textInverse },
    dayTabClose: {
      width: 16, height: 16, borderRadius: 8,
      alignItems: 'center', justifyContent: 'center',
    },
    addDayBtn: {
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: colors.surfaceContainerHigh,
      borderWidth: 1.5, borderColor: colors.borderLight,
      alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    },
    saveBtn: {
      backgroundColor: colors.primary, borderRadius: radius.full,
      paddingHorizontal: 14, paddingVertical: 8,
      alignItems: 'center', flexShrink: 0,
    },
    saveBtnDone: {
      backgroundColor: '#2e7d32',
    },
    saveBtnText: {
      fontSize: typography.sizes.sm, fontWeight: typography.weights.bold, color: colors.textInverse,
    },

    // Client name subtitle
    clientName: {
      fontSize: typography.sizes.xs, color: colors.primary,
      fontWeight: '700', letterSpacing: 0.3,
      paddingHorizontal: spacing.lg,
      paddingBottom: 8,
    },

    // List
    listScroll: { flex: 1 },
    listContent: { paddingHorizontal: spacing.lg, paddingTop: 4 },

    // Empty state
    emptyDay: {
      alignItems: 'center', paddingVertical: 60, gap: 10,
    },
    emptyDayText: {
      fontSize: typography.sizes.xl, fontWeight: typography.weights.black, color: colors.textTertiary,
    },
    emptyDayHint: {
      fontSize: typography.sizes.sm, color: colors.textTertiary,
    },

    // Exercise card
    cardWrap: {
      marginBottom: 6, borderRadius: radius.xl,
      flexDirection: 'row', alignItems: 'stretch',
    },
    dragHandle: {
      width: 44, alignItems: 'center', justifyContent: 'center',
      borderTopLeftRadius: radius.xl, borderBottomLeftRadius: radius.xl,
    },
    cardBody: {
      flex: 1, backgroundColor: colors.surfaceContainer,
      borderTopWidth: 1, borderBottomWidth: 1, borderRightWidth: 1,
      borderColor: colors.borderLight,
      borderTopRightRadius: radius.xl, borderBottomRightRadius: radius.xl,
      padding: spacing.md, gap: 8,
    },
    cardTopRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    },
    cardThumb: {
      width: 52, height: 52, borderRadius: 10,
      backgroundColor: '#fff', overflow: 'hidden', flexShrink: 0,
    },
    cardThumbImg: { width: '100%', height: '100%' },
    cardNameWrap: { flex: 1, gap: 4 },
    cardName: {
      fontSize: typography.sizes.base, fontWeight: typography.weights.black, color: colors.text,
    },
    cardGroupPill: {
      alignSelf: 'flex-start',
      backgroundColor: colors.primaryDim12,
      paddingHorizontal: 7, paddingVertical: 2,
      borderRadius: radius.md,
    },
    cardGroupText: {
      fontSize: 10, fontWeight: '700', color: colors.primary, letterSpacing: 0.3,
    },
    cardActions: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
    },
    editBtn: { padding: 4 },
    deleteBtn: { padding: 4 },
    cardMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    metaPill: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: colors.surfaceContainerHigh,
      paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.md,
    },
    metaPillText: {
      fontSize: typography.sizes.xs, fontWeight: '700', color: colors.textSecondary,
    },
    cardObs: {
      fontSize: typography.sizes.xs, color: colors.textTertiary, fontStyle: 'italic',
    },

    // FAB
    fab: {
      position: 'absolute', right: spacing.xl,
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: colors.primary,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: colors.primary, shadowOpacity: 0.5,
      shadowRadius: 14, shadowOffset: { width: 0, height: 4 },
      elevation: 8,
    },
  });
}
