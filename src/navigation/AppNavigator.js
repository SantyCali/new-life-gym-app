import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import { NavigationContainer, DarkTheme, DefaultTheme, createNavigationContainerRef } from '@react-navigation/native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createStackNavigator } from '@react-navigation/stack';
import TabNavigator from './TabNavigator';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import BodyMeasurementsScreen from '../screens/BodyMeasurementsScreen';
import AspectoScreen from '../screens/AspectoScreen';
import MisClientesScreen from '../screens/trainer/MisClientesScreen';
import ClienteDetailScreen from '../screens/trainer/ClienteDetailScreen';
import PlantillasScreen from '../screens/PlantillasScreen';
import RoutineEditorScreen from '../screens/trainer/RoutineEditorScreen';
import ClientProgressScreen from '../screens/trainer/ClientProgressScreen';
import MisionesScreen from '../screens/trainer/MisionesScreen';
import GymScreen from '../screens/GymScreen';
import RachaScreen from '../screens/RachaScreen';
import TorneosScreen from '../screens/TorneosScreen';
import TorneoDetailScreen from '../screens/TorneoDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import useAuth from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import SplashLoader from '../components/ui/SplashLoader';
import usePushNotifications from '../hooks/usePushNotifications';
import { GymEventsProvider } from '../context/GymEventsContext';

// En Android el stack nativo vacía la pantalla que se cierra antes de la
// animación de volver (se ve un panel vacío hasta que entra la anterior).
// El stack JS deja la pantalla anterior dibujada debajo mientras la actual se
// va. En iOS seguimos con el nativo, que no tiene ese problema.
// (Se pasan contentStyle y cardStyle: cada stack usa el suyo e ignora el otro.)
const Stack = Platform.OS === 'android' ? createStackNavigator() : createNativeStackNavigator();

const navigationRef = createNavigationContainerRef();
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo';

// Tocar una notificación lleva a su pantalla (por ahora, avisos de torneo).
function abrirDesdeNotificacion(data) {
  if (data?.tipo === 'torneo' && data.torneoId && navigationRef.isReady()) {
    navigationRef.navigate('TorneoDetail', { torneoId: data.torneoId, nombre: data.nombre ?? 'Torneo' });
    return true;
  }
  return false;
}

export default function AppNavigator() {
  const { isAuthenticated, initializing, user, isTrainer } = useAuth();
  const { theme: { colors, isDark } }           = useTheme();
  usePushNotifications(user?.uid, isTrainer);

  // Fondo de la ventana del sistema = fondo del tema. Si no, Android lo deja
  // blanco y se ve un destello blanco al volver atrás entre pantallas.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  // Toque en una notificación: con la app abierta, en segundo plano o
  // abriéndola desde cero (en ese caso se espera a que la navegación esté lista).
  const pendienteRef = useRef(null);
  useEffect(() => {
    if (IS_EXPO_GO || !isAuthenticated) return;
    const Notifications = require('expo-notifications');
    const manejar = async (resp) => {
      const req = resp?.notification?.request;
      if (!req) return;
      // Cada notificación se abre una sola vez (la "última tocada" se repite
      // en cada arranque de la app).
      const vista = await AsyncStorage.getItem('notifAbierta').catch(() => null);
      if (vista === req.identifier) return;
      AsyncStorage.setItem('notifAbierta', req.identifier).catch(() => {});
      const data = req.content?.data;
      if (!abrirDesdeNotificacion(data)) pendienteRef.current = data;
    };
    Notifications.getLastNotificationResponseAsync().then(manejar).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(manejar);
    return () => sub.remove();
  }, [isAuthenticated]);

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary:      colors.primary,
      background:   colors.background,
      card:         colors.surface,
      text:         colors.text,
      border:       colors.border,
      notification: colors.primary,
    },
  };

  if (initializing) return <SplashLoader />;

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      onReady={() => {
        if (pendienteRef.current && abrirDesdeNotificacion(pendienteRef.current)) pendienteRef.current = null;
      }}
    >
    <GymEventsProvider>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade', freezeOnBlur: true, contentStyle: { backgroundColor: colors.background }, cardStyle: { backgroundColor: colors.background } }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Main" component={TabNavigator} />
            <Stack.Screen
              name="BodyMeasurements"
              component={BodyMeasurementsScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="Aspecto"
              component={AspectoScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="MisClientes"
              component={MisClientesScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="Plantillas"
              component={PlantillasScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="ClienteDetail"
              component={ClienteDetailScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="RoutineEditor"
              component={RoutineEditorScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="ClientProgress"
              component={ClientProgressScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="Misiones"
              component={MisionesScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="Gym"
              component={GymScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="Racha"
              component={RachaScreen}
              options={{ presentation: 'transparentModal', animation: 'none', cardStyle: { backgroundColor: 'transparent' } }}
            />
            <Stack.Screen name="Torneos" component={TorneosScreen} options={{ animation: 'slide_from_right', contentStyle: { backgroundColor: colors.background }, cardStyle: { backgroundColor: colors.background } }} />
            <Stack.Screen name="TorneoDetail" component={TorneoDetailScreen} options={{ animation: 'slide_from_right', contentStyle: { backgroundColor: colors.background }, cardStyle: { backgroundColor: colors.background } }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ animation: 'slide_from_right', contentStyle: { backgroundColor: colors.background }, cardStyle: { backgroundColor: colors.background } }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{ animation: 'slide_from_right' }}
            />
          </>
        )}
      </Stack.Navigator>
    </GymEventsProvider>
    </NavigationContainer>
  );
}
