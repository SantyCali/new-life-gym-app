import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { guardarPerfil } from '../services/perfilPrivadoService';
import { registrarPushEntrenador } from '../services/avisosService';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// Evaluated once at module load — no Notifications import needed here
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

export default function usePushNotifications(userId, esEntrenador = false) {
  useEffect(() => {
    if (!userId) return;

    if (!Device.isDevice) {
      if (__DEV__) console.log('[PushNotif] Emulador — push no disponible.');
      return;
    }

    if (IS_EXPO_GO) {
      if (__DEV__) console.log('[PushNotif] Expo Go — push no disponible (SDK 53+). Usá un development build.');
      return;
    }

    register(userId, esEntrenador);
  }, [userId, esEntrenador]);
}

async function register(userId, esEntrenador) {
  // Deferred require: expo-notifications nunca se inicializa en Expo Go
  // porque esta función nunca se llama cuando IS_EXPO_GO === true.
  const Notifications = require('expo-notifications');

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'New Life',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    if (__DEV__) console.log('[PushNotif] Permiso denegado por el usuario.');
    return;
  }

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    // Para que otros te puedan avisar (por ejemplo, al sumarte a un torneo).
    // Primero y por separado: antes, si fallaba guardar el perfil, esto no
    // se guardaba nunca y a esa persona no le llegaba ningún aviso.
    await setDoc(doc(db, 'pushTokens', userId), { token, actualizadoEn: serverTimestamp() }).catch(() => {});
    await guardarPerfil(userId, { expoPushToken: token }).catch(() => {});
    // Entrenadores: el código también va donde los alumnos lo pueden leer,
    // para avisarles cuando se arman o modifican su rutina.
    if (esEntrenador) await registrarPushEntrenador(userId, token).catch(() => {});
    if (__DEV__) console.log('[PushNotif] Token registrado:', token);
  } catch (e) {
    if (__DEV__) console.warn('[PushNotif] Error al registrar token:', e.message);
  }
}