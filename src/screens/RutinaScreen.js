import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image, Modal, Pressable, Dimensions,
  TextInput,
} from 'react-native';
import { useEspacioBarra } from '../navigation/PremiumTabBar';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSpring, withTiming, withDelay, runOnJS, Easing,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveGymWeight } from '../services/progressService';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import useAuth from '../hooks/useAuth';
import { typography, spacing, radius } from '../theme';
import { subscribeToClientRoutine } from '../services/routineService';
import { MUSCLE_GROUPS, EXERCISE_BY_ID } from '../constants/exercises';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { getExerciseImage, getExerciseGif } from '../constants/exerciseMedia';
import useUserProfile from '../hooks/useUserProfile';

// Brillo suave del color de acento detrás de la pantalla (arriba a la derecha
// y a la izquierda). Sale del tema: cambia con el color y con claro/oscuro.
function FondoAmbiente({ color, fuerte }) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="amb1" cx="80%" cy="8%" r="55%">
          <Stop offset="0" stopColor={color} stopOpacity={fuerte ? 0.16 : 0.1} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="amb2" cx="8%" cy="40%" r="45%">
          <Stop offset="0" stopColor={color} stopOpacity={fuerte ? 0.1 : 0.06} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#amb1)" />
      <Rect width="100%" height="100%" fill="url(#amb2)" />
    </Svg>
  );
}

