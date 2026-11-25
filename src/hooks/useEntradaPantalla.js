import { useCallback } from 'react';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';

// Entrada de las pantallas de la barra de abajo: al volver a una pestaña,
// termina de aclararse con un fundido suave. Sin movimiento.
//
// Cómo evita el "salto": la pantalla se apaga un poco AL IRSE A OTRA PESTAÑA
// (cuando ya está escondida) y no al volver. Si se apagaba al volver, se veía
// un cuadro nítida, otro apagada y después se aclaraba. La primera vez que se
// entra a cada pestaña aparece normal.
//
// Solo al cambiar de pestaña, NO al abrir una pantalla encima (En el Gym,
// Mis Clientes...): en iPhone, al volver atrás el aviso de "volvió" llega
// recién cuando termina la animación, y mientras tanto la pestaña se veía
// apagada (casi blanca) un segundo.
//
// Ojo (iOS 27): el estilo inicial es opacidad 1. Antes las pantallas
// arrancaban transparentes y, como iOS a veces vuelve a armar la vista de la
// pestaña con su estilo inicial, se veían en negro.
const DESDE = 0.55;
const DURACION = 220;

export default function useEntradaPantalla() {
  const opacidad = useSharedValue(1);
  const navigation = useNavigation();
  const route = useRoute();

  useFocusEffect(useCallback(() => {
    opacidad.value = withTiming(1, { duration: DURACION, easing: Easing.out(Easing.quad) });
    return () => {
      // ¿Se fue a otra pestaña, o abrió una pantalla encima de esta?
      const tabs = navigation.getState?.();
      const sigueSiendoLaPestana = tabs?.routes?.[tabs.index]?.key === route.key;
      if (!sigueSiendoLaPestana) opacidad.value = DESDE;
    };
  }, [opacidad, navigation, route.key]));

  return useAnimatedStyle(() => ({ flex: 1, opacity: opacidad.value }));
}
