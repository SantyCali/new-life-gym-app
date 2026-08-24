import { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Animated } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useTheme } from '../../context/ThemeContext';

export default function SplashLoader() {
  const { theme: { colors, isDark } } = useTheme();
  const pulse = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    // Ocultar el splash nativo; SplashLoader ya está visible
    SplashScreen.hideAsync().catch(() => {});

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
  }, [pulse]);

  const icon = isDark
    ? require('../../../assets/icon-dark.png')
    : require('../../../assets/icon-light.png');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <Image source={icon} style={styles.logo} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  logo: {
    width:  140,
    height: 140,
  },
});
