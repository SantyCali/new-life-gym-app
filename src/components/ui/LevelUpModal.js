import { useRef, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet,
  Animated, Easing, TouchableOpacity, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { radius, spacing } from '../../theme';
import { playLevelUpSound } from '../../utils/playSound';

const GOLD     = '#FBBF24';
const GOLD_DIM = '#D97706';
const DURATION = 10000;

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
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: GOLD,
        transform: [{ scale }],
        opacity,
      }}
    />
  );
}

export default function LevelUpModal({ fromLevel, toLevel, onClose }) {
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const cardScale      = useRef(new Animated.Value(0.5)).current;
  const cardOpacity    = useRef(new Animated.Value(0)).current;
  const iconRotate     = useRef(new Animated.Value(0)).current;
  const iconScale      = useRef(new Animated.Value(0.5)).current;
  const levelScale     = useRef(new Animated.Value(0.3)).current;
  const glowOpacity    = useRef(new Animated.Value(0.2)).current;
  const progressWidth  = useRef(new Animated.Value(1)).current;

  const dismissRef = useRef(null);

  function dismiss() {
    clearTimeout(dismissRef.current);
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(cardScale,      { toValue: 0.82, duration: 180, useNativeDriver: true }),
      Animated.timing(cardOpacity,    { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => onClose());
  }

  useEffect(() => {
    playLevelUpSound();

    // Entry sequence
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.spring(cardScale,      { toValue: 1, damping: 13, stiffness: 220, useNativeDriver: true }),
      Animated.timing(cardOpacity,    { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      // Trophy icon: spin once then settle
      Animated.sequence([
        Animated.spring(iconScale,  { toValue: 1.2, damping: 8, stiffness: 300, useNativeDriver: true }),
        Animated.spring(iconScale,  { toValue: 1,   damping: 12, stiffness: 200, useNativeDriver: true }),
      ]).start();

      Animated.timing(iconRotate, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }).start();

      // Level number punch in
      Animated.spring(levelScale, {
        toValue: 1,
        damping: 10,
        stiffness: 280,
        useNativeDriver: true,
      }).start();

      // Border glow pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowOpacity, { toValue: 0.9, duration: 900, useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0.2, duration: 900, useNativeDriver: true }),
        ])
      ).start();
    });

    // Countdown bar
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
    inputRange: [0, 1],
    outputRange: ['-20deg', '0deg'],
  });

  const barWidth = progressWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal visible transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={dismiss}>
        <Animated.View style={[st.overlay, { opacity: overlayOpacity }]} />
      </Pressable>

      <Animated.View
        style={[st.cardWrap, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}
        pointerEvents="box-none"
      >
        <LinearGradient colors={['#1C1400', '#120F00']} style={st.card}>
          <View style={[StyleSheet.absoluteFillObject, st.cardBorder]} pointerEvents="none">
            <Animated.View style={[StyleSheet.absoluteFillObject, { borderRadius: 28, borderWidth: 1.5, borderColor: GOLD, opacity: glowOpacity }]} />
          </View>

          {/* Ripples around icon */}
          <View style={st.iconArea} pointerEvents="none">
            <Ripple delay={0}    size={130} />
            <Ripple delay={400}  size={130} />
            <Ripple delay={800}  size={130} />

            <View style={st.iconCircle}>
              <Animated.View style={{ transform: [{ scale: iconScale }, { rotate: spin }] }}>
                <Ionicons name="trophy" size={48} color={GOLD} />
              </Animated.View>
            </View>
          </View>

          {/* Label */}
          <Text style={st.label}>¡SUBISTE DE NIVEL!</Text>

          {/* Level number */}
          <Animated.View style={{ transform: [{ scale: levelScale }] }}>
            <Text style={st.levelNum}>Nivel {toLevel}</Text>
          </Animated.View>

          {/* From → To */}
          <View style={st.arrowRow}>
            <View style={st.levelChip}>
              <Text style={st.levelChipText}>Nivel {fromLevel}</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={GOLD} style={{ opacity: 0.6 }} />
            <View style={[st.levelChip, st.levelChipActive]}>
              <Text style={[st.levelChipText, { color: '#000' }]}>Nivel {toLevel}</Text>
            </View>
          </View>

          <Text style={st.subtitle}>Seguís progresando 🔥 Así se hace.</Text>

          <TouchableOpacity style={st.btn} onPress={dismiss} activeOpacity={0.85}>
            <Text style={st.btnText}>¡Gracias!</Text>
          </TouchableOpacity>

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
  cardBorder: {
    borderRadius: 28,
  },

  iconArea: {
    width: 130,
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#FBBF2415',
    borderWidth: 2,
    borderColor: '#FBBF2450',
    alignItems: 'center',
    justifyContent: 'center',
  },

  label: {
    fontSize: 11,
    fontWeight: '900',
    color: GOLD,
    letterSpacing: 2.5,
    textAlign: 'center',
    opacity: 0.85,
  },
  levelNum: {
    fontSize: 42,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -1,
    textAlign: 'center',
    marginTop: -4,
    textShadowColor: GOLD,
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 0 },
  },

  arrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: -2,
  },
  levelChip: {
    backgroundColor: '#FBBF2415',
    borderWidth: 1,
    borderColor: '#FBBF2440',
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  levelChipActive: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  levelChipText: {
    fontSize: 13,
    fontWeight: '800',
    color: GOLD,
  },

  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 4,
  },

  btn: {
    backgroundColor: GOLD,
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
    backgroundColor: GOLD_DIM,
    borderRadius: 2,
  },
});
