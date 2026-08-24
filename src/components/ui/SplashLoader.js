import { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Animated, useColorScheme } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

export default function SplashLoader() {
  // Usar el esquema del SISTEMA directamente, sin depender del estado de carga
  // de ThemeContext. Así el ícono siempre coincide con el splash nativo.
  const systemIsDark = useColorScheme() === 'dark';
  const bgColor = systemIsDark ? '#0A0A0A' : '#FFFFFF';

  const pulse = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});

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

  const icon = systemIsDark
    ? require('../../../assets/icon-dark.png')
    : require('../../../assets/icon-light.png');

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
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