export default function RutinaScreen({ navigation }) {
  // Espacio al final para que la barra flotante no tape lo último.
  const espacioBarra = useEspacioBarra();
  const { theme: { colors, isDark } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const insets = useSafeAreaInsets();
  const fondo = <FondoAmbiente color={colors.primary} fuerte={isDark} />;

  // El alumno se arma o edita su rutina (también la que le armó el entrenador)
  // con el mismo editor que usan los entrenadores.
  const abrirEditor = (rutina) => navigation.navigate('RoutineEditor', {
    cliente: { uid: user?.uid, nombre: profile?.nombre ?? '', apellido: profile?.apellido ?? '' },
    routine: rutina ?? null,
  });

  const [routine, setRoutine]                   = useState(undefined);
  const [activeDayId, setDayId]                 = useState(null);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [weightModalId, setWeightModalId]       = useState(null); // exercise slot id | null
  const [savedWeights, setSavedWeights]         = useState({});

  const headerOpacity = useSharedValue(0);
  const headerFadeStyle = useAnimatedStyle(() => ({ opacity: headerOpacity.value }));
  const screenOpacity = useSharedValue(0);
  const screenStyle   = useAnimatedStyle(() => ({ flex: 1, opacity: screenOpacity.value }));

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToClientRoutine(user.uid, setRoutine);
    return unsub;
  }, [user?.uid]);

  // Día inicial según la visita al gym. Si el día elegido no está en la rutina
  // (se cambió de rutina), se vuelve a elegir: antes quedaba "Este día no tiene
  // ejercicios" con ningún día marcado.
  useEffect(() => {
    if (!routine?.dias?.length) return;
    if (activeDayId && routine.dias.some((d) => d.id === activeDayId)) return;
    const storedIdx = profile?.gymRoutineDayIndex ?? 0;
    const safeIdx   = Math.min(Math.max(0, storedIdx), routine.dias.length - 1);
    setDayId(routine.dias[safeIdx]?.id ?? null);
  }, [routine, profile?.gymRoutineDayIndex]);

  useEffect(() => {
    screenOpacity.value = withTiming(1, { duration: 280 });
    headerOpacity.value = withTiming(1, { duration: 700 });
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    AsyncStorage.getItem(`userWeights_${user.uid}`).then(v => {
      if (v) setSavedWeights(JSON.parse(v));
    });
  }, [user?.uid]);

  const saveWeight = useCallback((slotId, value, auto, realExerciseId, exerciseName) => {
    setSavedWeights(prev => {
      const previousPeso = prev[slotId]?.value ?? null;
      const next = { ...prev, [slotId]: { value, auto } };
      AsyncStorage.setItem(`userWeights_${user.uid}`, JSON.stringify(next));
      if (realExerciseId && value > 0) {
        saveGymWeight(user.uid, realExerciseId, exerciseName, value, previousPeso);
      }
      return next;
    });
  }, [user?.uid]);

  const exercises = useMemo(() => {
    const day = routine?.dias?.find(d => d.id === activeDayId);
    return (day?.ejercicios ?? []).slice().sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  }, [routine, activeDayId]);

  const activeDay      = routine?.dias?.find(d => d.id === activeDayId);
  const muscleGroups   = useMemo(() =>
    [...new Set(exercises.map(e => {
      const g = MUSCLE_GROUPS.find(m => m.id === e.grupoMuscular);
      return g?.label ?? e.grupoMuscular;
    }))],
    [exercises]
  );

  const estimatedMinutes = Math.max(15, exercises.length * 8);

  const dayTitle = useMemo(() => {
    if (!activeDay) return '';
    if (activeDay.nombre?.trim()) return activeDay.nombre;
    const groups = muscleGroups.slice(0, 2).join(' + ');
    return groups ? `Día ${activeDay.numero}: ${groups}` : `Día ${activeDay.numero}`;
  }, [activeDay, muscleGroups]);

  const userInitials = user?.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email?.[0]?.toUpperCase() ?? '?');

  const selectedGroupMeta = selectedExercise
    ? MUSCLE_GROUPS.find(g => g.id === selectedExercise.grupoMuscular)
    : null;

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (routine === undefined) {
    return (
      <Animated.View style={screenStyle}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {fondo}
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
      </Animated.View>
    );
  }

  // ── No routine ───────────────────────────────────────────────────────────────
  if (!routine) {
    return (
      <Animated.View style={screenStyle}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {fondo}
        <Animated.View style={[styles.header, headerFadeStyle]}>
          <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>Mi Rutina</Text>
        </Animated.View>
        <View style={styles.emptyWrap}>
          <View style={[styles.emptyIconWrap, { backgroundColor: colors.primaryDim12 }]}>
            <Ionicons name="barbell-outline" size={44} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Todavía no tenés rutina</Text>
          <Text style={styles.emptySub}>
            Armate la tuya o pedísela a tu entrenador.{'\n'}
            Tu entrenador también la va a poder ver.
          </Text>
          <TouchableOpacity
            style={[styles.armarBtn, { backgroundColor: colors.primary }]}
            onPress={() => abrirEditor(null)}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={18} color={colors.textInverse} />
            <Text style={[styles.armarBtnText, { color: colors.textInverse }]}>Armar mi rutina</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.gymBtn, { borderColor: colors.primary + '66' }]}
            onPress={() => navigation.navigate('Plantillas', { modo: 'elegir' })}
            activeOpacity={0.85}
          >
            <Ionicons name="albums-outline" size={17} color={colors.primary} />
            <Text style={[styles.armarBtnText, { color: colors.primary }]}>Elegir una rutina del gym</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={screenStyle}>
    <SafeAreaView style={styles.container} edges={['top']}>
      {fondo}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Animated.View style={[styles.header, headerFadeStyle]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>Mi Rutina</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {routine.creadaPor === 'alumno' ? 'Armada por vos' : (routine.nombre ?? 'Entrenamiento')}
          </Text>
        </View>
        {/* Rutinas armadas por los entrenadores (para cambiar la actual) */}
        <TouchableOpacity
          style={[styles.rutinasGymBtn, { borderColor: colors.primary + '55', backgroundColor: colors.primaryDim12 }]}
          onPress={() => navigation.navigate('Plantillas', { modo: 'elegir' })}
          activeOpacity={0.8}
          hitSlop={6}
          accessibilityLabel="Rutinas del gym"
        >
          <View style={[styles.rutinasGymIcono, { backgroundColor: colors.primary }]}>
            <Ionicons name="barbell" size={14} color={colors.textOnPrimary} />
          </View>
          <Text style={[styles.rutinasGymText, { color: colors.primary }]}>Rutinas</Text>
        </TouchableOpacity>
        {(
          <TouchableOpacity
            style={[styles.editarBtn, { shadowColor: colors.primary }]}
            onPress={() => abrirEditor(routine)}
            activeOpacity={0.8}
            hitSlop={6}
            accessibilityLabel="Editar rutina"
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryShadow]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.editarBtnFondo}
            >
              <View style={styles.editarIcono}>
                <Ionicons name="pencil" size={12} color={colors.primary} />
              </View>
              <Text style={[styles.editarBtnText, { color: colors.textOnPrimary }]}>Editar</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
        <View style={styles.avatar}>
          {profile?.photoBase64
            ? <Image source={{ uri: `data:image/jpeg;base64,${profile.photoBase64}` }} style={styles.avatarImg} />
            : <Text style={styles.avatarText}>{userInitials}</Text>
          }
        </View>
      </Animated.View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: espacioBarra }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Day tabs ────────────────────────────────────────────────────── */}
        {routine.dias.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayTabs}
            style={styles.dayTabsScroll}
          >
            {routine.dias.map(day => {
              const isActive = activeDayId === day.id;
              return (
                <TouchableOpacity
                  key={day.id}
                  style={[styles.dayTab, isActive && [styles.dayTabActive, { shadowColor: colors.primary }]]}
                  onPress={() => setDayId(day.id)}
                  activeOpacity={0.85}
                >
                  {isActive ? (
                    <LinearGradient
                      colors={[colors.primary, colors.primaryShadow]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={styles.dayTabFondo}
                    >
                      <Text style={[styles.dayTabText, { color: colors.textOnPrimary }]}>Día {day.numero}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[styles.dayTabFondo, { backgroundColor: colors.surfaceContainer, borderColor: colors.border, borderWidth: 1 }]}>
                      <Text style={styles.dayTabText}>Día {day.numero}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* ── Day title ───────────────────────────────────────────────────── */}
        <LinearGradient
          colors={[colors.surfaceContainer, colors.surfaceContainerHigh]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.resumenCard, { borderColor: colors.border }]}
        >
          <Text style={styles.dayTitle}>{dayTitle}</Text>
          <View style={styles.dayMetaRow}>
            <MetaItem icon="time-outline"    label={`${estimatedMinutes} min`}         colors={colors} styles={styles} />
            <View style={styles.metaDot} />
            <MetaItem icon="barbell-outline" label={`${exercises.length} ejercicios`}  colors={colors} styles={styles} />
          </View>
          {muscleGroups.length > 0 && (
            <View style={[styles.resumenMusculos, { borderTopColor: colors.border }]}>
              <Text style={[styles.muscleGroups, { color: colors.primary }]}>{muscleGroups.join('  •  ')}</Text>
            </View>
          )}
        </LinearGradient>

        {/* ── Empty day ───────────────────────────────────────────────────── */}
        {exercises.length === 0 && (
          <View style={styles.emptyDay}>
            <Ionicons name="barbell-outline" size={34} color={colors.textTertiary} />
            <Text style={styles.emptyDayText}>Este día no tiene ejercicios</Text>
          </View>
        )}

        {/* ── Exercise cards ──────────────────────────────────────────────── */}
        {exercises.map((ex, index) => {
          const gm = MUSCLE_GROUPS.find(g => g.id === ex.grupoMuscular);
          return (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              groupMeta={gm}
              index={index}
              colors={colors}
              styles={styles}
              savedWeight={savedWeights[ex.id]}
              onPress={() => setSelectedExercise(ex)}
              onWeightPress={() => setWeightModalId(ex.id)}
            />
          );
        })}

      </ScrollView>

      {selectedExercise && (
        <ExerciseVideoModal
          exercise={selectedExercise}
          groupMeta={selectedGroupMeta}
          onClose={() => setSelectedExercise(null)}
          colors={colors}
        />
      )}

      {(() => {
        const modalEx = exercises.find(e => e.id === weightModalId);
        return modalEx ? (
          <SeriesLogModal
            exercise={modalEx}
            savedWeight={savedWeights[modalEx.id]}
            onWeightSave={(value) => saveWeight(modalEx.id, value, false, modalEx.exerciseId, modalEx.nombre)}
            onClose={() => setWeightModalId(null)}
            colors={colors}
          />
        ) : null;
      })()}
    </SafeAreaView>
    </Animated.View>
  );
}

// ── MetaItem ──────────────────────────────────────────────────────────────────
function MetaItem({ icon, label, colors, styles }) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={12} color={colors.textTertiary} />
      <Text style={styles.metaText}>{label}</Text>
    </View>
  );
}

