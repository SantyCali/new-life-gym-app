// Aviso de cuota por vencer. Notificaciones locales del propio celular del
// alumno (no hace falta servidor):
//   - Programadas: 3 días antes y el día que vence, a las 10 de la mañana.
//   - En el momento: si la fecha cambia (el entrenador renueva o corrige la
//     cuota) y ya está vencida, vence hoy o faltan 3 días o menos, avisa ya.
//     Una sola vez por fecha y estado, para no repetir.
// Con la app abierta escucha la cuota en vivo (suscribirAvisosDeCuota); con la
// app cerrada lo revisa la tarea en segundo plano (programarAvisosDeCuota).
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { getSocioByDni } from './gymService';

// En Expo Go expo-notifications no se inicializa (igual que en GymEventsContext).
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo';
const IDS = ['cuota-3dias', 'cuota-hoy'];
const CLAVE_PROGRAMADO = 'avisoCuota_programado';
const CLAVE_INMEDIATO = 'avisoCuota_inmediato';
const DIA_MS = 24 * 60 * 60 * 1000;

function aFecha(v) {
  if (!v) return null;
  const d = v.toDate?.() ?? new Date(v);
  return Number.isNaN(d?.getTime?.()) ? null : d;
}

function soloDia(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Días que faltan: 0 = vence hoy, negativo = ya venció.
function diasHasta(vence) {
  return Math.round((soloDia(vence) - soloDia(new Date())) / DIA_MS);
}

async function avisarAhora(Notifications, vence) {
  const dias = diasHasta(vence);
  if (dias > 3) return;
  const estado = dias < 0 ? 'vencida' : dias === 0 ? 'hoy' : `faltan${dias}`;
  const clave = `${soloDia(vence).toISOString().slice(0, 10)}|${estado}`;
  const antes = await AsyncStorage.getItem(CLAVE_INMEDIATO).catch(() => null);
  if (antes === clave) return; // ya se avisó para esta fecha y estado
  await AsyncStorage.setItem(CLAVE_INMEDIATO, clave).catch(() => {});

  const fecha = vence.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
  const content = dias < 0
    ? { title: 'Tu cuota está vencida', body: `Venció el ${fecha}. Pasá por recepción para renovarla.` }
    : dias === 0
      ? { title: 'Hoy vence tu cuota', body: 'Pasá por recepción para renovarla y seguir sumando puntos en el gym.' }
      : { title: `Tu cuota vence en ${dias} ${dias === 1 ? 'día' : 'días'}`, body: `Vence el ${fecha}. Renovala en recepción para seguir entrenando sin cortes.` };
  await Notifications.scheduleNotificationAsync({ content: { ...content, sound: 'default' }, trigger: null }).catch(() => {});
}

async function programar(Notifications, vence) {
  // Si ya están programados para esta misma fecha, no se toca nada.
  const clave = vence ? soloDia(vence).toISOString().slice(0, 10) : 'ninguno';
  const antes = await AsyncStorage.getItem(CLAVE_PROGRAMADO).catch(() => null);
  if (antes === clave) return;

  for (const id of IDS) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  await AsyncStorage.setItem(CLAVE_PROGRAMADO, clave).catch(() => {});
  if (!vence) return;

  const elDia = new Date(vence.getFullYear(), vence.getMonth(), vence.getDate(), 10, 0, 0);
  const tresAntes = new Date(elDia);
  tresAntes.setDate(tresAntes.getDate() - 3);
  const fecha = vence.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  const ahora = Date.now();
  const trigger = (date) => ({ type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: 'default' });

  if (tresAntes.getTime() > ahora) {
    await Notifications.scheduleNotificationAsync({
      identifier: 'cuota-3dias',
      content: {
        title: 'Tu cuota vence en 3 días',
        body: `Vence el ${fecha}. Renovala en recepción para seguir entrenando sin cortes.`,
        sound: 'default',
      },
      trigger: trigger(tresAntes),
    }).catch(() => {});
  }
  if (elDia.getTime() > ahora) {
    await Notifications.scheduleNotificationAsync({
      identifier: 'cuota-hoy',
      content: {
        title: 'Hoy vence tu cuota',
        body: 'Pasá por recepción para renovarla y seguir sumando puntos en el gym.',
        sound: 'default',
      },
      trigger: trigger(elDia),
    }).catch(() => {});
  }
}

async function procesar(vence) {
  if (IS_EXPO_GO) return;
  const Notifications = require('expo-notifications');
  await programar(Notifications, vence);
  if (vence) await avisarAhora(Notifications, vence);
}

// Una vez (tarea en segundo plano).
export async function programarAvisosDeCuota(gymDni) {
  if (IS_EXPO_GO) return;
  let vence = null;
  if (gymDni) {
    const socio = await getSocioByDni(gymDni).catch(() => undefined);
    if (socio === undefined) return; // sin conexión: se deja lo programado
    vence = aFecha(socio?.fechaVencimiento);
  }
  await procesar(vence);
}

// En vivo mientras la app está abierta: si el entrenador cambia la fecha, se
// reprograma y, si corresponde, avisa en el momento.
export function suscribirAvisosDeCuota(gymDni) {
  if (IS_EXPO_GO) return () => {};
  if (!gymDni) { procesar(null).catch(() => {}); return () => {}; }
  return onSnapshot(doc(db, 'socios', String(gymDni).trim()),
    (snap) => { procesar(snap.exists() ? aFecha(snap.data().fechaVencimiento) : null).catch(() => {}); },
    () => {});
}
