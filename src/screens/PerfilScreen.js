import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Modal,
  Pressable,
  ActivityIndicator,
  Image,
  TextInput,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { typography, spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';
import ProgressRing from '../components/ui/ProgressRing';
import { weeklyStats, weightHistory } from '../constants/mockData';
import useAuth from '../hooks/useAuth';
import useUserProfile from '../hooks/useUserProfile';
import { updateUserProfile } from '../services/userService';
import { getSocioByDni } from '../services/gymService';

const { width } = Dimensions.get('window');
const BAR_MAX_HEIGHT = 80;
const DRAWER_WIDTH = Math.min(width * 0.78, 300);

const OBJETIVO_LABEL = {
  bajar_grasa:   'Bajar grasa',
  ganar_musculo: 'Ganar músculo',
  mantener:      'Mantener',
  hipertrofia:   'Hipertrofia',
  perdida_peso:  'Pérdida de peso',
  fuerza:        'Fuerza',
  resistencia:   'Resistencia',
  mantenimiento: 'Mantenimiento',
};

const NIVEL_LABEL = {
  principiante: 'Principiante',
  intermedio:   'Intermedio',
  avanzado:     'Avanzado',
};

function calcEdad(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const parts = fechaNacimiento.split('/');
  if (parts.length !== 3) return null;
  const [dia, mes, anio] = parts.map(Number);
  if (!dia || !mes || !anio || anio < 1900) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - anio;
  if (hoy.getMonth() + 1 < mes || (hoy.getMonth() + 1 === mes && hoy.getDate() < dia)) edad--;
  return edad > 0 ? edad : null;
}

export default function PerfilScreen({ navigation }) {
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user: authUser } = useAuth();
  const { profile, loading } = useUserProfile();
  const [activeTab, setActiveTab]     = useState('stats');
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const slideAnim    = useSharedValue(DRAWER_WIDTH);
  const fadeAnim     = useSharedValue(0);
  const screenOpacity = useSharedValue(0);
  const screenStyle   = useAnimatedStyle(() => ({ flex: 1, opacity: screenOpacity.value }));

  useEffect(() => {
    screenOpacity.value = withTiming(1, { duration: 280 });
  }, []);

  // Datos reales del perfil
  const nombre   = profile?.nombre   ?? '';
  const apellido = profile?.apellido ?? '';
  const initials = ((nombre[0] ?? '') + (apellido[0] ?? '')).toUpperCase() || '?';
  const photoUri = profile?.photoBase64
    ? `data:image/jpeg;base64,${profile.photoBase64}`
    : null;

  const nivelJuego  = profile?.nivelJuego ?? 1;
  const xp          = profile?.xp         ?? 0;
  const xpRequired  = nivelJuego * 1000;
  const xpPercent   = xpRequired > 0 ? Math.min(Math.round((xp / xpRequired) * 100), 100) : 0;
  const monedas     = profile?.monedas    ?? 0;
  const racha       = profile?.racha      ?? 0;

  const edad  = calcEdad(profile?.fechaNacimiento);
  const sexo  = profile?.sexo
    ? (profile.sexo === 'masculino' ? 'Masc.' : 'Fem.')
    : '--';
  const peso   = profile?.peso   ? `${profile.peso}kg`   : '--';
  const altura = profile?.altura ? `${profile.altura}cm` : '--';

  const objetivoLabel = OBJETIVO_LABEL[profile?.objetivo] ?? profile?.objetivo ?? '--';
  const nivelLabel    = NIVEL_LABEL[profile?.nivelFitness] ?? profile?.nivelFitness ?? '';
  const goalLine      = [objetivoLabel, nivelLabel].filter(Boolean).join(' · ');

  async function handlePhotoTap() {
    Alert.alert('Foto de perfil', '¿Qué querés hacer?', [
      {
        text: 'Elegir de la galería',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Permisos', 'Se necesitan permisos para acceder a la galería.'); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.3, base64: true });
          if (!result.canceled && result.assets?.[0]?.base64 && authUser?.uid) {
            await updateUserProfile(authUser.uid, { photoBase64: result.assets[0].base64 });
          }
        },
      },
      {
        text: 'Sacar una foto',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Permisos', 'Se necesitan permisos para usar la cámara.'); return; }
          const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.3, base64: true });
          if (!result.canceled && result.assets?.[0]?.base64 && authUser?.uid) {
            await updateUserProfile(authUser.uid, { photoBase64: result.assets[0].base64 });
          }
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
    slideAnim.value = withSpring(0, { damping: 26, stiffness: 300, mass: 0.6 });
    fadeAnim.value  = withTiming(1, { duration: 200 });
  }, [slideAnim, fadeAnim]);

  const closeDrawer = useCallback((cb) => {
    const onFinish = () => {
      setDrawerOpen(false);
      cb?.();
    };
    slideAnim.value = withTiming(DRAWER_WIDTH, { duration: 200, easing: Easing.in(Easing.cubic) });
    fadeAnim.value  = withTiming(0, { duration: 180 }, (finished) => {
      'worklet';
      if (finished) runOnJS(onFinish)();
    });
  }, [slideAnim, fadeAnim]);

  return (
    <Animated.View style={screenStyle}>
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Drawer lateral ── */}
      <SideDrawer
        visible={drawerOpen}
        slideAnim={slideAnim}
        fadeAnim={fadeAnim}
        onClose={closeDrawer}
        onMedidas={() => navigation.navigate('BodyMeasurements')}
        onAspecto={() => navigation.navigate('Aspecto')}
        onGym={() => navigation.navigate('Gym')}
        photoUri={photoUri}
        nombre={nombre}
        apellido={apellido}
        initials={initials}
      />

      {/* ── Modal editar medidas ── */}
      <EditMedidasModal
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        uid={authUser?.uid}
        initialPeso={profile?.peso ?? ''}
        initialAltura={profile?.altura ?? ''}
        fechaNacimiento={profile?.fechaNacimiento}
        edad={edad}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mi Perfil</Text>
          <TouchableOpacity style={styles.menuBtn} onPress={openDrawer} activeOpacity={0.7}>
            <Ionicons name="menu" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* ── Avatar + info básica ── */}
        <View style={styles.profileCard}>
          <View style={styles.avatarBox}>
            <TouchableOpacity style={styles.avatarCircle} onPress={handlePhotoTap} activeOpacity={0.8}>
              {photoUri ? (
                <ProfilePhoto uri={photoUri} />
              ) : (
                <Text style={styles.avatarInitials}>{initials}</Text>
              )}
              <View style={styles.avatarCameraOverlay}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </TouchableOpacity>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>{nivelJuego}</Text>
            </View>
          </View>

          <Text style={styles.profileName}>
            {nombre} {apellido}
          </Text>
          {!!goalLine && <Text style={styles.profileGoal}>{goalLine}</Text>}

          {/* XP Bar */}
          <View style={styles.xpSection}>
            <View style={styles.xpHeader}>
              <Text style={styles.xpLabel}>Nivel {nivelJuego}</Text>
              <Text style={styles.xpValue}>
                {xp.toLocaleString('es-AR')} / {xpRequired.toLocaleString('es-AR')} XP
              </Text>
              <Text style={styles.xpLabel}>Nivel {nivelJuego + 1}</Text>
            </View>
            <View style={styles.xpTrack}>
              <View style={[styles.xpFill, { width: `${xpPercent}%` }]} />
            </View>
          </View>

          {/* Stats de usuario */}
          <View style={styles.userStatsRow}>
            <UserStat label="Peso"   value={peso}   />
            <View style={styles.statDivider} />
            <UserStat label="Altura" value={altura} />
            <View style={styles.statDivider} />
            <UserStat label="Sexo"   value={sexo}   />
            <View style={styles.statDivider} />
            <UserStat label="Edad"   value={edad != null ? `${edad} años` : '--'} />
          </View>
        </View>

        {/* ── Monedas y racha ── */}
        <View style={styles.coinsStreakRow}>
          <View style={styles.coinsCard}>
            <Text style={styles.coinsIcon}>🪙</Text>
            <Text style={styles.coinsValue}>{monedas.toLocaleString('es-AR')}</Text>
            <Text style={styles.coinsLabel}>Monedas</Text>
          </View>
          <View style={styles.coinsCard}>
            <Text style={styles.coinsIcon}>🔥</Text>
            <Text style={styles.coinsValue}>{racha}</Text>
            <Text style={styles.coinsLabel}>Días de racha</Text>
          </View>
          <View style={styles.coinsCard}>
            <View style={styles.miniRing}>
              <ProgressRing
                progress={xpPercent}
                radius={26}
                strokeWidth={5}
                color={colors.primary}
                trackColor={colors.surfaceActive}
              >
                <Text style={styles.miniRingText}>{xpPercent}%</Text>
              </ProgressRing>
            </View>
            <Text style={styles.coinsLabel}>Nivel {nivelJuego}</Text>
          </View>
        </View>

        {/* ── Tabs ── */}
        <View style={styles.tabs}>
          {[
            { key: 'stats',   label: 'Stats'    },
            { key: 'peso',    label: 'Peso'     },
            { key: 'medidas', label: 'Medidas'  },
            { key: 'gym',     label: 'Gym'      },
          ].map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.tab, activeTab === key && styles.tabActive]}
              onPress={() => setActiveTab(key)}
            >
              <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Contenido del tab ── */}
        {activeTab === 'stats' && <StatsTab />}
        {activeTab === 'peso' && <PesoTab />}
        {activeTab === 'medidas' && (
          <MedidasTab
            profile={profile}
            edad={edad}
            onEdit={() => setEditVisible(true)}
          />
        )}
        {activeTab === 'gym' && (
          <GymTab uid={authUser?.uid} profile={profile} />
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
    </Animated.View>
  );
}