// ── ExerciseCard ──────────────────────────────────────────────────────────────
function ExerciseCard({ exercise, groupMeta, index, colors, styles, savedWeight, onPress, onWeightPress }) {
  const fadeAnim  = useSharedValue(0);
  const scaleAnim = useSharedValue(0.94);

  useEffect(() => {
    fadeAnim.value  = withDelay(index * 75, withTiming(1, { duration: 420 }));
    scaleAnim.value = withDelay(index * 75, withSpring(1, { damping: 20, stiffness: 200 }));
  }, []);

  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ scale: scaleAnim.value }],
  }));

  const displayWeight = savedWeight?.auto
    ? (exercise.carga != null ? exercise.carga : '—')
    : (savedWeight?.value != null ? savedWeight.value : (exercise.carga ?? '—'));

  const hasUserWeight = savedWeight?.value != null && !savedWeight?.auto;

  const maquina = EXERCISE_BY_ID[exercise.exerciseId]?.maquina;
  const conMaquina = maquina && maquina !== 'Ninguna';

  // Tocar la tarjeta abre el registro de series/peso (como antes);
  // solo "Ver Técnica" abre el video.
  return (
    <TouchableOpacity activeOpacity={0.97} onPress={onWeightPress}>
    <Animated.View style={[styles.exCard, { borderColor: colors.border, backgroundColor: colors.surfaceContainer }, cardAnimStyle]}>
      {/* Etiqueta del músculo y número */}
      <LinearGradient colors={[colors.primary + '1F', colors.primary + '00']} style={styles.exArriba}>
        <View style={styles.exTagFila}>
          {groupMeta ? (
            <View style={[styles.exTag, { backgroundColor: colors.primary + '2E', borderColor: colors.primary + '55' }]}>
              <Ionicons name={groupMeta.icon} size={11} color={colors.primary} />
              <Text style={[styles.exTagText, { color: colors.primary }]}>{groupMeta.label.toUpperCase()}</Text>
            </View>
          ) : <View />}
          <Text style={styles.exNumero}>#{String(index + 1).padStart(2, '0')}</Text>
        </View>

        {/* Imagen del ejercicio (la del dataset), con el nombre abajo */}
        <View style={[styles.exImagen, { borderColor: colors.border }]}>
          <Image source={{ uri: getExerciseImage(exercise) }} style={styles.heroImage} resizeMode="contain" />
          <LinearGradient
            colors={[colors.surfaceContainer + '00', colors.surfaceContainer + 'CC', colors.surfaceContainer]}
            locations={[0.45, 0.8, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={styles.exNombreFila}>
            <Text style={styles.exNombre} numberOfLines={2}>{exercise.nombre}</Text>
            {conMaquina && (
              <View style={[styles.exEquipo, { backgroundColor: colors.background + 'CC', borderColor: colors.border }]}>
                <Text style={[styles.exEquipoText, { color: colors.primary }]} numberOfLines={1}>{maquina}</Text>
              </View>
            )}
          </View>
        </View>
      </LinearGradient>

      {/* Series, reps, descanso, peso */}
      <View style={[styles.exGrilla, { borderColor: colors.border, backgroundColor: colors.surfaceContainerHigh }]}>
        {[
          { label: 'Series',   value: exercise.series,         unit: null },
          { label: 'Reps',     value: exercise.repeticiones,   unit: null },
          { label: 'Descanso', value: exercise.descanso ?? 90, unit: 's' },
        ].map(stat => (
          <View key={stat.label} style={[styles.exCelda, { borderRightColor: colors.border }]}>
            <Text style={styles.statLabel}>{stat.label}</Text>
            <View style={styles.statValueRow}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{stat.value}</Text>
              {stat.unit && <Text style={styles.statUnit}>{stat.unit}</Text>}
            </View>
          </View>
        ))}
        <TouchableOpacity style={[styles.exCelda, { borderRightWidth: 0 }]} onPress={onWeightPress} activeOpacity={0.7}>
          <Text style={styles.statLabel}>PESO</Text>
          <View style={styles.statValueRow}>
            <Text style={[styles.statValue, { color: hasUserWeight ? colors.primary : colors.textTertiary }]}>{displayWeight}</Text>
            {displayWeight !== '—' && <Text style={styles.statUnit}>kg</Text>}
            <Ionicons name="create-outline" size={11} color={colors.primary} style={{ marginLeft: 3 }} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Ver Técnica */}
      <View style={styles.exPie}>
        <TouchableOpacity
          style={[styles.exTecnica, { backgroundColor: colors.primary + '1A', borderColor: colors.primary + '40' }]}
          onPress={onPress}
          activeOpacity={0.82}
        >
          <Ionicons name="body-outline" size={16} color={colors.primary} />
          <Text style={[styles.cardVideoBtnText, { color: colors.primary }]}>Ver Técnica</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
    </TouchableOpacity>
  );
}

