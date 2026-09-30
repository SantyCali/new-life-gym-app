// Rutinas del gym (plantillas). Tres usos:
//   modo 'gestionar' (entrenador): todas, crear / editar / publicar / borrar.
//   modo 'asignar'   (entrenador): elegir una para el alumno route.params.cliente.
//   modo 'elegir'    (alumno o entrenador, desde Mi Rutina): arriba "Tus
//                    rutinas" (las propias guardadas, solo las ve el dueño) y
//                    abajo las del gym publicadas.
import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator,
  Modal, TextInput, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import useAuth from '../hooks/useAuth';
import useUserProfile from '../hooks/useUserProfile';
import { typography, spacing, radius } from '../theme';
import { MUSCLE_GROUPS } from '../constants/exercises';
import {
  subscribePlantillas, setPublicada, borrarPlantilla, usarPlantilla,
} from '../services/plantillasService';
import {
  subscribeMisRutinas, guardarMiRutina, borrarMiRutina, cambiarARutina, huellaDias,
} from '../services/misRutinasService';
import { subscribeToClientRoutine } from '../services/routineService';

function resumen(dias = []) {
  const ejercicios = dias.reduce((n, d) => n + (d.ejercicios?.length ?? 0), 0);
  return `${dias.length} ${dias.length === 1 ? 'día' : 'días'} · ${ejercicios} ejercicios`;
}

function gruposDelDia(dia) {
  const ids = [...new Set((dia.ejercicios ?? []).map((e) => e.grupoMuscular))];
  return ids.map((id) => MUSCLE_GROUPS.find((g) => g.id === id)?.label ?? id).join(' · ');
}

