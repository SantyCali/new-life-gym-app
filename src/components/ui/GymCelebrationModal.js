import { useRef, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet,
  Animated, Easing, TouchableOpacity, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { radius, spacing, typography } from '../../theme';
import { playGymSound } from '../../utils/playSound';

const GREEN      = '#22C55E';
const GREEN_DIM  = '#16A34A';
const DURATION   = 9000;

export default function GymCelebrationModal({ onClose, xp = 150 }) {
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const cardScale      = useRef(new Animated.Value(0.55)).current;
  const cardOpacity    = useRef(new Animated.Value(0)).current;
  const iconScale      = useRef(new Animated.Value(1)).current;
  const rippleScale    = useRef(new Animated.Value(1)).current;
  const rippleOpacity  = useRef(new Animated.Value(0.55)).current;
  const progressWidth  = useRef(new Animated.Value(1)).current; // 1→0, not native driver

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
    // ── Entry ─────────────────────────────────────────────────────
    playGymSound();

    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.spring(cardScale, { toValue: 1, damping: 15, stiffness: 240, useNativeDriver: true }),
      Animated.timing(cardOpacity,    { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      // Icon pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(iconScale, { toValue: 1.13, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(iconScale, { toValue: 1,    duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();

      // Ripple outward
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(rippleScale,   { toValue: 1.7, duration: 950, useNativeDriver: true }),
            Animated.timing(rippleOpacity, { toValue: 0,   duration: 950, useNativeDriver: true }),
          ]),
          Animated.delay(300),
          Animated.parallel([
            Animated.timing(rippleScale,   { toValue: 1,    duration: 1, useNativeDriver: true }),
            Animated.timing(rippleOpacity, { toValue: 0.55, duration: 1, useNativeDriver: true }),
          ]),
        ])
      ).start();
    });

    // Countdown bar (JS-driven, 1 → 0 over DURATION ms)
    Animated.timing(progressWidth, {
      toValue: 0,
      duration: DURATION,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    // Auto-dismiss
    dismissRef.current = setTimeout(dismiss, DURATION);
    return () => clearTimeout(dismissRef.current);
  }, []);

  const barWidth = progressWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal visible transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      {/* Overlay tap to dismiss */}
      <Pressable style={StyleSheet.absoluteFill} onPress={dismiss}>
        <Animated.View style={[st.overlay, { opacity: overlayOpacity }]} />
      </Pressable>

      {/* Card */}
      <Animated.View
        style={[st.cardWrap, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}
        pointerEvents="box-none"
      >
        <LinearGradient colors={['#0C1F10', '#091409']} style={st.card}>
          {/* Card border */}
          <View style={[StyleSheet.absoluteFillObject, st.cardBorder]} pointerEvents="none" />

          {/* Icon with ripple */}
          <View style={st.iconArea}>
            <Animated.View
              style={[st.ripple, { transform: [{ scale: rippleScale }], opacity: rippleOpacity }]}
              pointerEvents="none"
            />
            <View style={st.iconCircle}>
              <Animated.View style={{ transform: [{ scale: iconScale }] }}>
                <Ionicons name="barbell" size={48} color={GREEN} />
              </Animated.View>
            </View>
          </View>

          {/* Text */}
          <Text style={st.title}>¡Estás en el gym!</Text>
          <Text style={st.subtitle}>Hora de entrenar duro 💪</Text>

          {/* Reward */}
          <View style={st.rewardRow}>
            <View style={st.rewardChip}>
              <Text style={st.rewardText}>+{xp} XP</Text>
            </View>
          </View>

          {/* Button */}
          <TouchableOpacity style={st.btn} onPress={dismiss} activeOpacity={0.85}>
            <Text style={st.btnText}>¡Vamos!</Text>
          </TouchableOpacity>

          {/* Countdown bar */}
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
    backgroundColor: 'rgba(0,0,0,0.80)',
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
    gap: 8,
    overflow: 'hidden',
  },
  cardBorder: {
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#22C55E35',
  },

  iconArea: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  ripple: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#22C55E28',
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#16A34A1A',
    borderWidth: 2,
    borderColor: '#22C55E45',
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.50)',
    textAlign: 'center',
    marginBottom: 6,
  },

  rewardRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    marginBottom: 4,
  },
  rewardChip: {
    backgroundColor: '#22C55E18',
    borderWidth: 1,
    borderColor: '#22C55E40',
    borderRadius: radius.full,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  rewardText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#22C55E',
    letterSpacing: 0.2,
  },
  btn: {
    backgroundColor: GREEN,
    borderRadius: radius.full,
    paddingVertical: 14,
    paddingHorizontal: 52,
    marginTop: 6,
    marginBottom: spacing.lg,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },

  progressTrack: {
    width: '100%',
    height: 3,
    backgroundColor: '#ffffff12',
    marginTop: 2,
  },
  progressFill: {
    height: 3,
    backgroundColor: GREEN_DIM,
    borderRadius: 2,
  },
});