// ── SeriesLogModal ────────────────────────────────────────────────────────────
const SCREEN_H = Dimensions.get('window').height;

function SeriesLogModal({ exercise, savedWeight, onWeightSave, onClose, colors }) {
  const totalSeries  = exercise.series ?? 4;
  const targetReps   = Number(exercise.repeticiones) || 12;
  const neon         = colors.primary;
  const groupMeta    = MUSCLE_GROUPS.find(g => g.id === exercise.grupoMuscular);

  const [currentSeries, setCurrentSeries] = useState(1);
  const [weight, setWeight] = useState(
    savedWeight?.value != null ? savedWeight.value : (exercise.carga ?? 0)
  );
  const [weightInput, setWeightInput] = useState(() => {
    const v = savedWeight?.value != null ? savedWeight.value : (exercise.carga ?? 0);
    return v > 0 ? String(v) : '';
  });
  const [reps, setReps] = useState(targetReps);

  const slideAnim  = useSharedValue(SCREEN_H);
  const slideStyle = useAnimatedStyle(() => ({ transform: [{ translateY: slideAnim.value }] }));
  const insets     = useSafeAreaInsets();

  useEffect(() => {
    slideAnim.value = withTiming(0, { duration: 340, easing: Easing.out(Easing.cubic) });
  }, []);

  const dismiss = useCallback(() => {
    if (weight > 0) onWeightSave(weight);
    slideAnim.value = withTiming(SCREEN_H, { duration: 280, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  }, [weight, onWeightSave, onClose]);

  const adjustWeight = useCallback((delta) => {
    setWeight(w => {
      const next = Math.max(0, Number(((w || 0) + delta).toFixed(1)));
      setWeightInput(next > 0 ? String(next) : '');
      return next;
    });
  }, []);

  const handleWeightChange = useCallback((text) => {
    const clean = text.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, '$1');
    setWeightInput(clean);
    const parsed = parseFloat(clean);
    setWeight(!isNaN(parsed) && parsed >= 0 ? parsed : 0);
  }, []);

  const handleWeightBlur = useCallback(() => {
    setWeightInput(w => {
      const parsed = parseFloat(w);
      return !isNaN(parsed) && parsed > 0 ? String(parsed) : '';
    });
  }, []);

  const adjustReps = useCallback((delta) => {
    setReps(r => Math.max(1, r + delta));
  }, []);

  const handleSaveSeries = useCallback(() => {
    if (weight > 0) onWeightSave(weight);
    if (currentSeries < totalSeries) {
      setCurrentSeries(s => s + 1);
      setReps(targetReps);
    } else {
      slideAnim.value = withTiming(SCREEN_H, { duration: 280, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(onClose)();
      });
    }
  }, [currentSeries, totalSeries, weight, targetReps, onWeightSave, onClose]);

  const hintText = currentSeries === 1
    ? 'Listo para registrar tu primera serie.'
    : `Serie ${currentSeries - 1} completada ✓  ¡Seguí así!`;

  return (
    <Modal visible animationType="none" onRequestClose={dismiss} statusBarTranslucent transparent navigationBarTranslucent>
      <Animated.View style={[slSt.root, slideStyle]}>
        <ScrollView bounces={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom }}>

          {/* ── Hero ── */}
          <View style={slSt.hero}>
            <Image
              source={{ uri: getExerciseGif(exercise) || getExerciseImage(exercise) }}
              style={slSt.heroImg}
              resizeMode="contain"
            />
            <View style={slSt.heroBottomFade} pointerEvents="none" />

            {/* Top row */}
            <View style={[slSt.heroTop, { paddingTop: insets.top + 14 }]}>
              <TouchableOpacity style={slSt.circleBtn} onPress={dismiss} hitSlop={8}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>

              {groupMeta && (
                <View style={[slSt.badge, { borderColor: neon, backgroundColor: neon + '33' }]}>
                  <Ionicons name={groupMeta.icon} size={11} color={neon} />
                  <Text style={[slSt.badgeText, { color: neon }]}>
                    {groupMeta.label.toUpperCase()}
                  </Text>
                </View>
              )}

              <View style={{ width: 38 }} />
            </View>

            {/* Exercise name */}
            <View style={slSt.heroBottom}>
              <View style={slSt.accentRow}>
                <View style={[slSt.accentLine, { backgroundColor: neon }]} />
                <Text style={slSt.heroCategory}>
                  {groupMeta ? `${groupMeta.label.toUpperCase()} · TREN` : 'EJERCICIO'}
                </Text>
              </View>
              <Text style={slSt.heroTitle}>{exercise.nombre}</Text>
              <Text style={slSt.heroDesc}>
                {exercise.observaciones ?? 'Controlá la técnica en cada repetición'}
              </Text>
            </View>
          </View>

          {/* ── Stats row ── */}
          <View style={slSt.statsRow}>
            {[
              { icon: 'layers-outline',  label: 'Series',   val: totalSeries,              sub: 'Totales'  },
              { icon: 'refresh-outline', label: 'Reps',     val: exercise.repeticiones ?? 12, sub: 'Por serie' },
              { icon: 'time-outline',    label: 'Descanso', val: exercise.descanso ?? 90,  sub: 'Seg'      },
            ].map((s, i) => (
              <View key={s.label} style={[slSt.statCol, i > 0 && slSt.statBorder]}>
                <View style={slSt.statLabelRow}>
                  <Ionicons name={s.icon} size={13} color="#555" />
                  <Text style={slSt.statLabelTxt}>{s.label}</Text>
                </View>
                <View style={slSt.statValRow}>
                  <Text style={slSt.statVal}>{s.val}</Text>
                  <Text style={slSt.statSub}>{s.sub}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* ── Registration card ── */}
          <View style={slSt.cardWrap}>
            <View style={slSt.card}>

              {/* Header */}
              <View style={slSt.cardHeader}>
                <Text style={slSt.cardTitle}>REGISTRAR SERIE</Text>
                <Text style={slSt.seriesCounter}>
                  <Text style={{ color: neon }}>{currentSeries}</Text>
                  {' / '}{totalSeries}
                </Text>
              </View>

              {/* Progress bar */}
              <View style={slSt.progressRow}>
                {Array.from({ length: totalSeries }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      slSt.progressSeg,
                      i < currentSeries && { backgroundColor: neon },
                    ]}
                  />
                ))}
              </View>

              {/* Controls: Peso + Reps */}
              <View style={slSt.controlsRow}>

                {/* Weight */}
                <View style={[slSt.control, { borderColor: neon + '30' }]}>
                  <Text style={slSt.controlLabel}>PESO</Text>
                  <View style={slSt.controlInner}>
                    <TouchableOpacity style={slSt.adjBtn} onPress={() => adjustWeight(-2.5)}>
                      <Ionicons name="remove" size={16} color="#ccc" />
                    </TouchableOpacity>
                    <View style={slSt.centerVal}>
                      <TextInput
                        style={slSt.controlInput}
                        value={weightInput}
                        onChangeText={handleWeightChange}
                        onBlur={handleWeightBlur}
                        keyboardType="decimal-pad"
                        returnKeyType="done"
                        placeholder="0"
                        placeholderTextColor="#555"
                        selectTextOnFocus
                      />
                      <Text style={slSt.controlUnit}>kg</Text>
                    </View>
                    <TouchableOpacity style={slSt.adjBtn} onPress={() => adjustWeight(2.5)}>
                      <Ionicons name="add" size={16} color="#ccc" />
                    </TouchableOpacity>
                  </View>
                  <Text style={slSt.controlHint}>Elegí tu carga</Text>
                </View>

                {/* Reps */}
                <View style={[slSt.control, { borderColor: 'rgba(255,255,255,0.06)' }]}>
                  <Text style={slSt.controlLabel}>REPETICIONES</Text>
                  <View style={slSt.controlInner}>
                    <TouchableOpacity style={slSt.adjBtn} onPress={() => adjustReps(-1)}>
                      <Ionicons name="remove" size={16} color="#ccc" />
                    </TouchableOpacity>
                    <View style={slSt.centerVal}>
                      <Text style={slSt.controlNum}>{reps}</Text>
                      <Text style={slSt.controlUnit}>reps</Text>
                    </View>
                    <TouchableOpacity style={slSt.adjBtn} onPress={() => adjustReps(1)}>
                      <Ionicons name="add" size={16} color="#ccc" />
                    </TouchableOpacity>
                  </View>
                  <Text style={slSt.controlHint}>Objetivo por serie</Text>
                </View>

              </View>

              {/* Save button */}
              <TouchableOpacity
                style={[slSt.saveBtn, { backgroundColor: neon }]}
                onPress={handleSaveSeries}
                activeOpacity={0.88}
              >
                <Ionicons name="checkmark" size={20} color="#000" />
                <Text style={slSt.saveBtnText}>
                  {currentSeries < totalSeries ? 'GUARDAR SERIE' : 'FINALIZAR'}
                </Text>
              </TouchableOpacity>

              <Text style={slSt.hintText}>{hintText}</Text>
            </View>
          </View>

        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const slSt = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0c0c0c' },

  // Hero
  hero:           { height: 290, position: 'relative', backgroundColor: '#fff', overflow: 'hidden' },
  heroImg:        { width: '100%', height: '100%' },
  heroBottomFade: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 130,
    backgroundColor: 'rgba(12,12,12,0.72)',
  },
  heroTop: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18,
  },
  circleBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 99, borderWidth: 1,
  },
  badgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  heroBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
    paddingHorizontal: 20, paddingBottom: 20,
  },
  accentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  accentLine: { width: 22, height: 3, borderRadius: 2 },
  heroCategory: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.45)', letterSpacing: 2 },
  heroTitle: { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -0.4, marginBottom: 5 },
  heroDesc:  { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },

  // Stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 22, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  statCol:      { flex: 1 },
  statBorder:   { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.08)', paddingLeft: 14 },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  statLabelTxt: { fontSize: 10, fontWeight: '700', color: '#555', textTransform: 'uppercase', letterSpacing: 0.6 },
  statValRow:   { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  statVal:      { fontSize: 22, fontWeight: '700', color: '#fff' },
  statSub:      { fontSize: 10, fontWeight: '700', color: '#555', textTransform: 'uppercase' },

  // Card
  cardWrap: { padding: 14, paddingBottom: 48 },
  card: {
    backgroundColor: '#151515',
    borderRadius: 30,
    padding: 22,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 18,
  },
  cardTitle:     { fontSize: 10, fontWeight: '700', color: '#555', letterSpacing: 2 },
  seriesCounter: { fontSize: 10, fontWeight: '700', color: '#fff', letterSpacing: 2 },

  // Progress
  progressRow: { flexDirection: 'row', gap: 7, marginBottom: 24 },
  progressSeg: {
    flex: 1, height: 4, borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  // Controls
  controlsRow: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  control: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1, borderRadius: 22,
    paddingVertical: 16, paddingHorizontal: 10,
    alignItems: 'center',
  },
  controlLabel: { fontSize: 9, fontWeight: '800', color: '#555', letterSpacing: 1.8, marginBottom: 12 },
  controlInner: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', width: '100%',
  },
  adjBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  centerVal: { alignItems: 'center', flex: 1 },
  emptyLine: { width: 22, height: 3, borderRadius: 2, marginBottom: 5 },
  controlNum:  { fontSize: 28, fontWeight: '800', color: '#fff', lineHeight: 32 },
  controlInput: {
    fontSize: 28, fontWeight: '800', color: '#fff',
    textAlign: 'center', minWidth: 72, padding: 0,
    includeFontPadding: false,
  },
  controlUnit: { fontSize: 9, fontWeight: '700', color: '#555', marginTop: 3, letterSpacing: 0.6 },
  controlHint: { fontSize: 9, color: '#444', marginTop: 12, fontWeight: '500' },

  // Save
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 18, marginBottom: 14,
  },
  saveBtnText: { fontSize: 14, fontWeight: '900', color: '#000', letterSpacing: 0.8 },
  hintText:    { fontSize: 11, color: '#444', textAlign: 'center', fontWeight: '500' },
});

