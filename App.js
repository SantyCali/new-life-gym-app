import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { StepProvider } from './src/context/StepContext';
import AppNavigator from './src/navigation/AppNavigator';

// Mantener el splash nativo visible hasta que SplashLoader esté montado
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ThemeProvider>
          <StepProvider>
            <StatusBar style="auto" backgroundColor="transparent" translucent />
            <AppNavigator />
          </StepProvider>
        </ThemeProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
