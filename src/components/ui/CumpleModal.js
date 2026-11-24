import { useRef, useEffect, useMemo } from 'react';
import {
  Modal, View, Text, StyleSheet, Animated, Easing, TouchableOpacity, Pressable, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { spacing } from '../../theme';

// Festejo de cumpleaños: globos que suben, lluvia de papelitos y una tarjeta del gym. Se muestra
// una vez por año, el día del cumple (ver cumpleService y GymEventsContext).
const COLORES = ['#F472B6', '#FACC15', '#22C55E', '#38BDF8', '#A78BFA', '#FB923C', '#F87171'];
const PAPELITOS = 24;
const GLOBOS = 18;

// Globo que sube desde abajo meciéndose (como el de cumpleaños de Twitter):
// óvalo con brillo, nudito e hilo.
function Globo({ alto, ancho, i }) {
  const subida = useRef(new Animated.Value(0)).current;
  const g = useMemo(() => {
    const t = 0.8 + Math.random() * 0.45;
    return {
      x: (ancho / GLOBOS) * i + Math.random() * 24 - 12,
      w: 46 * t,
      h: 58 * t,
      color: COLORES[(i * 3) % COLORES.length],
      dura: 4200 + Math.random() * 2600,
      // Los primeros salen enseguida, el resto escalonados.
      espera: i < 7 ? Math.random() * 400 : 500 + Math.random() * 1800,
      vaiven: 10 + Math.random() * 16,
      inclina: 6 + Math.random() * 6,
    };
  }, [ancho, i]);

  // Una sola tanda (como en Twitter): después queda la tarjeta limpia.
  useEffect(() => {
    const anim = Animated.sequence([
      Animated.delay(g.espera),
      Animated.timing(subida, { toValue: 1, duration: g.dura, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [subida, g]);

  const translateY = subida.interpolate({ inputRange: [0, 1], outputRange: [alto + 20, -g.h - 90] });
  const translateX = subida.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, g.vaiven, 0, -g.vaiven, 0],
  });
  const rotate = subida.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: ['0deg', `${g.inclina}deg`, '0deg', `-${g.inclina}deg`, '0deg'],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', left: g.x, top: 0, alignItems: 'center', transform: [{ translateY }, { translateX }, { rotate }] }}
    >
      <View style={{ width: g.w, height: g.h, borderRadius: g.w / 2, backgroundColor: g.color }}>
        <View style={{
          position: 'absolute', left: g.w * 0.2, top: g.h * 0.14,
          width: g.w * 0.22, height: g.h * 0.3, borderRadius: g.w, backgroundColor: 'rgba(255,255,255,0.35)',
          transform: [{ rotate: '20deg' }],
        }} />
      </View>
      {/* Nudito */}
      <View style={{
        width: 0, height: 0, marginTop: -2,
        borderLeftWidth: 5, borderRightWidth: 5, borderBottomWidth: 7,
        borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: g.color,
      }} />
      {/* Hilo */}
      <View style={{ width: 1.2, height: 70, backgroundColor: 'rgba(255,255,255,0.45)' }} />
    </Animated.View>
  );
}

function Papelito({ alto, ancho, i }) {
  const caida = useRef(new Animated.Value(0)).current;
  // Cada papelito con su lugar, tamaño, color, velocidad y vaivén propios.
  const p = useMemo(() => ({
    x: Math.random() * ancho,
    w: 6 + Math.random() * 6,
    h: 10 + Math.random() * 8,
    color: COLORES[i % COLORES.length],
    redondo: i % 5 === 0,
    dura: 2600 + Math.random() * 2200,
    espera: Math.random() * 1400,
    vaiven: 18 + Math.random() * 30,
    vueltas: (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 3),
  }), [ancho, i]);

  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.delay(p.espera),
      Animated.timing(caida, { toValue: 1, duration: p.dura, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(caida, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, [caida, p]);

  const translateY = caida.interpolate({ inputRange: [0, 1], outputRange: [-40, alto + 40] });
  const translateX = caida.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, p.vaiven, 0, -p.vaiven, 0],
  });
  const rotate = caida.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.vueltas * 360}deg`] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: p.x,
        top: 0,
        width: p.w,
        height: p.redondo ? p.w : p.h,
        borderRadius: p.redondo ? p.w / 2 : 2,
        backgroundColor: p.color,
        transform: [{ translateY }, { translateX }, { rotate }],
      }}
    />
  );
}

export default function CumpleModal({ nombre, onClose }) {
  const { width, height } = useWindowDimensions();
  const fondo     = useRef(new Animated.Value(0)).current;
  const escala    = useRef(new Animated.Value(0.5)).current;
  const opacidad  = useRef(new Animated.Value(0)).current;
  const torta     = useRef(new Animated.Value(0)).current;

  function cerrar() {
    Animated.parallel([
      Animated.timing(fondo,    { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(escala,   { toValue: 0.85, duration: 180, useNativeDriver: true }),
      Animated.timing(opacidad, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => onClose());
  }

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.parallel([
      Animated.timing(fondo, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.spring(escala, { toValue: 1, damping: 13, stiffness: 200, useNativeDriver: true }),
      Animated.timing(opacidad, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
    // La torta se balancea.
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(torta, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(torta, { toValue: -1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(torta, { toValue: 0, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  const giro = torta.interpolate({ inputRange: [-1, 1], outputRange: ['-10deg', '10deg'] });
  const salto = torta.interpolate({ inputRange: [-1, 0, 1], outputRange: [-4, 0, -4] });

  return (
    <Modal visible transparent animationType="none" onRequestClose={cerrar} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={cerrar}>
        <Animated.View style={[st.fondo, { opacity: fondo }]} />
      </Pressable>

      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fondo }]} pointerEvents="none">
        {Array.from({ length: PAPELITOS }, (_, i) => <Papelito key={`p${i}`} i={i} alto={height} ancho={width} />)}
      </Animated.View>

      {/* Los globos pasan por delante de la tarjeta, como en Twitter. */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fondo, zIndex: 2 }]} pointerEvents="none">
        {Array.from({ length: GLOBOS }, (_, i) => <Globo key={`g${i}`} i={i} alto={height} ancho={width} />)}
      </Animated.View>

      <Animated.View style={[st.centro, { opacity: opacidad, transform: [{ scale: escala }] }]} pointerEvents="box-none">
        <LinearGradient colors={['#2A1238', '#14091D']} style={st.tarjeta}>
          <View style={[StyleSheet.absoluteFillObject, st.borde]} pointerEvents="none" />
          <Animated.Text style={[st.torta, { transform: [{ rotate: giro }, { translateY: salto }] }]}>🎂</Animated.Text>
          <Text style={st.titulo}>¡Feliz cumple{nombre ? `,\n${nombre}` : ''}!</Text>
          <Text style={st.texto}>
            Todo el equipo de New Life Gym te desea un día increíble. ¡Que lo disfrutes a full! 💪🎉
          </Text>
          <TouchableOpacity style={st.boton} onPress={cerrar} activeOpacity={0.85}>
            <Text style={st.botonTexto}>¡Gracias!</Text>
          </TouchableOpacity>
        </LinearGradient>
      </Animated.View>
    </Modal>
  );
}

const st = StyleSheet.create({
  fondo: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.78)',
  },
  centro: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tarjeta: {
    width: 310,
    borderRadius: 28,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
  },
  borde: {
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#F472B655',
  },
  torta: {
    fontSize: 72,
    lineHeight: 86,
  },
  titulo: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  texto: {
    fontSize: 15,
    lineHeight: 21,
    color: '#E9D5FF',
    textAlign: 'center',
    marginBottom: 6,
  },
  boton: {
    alignSelf: 'stretch',
    backgroundColor: '#F472B6',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  botonTexto: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A0B22',
  },
});
