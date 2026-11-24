// Respaldo de la sesión (sobre todo para Android).
//
// Al arrancar la app, Firebase consulta al servidor si la sesión guardada sigue
// valiendo (accounts:lookup). Si esa consulta falla por algo que no sea falta
// de internet, BORRA la sesión del celular y hay que volver a entrar. En
// Android pasaba varias veces por semana (el contador de pasos y las tareas en
// segundo plano hacen que la app arranque de cero muchas veces): en noviembre
// 2026, 22 de esas consultas dieron error 400 en una semana, cuando la sesión
// seguía siendo válida (ninguna renovación de sesión falló).
//
// Solución: una copia aparte de la sesión guardada por Firebase. Si al
// arrancar Firebase la borró sin que la persona cerrara sesión, se pide una
// sesión nueva con esa copia; si Google la acepta, se vuelve a poner donde
// Firebase la busca y se recarga la app (ya adentro). Si Google dice que la
// sesión ya no vale (contraseña cambiada, cuenta borrada), se pide entrar.
//
// Además se anota el motivo (para la pantalla Actividad), para encontrar la
// causa de fondo.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseConfig } from '../firebase/firebaseConfig';

const CLAVE_FIREBASE = `firebase:authUser:${firebaseConfig.apiKey}:[DEFAULT]`;
const CLAVE_RESPALDO = 'nlg_sesion_respaldo';
const CLAVE_INTENTO = 'nlg_sesion_recuperando_en';
const CLAVE_MOTIVO = 'nlg_sesion_perdida';
// Un intento cada tanto: si la sesión recuperada se vuelve a caer enseguida,
// no se queda recargando en un bucle.
const ENTRE_INTENTOS_MS = 10 * 60 * 1000;
const SESION_INVALIDA = ['TOKEN_EXPIRED', 'INVALID_REFRESH_TOKEN', 'USER_DISABLED', 'USER_NOT_FOUND', 'INVALID_GRANT_TYPE', 'MISSING_REFRESH_TOKEN'];

// Copia la sesión que guardó Firebase (se llama con la sesión ya iniciada).
export async function respaldarSesion(uid) {
  try {
    const v = await AsyncStorage.getItem(CLAVE_FIREBASE);
    if (v && JSON.parse(v)?.uid === uid) await AsyncStorage.setItem(CLAVE_RESPALDO, v);
  } catch {}
}

// Al cerrar sesión o borrar la cuenta.
export async function borrarRespaldoSesion() {
  await AsyncStorage.multiRemove([CLAVE_RESPALDO, CLAVE_INTENTO]).catch(() => {});
}

async function pedir(url, opciones) {
  const r = await fetch(url, opciones);
  const cuerpo = await r.json().catch(() => ({}));
  return { ok: r.ok, estado: r.status, cuerpo };
}

// true: la sesión se volvió a poner y la app se está recargando (no mostrar el
// login). false: no había respaldo, no vale más o ya se intentó hace poco.
export async function recuperarSesion() {
  try {
    const guardada = await AsyncStorage.getItem(CLAVE_RESPALDO);
    if (!guardada) return false;
    const ultimo = Number(await AsyncStorage.getItem(CLAVE_INTENTO)) || 0;
    if (Date.now() - ultimo < ENTRE_INTENTOS_MS) return false;
    await AsyncStorage.setItem(CLAVE_INTENTO, String(Date.now()));

    const usuario = JSON.parse(guardada);
    const sts = usuario?.stsTokenManager;
    if (!sts?.refreshToken) return false;
    const apiKey = firebaseConfig.apiKey;

    // Diagnóstico: qué le contesta Google a la sesión de antes.
    const motivo = { en: Date.now(), venceLocal: sts.expirationTime ?? null };
    try {
      const l = await pedir(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: sts.accessToken }),
      });
      motivo.lookup = l.ok ? 'ok' : `${l.estado} ${l.cuerpo?.error?.message ?? ''}`.trim();
    } catch (e) { motivo.lookup = `red: ${e?.message ?? e}`; }

    // Sesión nueva con el token de renovación.
    let r;
    try {
      r = await pedir(`https://securetoken.googleapis.com/v1/token?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(sts.refreshToken)}`,
      });
    } catch (e) {
      // Sin internet: no se puede hacer nada ahora (tampoco entrar con la
      // contraseña); se reintenta la próxima vez que abra la app.
      await AsyncStorage.removeItem(CLAVE_INTENTO).catch(() => {});
      return false;
    }
    const mensaje = r.cuerpo?.error?.message ?? '';
    if (!r.ok || !r.cuerpo?.id_token) {
      motivo.renovar = `${r.estado} ${mensaje}`.trim();
      await AsyncStorage.setItem(CLAVE_MOTIVO, JSON.stringify(motivo)).catch(() => {});
      if (SESION_INVALIDA.some((m) => mensaje.startsWith(m))) await borrarRespaldoSesion();
      return false;
    }

    usuario.stsTokenManager = {
      refreshToken: r.cuerpo.refresh_token || sts.refreshToken,
      accessToken: r.cuerpo.id_token,
      expirationTime: Date.now() + Number(r.cuerpo.expires_in || 3600) * 1000,
    };
    motivo.recuperada = true;
    await AsyncStorage.setItem(CLAVE_FIREBASE, JSON.stringify(usuario));
    await AsyncStorage.setItem(CLAVE_RESPALDO, JSON.stringify(usuario));
    await AsyncStorage.setItem(CLAVE_MOTIVO, JSON.stringify(motivo)).catch(() => {});

    // Se recarga la app: al arrancar, Firebase encuentra la sesión de nuevo.
    const Updates = require('expo-updates');
    if (__DEV__ || !Updates.isEnabled) return false;
    await Updates.reloadAsync();
    return true;
  } catch {
    return false;
  }
}

// El último motivo anotado (y se borra): lo sube actividadService.
export async function tomarMotivoSesionPerdida() {
  try {
    const v = await AsyncStorage.getItem(CLAVE_MOTIVO);
    if (!v) return null;
    await AsyncStorage.removeItem(CLAVE_MOTIVO);
    return JSON.parse(v);
  } catch { return null; }
}
