import { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export default function SplashLoader() {
  const { theme: { colors, isDark } } = useTheme();
  const pulse  = useRef(new Animated.Value(0.85)).current;
  const fade   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in rápido
    Animated.timing(fade, {
      toValue:         1,
      duration:        300,
      useNativeDriver: true,
    }).start();

    // Pulso suave infinito
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue:         1,
          duration:        900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue:         0.85,
          duration:        900,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [fade, pulse]);

  const icon = isDark
    ? require('../../../assets/icon-dark.png')
    : require('../../../assets/icon-light.png');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View style={{ opacity: fade, transform: [{ scale: pulse }] }}>
        <Image source={icon} style={styles.logo} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
  },
  logo: {
    width:  140,
    height: 140,
  },
});
