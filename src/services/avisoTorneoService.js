// Avisos de torneos. Notificaciones locales del propio celular (no hace falta
// servidor ni cambiar reglas):
//   - "Te agregaron a un torneo": aparece un torneo nuevo en la lista del
//     usuario que no creó él.
//   - "Terminó el torneo": uno de sus torneos pasó la fecha de fin (o se
//     cerró), con el puesto en que quedó si se puede calcular.
// Con la app abierta escucha sus torneos en vivo (suscribirAvisosDeTorneos);
// con la app cerrada lo revisa la tarea en segundo plano (revisarAvisosDeTorneos).
// Cada aviso sale una sola vez por torneo. La primera vez que corre solo
// anota lo que ya existe, para no avisar de torneos viejos.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { subscribeTorneosForUser, torneoTerminado, puntosEnTorneo } from './torneoService';

// En Expo Go expo-notifications no se inicializa (igual que en avisoCuotaService).
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo';
const clave = (uid) => `avisoTorneos_${uid}`;

// Puesto del usuario en un torneo terminado, o null si no se puede saber
// (algún participante sin foto de cierre, con la versión vieja de la app).
async function puestoEnTorneo(torneoId, uid) {
  const snap = await getDocs(collection(db, 'torneos', torneoId, 'participantes'));
  const filas = snap.docs.map((d) => d.data());
  if (filas.length < 2 || filas.some((p) => p.xpTotalFin == null)) return null;
  const tabla = filas
    .map((p) => ({ uid: p.uid, ...puntosEnTorneo(p, {}, true) }))
    .sort((a, b) => b.xpGanado - a.xpGanado); // mismo orden que la tabla del torneo
  const i = tabla.findIndex((p) => p.uid === uid);
  return i === -1 ? null : { puesto: i + 1, total: tabla.length };
}

// Serializa las revisiones: el listener y la tarea en segundo plano pueden
// llegar juntos y avisar dos veces lo mismo.
let cola = Promise.resolve();

export function revisarAvisosDeTorneos(uid, torneos) {
  cola = cola.then(() => revisar(uid, torneos)).catch(() => {});
  return cola;
}

async function revisar(uid, torneosDados) {
  if (IS_EXPO_GO || !uid) return;
  const torneos = torneosDados ?? (await getDocs(
    query(collection(db, 'torneos'), where('participantUids', 'array-contains', uid)),
  )).docs.map((d) => ({ id: d.id, ...d.data() }));

  const guardado = await AsyncStorage.getItem(clave(uid)).catch(() => null);
  const estado = guardado ? JSON.parse(guardado) : null;
  const ahora = Date.now();
  const terminadosAhora = torneos.filter((t) => torneoTerminado(t, ahora)).map((t) => t.id);

  // Primera vez en este celular: se anota lo que hay, sin avisar.
  if (!estado) {
    await AsyncStorage.setItem(clave(uid), JSON.stringify({
      conocidos: torneos.map((t) => t.id),
      terminados: terminadosAhora,
    })).catch(() => {});
    return;
  }

  const conocidos = new Set(estado.conocidos ?? []);
  const terminados = new Set(estado.terminados ?? []);
  const avisos = [];

  for (const t of torneos) {
    const nuevo = !conocidos.has(t.id);
    conocidos.add(t.id);
    if (nuevo && t.creadoPor !== uid && !torneoTerminado(t, ahora)) {
      const quien = t.creadoPorNombre || 'Alguien';
      avisos.push({
        title: '🏆 Te sumaron a un torneo',
        body: `${quien} te agregó a "${t.nombre}". ¡A sumar pasos y visitas al gym!`,
        data: { tipo: 'torneo', torneoId: t.id, nombre: t.nombre },
      });
    }
    if (torneoTerminado(t, ahora) && !terminados.has(t.id)) {
      terminados.add(t.id);
      // Si recién lo conoce y ya estaba terminado, no se avisa el cierre.
      if (nuevo) continue;
      const r = await puestoEnTorneo(t.id, uid).catch(() => null);
      const medalla = r?.puesto === 1 ? '🥇' : r?.puesto === 2 ? '🥈' : r?.puesto === 3 ? '🥉' : '🏁';
      avisos.push({
        title: `${medalla} Terminó el torneo "${t.nombre}"`,
        body: r
          ? (r.puesto <= 3
            ? `¡Quedaste ${r.puesto}° de ${r.total}! Entrá para ver el podio y tu premio.`
            : `Quedaste ${r.puesto}° de ${r.total}. Entrá para ver cómo terminó.`)
          : 'Entrá para ver cómo quedó la tabla.',
        data: { tipo: 'torneo', torneoId: t.id, nombre: t.nombre },
      });
    }
  }

  // Se guarda antes de avisar: si algo falla, mejor no avisar que repetir.
  await AsyncStorage.setItem(clave(uid), JSON.stringify({
    conocidos: [...conocidos],
    terminados: [...terminados],
  })).catch(() => {});
  if (!avisos.length) return;

  const Notifications = require('expo-notifications');
  for (const content of avisos) {
    await Notifications.scheduleNotificationAsync({
      content: { ...content, sound: 'default' },
      trigger: null,
    }).catch(() => {});
  }
}

// Con la app abierta: revisa cada vez que cambia la lista de torneos. Un torneo
// que termina por fecha no cambia el documento, así que también se revisa
// cada 5 minutos.
export function suscribirAvisosDeTorneos(uid) {
  if (IS_EXPO_GO || !uid) return () => {};
  let ultimos = null;
  const dejar = subscribeTorneosForUser(uid, (torneos) => {
    ultimos = torneos;
    revisarAvisosDeTorneos(uid, torneos);
  });
  const reloj = setInterval(() => {
    if (ultimos) revisarAvisosDeTorneos(uid, ultimos);
  }, 5 * 60 * 1000);
  return () => { dejar(); clearInterval(reloj); };
}
