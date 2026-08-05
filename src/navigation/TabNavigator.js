import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeScreen   from '../screens/HomeScreen';
import RutinaScreen from '../screens/RutinaScreen';
import RetosScreen  from '../screens/RetosScreen';
import PerfilScreen from '../screens/PerfilScreen';
import PremiumTabBar from './PremiumTabBar';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
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
