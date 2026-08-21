import { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing } from '../../theme';

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function AnnouncementCard({ announcement, colors, onPress }) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;
  const shimmerX  = useRef(new Animated.Value(-160)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, damping: 18, stiffness: 200, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(iconScale, { toValue: 1.12, duration: 900, useNativeDriver: true }),
        Animated.timing(iconScale, { toValue: 1.0,  duration: 900, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    ).start();

    // Shimmer sweep: sword-reflection light beam across the card
    Animated.loop(
      Animated.sequence([
        Animated.delay(3000),
        Animated.timing(shimmerX, {
          toValue: 420,
          duration: 700,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(shimmerX, { toValue: -160, duration: 1, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const p = colors.primary;

  const borderOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.95],
  });

  return (
    <Animated.View
      style={[
        st.outer,
        { shadowColor: p, opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      {/* Animated glow border */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, st.glowBorder, { borderColor: p, opacity: borderOpacity }]}
      />

      <LinearGradient
        colors={[p + '22', colors.surface + 'F4']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={st.card}
      >
        {/* Ambient orb — static glow */}
        <View style={[st.orb, { backgroundColor: p + '30' }]} />

        {/* Shimmer beam — sword reflection sweep */}
        <Animated.View
          style={[st.shimmerWrap, { transform: [{ translateX: shimmerX }, { rotate: '22deg' }] }]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={['transparent', '#ffffff18', '#ffffff55', '#ffffff18', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={st.shimmerBeam}
          />
        </Animated.View>

        <View style={st.body}>
          {/* Icon */}
          <View style={[st.iconWrap, { backgroundColor: colors.surfaceElevated, borderColor: p + '45' }]}>
            <View style={[StyleSheet.absoluteFillObject, st.iconTint, { backgroundColor: p + '18' }]} />
            <Animated.View style={{ transform: [{ scale: iconScale }] }}>
              <Ionicons name="megaphone" size={28} color={p} />
            </Animated.View>
          </View>

          {/* Texts */}
          <View style={st.texts}>
            <Text style={[st.title, { color: p }]} numberOfLines={2}>
              {announcement.title}
            </Text>
            <Text style={[st.message, { color: colors.text }]} numberOfLines={5}>
              {announcement.message}
            </Text>
            <Text style={[st.meta, { color: colors.textTertiary }]}>
              {announcement.trainerName}
              {announcement.createdAt ? `  ·  ${formatDate(announcement.createdAt)}` : ''}
            </Text>
          </View>
        </View>

        {/* Bottom gradient line */}
        <LinearGradient
          colors={[p, p + '00']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={st.bottomLine}
        />

      </LinearGradient>

      {/* Tap overlay — encima de todo para capturar el press */}
      {onPress && (
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={onPress}
          activeOpacity={0.88}
        />
      )}
    </Animated.View>
  );
}

const st = StyleSheet.create({
  outer: {
    marginBottom: spacing.lg,
    borderRadius: radius.xl + 2,
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  glowBorder: {
    borderRadius: radius.xl + 2,
    borderWidth: 1.5,
  },
  card: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    top: -50,
    left: -50,
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  shimmerWrap: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 70,
  },
  shimmerBeam: {
    flex: 1,
  },
  body: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  iconTint: {
    borderRadius: 14,
  },
  texts: { flex: 1, gap: 6 },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    marginTop: 2,
  },
  meta: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginTop: 4,
    opacity: 0.8,
  },
  bottomLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
});
