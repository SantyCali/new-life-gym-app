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
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused }) => ({
            sfSymbol: focused ? `${SIMBOLOS[route.name]}.fill` : SIMBOLOS[route.name],
          }),
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
