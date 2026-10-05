// Aviso "estás muy cerca de tu meta" al llegar al 80% de la meta diaria de
// pasos. Una vez por día. Se revisa en cada sincronización de pasos (app
// abierta y en segundo plano: en Android cada ~5 min mientras camina, en
// iPhone cuando iOS despierta la app). Si ya pasó la meta, no se avisa.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo';
const PORCENTAJE = 0.8;
const fmt = (n) => n.toLocaleString('es-AR');

// Solo Android, y en iPhone solo los entrenadores (para probarlo).
function leTocaElAviso(rol) {
  if (Platform.OS === 'android') return true;
  const roles = Array.isArray(rol) ? rol : String(rol ?? '').split(',').map((r) => r.trim());
  return roles.includes('entrenador');
}

export async function avisarSiEstaCerca(uid, fecha, pasos, meta, rol) {
  if (IS_EXPO_GO || !uid || !fecha || !(meta > 0) || !(pasos > 0)) return;
  if (!leTocaElAviso(rol)) return;
  if (pasos < meta * PORCENTAJE || pasos >= meta) return;
  const clave = `avisoMeta80_${uid}_${fecha}`;
  if ((await AsyncStorage.getItem(clave).catch(() => null)) === '1') return;
  await AsyncStorage.setItem(clave, '1').catch(() => {});

  const Notifications = require('expo-notifications');
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🔥 ¡Estás muy cerca de tu meta!',
      body: `Llevás ${fmt(pasos)} de ${fmt(meta)} pasos. Te faltan solo ${fmt(meta - pasos)}, ¡seguí así!`,
      sound: 'default',
    },
    trigger: null,
  }).catch(() => {});
}
