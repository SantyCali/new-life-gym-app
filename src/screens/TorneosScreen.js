import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS, Easing, interpolate, Extrapolation } from 'react-native-reanimated';
import { typography, spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';
import useAuth from '../hooks/useAuth';
import { subscribeTorneosForUser, createTorneo, tiempoRestante, torneoTerminado, DURACION_MAX } from '../services/torneoService';

const DIAS_SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

// Dentro de N días → "sáb 21/10"
function fechaFinTexto(dias) {
  const d = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
  return DIAS_SEMANA[d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth() + 1);
}

export default function TorneosScreen({ navigation }) {
  const { theme: { colors } } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [torneos, setTorneos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [nombre, setNombre] = useState('');
  const [creating, setCreating] = useState(false);
  const [soloPasos, setSoloPasos] = useState(false);   // false = pasos y gym

  const [duracion, setDuracion] = useState(14);        // 7 | 14 | 'otro'
  const [diasOtro, setDiasOtro] = useState('');
  const diasElegidos = duracion === 'otro' ? parseInt(diasOtro, 10) : duracion;
  const diasValidos = Number.isInteger(diasElegidos) && diasElegidos >= 1 && diasElegidos <= DURACION_MAX;

  // Hoja "Nuevo torneo", igual que "¿Cómo sumo puntos?": al abrir, el fondo
  // se oscurece de a poco y la hoja sube. La manija: para abajo la cierra (si
  // se baja bastante o rápido); para arriba se estira un poco y vuelve.
  // bajada = cuánto está corrida para abajo (FUERA = escondida).
  const FUERA = 600;
  const bajada = useSharedValue(FUERA);
  useEffect(() => {
    if (modalVisible) {
      bajada.value = FUERA;
      bajada.value = withSpring(0, { damping: 22, stiffness: 220, mass: 0.9 });
    }
  }, [modalVisible, bajada]);
  const cerrarHoja = useCallback(() => setModalVisible(false), []);
  const cerrar = useCallback(() => {
    bajada.value = withTiming(FUERA, { duration: 220, easing: Easing.in(Easing.cubic) }, (ok) => {
      if (ok) runOnJS(cerrarHoja)();
    });
  }, [bajada, cerrarHoja]);
  const arrastre = useMemo(() => Gesture.Pan()
    .onUpdate((e) => {
      const dy = e.translationY;
      bajada.value = dy > 0 ? dy : Math.max(-40, dy * 0.25);
    })
    .onEnd((e) => {
      if (bajada.value > 90 || e.velocityY > 900) {
        bajada.value = withTiming(FUERA, { duration: 200, easing: Easing.in(Easing.cubic) }, (ok) => {
          if (ok) runOnJS(cerrarHoja)();
        });
        return;
      }
      bajada.value = withSpring(0, { damping: 22, stiffness: 260 });
    }), [bajada, cerrarHoja]);
  const hojaStyle = useAnimatedStyle(() => ({ transform: [{ translateY: Math.max(-40, bajada.value) }] }));
  const fondoStyle = useAnimatedStyle(() => ({
    opacity: interpolate(bajada.value, [0, FUERA * 0.7], [1, 0], Extrapolation.CLAMP),
  }));

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeTorneosForUser(user.uid, data => {
      setTorneos(data);
      setLoading(false);
    });
    return unsub;
  }, [user?.uid]);

  const handleCreate = useCallback(async () => {
    if (!nombre.trim() || creating || !diasValidos) return;
    setCreating(true);
    try {
      const id = await createTorneo({ nombre, creadoPor: user.uid, soloPasos, duracionDias: diasElegidos });
      setModalVisible(false);
      setNombre('');
      setSoloPasos(false);
      setDuracion(14);
      setDiasOtro('');
      navigation.navigate('TorneoDetail', { torneoId: id, nombre: nombre.trim() });
    } catch {}
    setCreating(false);
  }, [nombre, creating, user?.uid, navigation, soloPasos, diasValidos, diasElegidos]);

  const renderItem = useCallback(({ item }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
      onPress={() => navigation.navigate('TorneoDetail', { torneoId: item.id, nombre: item.nombre })}
      activeOpacity={0.8}
    >
      <View style={[styles.cardIconWrap, { backgroundColor: '#FBBF2415', borderWidth: 1, borderColor: '#FBBF2440' }]}>
        <Ionicons name="trophy" size={20} color="#FBBF24" />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardRow}>
          <Text style={[styles.cardNombre, { color: colors.text }]} numberOfLines={1}>{item.nombre}</Text>
          {!torneoTerminado(item) && (
            <View style={[styles.activoBadge, { backgroundColor: '#22C55E20', borderColor: '#22C55E40' }]}>
              <Text style={styles.activoText}>Activo</Text>
            </View>
          )}
        </View>
        <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
          Por {item.creadoPorNombre || 'Desconocido'} · {(item.participantUids ?? []).length} participantes
        </Text>
        <Text style={[styles.cardModo, { color: colors.textSecondary }]}>
          {item.soloPasos ? '👟 Solo pasos' : '👟🏋️ Pasos y gym'}
        </Text>
        {item.fechaFin && (() => {
          const t = tiempoRestante(item.fechaFin);
          return (
            <Text style={[styles.cardTimer, { color: t.vencido ? '#EF4444' : colors.textTertiary }]}>
              {t.vencido ? '⏱ Terminado' : `⏱ ${t.texto}`}
            </Text>
          );
        })()}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </TouchableOpacity>
  ), [colors, navigation]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Torneos</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={20} color="#000" />
        </TouchableOpacity>
      </View>

      {torneos.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconWrap, { backgroundColor: '#FBBF2415', borderColor: '#FBBF2440' }]}>
            <Ionicons name="trophy" size={40} color="#FBBF24" />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Creá tu primer torneo</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
            Desafiá a tus amigos y mirá quién sube más de nivel
          </Text>
          <TouchableOpacity
            style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="trophy-outline" size={18} color="#000" />
            <Text style={styles.emptyBtnText}>Crear torneo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={torneos}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        onRequestClose={cerrar}
        statusBarTranslucent
        navigationBarTranslucent
      >
        {/* Los gestos dentro de un Modal necesitan su propia raíz. */}
        <GestureHandlerRootView style={{ flex: 1 }}>
        {/* Fondo oscuro de toda la pantalla: aparece de a poco y tocarlo cierra. */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, fondoStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={cerrar} />
        </Animated.View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheetWrapper}
        >
          <Animated.View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }, Platform.OS === 'android' && { paddingBottom: spacing['3xl'] + insets.bottom }, hojaStyle]}>
            {/* Manija + título: de acá se arrastra la hoja. */}
            <GestureDetector gesture={arrastre}>
              <View style={styles.agarre}>
                <View style={[styles.sheetHandle, { backgroundColor: colors.textTertiary }]} />
                <View style={styles.sheetCabecera}>
                  <Text style={[styles.sheetTitle, { color: colors.text, marginBottom: 0 }]}>Nuevo torneo</Text>
                  <TouchableOpacity onPress={cerrar} hitSlop={12}>
                    <Ionicons name="close" size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
            </GestureDetector>
            <Text style={[styles.sheetLabel, { color: colors.textSecondary }]}>Nombre del torneo</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.text }]}
              placeholder="Ej: Liga de agosto"
              placeholderTextColor={colors.textTertiary}
              value={nombre}
              onChangeText={setNombre}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
            <Text style={[styles.sheetLabel, { color: colors.textSecondary }]}>¿Qué suma puntos?</Text>
            <View style={styles.modos}>
              {[
                { solo: false, icono: '👟🏋️', titulo: 'Pasos y gym', sub: 'Pasos + 150 XP por día de gym' },
                { solo: true,  icono: '👟',   titulo: 'Solo pasos',  sub: 'El gym no suma' },
              ].map((m) => {
                const elegido = soloPasos === m.solo;
                return (
                  <TouchableOpacity
                    key={m.titulo}
                    onPress={() => setSoloPasos(m.solo)}
                    activeOpacity={0.8}
                    style={[
                      styles.modo,
                      { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                      elegido && { borderColor: colors.primary, backgroundColor: colors.primaryDim12 },
                    ]}
                  >
                    <View style={styles.modoHead}>
                      <Text style={styles.modoIcono}>{m.icono}</Text>
                      <Ionicons
                        name={elegido ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={elegido ? colors.primary : colors.textTertiary}
                      />
                    </View>
                    <Text style={[styles.modoTitulo, { color: elegido ? colors.primary : colors.text }]}>{m.titulo}</Text>
                    <Text style={[styles.modoSub, { color: colors.textSecondary }]}>{m.sub}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.sheetLabel, { color: colors.textSecondary }]}>¿Cuánto dura?</Text>
            <View style={styles.duraciones}>
              {[
                { id: 7, texto: '1 semana' },
                { id: 14, texto: '2 semanas' },
                { id: 'otro', texto: 'Personalizado' },
              ].map((o) => {
                const elegido = duracion === o.id;
                return (
                  <TouchableOpacity
                    key={o.id}
                    onPress={() => setDuracion(o.id)}
                    activeOpacity={0.8}
                    style={[
                      styles.duracion,
                      { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                      elegido && { borderColor: colors.primary, backgroundColor: colors.primaryDim12 },
                    ]}
                  >
                    <Text style={[styles.duracionTexto, { color: elegido ? colors.primary : colors.text }]}>{o.texto}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {duracion === 'otro' && (
              <View style={styles.otroFila}>
                <TextInput
                  style={[styles.otroInput, { backgroundColor: colors.surfaceElevated, borderColor: diasOtro && !diasValidos ? '#EF4444' : colors.border, color: colors.text }]}
                  placeholder="Ej: 30"
                  placeholderTextColor={colors.textTertiary}
                  value={diasOtro}
                  onChangeText={(t) => setDiasOtro(t.replace(/[^0-9]/g, '').slice(0, 3))}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  autoFocus
                />
                <Text style={[styles.otroDias, { color: colors.textSecondary }]}>días</Text>
                {[30, 21, 10].map((n) => (
                  <TouchableOpacity
                    key={n}
                    onPress={() => setDiasOtro(String(n))}
                    style={[styles.atajo, { borderColor: colors.border }]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.atajoTexto, { color: colors.textSecondary }]}>{n === 30 ? '1 mes' : `${n} d`}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Text style={[styles.terminaTexto, { color: diasOtro && !diasValidos ? '#EF4444' : colors.textTertiary }]}>
              {diasValidos
                ? `Termina el ${fechaFinTexto(diasElegidos)}`
                : duracion === 'otro' && diasOtro
                  ? `Elegí entre 1 y ${DURACION_MAX} días`
                  : 'Escribí cuántos días dura'}
            </Text>

            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: colors.primary, opacity: nombre.trim() && diasValidos ? 1 : 0.5 }]}
              onPress={handleCreate}
              disabled={!nombre.trim() || creating || !diasValidos}
              activeOpacity={0.85}
            >
              {creating
                ? <ActivityIndicator size="small" color="#000" />
                : <Text style={styles.createBtnText}>Crear</Text>
              }
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
        </GestureHandlerRootView>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 0.5,
    },
    backBtn: { padding: 4, marginRight: spacing.sm },
    headerTitle: {
      flex: 1,
      fontSize: typography.sizes.xl,
      fontWeight: typography.weights.black,
    },
    addBtn: {
      width: 34,
      height: 34,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    list: {
      padding: spacing.xl,
      gap: spacing.sm,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: radius.lg,
      borderWidth: 0.5,
      padding: spacing.md,
      gap: spacing.md,
    },
    cardIconWrap: {
      width: 42,
      height: 42,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    cardBody: { flex: 1 },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 3 },
    cardNombre: {
      flex: 1,
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.bold,
    },
    activoBadge: {
      borderWidth: 1,
      borderRadius: radius.full,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    activoText: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold,
      color: '#22C55E',
    },
    cardSub: {
      fontSize: typography.sizes.sm,
    },
    cardTimer: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.medium,
      marginTop: 2,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing['2xl'],
    },
    emptyIconWrap: {
      width: 80,
      height: 80,
      borderRadius: radius.xl,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xl,
    },
    emptyTitle: {
      fontSize: typography.sizes['2xl'],
      fontWeight: typography.weights.black,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    emptySub: {
      fontSize: typography.sizes.base,
      textAlign: 'center',
      lineHeight: typography.sizes.base * 1.5,
      marginBottom: spacing['2xl'],
    },
    emptyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing['2xl'],
      paddingVertical: spacing.md,
      borderRadius: radius.full,
    },
    emptyBtnText: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.bold,
      color: '#000',
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    sheetWrapper: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
    },
    sheet: {
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      borderWidth: 0.5,
      borderBottomWidth: 0,
      padding: spacing.xl,
      paddingBottom: spacing['3xl'],
    },
    // Zona de arrastre: arriba de todo, con margen para que sea fácil agarrarla.
    agarre: {
      marginTop: -spacing.md,
      paddingTop: spacing.md,
      marginBottom: spacing.xl,
    },
    sheetHandle: {
      width: 44,
      height: 5,
      borderRadius: radius.full,
      alignSelf: 'center',
      marginBottom: spacing.lg,
      opacity: 0.5,
    },
    sheetCabecera: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sheetTitle: {
      fontSize: typography.sizes.xl,
      fontWeight: typography.weights.black,
      marginBottom: spacing.xl,
    },
    sheetLabel: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
      marginBottom: spacing.sm,
    },
    input: {
      borderWidth: 1,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: typography.sizes.base,
      marginBottom: spacing.xl,
    },
    cardModo: {
      fontSize: typography.sizes.xs,
      marginTop: 2,
    },
    modos: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.xl,
    },
    modo: {
      flex: 1,
      borderWidth: 1.5,
      borderRadius: radius.lg,
      padding: spacing.md,
    },
    modoHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    modoIcono: { fontSize: 20 },
    modoTitulo: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.bold,
      marginBottom: 2,
    },
    modoSub: {
      fontSize: typography.sizes.xs,
    },
    duraciones: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
    duracion: {
      flex: 1,
      borderWidth: 1.5,
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    duracionTexto: { fontSize: typography.sizes.sm, fontWeight: typography.weights.bold },
    otroFila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    otroInput: {
      width: 72,
      borderWidth: 1,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: typography.sizes.base,
      textAlign: 'center',
    },
    otroDias: { fontSize: typography.sizes.base, marginRight: spacing.xs },
    atajo: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 6 },
    atajoTexto: { fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold },
    terminaTexto: { fontSize: typography.sizes.xs, marginBottom: spacing.lg },
    createBtn: {
      borderRadius: radius.full,
      paddingVertical: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    createBtnText: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.bold,
      color: '#000',
    },
  });
}
