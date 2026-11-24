import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';

// Entrada de las pantallas de la barra de abajo: al volver a una pestaña,
// termina de aclararse con un fundido suave. Sin movimiento.
//
// Cómo evita el "salto": la pantalla se apaga un poco AL IRSE (cuando ya está
// escondida) y no al volver. Si se apagaba al volver, se veía un cuadro nítida,
// otro apagada y después se aclaraba. Así aparece directo apagadita y se
// aclara. La primera vez que se entra a cada pestaña aparece normal.
//
// Ojo (iOS 27): el estilo inicial es opacidad 1. Antes las pantallas
// arrancaban transparentes y, como iOS a veces vuelve a armar la vista de la
// pestaña con su estilo inicial, se veían en negro.
const DESDE = 0.55;
const DURACION = 220;

export default function useEntradaPantalla() {
  const opacidad = useSharedValue(1);

  useFocusEffect(useCallback(() => {
    opacidad.value = withTiming(1, { duration: DURACION, easing: Easing.out(Easing.quad) });
    return () => { opacidad.value = DESDE; };
  }, [opacidad]));

  return useAnimatedStyle(() => ({ flex: 1, opacity: opacidad.value }));
}
