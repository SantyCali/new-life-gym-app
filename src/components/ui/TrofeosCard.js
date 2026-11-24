import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS, Easing, interpolate, Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, radius } from '../../theme';
import { subscribeTrofeos, resumirTrofeos, VICTORIAS_POR_PLATINO } from '../../services/trofeosService';

// Trofeos de torneos en el Perfil, estilo PlayStation (ver trofeosService).
export const TIPOS = {
  platino: { color: '#9FC3E7', nombre: 'Platino' },
  oro:     { color: '#F5C542', nombre: 'Oro' },
  plata:   { color: '#C3CAD4', nombre: 'Plata' },
  bronce:  { color: '#D08A4E', nombre: 'Bronce' },
};
const POR_PUESTO = { 1: 'oro', 2: 'plata', 3: 'bronce' };

function Copa({ tipo, size = 22 }) {
  const { color } = TIPOS[tipo];
  return (
    <View style={{ width: size * 1.75, height: size * 1.75, borderRadius: size, alignItems: 'center', justifyContent: 'center', backgroundColor: color + '22', borderWidth: 1, borderColor: color + '66' }}>
      <Ionicons name="trophy" size={size} color={color} />
    </View>
  );
}

export default function TrofeosCard({ uid, colors }) {
  const [lista, setLista] = useState(null);
  const [abierto, setAbierto] = useState(false);
  useEffect(() => subscribeTrofeos(uid, setLista), [uid]);
  const r = useMemo(() => resumirTrofeos(lista ?? []), [lista]);
  const st = useMemo(() => makeStyles(colors), [colors]);

  const total = r.platino + r.oro + r.plata + r.bronce;
  return (
    <>
      <TouchableOpacity style={st.card} onPress={() => setAbierto(true)} activeOpacity={0.85}>
        <View style={st.cabecera}>
          <Text style={st.titulo}>Trofeos</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={st.total}>{total}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </View>
        </View>
        <View style={st.fila}>
          {[['platino', r.platino], ['oro', r.oro], ['plata', r.plata], ['bronce', r.bronce]].map(([tipo, n]) => (
            <View key={tipo} style={st.tipo}>
              <Ionicons name="trophy" size={20} color={n ? TIPOS[tipo].color : colors.textTertiary + '66'} />
              <Text style={[st.numero, !n && { color: colors.textTertiary }]}>{n}</Text>
              <Text style={st.etiqueta}>{TIPOS[tipo].nombre}</Text>
            </View>
          ))}
        </View>
        {/* Progreso al próximo platino */}
        <View style={st.progreso}>
          <View style={st.barra}>
            <View style={[st.barraLlena, { width: `${(r.haciaPlatino / VICTORIAS_POR_PLATINO) * 100}%` }]} />
          </View>
          <Text style={st.progresoTexto}>
            {r.haciaPlatino}/{VICTORIAS_POR_PLATINO} victorias para {r.platino ? 'otro' : 'el'} platino
          </Text>
        </View>
      </TouchableOpacity>

      {abierto && <ListaTrofeos resumen={r} colors={colors} onClose={() => setAbierto(false)} />}
    </>
  );
}