const TRAIN_OPTIONS = [
  { label: '30 min',  value: 30  },
  { label: '45 min',  value: 45  },
  { label: '1 h',     value: 60  },
  { label: '1h 15',   value: 75  },
  { label: '1h 30',   value: 90  },
  { label: '1h 45',   value: 105 },
  { label: '2 h',     value: 120 },
  { label: '2h 30',   value: 150 },
];

function formatVen(ts) {
  if (!ts?.toDate) return null;
  return ts.toDate().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function GymTab({ uid, profile }) {
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [dniInput, setDniInput]     = useState('');
  const [linking, setLinking]       = useState(false);
  const [socioData, setSocioData]   = useState(null);
  const [loadingSocio, setLoadingSocio] = useState(false);

  const linkedDni    = profile?.gymDni ?? null;
  const trainMinutes = profile?.gymTrainMinutes ?? 60;

  // Load socio data when tab mounts (if already linked)
  React.useEffect(() => {
    if (!linkedDni) return;
    setLoadingSocio(true);
    getSocioByDni(linkedDni)
      .then(setSocioData)
      .catch(() => setSocioData(null))
      .finally(() => setLoadingSocio(false));
  }, [linkedDni]);

  async function handleLink() {
    const trimmed = dniInput.trim();
    if (!trimmed || !uid) return;
    setLinking(true);
    try {
      const socio = await getSocioByDni(trimmed);
      if (!socio) {
        Alert.alert('No encontrado', 'No hay ningún socio con ese DNI en el gimnasio.');
        return;
      }
      await updateUserProfile(uid, { gymDni: trimmed });
      setSocioData(socio);
      setDniInput('');
    } catch {
      Alert.alert('Error', 'No se pudo vincular el DNI. Intentá de nuevo.');
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlink() {
    Alert.alert('Desvincular DNI', '¿Querés desvincular tu cuenta del gimnasio?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desvincular',
        style: 'destructive',
        onPress: async () => {
          await updateUserProfile(uid, { gymDni: null });
          setSocioData(null);
        },
      },
    ]);
  }

  async function handleTrainTime(minutes) {
    if (!uid) return;
    await updateUserProfile(uid, { gymTrainMinutes: minutes });
  }

  const isVencido = socioData?.estado === 'VENCIDO';
  const estadoColor = isVencido ? '#EF4444' : '#22C55E';

  return (
    <View>
      {/* ── Vinculación DNI ── */}
      <Text style={styles.tabSectionTitle}>Mi cuenta del gimnasio</Text>

      {loadingSocio ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} />
      ) : linkedDni && socioData ? (
        <View style={[styles.medidasList, { marginBottom: spacing.lg }]}>
          <View style={styles.medidasRow}>
            <Text style={styles.medidasRowEmoji}>👤</Text>
            <Text style={styles.medidasRowLabel}>Nombre</Text>
            <Text style={styles.medidasRowValue}>{socioData.nombre}</Text>
          </View>
          <View style={styles.medidasRowDivider} />
          <View style={styles.medidasRow}>
            <Text style={styles.medidasRowEmoji}>🪪</Text>
            <Text style={styles.medidasRowLabel}>DNI</Text>
            <Text style={styles.medidasRowValue}>{linkedDni}</Text>
          </View>
          <View style={styles.medidasRowDivider} />
          <View style={styles.medidasRow}>
            <Text style={styles.medidasRowEmoji}>{isVencido ? '❌' : '✅'}</Text>
            <Text style={styles.medidasRowLabel}>Cuota</Text>
            <Text style={[styles.medidasRowValue, { color: estadoColor, fontWeight: '700' }]}>
              {isVencido ? 'Vencida' : 'Al día'}
            </Text>
          </View>
          {socioData.fechaVencimiento && (
            <>
              <View style={styles.medidasRowDivider} />
              <View style={styles.medidasRow}>
                <Text style={styles.medidasRowEmoji}>📅</Text>
                <Text style={styles.medidasRowLabel}>Vence</Text>
                <Text style={styles.medidasRowValue}>{formatVen(socioData.fechaVencimiento)}</Text>
              </View>
            </>
          )}
          {socioData.ultimaVisita && (
            <>
              <View style={styles.medidasRowDivider} />
              <View style={styles.medidasRow}>
                <Text style={styles.medidasRowEmoji}>🏋️</Text>
                <Text style={styles.medidasRowLabel}>Última visita</Text>
                <Text style={styles.medidasRowValue}>{formatVen(socioData.ultimaVisita)}</Text>
              </View>
            </>
          )}
        </View>
      ) : linkedDni && !socioData ? (
        <View style={[styles.medidasList, { marginBottom: spacing.lg }]}>
          <View style={styles.medidasRow}>
            <Text style={styles.medidasRowEmoji}>🪪</Text>
            <Text style={styles.medidasRowLabel}>DNI vinculado</Text>
            <Text style={styles.medidasRowValue}>{linkedDni}</Text>
          </View>
          <View style={styles.medidasRowDivider} />
          <View style={styles.medidasRow}>
            <Text style={styles.medidasRowEmoji}>⚠️</Text>
            <Text style={[styles.medidasRowLabel, { color: colors.textSecondary }]}>
              Sin datos del gym todavía
            </Text>
          </View>
        </View>
      ) : (
        <View style={[styles.medidasList, { marginBottom: spacing.lg }]}>
          <View style={[styles.medidasRow, { gap: spacing.md }]}>
            <TextInput
              style={[styles.gymDniInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
              value={dniInput}
              onChangeText={v => setDniInput(v.replace(/\D/g, '').slice(0, 8))}
              placeholder="Ingresá tu DNI del gym"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
              maxLength={8}
            />
            <TouchableOpacity
              style={[styles.gymLinkBtn, { backgroundColor: colors.primary }, (!dniInput.trim() || linking) && { opacity: 0.4 }]}
              onPress={handleLink}
              disabled={!dniInput.trim() || linking}
              activeOpacity={0.82}
            >
              {linking
                ? <ActivityIndicator color={colors.textInverse} size="small" />
                : <Text style={[styles.gymLinkBtnText, { color: colors.textInverse }]}>Vincular</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      )}

      {linkedDni && (
        <TouchableOpacity onPress={handleUnlink} style={styles.gymUnlinkBtn} activeOpacity={0.75}>
          <Text style={[styles.gymUnlinkText, { color: colors.textTertiary }]}>Desvincular cuenta del gym</Text>
        </TouchableOpacity>
      )}

      {/* ── Tiempo de entrenamiento ── */}
      <Text style={[styles.tabSectionTitle, { marginTop: spacing.xl }]}>Tiempo habitual de entreno</Text>
      <View style={styles.trainTimeGrid}>
        {TRAIN_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.trainTimeChip,
              { borderColor: colors.border, backgroundColor: colors.surfaceElevated },
              trainMinutes === opt.value && { borderColor: colors.primary, backgroundColor: colors.primaryDim12 },
            ]}
            onPress={() => handleTrainTime(opt.value)}
            activeOpacity={0.75}
          >
            <Text style={[
              styles.trainTimeChipText,
              { color: colors.textSecondary },
              trainMinutes === opt.value && { color: colors.primary, fontWeight: '700' },
            ]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.medidasNote}>
        Usamos este dato para mostrarte estadísticas personalizadas de tu actividad en el gym.
      </Text>
    </View>
  );
}

function StatsTab() {
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const maxSteps = Math.max(...weeklyStats.map((d) => d.steps));

  return (
    <View>
      <Text style={styles.tabSectionTitle}>Pasos esta semana</Text>
      <View style={styles.barsChart}>
        {weeklyStats.map((day, idx) => {
          const barH = Math.round((day.steps / maxSteps) * BAR_MAX_HEIGHT);
          return (
            <View key={idx} style={styles.barCol}>
              <Text style={styles.barValue}>
                {day.steps >= 1000
                  ? `${(day.steps / 1000).toFixed(1)}k`
                  : day.steps}
              </Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { height: barH, backgroundColor: day.trained ? colors.primary : colors.surfaceActive },
                  ]}
                />
              </View>
              <Text style={styles.barDay}>{day.day}</Text>
              {day.trained && <View style={styles.trainedDot} />}
            </View>
          );
        })}
      </View>
      <Text style={styles.chartLegend}>
        🟢 Días con entrenamiento registrado
      </Text>
    </View>
  );
}

