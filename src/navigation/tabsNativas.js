import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Barra de pestañas nativa de Apple (Liquid Glass, react-native-bottom-tabs).
// En iOS 27 (librería 1.4.0) las pantallas parpadeaban en negro al cambiar de
// pestaña: se apagó la animación de cambio de pestaña y se cargan todas al
// arrancar (ver TabNavigator). Si hiciera falta volver a la barra propia
// (PremiumTabBar, la de Android), poner NATIVA_EN_IPHONE en false.
const NATIVA_EN_IPHONE = true;

export const USAR_TABS_NATIVAS =
  NATIVA_EN_IPHONE && Platform.OS === 'ios' && Constants.executionEnvironment !== 'storeClient';