export default function PlantillasScreen({ route, navigation }) {
  const modo = route.params?.modo ?? 'gestionar';
  const cliente = route.params?.cliente;
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { profile } = useUserProfile();

  const [plantillas, setPlantillas] = useState(null);
  const [abierta, setAbierta] = useState(null);
  const [usando, setUsando] = useState(null);
  const [misRutinas, setMisRutinas] = useState([]);
  const [actual, setActual] = useState(null);
  const [guardando, setGuardando] = useState(null); // nombre en edición | null

  useEffect(() => subscribePlantillas({ soloPublicadas: modo === 'elegir' }, setPlantillas), [modo]);
  useEffect(() => {
    if (modo !== 'elegir' || !user?.uid) return undefined;
    const a = subscribeMisRutinas(user.uid, setMisRutinas);
    const b = subscribeToClientRoutine(user.uid, setActual);
    return () => { a(); b(); };
  }, [modo, user?.uid]);

  const tieneRutinaActual = (actual?.dias ?? []).some((d) => (d.ejercicios?.length ?? 0) > 0);

  // ¿Es la rutina que ya tiene puesta? (mismo nombre y mismos ejercicios; una
  // del gym, si la que usa salió de esa y no la modificó)
  const huellaActual = actual ? huellaDias(actual.dias) : null;
  const guardadaEnUso = (r) => !!actual
    && (r.nombre ?? '').trim() === (actual.nombre ?? '').trim()
    && huellaDias(r.dias) === huellaActual;
  const plantillaEnUso = (p) => !!actual && actual.plantillaId === p.id && huellaDias(p.dias) === huellaActual;
  const yaEnUso = (nombre) => Alert.alert('Ya la estás usando', `"${nombre}" es la rutina que tenés puesta ahora.`);

  const guardarActual = async () => {
    const nombre = (guardando ?? '').trim();
    if (!nombre) return;
    setGuardando(null);
    try {
      const ok = await guardarMiRutina(user.uid, { nombre, dias: actual?.dias });
      if (!ok) Alert.alert('Ya estaba guardada', 'Esa rutina ya está en "Tus rutinas".');
    } catch { Alert.alert('Error', 'No se pudo guardar. Verificá tu conexión.'); }
  };

  const usarGuardada = (r) => Alert.alert('Usar esta rutina', `¿Volver a "${r.nombre}"? La que tenés ahora queda guardada en "Tus rutinas".`, [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: 'Usar',
      onPress: async () => {
        setUsando(r.id);
        try { await cambiarARutina(user.uid, r); navigation.goBack(); }
        catch { Alert.alert('Error', 'No se pudo cambiar. Verificá tu conexión.'); }
        finally { setUsando(null); }
      },
    },
  ]);

  const borrarGuardada = (r) => Alert.alert('Borrar rutina guardada', `¿Borrar "${r.nombre}"?`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Borrar', style: 'destructive', onPress: () => borrarMiRutina(user.uid, r.id).catch(() => Alert.alert('Error', 'No se pudo borrar.')) },
  ]);

  const titulo = modo === 'asignar' ? 'Asignar rutina' : modo === 'elegir' ? 'Rutinas' : 'Rutinas del gym';
  const subtitulo = modo === 'asignar'
    ? `Elegí una para ${cliente?.nombre ?? 'el alumno'}`
    : modo === 'elegir' ? 'Las tuyas y las armadas por los entrenadores' : 'Rutinas modelo para los alumnos';

  const editar = (p) => navigation.navigate('RoutineEditor', { plantilla: p ?? {} });

  const cambiarPublicada = async (p) => {
    try { await setPublicada(p.id, !p.publicada); }
    catch { Alert.alert('Error', 'No se pudo cambiar. Verificá tu conexión.'); }
  };

  const borrar = (p) => Alert.alert('Borrar rutina', `¿Borrar "${p.nombre}"? Los alumnos que ya la usan conservan su copia.`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Borrar', style: 'destructive', onPress: () => borrarPlantilla(p.id).catch(() => Alert.alert('Error', 'No se pudo borrar.')) },
  ]);

  const usar = (p) => {
    const para = modo === 'asignar' ? cliente?.nombre ?? 'el alumno' : null;
    Alert.alert(
      modo === 'asignar' ? 'Asignar rutina' : 'Usar esta rutina',
      modo === 'asignar'
        ? `¿Asignarle "${p.nombre}" a ${para}? Reemplaza su rutina actual.`
        : `¿Usar "${p.nombre}" como tu rutina? La que tenés ahora queda guardada en "Tus rutinas". Después la podés editar.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: modo === 'asignar' ? 'Asignar' : 'Usar',
          onPress: async () => {
            setUsando(p.id);
            try {
              await usarPlantilla(modo === 'asignar'
                ? { clienteUid: cliente.uid, clienteNombre: cliente.nombre, plantilla: p, quien: 'entrenador', entrenadorUid: user?.uid }
                : { clienteUid: user?.uid, clienteNombre: profile?.nombre, plantilla: p, quien: 'alumno' });
              navigation.goBack();
            } catch {
              Alert.alert('Error', 'No se pudo guardar. Verificá tu conexión.');
            } finally {
              setUsando(null);
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item: p }) => {
    const expandida = abierta === p.id;
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={() => setAbierta(expandida ? null : p.id)} style={styles.card}>
        <View style={styles.cardTop}>
          <View style={[styles.icono, { backgroundColor: colors.primaryDim12 }]}>
            <Ionicons name="barbell" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.nombre} numberOfLines={2}>{p.nombre}</Text>
            <Text style={styles.meta}>{resumen(p.dias)}{p.autorNombre ? ` · ${p.autorNombre}` : ''}</Text>
          </View>
          {modo === 'gestionar' && (
            <View style={[styles.estado, p.publicada ? styles.estadoPublicada : styles.estadoBorrador]}>
              <Text style={[styles.estadoText, { color: p.publicada ? '#22C55E' : colors.textTertiary }]}>
                {p.publicada ? 'Publicada' : 'Borrador'}
              </Text>
            </View>
          )}
          <Ionicons name={expandida ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textTertiary} />
        </View>

        {expandida && (
          <View style={styles.detalle}>
            {(p.dias ?? []).map((d, i) => (
              <View key={d.id ?? i} style={styles.diaFila}>
                <Text style={styles.diaNum}>Día {d.numero ?? i + 1}</Text>
                <Text style={styles.diaInfo} numberOfLines={1}>
                  {(d.ejercicios?.length ?? 0)} ejercicios{gruposDelDia(d) ? ` · ${gruposDelDia(d)}` : ''}
                </Text>
              </View>
            ))}

            {modo === 'gestionar' ? (
              <View style={styles.acciones}>
                <TouchableOpacity style={styles.accion} onPress={() => editar(p)}>
                  <Ionicons name="create-outline" size={16} color={colors.primary} />
                  <Text style={[styles.accionText, { color: colors.primary }]}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.accion} onPress={() => cambiarPublicada(p)}>
                  <Ionicons name={p.publicada ? 'eye-off-outline' : 'megaphone-outline'} size={16} color={p.publicada ? colors.textSecondary : '#22C55E'} />
                  <Text style={[styles.accionText, { color: p.publicada ? colors.textSecondary : '#22C55E' }]}>
                    {p.publicada ? 'Ocultar' : 'Publicar'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.accion} onPress={() => borrar(p)}>
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  <Text style={[styles.accionText, { color: '#EF4444' }]}>Borrar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              modo === 'elegir' && plantillaEnUso(p) ? (
                <TouchableOpacity style={[styles.enUsoGrande, { borderColor: colors.primary + '66' }]} onPress={() => yaEnUso(p.nombre)}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                  <Text style={[styles.enUsoText, { color: colors.primary, fontSize: typography.sizes.base }]}>Ya la estás usando</Text>
                </TouchableOpacity>
              ) : (
              <TouchableOpacity
                style={[styles.usarBtn, { backgroundColor: colors.primary }]}
                onPress={() => usar(p)}
                disabled={!!usando}
                activeOpacity={0.85}
              >
                {usando === p.id
                  ? <ActivityIndicator size="small" color={colors.textInverse} />
                  : <Text style={[styles.usarText, { color: colors.textInverse }]}>
                      {modo === 'asignar' ? `Asignar a ${cliente?.nombre ?? 'alumno'}` : 'Usar esta rutina'}
                    </Text>}
              </TouchableOpacity>
              )
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{titulo}</Text>
          <Text style={styles.subtitle}>{subtitulo}</Text>
        </View>
      </View>

      {plantillas === null ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={plantillas}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          ListHeaderComponent={modo === 'elegir' ? (
            <View style={styles.misBloque}>
              <View style={styles.misTitulo}>
                <Text style={styles.seccion}>Tus rutinas</Text>
                <View style={styles.privada}>
                  <Ionicons name="lock-closed" size={11} color={colors.textSecondary} />
                  <Text style={styles.privadaText}>Solo vos podés verlas</Text>
                </View>
              </View>

              {tieneRutinaActual && (
                <TouchableOpacity
                  style={[styles.guardarBtn, { borderColor: colors.primary + '66' }]}
                  onPress={() => setGuardando(actual?.nombre ?? '')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="bookmark-outline" size={16} color={colors.primary} />
                  <Text style={[styles.guardarText, { color: colors.primary }]}>Guardar mi rutina actual</Text>
                </TouchableOpacity>
              )}

              {misRutinas.length === 0 ? (
                <Text style={styles.misVacio}>
                  Cuando cambies de rutina, la anterior se guarda acá. También podés guardar la actual con un nombre.
                </Text>
              ) : misRutinas.map((r) => (
                <View key={r.id} style={styles.miCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nombre} numberOfLines={1}>{r.nombre}</Text>
                    <Text style={styles.meta}>
                      {resumen(r.dias)}{r.guardadaEn?.toDate ? ` · guardada el ${r.guardadaEn.toDate().toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}` : ''}
                    </Text>
                  </View>
                  {guardadaEnUso(r) ? (
                    <TouchableOpacity style={[styles.enUso, { borderColor: colors.primary + '66' }]} onPress={() => yaEnUso(r.nombre)}>
                      <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                      <Text style={[styles.enUsoText, { color: colors.primary }]}>En uso</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={[styles.miUsar, { backgroundColor: colors.primary }]} onPress={() => usarGuardada(r)} disabled={!!usando}>
                      {usando === r.id
                        ? <ActivityIndicator size="small" color={colors.textInverse} />
                        : <Text style={[styles.miUsarText, { color: colors.textInverse }]}>Usar</Text>}
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.miBorrar} onPress={() => borrarGuardada(r)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={17} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}

              <Text style={[styles.seccion, { marginTop: spacing.lg }]}>Rutinas del gym</Text>
            </View>
          ) : null}
          contentContainerStyle={[styles.lista, { paddingBottom: insets.bottom + 100 }]}
          ListEmptyComponent={(
            <View style={styles.vacio}>
              <Ionicons name="albums-outline" size={40} color={colors.textTertiary} />
              <Text style={styles.vacioTitulo}>
                {modo === 'gestionar' ? 'Todavía no hay rutinas del gym' : 'Todavía no hay rutinas publicadas'}
              </Text>
              <Text style={styles.vacioSub}>
                {modo === 'gestionar' ? 'Tocá + para armar la primera.' : 'Los entrenadores las van a ir cargando.'}
              </Text>
            </View>
          )}
        />
      )}

      <Modal visible={guardando !== null} transparent animationType="fade" onRequestClose={() => setGuardando(null)} statusBarTranslucent navigationBarTranslucent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalFondo}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setGuardando(null)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Guardar mi rutina</Text>
            <Text style={styles.modalSub}>Ponele un nombre para encontrarla después. Solo vos la vas a ver.</Text>
            <TextInput
              style={styles.modalInput}
              value={guardando ?? ''}
              onChangeText={setGuardando}
              placeholder='Ej: "Rutina Cali"'
              placeholderTextColor={colors.textTertiary}
              autoFocus
              maxLength={60}
              onSubmitEditing={guardarActual}
            />
            <View style={styles.modalAcciones}>
              <TouchableOpacity style={styles.modalCancelar} onPress={() => setGuardando(null)}>
                <Text style={[styles.accionText, { color: colors.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalGuardar, { backgroundColor: colors.primary }]} onPress={guardarActual}>
                <Text style={[styles.accionText, { color: colors.textInverse }]}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {modo === 'gestionar' && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 24, backgroundColor: colors.primary }]}
          onPress={() => editar(null)}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color={colors.textInverse} />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceElevated },
    title: { fontSize: typography.sizes.xl, fontWeight: typography.weights.black, color: colors.text },
    subtitle: { fontSize: typography.sizes.sm, color: colors.textSecondary, marginTop: 2 },
    lista: { paddingHorizontal: spacing.lg, gap: spacing.md },
    card: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    icono: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
    nombre: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold, color: colors.text },
    meta: { fontSize: typography.sizes.sm, color: colors.textSecondary, marginTop: 2 },
    estado: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
    estadoPublicada: { backgroundColor: '#22C55E1A', borderColor: '#22C55E55' },
    estadoBorrador: { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
    estadoText: { fontSize: 11, fontWeight: typography.weights.bold },
    detalle: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
    diaFila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    diaNum: { fontSize: typography.sizes.sm, fontWeight: typography.weights.bold, color: colors.primary, width: 48 },
    diaInfo: { flex: 1, fontSize: typography.sizes.sm, color: colors.textSecondary },
    acciones: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    accion: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 10, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated,
    },
    accionText: { fontSize: typography.sizes.sm, fontWeight: typography.weights.bold },
    usarBtn: { marginTop: spacing.sm, paddingVertical: 12, borderRadius: radius.lg, alignItems: 'center' },
    usarText: { fontSize: typography.sizes.base, fontWeight: typography.weights.extrabold },
    vacio: { alignItems: 'center', paddingVertical: 60, gap: 8 },
    vacioTitulo: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold, color: colors.text },
    vacioSub: { fontSize: typography.sizes.sm, color: colors.textSecondary, textAlign: 'center' },
    misBloque: { gap: spacing.sm, marginBottom: spacing.xs },
    misTitulo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    seccion: { fontSize: typography.sizes.sm, fontWeight: typography.weights.black, color: colors.textSecondary, letterSpacing: 1, textTransform: 'uppercase' },
    privada: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: colors.surfaceElevated },
    privadaText: { fontSize: 11, fontWeight: typography.weights.bold, color: colors.textSecondary },
    guardarBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 11, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed',
    },
    guardarText: { fontSize: typography.sizes.sm, fontWeight: typography.weights.extrabold },
    misVacio: { fontSize: typography.sizes.sm, color: colors.textTertiary, lineHeight: 19 },
    miCard: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
      paddingVertical: 12, paddingHorizontal: spacing.md,
    },
    miUsar: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, minWidth: 58, alignItems: 'center' },
    miUsarText: { fontSize: typography.sizes.sm, fontWeight: typography.weights.extrabold },
    miBorrar: { padding: 4 },
    enUso: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1,
    },
    enUsoGrande: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      marginTop: spacing.sm, paddingVertical: 12, borderRadius: radius.lg, borderWidth: 1,
    },
    enUsoText: { fontSize: typography.sizes.sm, fontWeight: typography.weights.extrabold },
    modalFondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.xl },
    modalCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, gap: spacing.sm },
    modalTitulo: { fontSize: typography.sizes.lg, fontWeight: typography.weights.black, color: colors.text },
    modalSub: { fontSize: typography.sizes.sm, color: colors.textSecondary },
    modalInput: {
      marginTop: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 12,
      borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated,
      color: colors.text, fontSize: typography.sizes.md,
    },
    modalAcciones: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    modalCancelar: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.lg, backgroundColor: colors.surfaceElevated },
    modalGuardar: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.lg },
    fab: {
      position: 'absolute', right: spacing.xl, width: 58, height: 58, borderRadius: 29,
      alignItems: 'center', justifyContent: 'center', elevation: 6,
      shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    },
  });
}