function PesoTab() {
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const maxW = Math.max(...weightHistory.map((w) => w.weight));
  const minW = Math.min(...weightHistory.map((w) => w.weight));
  const range = maxW - minW || 1;

  return (
    <View>
      <Text style={styles.tabSectionTitle}>Historial de peso</Text>
      <View style={styles.weightChart}>
        {weightHistory.map((entry, idx) => {
          const yPercent = 1 - (entry.weight - minW) / range;
          return (
            <View key={idx} style={styles.weightCol}>
              <View
                style={[
                  styles.weightDot,
                  idx === weightHistory.length - 1 && styles.weightDotActive,
                  { marginTop: yPercent * 60 },
                ]}
              />
              <Text style={styles.weightValue}>{entry.weight}</Text>
              <Text style={styles.weightDate}>{entry.date}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.weightSummary}>
        <View style={styles.weightSummaryItem}>
          <Text style={styles.weightSummaryLabel}>Inicial</Text>
          <Text style={styles.weightSummaryValue}>{weightHistory[0].weight}kg</Text>
        </View>
        <View style={styles.weightSummaryItem}>
          <Text style={styles.weightSummaryLabel}>Actual</Text>
          <Text style={[styles.weightSummaryValue, { color: colors.primary }]}>
            {weightHistory[weightHistory.length - 1].weight}kg
          </Text>
        </View>
        <View style={styles.weightSummaryItem}>
          <Text style={styles.weightSummaryLabel}>Cambio</Text>
          <Text style={[styles.weightSummaryValue, { color: colors.success }]}>
            -{(weightHistory[0].weight - weightHistory[weightHistory.length - 1].weight).toFixed(1)}kg
          </Text>
        </View>
      </View>
    </View>
  );
}

function MedidasTab({ profile, edad, onEdit }) {
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const sexoDisplay = profile?.sexo
    ? (profile.sexo === 'masculino' ? 'Masculino' : 'Femenino')
    : '--';

  const birthYear = profile?.fechaNacimiento
    ? (profile.fechaNacimiento.split('/')[2] ?? '--')
    : '--';

  const rows = [
    { emoji: '🚶', label: 'Sexo',                value: sexoDisplay,                           editable: false },
    { emoji: '🎂', label: 'Año de nacimiento',   value: birthYear,                             editable: false },
    { emoji: '⚖️', label: 'Peso',                value: profile?.peso   ? `${profile.peso} kg`   : '--', editable: true },
    { emoji: '🧍', label: 'Talla corporal',      value: profile?.altura ? `${profile.altura} cm` : '--', editable: true },
  ];

  return (
    <View>
      <View style={styles.medidasHeader}>
        <Text style={styles.tabSectionTitle}>Medidas corporales</Text>
        <TouchableOpacity style={styles.editMedidaBtn} onPress={onEdit} activeOpacity={0.75}>
          <Ionicons name="create-outline" size={16} color={colors.primary} />
          <Text style={styles.editMedidaText}>Editar</Text>
        </TouchableOpacity>
      </View>

      {/* Lista estilo Health app */}
      <View style={styles.medidasList}>
        {rows.map((row, idx) => (
          <React.Fragment key={idx}>
            <View style={styles.medidasRow}>
              <Text style={styles.medidasRowEmoji}>{row.emoji}</Text>
              <Text style={styles.medidasRowLabel}>{row.label}</Text>
              <Text style={styles.medidasRowValue}>{row.value}</Text>
              {row.editable && (
                <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} style={{ marginLeft: 4 }} />
              )}
            </View>
            {idx < rows.length - 1 && <View style={styles.medidasRowDivider} />}
          </React.Fragment>
        ))}
      </View>

      <Text style={styles.medidasNote}>
        Tus medidas corporales son importantes para calcular tu progreso y metas personalizadas.
      </Text>
    </View>
  );
}

function ProfilePhoto({ uri }) {
  return <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 40 }} />;
}

