import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeScreen   from '../screens/HomeScreen';
import RutinaScreen from '../screens/RutinaScreen';
import RetosScreen  from '../screens/RetosScreen';
import PerfilScreen from '../screens/PerfilScreen';
import PremiumTabBar from './PremiumTabBar';
import { USAR_TABS_NATIVAS } from './tabsNativas';
import { useTheme } from '../context/ThemeContext';

// Solo se carga en iPhone con build (en Expo Go no está el módulo nativo).
const createNativeBottomTabNavigator = USAR_TABS_NATIVAS
  ? require('@bottom-tabs/react-navigation').createNativeBottomTabNavigator
  : null;

const Tab = USAR_TABS_NATIVAS ? createNativeBottomTabNavigator() : createBottomTabNavigator();

// Íconos SF Symbols de Apple (lleno cuando la pestaña está activa)
const SIMBOLOS = {
  Inicio: 'house',
  Rutina: 'dumbbell',
  Retos:  'medal',
  Perfil: 'person',
};

export default function TabNavigator() {
  const { theme: { colors } } = useTheme();

  if (USAR_TABS_NATIVAS) {
    return (
      <Tab.Navigator
        hapticFeedbackEnabled
        tabBarActiveTintColor={colors.primary}
        // iOS 27: la transición de Apple al cambiar de pestaña mostraba la
        // pantalla en negro un instante. Sin ella, el cambio es instantáneo
        // (la barra sigue siendo Liquid Glass).
        disablePageAnimations
        screenOptions={({ route }) => ({
          // Las 4 pestañas se dibujan al arrancar: en iOS 27 la primera vez
          // que se abría una pestaña también hacía un flash.
          lazy: false,
          tabBarIcon: ({ focused }) => ({
            sfSymbol: focused ? `${SIMBOLOS[route.name]}.fill` : SIMBOLOS[route.name],
          }),
          // Detrás de cada pantalla, el fondo del tema (no el negro del
          // sistema): si iOS muestra la pestaña un instante antes de dibujarla,
          // no se ve un flash negro.
          sceneStyle: { backgroundColor: colors.background },
        })}
      >
        <Tab.Screen name="Inicio" component={HomeScreen}   />
        <Tab.Screen name="Rutina" component={RutinaScreen} />
        <Tab.Screen name="Retos"  component={RetosScreen}  />
        <Tab.Screen name="Perfil" component={PerfilScreen} />
      </Tab.Navigator>
    );
  }

  return (
    <Tab.Navigator
      tabBar={(props) => <PremiumTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Inicio" component={HomeScreen}   />
      <Tab.Screen name="Rutina" component={RutinaScreen} />
      <Tab.Screen name="Retos"  component={RetosScreen}  />
      <Tab.Screen name="Perfil" component={PerfilScreen} />
    </Tab.Navigator>
  );
}
