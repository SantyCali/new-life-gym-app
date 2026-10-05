import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, BackHandler } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, interpolate, Extrapolation, runOnJS, Easing,
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { stepMilestones } from '../../constants/mockData';
import { LOGROS_DEF } from '../../constants/logros';
import { XP_PER_1K_STEPS, XP_GOAL_BONUS, XP_GYM_VISIT } from '../../services/gamificationService';
import { PRIZES } from '../../services/torneoService';

const fmt = (n) => n.toLocaleString('es-AR');
const RESORTE = { damping: 22, stiffness: 220, mass: 0.9 };

// Botón + hoja que explica cómo se ganan los puntos. Los números salen de las
// mismas constantes con las que la app los da: si cambian, esto cambia solo.
//
// La hoja se maneja con la manija (la parte de arriba): arrastrando para
// arriba se agranda, para abajo se achica y, si se baja lo suficiente (o
// rápido), se cierra. Tocar lo oscuro de afuera también la cierra. El fondo
// oscuro cubre toda la pantalla, también detrás de las esquinas redondeadas
// (antes ahí se veían dos cuadrados de la pantalla de atrás).
export default function ComoSumarPuntos() {
  const { theme: { colors } } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: altoPantalla } = useWindowDimensions();
  const [abierto, setAbierto] = useState(false);

  // Alturas de la hoja: al abrir y agrandada. Agrandada deja una franja
  // oscura de 72 px debajo de la barra de estado, para poder tocar afuera y
  // cerrarla (los toques sobre la barra de estado se los queda el sistema).
  const ALTO_INICIAL = Math.round(altoPantalla * 0.75);
  const ALTO_MAX = Math.max(ALTO_INICIAL, Math.round(altoPantalla - insets.top - 72));

  // Lo que se ve de la hoja (0 = cerrada). Por encima de ALTO_INICIAL crece
  // la hoja; por debajo, la hoja baja entera (no se aplasta el contenido).
  const visible = useSharedValue(0);
  const inicioArrastre = useSharedValue(0);

  useEffect(() => {
    if (abierto) visible.value = withSpring(ALTO_INICIAL, RESORTE);
  }, [abierto, ALTO_INICIAL, visible]);

  const cerrar = useCallback(() => {
    visible.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.cubic) }, (ok) => {
      if (ok) runOnJS(setAbierto)(false);
    });
  }, [visible]);

  // Botón "atrás" de Android: cierra con la misma animación.
  useEffect(() => {
    if (!abierto) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { cerrar(); return true; });
    return () => sub.remove();
  }, [abierto, cerrar]);

  const arrastre = Gesture.Pan()
    .onBegin(() => { inicioArrastre.value = visible.value; })
    .onUpdate((e) => {
      visible.value = Math.max(0, Math.min(ALTO_MAX, inicioArrastre.value - e.translationY));
    })
    .onEnd((e) => {
      const v = visible.value;
      // Rápido para abajo, o bajada más de un tercio: se cierra.
      if (e.velocityY > 900 || v < ALTO_INICIAL * 0.66) {
        visible.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) }, (ok) => {
          if (ok) runOnJS(setAbierto)(false);
        });
        return;
      }
      // Si no, queda en la altura más cercana (o hacia donde se tiró).
      const agrandar = e.velocityY < -600 || (e.velocityY < 600 && v > (ALTO_INICIAL + ALTO_MAX) / 2);
      visible.value = withSpring(agrandar ? ALTO_MAX : ALTO_INICIAL, { ...RESORTE, velocity: -e.velocityY });
    });

  const fondoStyle = useAnimatedStyle(() => ({
    opacity: interpolate(visible.value, [0, ALTO_INICIAL], [0, 1], Extrapolation.CLAMP),
  }));
  const hojaStyle = useAnimatedStyle(() => ({
    height: Math.max(visible.value, ALTO_INICIAL),
    transform: [{ translateY: Math.max(0, ALTO_INICIAL - visible.value) }],
  }));

  const Fila = ({ izq, der }) => (
    <View style={[st.fila, { borderBottomColor: colors.border }]}>
      <Text style={[st.filaIzq, { color: colors.textSecondary }]}>{izq}</Text>
      <Text style={[st.filaDer, { color: colors.primary }]}>{der}</Text>
    </View>
  );

  const Seccion = ({ icono, titulo, children }) => (
    <View style={[st.seccion, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }]}>
      <View style={st.seccionTitulo}>
        <View style={[st.icono, { backgroundColor: colors.primary + '22' }]}>
          <Ionicons name={icono} size={16} color={colors.primary} />
        </View>
        <Text style={[st.titulo, { color: colors.text }]}>{titulo}</Text>
      </View>
      {children}
    </View>
  );

  return (
    <>
      <TouchableOpacity
        style={[st.boton, { backgroundColor: colors.primary + '1A', borderColor: colors.primary + '55' }]}
        onPress={() => setAbierto(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="help-circle-outline" size={15} color={colors.primary} />
        <Text style={[st.botonTexto, { color: colors.primary }]}>¿Cómo sumo puntos?</Text>
      </TouchableOpacity>

      <Modal visible={abierto} transparent animationType="none" onRequestClose={cerrar} statusBarTranslucent navigationBarTranslucent>
        {/* Los gestos dentro de un Modal necesitan su propia raíz. */}
        <GestureHandlerRootView style={st.raiz}>
          <Animated.View style={[StyleSheet.absoluteFill, st.fondo, fondoStyle]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={cerrar} />
          </Animated.View>

          <Animated.View style={[st.hoja, { backgroundColor: colors.background, borderColor: colors.border, paddingBottom: insets.bottom + 16 }, hojaStyle]}>
            {/* Manija + título: de acá se arrastra la hoja. */}
            <GestureDetector gesture={arrastre}>
              <View style={st.agarre}>
                <View style={[st.manija, { backgroundColor: colors.textTertiary }]} />
                <View style={st.cabecera}>
                  <Text style={[st.cabeceraTitulo, { color: colors.text }]}>Cómo sumar puntos</Text>
                  <TouchableOpacity onPress={cerrar} hitSlop={12}>
                    <Ionicons name="close" size={22} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <Text style={[st.intro, { color: colors.textSecondary }]}>
                  Los puntos (XP) te hacen subir de nivel y cuentan para los torneos. Se suman solos con tu actividad: no hace falta tocar nada.
                </Text>
              </View>
            </GestureDetector>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
              <Seccion icono="footsteps" titulo="Pasos (cada día)">
                <Fila izq="Cada 1.000 pasos" der={`+${XP_PER_1K_STEPS}`} />
                <Fila izq="Llegar a tu meta diaria" der={`+${XP_GOAL_BONUS}`} />
                {stepMilestones.map((m) => (
                  <Fila key={m.steps} izq={`Hito de ${fmt(m.steps)} pasos${m.isPremium ? ' ★' : ''}`} der={`+${m.xp}`} />
                ))}
              </Seccion>

              <Seccion icono="barbell" titulo="Gimnasio">
                <Fila izq="Cada visita al gym" der={`+${XP_GYM_VISIT}`} />
              </Seccion>

              <Seccion icono="ribbon" titulo="Logros">
                {LOGROS_DEF.map((l) => <Fila key={l.id} izq={l.title} der={`+${l.xp}`} />)}
              </Seccion>

              <Seccion icono="trophy" titulo="Torneos (al terminar)">
                <Fila izq="🥇 1° puesto" der={`+${PRIZES[0].xp}`} />
                <Fila izq="🥈 2° puesto" der={`+${PRIZES[1].xp}`} />
                <Fila izq="🥉 3° puesto" der={`+${PRIZES[2].xp}`} />
              </Seccion>

              <Text style={[st.pie, { color: colors.textTertiary }]}>
                Cada nivel pide un poco más: del 1 al 2 necesitás 1.000 XP, del 2 al 3 2.000 XP, y así.
              </Text>
            </ScrollView>
          </Animated.View>
        </GestureHandlerRootView>
      </Modal>
    </>
  );
}

const st = StyleSheet.create({
  boton:          { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1 },
  botonTexto:     { fontSize: 12, fontWeight: '700' },
  raiz:           { flex: 1, justifyContent: 'flex-end' },
  fondo:          { backgroundColor: 'rgba(0,0,0,0.55)' },
  // Bien redondeada arriba; overflow hidden para que nada se salga de las curvas.
  hoja:           { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: StyleSheet.hairlineWidth, borderBottomWidth: 0, paddingHorizontal: 18, overflow: 'hidden' },
  agarre:         { paddingTop: 10 },
  manija:         { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, marginBottom: 12, opacity: 0.5 },
  cabecera:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cabeceraTitulo: { fontSize: 20, fontWeight: '800' },
  intro:          { fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 14 },
  seccion:        { borderRadius: 18, borderWidth: 1, padding: 14 },
  seccionTitulo:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  icono:          { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  titulo:         { fontSize: 15, fontWeight: '800' },
  fila:           { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  filaIzq:        { fontSize: 14, flex: 1 },
  filaDer:        { fontSize: 14, fontWeight: '800' },
  pie:            { fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 4 },
});