function EditMedidasModal({ visible, onClose, uid, initialPeso, initialAltura, fechaNacimiento, edad }) {
  const { theme: { colors } } = useTheme();
  const editModalStyles = useMemo(() => makeEditModalStyles(colors), [colors]);
  const [peso,   setPeso]   = useState('');
  const [altura, setAltura] = useState('');
  const [saving, setSaving] = useState(false);

  // Sync when modal opens
  React.useEffect(() => {
    if (visible) {
      setPeso(initialPeso !== '' && initialPeso != null ? String(initialPeso) : '');
      setAltura(initialAltura !== '' && initialAltura != null ? String(initialAltura) : '');
    }
  }, [visible, initialPeso, initialAltura]);

  async function handleSave() {
    if (!uid) return;
    setSaving(true);
    try {
      const updates = {};
      if (peso.trim()   && !isNaN(+peso))   updates.peso   = Number(peso);
      if (altura.trim() && !isNaN(+altura)) updates.altura = Number(altura);
      if (Object.keys(updates).length > 0) await updateUserProfile(uid, updates);
      onClose();
    } catch {
      Alert.alert('Error', 'No se pudo guardar. Intentá de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable style={editModalStyles.backdrop} onPress={onClose} />
      <View style={editModalStyles.sheet}>
        <View style={editModalStyles.handle} />
        <Text style={editModalStyles.title}>Editar medidas</Text>

        <View style={editModalStyles.row}>
          <EditField label="Peso (kg)" value={peso} onChangeText={setPeso} placeholder={String(initialPeso || '93')} keyboardType="decimal-pad" />
          <View style={{ width: 12 }} />
          <EditField label="Altura (cm)" value={altura} onChangeText={setAltura} placeholder={String(initialAltura || '190')} keyboardType="numeric" />
        </View>

        {/* Edad — solo lectura */}
        <View style={editModalStyles.readOnlyRow}>
          <Ionicons name="calendar-outline" size={16} color={colors.textTertiary} />
          <Text style={editModalStyles.readOnlyText}>
            Edad: <Text style={editModalStyles.readOnlyValue}>{edad != null ? `${edad} años` : '--'}</Text>
            {'  ·  '}
            <Text style={editModalStyles.readOnlyHint}>Se actualiza automáticamente con tu fecha de nacimiento</Text>
          </Text>
        </View>

        <TouchableOpacity
          style={[editModalStyles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.82}
        >
          {saving
            ? <ActivityIndicator color={colors.textInverse} />
            : <Text style={editModalStyles.saveBtnText}>Guardar cambios</Text>
          }
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function EditField({ label, ...inputProps }) {
  const { theme: { colors } } = useTheme();
  const editModalStyles = useMemo(() => makeEditModalStyles(colors), [colors]);
  const [focused, setFocused] = useState(false);
  return (
    <View style={editModalStyles.fieldWrap}>
      <Text style={editModalStyles.label}>{label}</Text>
      <TextInput
        style={[editModalStyles.input, focused && editModalStyles.inputFocused]}
        placeholderTextColor={colors.textTertiary}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...inputProps}
      />
    </View>
  );
}

function UserStat({ label, value }) {
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.userStat}>
      <Text style={styles.userStatValue}>{value}</Text>
      <Text style={styles.userStatLabel}>{label}</Text>
    </View>
  );
}

function SideDrawer({ visible, slideAnim, fadeAnim, onClose, onMedidas, onAspecto, onGym, photoUri, nombre, apellido, initials }) {
  const { theme: { colors } } = useTheme();
  const drawerStyles = useMemo(() => makeDrawerStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { user: authUser, signOut, authLoading } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: fadeAnim.value }));
  const panelStyle    = useAnimatedStyle(() => ({ transform: [{ translateX: slideAnim.value }] }));

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      setSigningOut(false);
    }
  }

  const displayName = [nombre, apellido].filter(Boolean).join(' ') || authUser?.displayName || 'Mi cuenta';

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={() => onClose()}>
      {/* Backdrop */}
      <Animated.View style={[drawerStyles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => onClose()} />
      </Animated.View>

      {/* Panel */}
      <Animated.View
        style={[
          drawerStyles.panel,
          panelStyle,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 24,
          },
        ]}
      >
        {/* Close button */}
        <TouchableOpacity style={drawerStyles.closeBtn} onPress={() => onClose()} activeOpacity={0.7}>
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>

        {/* User info */}
        <View style={drawerStyles.userInfo}>
          <View style={drawerStyles.drawerAvatar}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={drawerStyles.drawerAvatarPhoto} />
            ) : (
              <Text style={drawerStyles.drawerAvatarText}>
                {initials || (authUser?.email?.[0] ?? '?').toUpperCase()}
              </Text>
            )}
          </View>
          <Text style={drawerStyles.drawerName} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={drawerStyles.drawerEmail} numberOfLines={1}>
            {authUser?.email ?? ''}
          </Text>
        </View>

        <View style={drawerStyles.divider} />

        {/* Medidas corporales — neon card */}
        <TouchableOpacity
          style={drawerStyles.neonCard}
          onPress={() => onClose(onMedidas)}
          activeOpacity={0.75}
        >
          <View style={drawerStyles.neonCardIcon}>
            <Text style={drawerStyles.neonCardEmoji}>🧍</Text>
          </View>
          <View style={drawerStyles.neonCardBody}>
            <Text style={drawerStyles.neonCardTitle}>Medidas corporales</Text>
            <Text style={drawerStyles.neonCardSub}>Peso · Altura · Sexo</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </TouchableOpacity>

        {/* Aspecto — neon card */}
        <TouchableOpacity
          style={drawerStyles.neonCard}
          onPress={() => onClose(onAspecto)}
          activeOpacity={0.75}
        >
          <View style={drawerStyles.neonCardIcon}>
            <Text style={drawerStyles.neonCardEmoji}>🎨</Text>
          </View>
          <View style={drawerStyles.neonCardBody}>
            <Text style={drawerStyles.neonCardTitle}>Aspecto</Text>
            <Text style={drawerStyles.neonCardSub}>Tema · Color de acento</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </TouchableOpacity>

        {/* En el Gym — neon card */}
        <TouchableOpacity
          style={drawerStyles.neonCard}
          onPress={() => onClose(onGym)}
          activeOpacity={0.75}
        >
          <View style={drawerStyles.neonCardIcon}>
            <Text style={drawerStyles.neonCardEmoji}>🏋️</Text>
          </View>
          <View style={drawerStyles.neonCardBody}>
            <Text style={drawerStyles.neonCardTitle}>En el Gym</Text>
            <Text style={drawerStyles.neonCardSub}>¿Cuánta gente hay ahora?</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </TouchableOpacity>

        <View style={[drawerStyles.divider, { marginTop: spacing.md }]} />

        {/* Cerrar sesión */}
        <TouchableOpacity
          style={drawerStyles.logoutBtn}
          onPress={handleSignOut}
          activeOpacity={0.75}
          disabled={signingOut || authLoading}
        >
          {signingOut || authLoading ? (
            <ActivityIndicator size="small" color={colors.danger} />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={20} color={colors.danger} />
              <Text style={drawerStyles.logoutText}>Cerrar sesión</Text>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

function makeDrawerStyles(colors) { return StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlayMedium,
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: DRAWER_WIDTH,
    backgroundColor: colors.surface,
    borderLeftWidth: 0.5,
    borderLeftColor: colors.border,
    paddingHorizontal: spacing.xl,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: -4, height: 0 },
    elevation: 20,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  userInfo: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  drawerAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primaryDim,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  drawerAvatarText: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.black,
    color: colors.primary,
  },
  drawerAvatarPhoto: {
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  drawerName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 4,
  },
  drawerEmail: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  divider: {
    height: 0.5,
    backgroundColor: colors.border,
    marginBottom: spacing.xl,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.dangerDim,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    minHeight: 48,
    justifyContent: 'center',
  },
  logoutText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.danger,
  },
  neonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryGlow,
    borderWidth: 1.5,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
    marginBottom: spacing.sm,
  },
  neonCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryDim12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  neonCardEmoji: { fontSize: 22 },
  neonCardBody: { flex: 1 },
  neonCardTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 2,
  },
  neonCardSub: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
}); }

