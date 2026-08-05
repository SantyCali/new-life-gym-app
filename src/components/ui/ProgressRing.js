import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function ProgressRing({
  progress = 0,
  radius = 100,
  strokeWidth = 14,
  color,
  trackColor,
  replayKey,
  duration = 1500,
  children,
}) {
  const { theme: { colors } } = useTheme();
  const arcColor   = color      ?? colors.primary;
  const trackFill  = trackColor ?? colors.surfaceContainerLow;

  const PAD = 28;
  const size        = (radius + strokeWidth + PAD) * 2;
  const cx          = radius + strokeWidth + PAD;
  const cy          = radius + strokeWidth + PAD;
  const circumference = 2 * Math.PI * radius;
  const clamped     = Math.min(Math.max(progress, 0), 100);
  const dashArc     = `${circumference} ${circumference}`;

  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: clamped,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [replayKey, clamped, duration, anim]);

  const dashoffset = anim.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={[{ width: size, height: size }, styles.glowWrap, { shadowColor: arcColor }]}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${cx}, ${cy}`}>
          {/* Track */}
          <Circle cx={cx} cy={cy} r={radius} stroke={trackFill} strokeWidth={strokeWidth} fill="none" />
          {/* Halo exterior */}
          <AnimatedCircle cx={cx} cy={cy} r={radius} stroke={arcColor} strokeWidth={strokeWidth + 26} strokeOpacity={0.05} fill="none" strokeDasharray={dashArc} strokeDashoffset={dashoffset} strokeLinecap="round" />
          {/* Halo medio */}
          <AnimatedCircle cx={cx} cy={cy} r={radius} stroke={arcColor} strokeWidth={strokeWidth + 16} strokeOpacity={0.10} fill="none" strokeDasharray={dashArc} strokeDashoffset={dashoffset} strokeLinecap="round" />
          {/* Glow interior */}
          <AnimatedCircle cx={cx} cy={cy} r={radius} stroke={arcColor} strokeWidth={strokeWidth + 7}  strokeOpacity={0.32} fill="none" strokeDasharray={dashArc} strokeDashoffset={dashoffset} strokeLinecap="round" />
          {/* Arco sólido */}
          <AnimatedCircle cx={cx} cy={cy} r={radius} stroke={arcColor} strokeWidth={strokeWidth}       fill="none"         strokeDasharray={dashArc} strokeDashoffset={dashoffset} strokeLinecap="round" />
          {/* Filo blanco LED */}
          <AnimatedCircle cx={cx} cy={cy} r={radius} stroke={colors.text} strokeWidth={Math.max(strokeWidth * 0.32, 2)} strokeOpacity={0.85} fill="none" strokeDasharray={dashArc} strokeDashoffset={dashoffset} strokeLinecap="round" />
        </G>
      </Svg>
      {children && (
        <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center:   { alignItems: 'center', justifyContent: 'center' },
  glowWrap: {
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius:  28,
    elevation:     12,
  },
});
