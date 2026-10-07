// Puntito naranja "en vivo" del anillo de pasos: hay un reloj o pulsera
// pasando pasos. Titila como el "En vivo" del panel web. Al tocarlo aparece
// un cartelito ("Reloj conectado, contando pasos") que se va solo; tocando el
// cartelito se abre la pantalla del reloj.
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, FadeIn, FadeOut,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

const NARANJA = '#FF9F1A';
const CARTEL_MS = 3500;

export default function PuntoReloj({ apps = [], onAbrir }) {
  const [cartel, setCartel] = useState(false);
  const timerRef = useRef(null);

  // Onda que sale del punto y se desvanece, una y otra vez.
  const onda = useSharedValue(0);
  useEffect(() => {
    onda.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.out(Easing.ease) }), -1, false);
  }, [onda]);
  const ondaStyle = useAnimatedStyle(() => ({
    opacity: 0.6 * (1 - onda.value),
    transform: [{ scale: 1 + onda.value * 1.6 }],
  }));

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const mostrar = () => {
    setCartel(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCartel(false), CARTEL_MS);
  };

  const deDonde = apps.length ? apps.join(', ') : null;

  return (
    <View style={styles.wrap}>
      <TouchableOpacity onPress={mostrar} hitSlop={16} activeOpacity={0.7} style={styles.toque}>
        <Animated.View style={[styles.onda, ondaStyle]} />
        <View style={styles.punto} />
      </TouchableOpacity>

      {cartel && (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(200)} style={styles.cartelWrap}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => { setCartel(false); onAbrir?.(); }}
            style={styles.cartel}
          >
            <Ionicons name="watch-outline" size={15} color={NARANJA} />
            <View>
              <Text style={styles.cartelTitulo}>Reloj conectado, contando pasos</Text>
              {deDonde && <Text style={styles.cartelSub} numberOfLines={1}>{`De: ${deDonde}`}</Text>}
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  toque: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onda: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: NARANJA,
  },
  punto: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: NARANJA,
  },
  cartelWrap: {
    position: 'absolute',
    top: 22,
    width: 240,
    alignItems: 'center',
    zIndex: 10,
  },
  cartel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: NARANJA + '66',
    backgroundColor: '#2A1A06F2',
  },
  cartelTitulo: {
    color: NARANJA,
    fontSize: 12,
    fontWeight: '700',
  },
  cartelSub: {
    color: '#FFD9A3',
    fontSize: 11,
    marginTop: 1,
    maxWidth: 180,
  },
});
