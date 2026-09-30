// Tarjeta "En sala" en vivo, igual a la del panel web (StatCard con liveColor):
// haz de luz que recorre la línea superior, punto de estado que respira y el
// número de personas en el color del aforo.
import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, interpolate, Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { typography, spacing, radius } from '../../theme';

// Mismos cortes y colores que estadoAforo() del panel y statusFor() de GymScreen.
export function estadoAforo(cantidad) {
  if (cantidad === 0) return { label: 'Vacío',     color: '#6B7280' };
  if (cantidad <= 14) return { label: 'Tranquilo', color: '#22C55E' };
  if (cantidad <= 21) return { label: 'Moderado',  color: '#EAB308' };
  return                     { label: 'Lleno',     color: '#EF4444' };
}

export default function EnSalaCard({ cantidad = 0, ingresosHoy = null, onPress }) {
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { label, color } = estadoAforo(cantidad);

  // Haz de luz: recorre la línea de izquierda a derecha cada 2 s.
  const [ancho, setAncho] = useState(0);
  const haz = useSharedValue(0);
  useEffect(() => {
    haz.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.bezier(0.4, 0, 0.2, 1) }), -1, false);
  }, []);
  const anchoHaz = ancho * 0.66;
  const hazStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(haz.value, [0, 0.5, 1], [-anchoHaz, anchoHaz * 0.1, anchoHaz * 1.6]) }],
  }), [anchoHaz]);

  // Punto que respira (solo opacidad, igual que en la web).
  const respira = useSharedValue(1);
  useEffect(() => {
    respira.value = withRepeat(withTiming(0.4, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);
  const puntoStyle = useAnimatedStyle(() => ({ opacity: respira.value }));

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
      style={[styles.card, { borderColor: colors.border, shadowColor: color }]}
    >
      {/* Línea superior con el haz */}
      <View style={styles.linea}>
        <LinearGradient
          colors={[color + '99', color + 'e6', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.lineaBase}
        />
        {ancho > 0 && (
          <Animated.View style={[styles.haz, { width: anchoHaz }, hazStyle]}>
            <LinearGradient
              colors={['transparent', color, 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        )}
      </View>

      <View style={styles.cabecera}>
        <View style={styles.titulo}>
          <Animated.View style={[styles.punto, { backgroundColor: color, shadowColor: color }, puntoStyle]} />
          <Text style={styles.label}>{`EN SALA · ${label.toUpperCase()}`}</Text>
        </View>
        <View style={[styles.icono, { backgroundColor: color + '26' }]}>
          <Ionicons name="barbell" size={16} color={color} />
        </View>
      </View>

      <View style={styles.valorFila}>
        <Text style={[styles.valor, { color: cantidad === 0 ? colors.textSecondary : color }]}>{cantidad}</Text>
        <Text style={styles.unidad}>{cantidad === 1 ? 'persona' : 'personas'}</Text>
      </View>

      {ingresosHoy != null && (
        <Text style={styles.pie}>
          {`${ingresosHoy} ${ingresosHoy === 1 ? 'ingreso' : 'ingresos'} en el día`}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderRadius: radius.xl,
      padding: spacing.lg,
      overflow: 'hidden',
      // Resplandor del color del aforo (en iOS; Android no colorea sombras).
      ...Platform.select({ ios: { shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } } }),
    },
    linea: {
      position: 'absolute', top: 0, left: 0, right: 0, height: 2.5,
      backgroundColor: '#1a2332', overflow: 'hidden',
    },
    lineaBase: { position: 'absolute', top: 0, bottom: 0, left: 0, width: '40%' },
    haz: { position: 'absolute', top: 0, bottom: 0, left: 0 },
    cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    titulo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    punto: {
      width: 10, height: 10, borderRadius: 5,
      shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
    },
    label: {
      fontSize: 11, fontWeight: typography.weights.bold, letterSpacing: 1.2,
      color: colors.textSecondary,
    },
    icono: { width: 32, height: 32, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
    valorFila: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.xs },
    valor: { fontSize: 40, fontWeight: typography.weights.black, lineHeight: 46 },
    unidad: { fontSize: 13, color: colors.textSecondary },
    pie: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs },
  });
}
