import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TabNavigator from './TabNavigator';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import BodyMeasurementsScreen from '../screens/BodyMeasurementsScreen';
import AspectoScreen from '../screens/AspectoScreen';
import MisClientesScreen from '../screens/trainer/MisClientesScreen';
import ClienteDetailScreen from '../screens/trainer/ClienteDetailScreen';
import RoutineEditorScreen from '../screens/trainer/RoutineEditorScreen';
import ClientProgressScreen from '../screens/trainer/ClientProgressScreen';
import MisionesScreen from '../screens/trainer/MisionesScreen';
import GymScreen from '../screens/GymScreen';
import RachaScreen from '../screens/RachaScreen';
import TorneosScreen from '../screens/TorneosScreen';
import TorneoDetailScreen from '../screens/TorneoDetailScreen';
import useAuth from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import usePushNotifications from '../hooks/usePushNotifications';
import { GymEventsProvider } from '../context/GymEventsContext';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { isAuthenticated, initializing, user } = useAuth();
  const { theme: { colors, isDark } }           = useTheme();
  usePushNotifications(user?.uid);

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

  if (initializing) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
    <GymEventsProvider>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: colors.background } }}>
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
              options={{ presentation: 'transparentModal', animation: 'none' }}
            />
            <Stack.Screen name="Torneos" component={TorneosScreen} options={{ animation: 'slide_from_right', contentStyle: { backgroundColor: colors.background } }} />
            <Stack.Screen name="TorneoDetail" component={TorneoDetailScreen} options={{ animation: 'slide_from_right', contentStyle: { backgroundColor: colors.background } }} />
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