// ── ExerciseVideoModal ────────────────────────────────────────────────────────
function ExerciseVideoModal({ exercise, groupMeta, onClose, colors }) {
  const slideAnim = useSharedValue(500);
  const fadeAnim  = useSharedValue(0);
  const insets    = useSafeAreaInsets();

  const backdropStyle = useAnimatedStyle(() => ({ opacity: fadeAnim.value }));
  const sheetStyle    = useAnimatedStyle(() => ({ transform: [{ translateY: slideAnim.value }] }));

  useEffect(() => {
    slideAnim.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) });
    fadeAnim.value  = withTiming(1, { duration: 260 });
  }, []);

  const dismiss = useCallback(() => {
    slideAnim.value = withTiming(500, { duration: 240, easing: Easing.in(Easing.cubic) });
    fadeAnim.value  = withTiming(0, { duration: 240 }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  }, [onClose]);

  return (
    <Modal transparent visible animationType="none" onRequestClose={dismiss} statusBarTranslucent navigationBarTranslucent>
      <Animated.View style={[vmSt.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={dismiss} />
        <Animated.View
          style={[
            vmSt.sheet,
            { backgroundColor: colors.surfaceContainer, paddingBottom: insets.bottom + 20 },
            sheetStyle,
          ]}
        >
          <Pressable onPress={() => {}}>
            {/* Handle */}
            <View style={vmSt.handle}>
              <View style={[vmSt.handleBar, { backgroundColor: colors.borderLight }]} />
            </View>

            {/* Photo / GIF */}
            <View style={vmSt.imageWrap}>
              <Image
                source={{ uri: getExerciseGif(exercise) || getExerciseImage(exercise) }}
                style={vmSt.vmImage}
                resizeMode="contain"
              />
              <View style={vmSt.imageFade} pointerEvents="none" />
              {groupMeta && (
                <View style={[vmSt.groupBadge, { backgroundColor: colors.primary }]}>
                  <Ionicons name={groupMeta.icon} size={11} color={colors.textInverse} />
                  <Text style={[vmSt.groupBadgeText, { color: colors.textInverse }]}>
                    {groupMeta.label}
                  </Text>
                </View>
              )}
              <TouchableOpacity style={vmSt.closeBtn} onPress={dismiss} hitSlop={12}>
                <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.9)" />
              </TouchableOpacity>
            </View>

            {/* Info + action */}
            <View style={vmSt.body}>
              <Text style={[vmSt.exerciseName, { color: colors.text }]} numberOfLines={2}>
                {exercise.nombre}
              </Text>
              <Text style={[vmSt.exerciseMeta, { color: colors.textSecondary }]}>
                {exercise.series} series · {exercise.repeticiones} reps
                {exercise.carga ? ` · ${exercise.carga} kg` : ''}
                {exercise.observaciones ? `  —  ${exercise.observaciones}` : ''}
              </Text>

            </View>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const vmSt = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.68)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  handle: { paddingTop: 12, paddingBottom: 6, alignItems: 'center' },
  handleBar: { width: 38, height: 4, borderRadius: 2 },
  imageWrap: { height: 210, backgroundColor: '#fff', overflow: 'hidden' },
  vmImage:   { width: '100%', height: '100%' },
  imageFade: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  groupBadge: {
    position: 'absolute', bottom: 14, left: 16,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99,
  },
  groupBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  closeBtn: { position: 'absolute', top: 12, right: 12 },
  body: { padding: 20, gap: 14 },
  exerciseName: { fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  exerciseMeta: { fontSize: 13, fontWeight: '600', lineHeight: 18, marginTop: -4 },
});

// ── Styles ────────────────────────────────────────────────────────────────────
function makeStyles(colors) {
  return StyleSheet.create({
    container:   { flex: 1, backgroundColor: colors.background },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    // Header
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 10,
    },
    headerLeft:  { flex: 1 },
    headerTitle: { fontSize: 26, fontWeight: '900', color: colors.text, letterSpacing: -0.7 },
    headerSub:   { fontSize: typography.sizes.xs, color: colors.primary, fontWeight: '700', letterSpacing: 0.2, marginTop: 1 },
    avatar: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.primaryDim12, borderWidth: 2, borderColor: colors.primary,
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    },
    avatarImg:  { width: 40, height: 40, borderRadius: 20 },
    avatarText: { fontSize: 14, fontWeight: '900', color: colors.primary },

    // Scroll
    scroll:        { flex: 1 },
    scrollContent: { paddingHorizontal: spacing.lg },

    // Day tabs
    dayTabsScroll: { marginHorizontal: -spacing.lg, marginBottom: 16 },
    dayTabs:       { paddingHorizontal: spacing.lg, paddingVertical: 6, flexDirection: 'row', gap: 8 },
    // El fondo lo pone dayTabFondo (degradé si está elegido).
    dayTab: { borderRadius: radius.full },
    // Brillo del día elegido: en iOS con sombra de color; en Android la
    // elevation sin fondo propio dibujaba un rectángulo oscuro.
    dayTabActive: {
      shadowOpacity: 0.55, shadowRadius: 10, shadowOffset: { width: 0, height: 2 },
    },
    dayTabFondo: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 999, alignItems: 'center' },
    dayTabText:   { fontSize: 13, fontWeight: '700', color: colors.textSecondary },

    // Day section
    daySection:   { marginBottom: 18 },
    resumenCard:  { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 18 },
    resumenMusculos: { borderTopWidth: 1, marginTop: 6, paddingTop: 10 },
    exCard: {
      borderRadius: 18, borderWidth: 1, overflow: 'hidden', marginBottom: 16,
      shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 3,
    },
    exArriba:    { paddingTop: 12, paddingHorizontal: 14, paddingBottom: 10 },
    exTagFila:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    exTag:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7, borderWidth: 1 },
    exTagText:   { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
    exNumero:    { fontSize: 11, fontWeight: '700', color: colors.textTertiary, fontVariant: ['tabular-nums'] },
    exImagen:    { height: 170, borderRadius: 13, overflow: 'hidden', borderWidth: 1, backgroundColor: '#fff' },
    exNombreFila: { position: 'absolute', left: 12, right: 12, bottom: 10, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
    exNombre:    { flex: 1, fontSize: 17, fontWeight: '800', color: colors.text },
    exEquipo:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, maxWidth: '45%' },
    exEquipoText: { fontSize: 11, fontWeight: '700' },
    exGrilla:    { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 12 },
    exCelda:     { flex: 1, alignItems: 'center', borderRightWidth: 1 },
    exPie:       { padding: 10 },
    exTecnica:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, borderRadius: 13, borderWidth: 1 },
    dayTitle:     { fontSize: 23, fontWeight: '900', color: colors.text, letterSpacing: -0.5, marginBottom: 8 },
    dayMetaRow:   { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
    metaItem:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText:     { fontSize: 12, color: colors.textTertiary, fontWeight: '600' },
    metaDot:      { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.textTertiary, opacity: 0.4 },
    muscleGroups: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },

    // Empty
    emptyDay:     { alignItems: 'center', paddingVertical: 48, gap: 10 },
    emptyDayText: { fontSize: typography.sizes.base, color: colors.textTertiary, fontWeight: '600' },
    emptyWrap:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },
    emptyIconWrap: {
      width: 80, height: 80, borderRadius: 40,
      alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    },
    emptyTitle: { fontSize: 22, fontWeight: '900', color: colors.text, textAlign: 'center' },
    emptySub:   { fontSize: typography.sizes.base, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
    armarBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
      borderRadius: radius.full, marginTop: spacing.lg,
    },
    armarBtnText: { fontSize: typography.sizes.base, fontWeight: '800' },
    gymBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
      borderRadius: radius.full, borderWidth: 1, marginTop: spacing.md,
    },
    // Pastilla "Rutinas": secundaria al lado de Editar (borde y fondo suave).
    rutinasGymBtn: {
      height: 40, borderRadius: 20, borderWidth: 1, marginRight: 8,
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingLeft: 6, paddingRight: 12,
    },
    rutinasGymIcono: {
      width: 26, height: 26, borderRadius: 13,
      alignItems: 'center', justifyContent: 'center',
    },
    rutinasGymText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },
    // Pastilla de la misma altura que el avatar: degradé del color de acento,
    // lápiz en un círculo claro y brillo.
    editarBtn: {
      height: 40, borderRadius: 20, marginRight: 10,
      shadowOpacity: 0.55, shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
      elevation: 6,
    },
    editarBtnFondo: {
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7,
      paddingLeft: 5, paddingRight: 15, borderRadius: 20,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    },
    editarIcono: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.92)',
      alignItems: 'center', justifyContent: 'center',
    },
    editarBtnText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },

    // Hero card — outer has shadow, inner clips
    heroOuter: {
      borderRadius: radius.xl + 2,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
      elevation: 6,
      backgroundColor: colors.surfaceContainer,
    },
    heroInner: {
      borderRadius: radius.xl,
      overflow: 'hidden',
      borderWidth: 1,
    },
    heroImageWrap: { height: 130, backgroundColor: '#fff', overflow: 'hidden' },
    heroImage: { width: '100%', height: '100%' },
    heroImageBottomFade: {
      position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    heroBadge: {
      position: 'absolute', top: 10, left: 10,
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full,
    },
    heroBadgeText: { fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
    heroTitleWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10 },
    heroName: {
      fontSize: 17, fontWeight: '900', color: '#fff', letterSpacing: -0.2,
      textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6,
    },

    // Stats
    statsGrid: { flexDirection: 'row', borderTopWidth: 1 },
    statCell: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingVertical: 10, borderRightWidth: 1,
    },
    statLabel: {
      fontSize: 7, fontWeight: '700', color: colors.textTertiary,
      textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3,
    },
    statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
    statValue:    { fontSize: 17, fontWeight: '900', letterSpacing: -0.5 },
    statUnit:     { fontSize: 9, color: colors.textTertiary, fontWeight: '700' },

    // Ver Ejercicio (inside card)
    cardVideoBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 11, borderTopWidth: 1,
    },
    cardVideoBtnText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
  });
}