function makeStyles(colors) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing['3xl'] },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  headerTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.black,
    color: colors.text,
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: colors.border,
  },

  // Profile card
  profileCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatarBox: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryDim,
    borderWidth: 2.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarCameraOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 24,
    backgroundColor: 'rgba(0,0,0,0.45)', // overlay on photo, intentionally neutral
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.black,
    color: colors.primary,
  },
  levelBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surfaceElevated,
  },
  levelBadgeText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.black,
    color: colors.textInverse,
  },
  profileName: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.black,
    color: colors.text,
    marginBottom: 4,
  },
  profileGoal: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },

  // XP bar
  xpSection: { width: '100%', marginBottom: spacing.xl },
  xpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  xpLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  xpValue: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  xpTrack: {
    height: 6,
    backgroundColor: colors.surfaceActive,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.full,
  },

  // User stats row
  userStatsRow: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
  },
  userStat: { flex: 1, alignItems: 'center' },
  userStatValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.black,
    color: colors.text,
  },
  userStatLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 0.5,
    height: 32,
    backgroundColor: colors.border,
  },

  // Coins & streak
  coinsStreakRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  coinsCard: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
    gap: 3,
  },
  coinsIcon: { fontSize: 24, marginBottom: 2 },
  miniRing: { marginBottom: 2 },
  miniRingText: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  coinsValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.black,
    color: colors.text,
  },
  coinsLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Tabs
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    padding: 4,
    marginBottom: spacing.xl,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.lg,
  },
  tabActive: { backgroundColor: colors.primary },
  tabText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  tabTextActive: { color: colors.textInverse },

  tabSectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.lg,
  },

  // Bars chart
  barsChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: spacing.lg,
    paddingTop: spacing['2xl'],
    marginBottom: spacing.sm,
    height: 180,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  barValue: {
    fontSize: 9,
    color: colors.textTertiary,
    fontWeight: typography.weights.medium,
  },
  barTrack: {
    width: 24,
    height: BAR_MAX_HEIGHT,
    backgroundColor: colors.surfaceActive,
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  barDay: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  trainedDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.primary,
  },
  chartLegend: {
    fontSize: typography.sizes.xs,
    color: colors.textTertiary,
    marginBottom: spacing.xl,
  },

  // Weight chart
  weightChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: spacing.lg,
    height: 160,
    marginBottom: spacing.md,
  },
  weightCol: { flex: 1, alignItems: 'center' },
  weightDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surfaceActive,
    borderWidth: 2,
    borderColor: colors.border,
    marginBottom: 4,
  },
  weightDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  weightValue: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.bold,
    marginTop: 4,
  },
  weightDate: {
    fontSize: 9,
    color: colors.textTertiary,
    marginTop: 2,
  },
  weightSummary: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    justifyContent: 'space-around',
  },
  weightSummaryItem: { alignItems: 'center' },
  weightSummaryLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  weightSummaryValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.black,
    color: colors.text,
  },

  // Medidas
  medidasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  medidaCard: {
    width: (width - spacing.xl * 2 - spacing.sm * 2) / 3,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  medidaValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.black,
    color: colors.text,
  },
  medidaLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  addMedidaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 14,
    marginBottom: spacing.xl,
  },
  addMedidaText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.textInverse,
  },
  medidasHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  editMedidaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    backgroundColor: colors.primaryDim12,
    borderWidth: 1,
    borderColor: colors.primaryDim,
  },
  editMedidaText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },

  // Medidas list (Health-app style)
  medidasList: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
    // neon glow
    shadowColor: colors.primary,
    shadowOpacity: 0.10,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  medidasRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  medidasRowEmoji: { fontSize: 22, width: 28, textAlign: 'center' },
  medidasRowLabel: {
    flex: 1,
    fontSize: typography.sizes.base,
    color: colors.text,
    fontWeight: typography.weights.medium,
  },
  medidasRowValue: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  medidasRowDivider: {
    height: 0.5,
    backgroundColor: colors.border,
    marginLeft: 28 + spacing.md + spacing.lg, // indent past emoji
  },
  medidasNote: {
    fontSize: typography.sizes.xs,
    color: colors.textTertiary,
    lineHeight: 18,
    marginBottom: spacing.xl,
  },

  // Gym tab
  gymDniInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.base,
    minHeight: 44,
  },
  gymLinkBtn: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gymLinkBtnText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  gymUnlinkBtn: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  gymUnlinkText: {
    fontSize: typography.sizes.xs,
    textDecorationLine: 'underline',
  },
  trainTimeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  trainTimeChip: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  trainTimeChipText: {
    fontSize: typography.sizes.sm,
  },
}); }

function makeEditModalStyles(colors) { return StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlayMedium,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: 40,
    borderTopWidth: 0.5,
    borderColor: colors.border,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.black,
    color: colors.text,
    marginBottom: spacing.xl,
  },
  row: { flexDirection: 'row', marginBottom: spacing.xl },
  fieldWrap: { flex: 1 },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: 7,
  },
  input: {
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: typography.sizes.base,
    color: colors.text,
    minHeight: 52,
  },
  inputFocused: {
    borderColor: colors.primaryDim,
    backgroundColor: colors.surfaceContainerHigh,
  },
  readOnlyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  readOnlyText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  readOnlyValue: {
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  readOnlyHint: {
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  saveBtn: {
    backgroundColor: colors.primaryDim,
    borderRadius: radius.full,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  saveBtnText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.textInverse,
    letterSpacing: 0.3,
  },
}); }
