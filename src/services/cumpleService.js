// Saludo de cumpleaños. Notificación local del propio celular, programada
// para todos los años el día del cumple a las 9 (no hace falta servidor, igual
// que el aviso de cuota). Además, el día del cumple la app muestra un festejo
// al abrirla, una vez por año (CumpleModal, desde GymEventsContext).
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo';
const ID = 'cumple';
const CLAVE_PROGRAMADO = 'cumple_programado';

// fechaNacimiento viene como "DD/MM/AAAA" (Registro). Devuelve { dia, mes }
// con mes 1-12, o null si no se entiende.
export function diaDelCumple(fechaNacimiento) {
  const [d, m] = String(fechaNacimiento ?? '').split('/').map((x) => parseInt(x, 10));
  if (!(d >= 1 && d <= 31 && m >= 1 && m <= 12)) return null;
  return { dia: d, mes: m };
}

// Los del 29/2 lo festejan el 28/2 los años que no son bisiestos.
export function esCumpleHoy(fechaNacimiento, hoy = new Date()) {
  const c = diaDelCumple(fechaNacimiento);
  if (!c) return false;
  const mes = hoy.getMonth() + 1;
  const dia = hoy.getDate();
  if (c.mes === mes && c.dia === dia) return true;
  const bisiesto = new Date(hoy.getFullYear(), 1, 29).getMonth() === 1;
  return c.mes === 2 && c.dia === 29 && !bisiesto && mes === 2 && dia === 28;
}

function saludo(nombre) {
  return {
    title: `🎂 ¡Feliz cumpleaños${nombre ? `, ${nombre}` : ''}!`,
    body: 'Todo el equipo de New Life Gym te desea un muy feliz cumple. ¡Que lo disfrutes a full! 💪🎉',
    sound: 'default',
    data: { tipo: 'cumple' },
  };
}

// Botón de tester (Perfil): manda el saludo ya, igual al del día del cumple.
export async function probarSaludoDeCumple(nombre) {
  if (IS_EXPO_GO) return;
  const Notifications = require('expo-notifications');
  await Notifications.scheduleNotificationAsync({ content: saludo(nombre), trigger: null });
}

// Se llama cada vez que llega el perfil; solo reprograma si cambió la fecha o
// el nombre.
export async function programarSaludoDeCumple(fechaNacimiento, nombre) {
  if (IS_EXPO_GO) return;
  const c = diaDelCumple(fechaNacimiento);
  const clave = c ? `${c.dia}/${c.mes}|${nombre ?? ''}` : 'ninguno';
  const antes = await AsyncStorage.getItem(CLAVE_PROGRAMADO).catch(() => null);
  if (antes === clave) return;

  const Notifications = require('expo-notifications');
  await Notifications.cancelScheduledNotificationAsync(ID).catch(() => {});
  if (c) {
    // 29/2: el aviso anual va el 28/2 (si no, solo sonaría cada 4 años).
    const dia = c.mes === 2 && c.dia === 29 ? 28 : c.dia;
    await Notifications.scheduleNotificationAsync({
      identifier: ID,
      content: saludo(nombre),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.YEARLY,
        month: c.mes - 1, // 0 = enero
        day: dia,
        hour: 9,
        minute: 0,
        channelId: 'default',
      },
    });
  }
  await AsyncStorage.setItem(CLAVE_PROGRAMADO, clave).catch(() => {});
}

// El festejo en la app: una vez por año y por cuenta.
const claveVisto = (uid) => `cumple_visto_${uid}_${new Date().getFullYear()}`;

export async function tocaFestejo(uid, fechaNacimiento) {
  if (!uid || !esCumpleHoy(fechaNacimiento)) return false;
  return !(await AsyncStorage.getItem(claveVisto(uid)).catch(() => null));
}

export async function marcarFestejoVisto(uid) {
  await AsyncStorage.setItem(claveVisto(uid), '1').catch(() => {});
}
