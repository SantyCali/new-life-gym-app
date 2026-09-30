import { Platform } from 'react-native';
import Constants from 'expo-constants';

// En iPhone usamos la barra de pestañas nativa de Apple: en iOS 26 es
// Liquid Glass (vidrio + la "gota" que agranda el ícono al deslizar, como
// WhatsApp). En Expo Go no existe ese módulo nativo, así que ahí (y en
// Android) sigue la barra propia (PremiumTabBar).
export const USAR_TABS_NATIVAS =
  Platform.OS === 'ios' && Constants.executionEnvironment !== 'storeClient';