// Hoja "Mis trofeos", igual que "Nuevo torneo": el fondo se oscurece de a poco
// (no sube) y la hoja sube. La manija: para abajo la cierra (si se baja
// bastante o rápido); para arriba se estira un poco y vuelve.
function ListaTrofeos({ resumen, colors, onClose }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const { copas, platino } = resumen;
  const fecha = (c) => c.fecha?.toDate?.()?.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }) ?? '';

  // bajada = cuánto está corrida para abajo (FUERA = escondida).
  const FUERA = height;
  const bajada = useSharedValue(FUERA);
  useEffect(() => {
    bajada.value = withSpring(0, { damping: 22, stiffness: 220, mass: 0.9 });
  }, [bajada]);
  const cerrar = useCallback(() => {
    bajada.value = withTiming(FUERA, { duration: 240, easing: Easing.in(Easing.cubic) }, (ok) => {
      if (ok) runOnJS(onClose)();
    });
  }, [bajada, FUERA, onClose]);
  const arrastre = useMemo(() => Gesture.Pan()
    .onUpdate((e) => {
      const dy = e.translationY;
      bajada.value = dy > 0 ? dy : Math.max(-40, dy * 0.25);
    })
    .onEnd((e) => {
      if (bajada.value > 110 || e.velocityY > 900) {
        bajada.value = withTiming(FUERA, { duration: 200, easing: Easing.in(Easing.cubic) }, (ok) => {
          if (ok) runOnJS(onClose)();
        });
        return;
      }
      bajada.value = withSpring(0, { damping: 22, stiffness: 260 });
    }), [bajada, FUERA, onClose]);
  const hojaStyle = useAnimatedStyle(() => ({ transform: [{ translateY: Math.max(-40, bajada.value) }] }));
  const fondoStyle = useAnimatedStyle(() => ({
    opacity: interpolate(bajada.value, [0, FUERA * 0.6], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <Modal visible transparent animationType="none" onRequestClose={cerrar} statusBarTranslucent navigationBarTranslucent>
      {/* Los gestos dentro de un Modal necesitan su propia raíz. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
      <Animated.View style={[st.fondo, fondoStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={cerrar} />
      </Animated.View>
      <Animated.View style={[st.hoja, { paddingBottom: insets.bottom + spacing.lg }, hojaStyle]}>
        {/* Manija + título: de acá se arrastra la hoja. */}
        <GestureDetector gesture={arrastre}>
          <View>
            <View style={st.manija} />
            <View style={st.hojaCabecera}>
              <Text style={st.hojaTitulo}>Mis trofeos</Text>
              <TouchableOpacity onPress={cerrar} hitSlop={10}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        </GestureDetector>
        <ScrollView contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.md }}>
          {Array.from({ length: platino }, (_, i) => (
            <View key={`pl${i}`} style={[st.item, { borderColor: TIPOS.platino.color + '55' }]}>
              <Copa tipo="platino" size={24} />
              <View style={{ flex: 1 }}>
                <Text style={st.itemTitulo}>Platino{platino > 1 ? ` #${i + 1}` : ''}</Text>
                <Text style={st.itemSub}>Ganaste {VICTORIAS_POR_PLATINO * (i + 1)} torneos</Text>
              </View>
            </View>
          ))}
          {copas.map((c) => (
            <View key={c.id} style={st.item}>
              <Copa tipo={POR_PUESTO[c.puesto]} size={22} />
              <View style={{ flex: 1 }}>
                <Text style={st.itemTitulo} numberOfLines={1}>{c.nombre}</Text>
                <Text style={st.itemSub}>
                  {c.puesto}° puesto de {c.jugadores}{c.soloPasos ? ' · solo pasos' : ''}{fecha(c) ? ` · ${fecha(c)}` : ''}
                </Text>
              </View>
            </View>
          ))}
          {!copas.length && (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm }}>
              <Ionicons name="trophy-outline" size={40} color={colors.textTertiary} />
              <Text style={[st.itemSub, { textAlign: 'center' }]}>
                Todavía no tenés trofeos.{'\n'}Quedá entre los 3 primeros de un torneo para ganar tu primera copa.
              </Text>
            </View>
          )}
        </ScrollView>
      </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    // Como las tarjetas de racha y calorías del Perfil.
    card: {
      backgroundColor: colors.surfaceElevated, borderRadius: radius.lg, borderWidth: 0.5, borderColor: colors.border,
      padding: spacing.md, marginBottom: spacing.xl, gap: spacing.md,
    },
    cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    titulo: { color: colors.text, fontSize: 16, fontWeight: '800' },
    total: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
    fila: { flexDirection: 'row', justifyContent: 'space-between' },
    tipo: { flex: 1, alignItems: 'center', gap: 2 },
    numero: { color: colors.text, fontSize: 18, fontWeight: '900' },
    etiqueta: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
    progreso: { gap: 6 },
    barra: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceActive ?? colors.border, overflow: 'hidden' },
    barraLlena: { height: '100%', borderRadius: 3, backgroundColor: TIPOS.platino.color },
    progresoTexto: { color: colors.textSecondary, fontSize: 12 },
    fondo: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
    hoja: {
      position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '80%',
      backgroundColor: colors.surfaceElevated ?? colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      paddingHorizontal: spacing.lg, paddingTop: spacing.sm,
    },
    manija: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.sm },
    hojaCabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
    hojaTitulo: { color: colors.text, fontSize: 20, fontWeight: '900' },
    item: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md,
      borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    },
    itemTitulo: { color: colors.text, fontSize: 15, fontWeight: '700' },
    itemSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  });
}
