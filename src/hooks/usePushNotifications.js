import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Evaluated once at module load — no Notifications import needed here
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

export default function usePushNotifications(userId) {
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

    register(userId);
  }, [userId]);
}

async function register(userId) {
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
    await updateDoc(doc(db, 'users', userId), { expoPushToken: token });
    if (__DEV__) console.log('[PushNotif] Token registrado:', token);
  } catch (e) {
    if (__DEV__) console.warn('[PushNotif] Error al registrar token:', e.message);
  }
}