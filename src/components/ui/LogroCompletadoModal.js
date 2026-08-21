import { useRef, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet,
  Animated, Easing, TouchableOpacity, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { radius, spacing } from '../../theme';
import { playLogroSound } from '../../utils/playSound';

const GREEN     = '#22c55e';
const GREEN_DIM = '#16a34a';
const DURATION  = 10000;

function Ripple({ delay, size }) {
  const scale   = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale,   { toValue: 1.6, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0,   duration: 1200, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale,   { toValue: 0.4, duration: 1, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.7, duration: 1, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size, height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: GREEN,
        transform: [{ scale }],
        opacity,
      }}
    />
  );
}

// logro = { title, description, icon, xp }
export default function LogroCompletadoModal({ logro, onClose }) {
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const cardScale      = useRef(new Animated.Value(0.5)).current;
  const cardOpacity    = useRef(new Animated.Value(0)).current;
  const iconRotate     = useRef(new Animated.Value(0)).current;
  const iconScale      = useRef(new Animated.Value(0.5)).current;
  const titleScale     = useRef(new Animated.Value(0.3)).current;
  const glowOpacity    = useRef(new Animated.Value(0.2)).current;
  const progressWidth  = useRef(new Animated.Value(1)).current;
  const dismissRef     = useRef(null);

  function dismiss() {
    clearTimeout(dismissRef.current);
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(cardScale,      { toValue: 0.82, duration: 180, useNativeDriver: true }),
      Animated.timing(cardOpacity,    { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => onClose());
  }

  useEffect(() => {
    playLogroSound();

    // Entry sequence — igual a LevelUpModal
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.spring(cardScale,      { toValue: 1, damping: 13, stiffness: 220, useNativeDriver: true }),
      Animated.timing(cardOpacity,    { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      // Ícono: punch in + spin
      Animated.sequence([
        Animated.spring(iconScale, { toValue: 1.2, damping: 8, stiffness: 300, useNativeDriver: true }),
        Animated.spring(iconScale, { toValue: 1,   damping: 12, stiffness: 200, useNativeDriver: true }),
      ]).start();

      Animated.timing(iconRotate, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }).start();

      // Título punch in
      Animated.spring(titleScale, {
        toValue: 1,
        damping: 10,
        stiffness: 280,
        useNativeDriver: true,
      }).start();

      // Borde pulsante
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowOpacity, { toValue: 0.9, duration: 900, useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0.2, duration: 900, useNativeDriver: true }),
        ])
      ).start();
    });

    // Barra de cuenta regresiva
    Animated.timing(progressWidth, {
      toValue: 0,
      duration: DURATION,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    dismissRef.current = setTimeout(dismiss, DURATION);
    return () => clearTimeout(dismissRef.current);
  }, []);

  const spin = iconRotate.interpolate({
    inputRange:  [0, 1],
    outputRange: ['-20deg', '0deg'],
  });

  const barWidth = progressWidth.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal visible transparent animationType="none" onRequestClose={() => {}} statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => {}}>
        <Animated.View style={[st.overlay, { opacity: overlayOpacity }]} />
      </Pressable>

      <Animated.View
        style={[st.cardWrap, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}
        pointerEvents="box-none"
      >
        <LinearGradient colors={['#0a1f0f', '#071409']} style={st.card}>
          {/* Borde luminoso */}
          <View style={[StyleSheet.absoluteFillObject, st.cardBorder]} pointerEvents="none">
            <Animated.View style={[StyleSheet.absoluteFillObject, { borderRadius: 28, borderWidth: 1.5, borderColor: GREEN, opacity: glowOpacity }]} />
          </View>

          {/* Ripples + ícono */}
          <View style={st.iconArea} pointerEvents="none">
            <Ripple delay={0}   size={130} />
            <Ripple delay={400} size={130} />
            <Ripple delay={800} size={130} />
            <View style={st.iconCircle}>
              <Animated.View style={{ transform: [{ scale: iconScale }, { rotate: spin }] }}>
                <Ionicons name={logro?.icon ?? 'medal'} size={48} color={GREEN} />
              </Animated.View>
            </View>
          </View>

          {/* Label */}
          <Text style={st.label}>¡LOGRO DESBLOQUEADO!</Text>

          {/* Título */}
          <Animated.View style={{ transform: [{ scale: titleScale }] }}>
            <Text style={st.title}>{logro?.title}</Text>
          </Animated.View>

          {/* Descripción */}
          <Text style={st.desc}>{logro?.description}</Text>

          {/* XP chip */}
          <View style={st.xpChip}>
            <Ionicons name="star" size={14} color={GREEN} />
            <Text style={st.xpText}>+{logro?.xp} XP</Text>
          </View>

          {/* Botón */}
          <TouchableOpacity style={st.btn} onPress={dismiss} activeOpacity={0.85}>
            <Text style={st.btnText}>¡Excelente!</Text>
          </TouchableOpacity>

          {/* Barra de cuenta regresiva */}
          <View style={st.progressTrack}>
            <Animated.View style={[st.progressFill, { width: barWidth }]} />
          </View>
        </LinearGradient>
      </Animated.View>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  cardWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: 300,
    borderRadius: 28,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['2xl'],
    paddingBottom: 0,
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
  },
  cardBorder: { borderRadius: 28 },

  iconArea: {
    width: 130, height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconCircle: {
    width: 90, height: 90,
    borderRadius: 45,
    backgroundColor: '#22c55e18',
    borderWidth: 2,
    borderColor: '#22c55e50',
    alignItems: 'center',
    justifyContent: 'center',
  },

  label: {
    fontSize: 11,
    fontWeight: '900',
    color: GREEN,
    letterSpacing: 2.5,
    textAlign: 'center',
    opacity: 0.85,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginTop: -4,
    textShadowColor: GREEN,
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
  },
  desc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: -2,
    marginBottom: 2,
  },
  xpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#22c55e18',
    borderWidth: 1,
    borderColor: '#22c55e40',
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  xpText: {
    fontSize: 14,
    fontWeight: '800',
    color: GREEN,
  },

  btn: {
    backgroundColor: GREEN,
    borderRadius: radius.full,
    paddingVertical: 14,
    paddingHorizontal: 52,
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 0.3,
  },

  progressTrack: {
    width: '100%',
    height: 3,
    backgroundColor: '#ffffff10',
    marginTop: 2,
  },
  progressFill: {
    height: 3,
    backgroundColor: GREEN_DIM,
    borderRadius: 2,
  },
});
