import { Platform, Linking } from 'react-native';
import { Pedometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// HC install status values (used across the app)
export const HC_STATUS = {
  NOT_ANDROID:    'not_android',
  AVAILABLE:      'available',
  NOT_AUTHORIZED: 'not_authorized', // HC installed but Steps permission not granted
  NOT_INSTALLED:  'not_installed',
  NEEDS_UPDATE:   'needs_update',
  UNKNOWN:        'unknown',
};

const STORAGE_KEY = 'step_data_v2';

// ── Date helpers ──────────────────────────────────────────────────────────────

export function todayDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Igual que todayDateString pero para una fecha arbitraria — siempre usa hora local.
export function localDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function midnightToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Edad a partir de una fecha de nacimiento (Firestore Timestamp o string/Date ISO).
export function computeAge(fechaNacimiento) {
  if (!fechaNacimiento) return 30;
  try {
    const birth = fechaNacimiento?.toDate ? fechaNacimiento.toDate() : new Date(fechaNacimiento);
    if (isNaN(birth.getTime())) return 30;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return Math.max(10, Math.min(100, age));
  } catch { return 30; }
}

// ── iOS: app Salud (HealthKit) ────────────────────────────────────────────────
// Salud junta los pasos del iPhone y del Apple Watch sin contarlos dos veces
// (el sensor del iPhone solo, CMPedometer, no ve los del reloj: con reloj daba
// ~7 mil contra ~9 mil de Salud). Se usa lo que diga Salud, y el sensor queda
// de respaldo: iOS no avisa si el usuario negó el permiso (Salud devuelve 0),
// y con el celular bloqueado Salud no se puede leer. Por eso siempre se toma
// el mayor de los dos. En Expo Go el módulo no existe: solo sensor.

const PASOS_SALUD = 'HKQuantityTypeIdentifierStepCount';
const SALUD_PEDIDO = 'saludPermisoPedido'; // se pidió el permiso de Salud alguna vez
let saludMod;
function salud() {
  if (saludMod !== undefined) return saludMod;
  saludMod = null;
  if (Platform.OS !== 'ios' || Constants.executionEnvironment === 'storeClient') return null;
  try {
    const hk = require('@kingstinct/react-native-healthkit');
    if (hk.isHealthDataAvailable()) saludMod = hk;
  } catch {}
  return saludMod;
}

// Pide permiso para leer los pasos de Salud (el cartel de iOS sale una sola
// vez; después no hace nada). Solo desde la app abierta, nunca en segundo plano.
// Después deja registrado en iOS que despierte la app cuando haya pasos nuevos
// (background delivery): Apple lo hace como mucho una vez por hora para pasos.
export async function pedirPermisoSalud() {
  const hk = salud();
  if (!hk) return false;
  try {
    const ok = await hk.requestAuthorization({ toRead: [PASOS_SALUD] });
    await AsyncStorage.setItem(SALUD_PEDIDO, '1').catch(() => {});
    hk.configureBackgroundTypes([PASOS_SALUD], 2 /* UpdateFrequency.hourly */).catch(() => {});
    return ok;
  } catch { return false; }
}

// Al arrancar la app (también cuando iOS la despierta en segundo plano por
// pasos nuevos en Salud): escucha esos avisos y corre la sincronización.
// Solo si el permiso ya se pidió alguna vez: consultar Salud sin haberlo pedido
// cierra la app.
export async function escucharSaludEnSegundoPlano(alAvisar) {
  const hk = salud();
  if (!hk) return;
  try {
    if ((await AsyncStorage.getItem(SALUD_PEDIDO)) !== '1') return;
    hk.subscribeToChanges(PASOS_SALUD, () => { alAvisar(); });
  } catch {}
}

// Pasos de Salud entre dos fechas, o null si no se pudo leer.
async function pasosDeSalud(desde, hasta) {
  const hk = salud();
  if (!hk) return null;
  // Sin el permiso pedido, consultar Salud cierra la app (aviso de la librería).
  try { if ((await AsyncStorage.getItem(SALUD_PEDIDO)) !== '1') return null; } catch { return null; }
  try {
    const r = await hk.queryStatisticsForQuantity(PASOS_SALUD, ['cumulativeSum'], {
      filter: { date: { startDate: desde, endDate: hasta } },
      unit: 'count',
    });
    const n = r?.sumQuantity?.quantity;
    return typeof n === 'number' ? Math.round(n) : 0;
  } catch { return null; }
}

// Relojes en iPhone: no hace falta leerlos aparte. Su app (Mi Fitness,
// Garmin Connect, Zepp…) escribe los pasos en Salud, y Salud ya los junta con
// los del iPhone y el Apple Watch sin contarlos dos veces (lo de arriba).
// Esto solo sirve para la pantalla "Reloj": ver de qué apps está recibiendo
// pasos Salud en la última semana, sin contar el propio iPhone.
// { apps: ['Apple Watch de Ana', 'Mi Fitness'] } o null si no se pudo leer
// (sin permiso de Salud, Expo Go).
export async function relojEnSalud() {
  const hk = salud();
  if (!hk) return null;
  try { if ((await AsyncStorage.getItem(SALUD_PEDIDO)) !== '1') return null; } catch { return null; }
  const desde = midnightToday();
  desde.setDate(desde.getDate() - 7);
  try {
    const r = await hk.queryStatisticsForQuantitySeparateBySource(PASOS_SALUD, ['cumulativeSum'], {
      filter: { date: { startDate: desde, endDate: new Date() } },
      unit: 'count',
    });
    const apps = (r ?? [])
      .filter((x) => (x.sumQuantity?.quantity ?? 0) > 0)
      .map((x) => x.source ?? {})
      // El iPhone mismo figura como "com.apple.health…"; el Apple Watch
      // también, pero con "Watch" en el nombre.
      .filter((src) => !(String(src.bundleIdentifier ?? '').startsWith('com.apple.health') && !/watch/i.test(src.name ?? '')))
      .map((src) => src.name || src.bundleIdentifier)
      .filter(Boolean);
    return { apps: [...new Set(apps)] };
  } catch { return null; }
}

// ── iOS: expo-sensors CMPedometer ─────────────────────────────────────────────

// Request motion/activity permission before using the pedometer (Android 10+ requires it)
export async function requestPedometerPermission() {
  try {
    const { status } = await Pedometer.requestPermissionsAsync();
    return status === 'granted';
  } catch { return true; } // iOS doesn't need explicit request here
}

export async function isPedometerAvailable() {
  try { return await Pedometer.isAvailableAsync(); } catch { return false; }
}

// Pasos de hoy en iPhone: el mayor entre Salud y el sensor (ver arriba).
export async function getStepsSinceMidnight() {
  const desde = midnightToday();
  const hasta = new Date();
  const [sensor, deSalud] = await Promise.all([
    Pedometer.getStepCountAsync(desde, hasta).then((r) => r.steps ?? 0).catch(() => null),
    pasosDeSalud(desde, hasta),
  ]);
  if (sensor == null && deSalud == null) throw new Error('sin pasos');
  return Math.max(sensor ?? 0, deSalud ?? 0);
}

export function watchStepCount(callback) {
  return Pedometer.watchStepCount(callback);
}

// ── Android: Health Connect ───────────────────────────────────────────────────

// Returns one of HC_STATUS values — safe to call repeatedly
export async function getHCStatus() {
  if (Platform.OS !== 'android') return HC_STATUS.NOT_ANDROID;
  try {
    const { getSdkStatus, SdkAvailabilityStatus } = require('react-native-health-connect');
    const status = await getSdkStatus();
    if (status === SdkAvailabilityStatus.SDK_AVAILABLE)                          return HC_STATUS.AVAILABLE;
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return HC_STATUS.NEEDS_UPDATE;
    return HC_STATUS.NOT_INSTALLED;
  } catch {
    return HC_STATUS.UNKNOWN;
  }
}

// Check if Steps read permission is ALREADY granted — no dialog, safe to call on startup
export async function checkHCPermissions() {
  if (Platform.OS !== 'android') return false;
  try {
    const { getGrantedPermissions } = require('react-native-health-connect');
    const granted = await getGrantedPermissions();
    return granted.some(g => g.recordType === 'Steps' && g.accessType === 'read');
  } catch {
    return false;
  }
}

// Xiaomi/MIUI devices crash when requestPermission opens its dialog.
// Detect by manufacturer so we use the manual-grant flow instead.
export function isMIUIDevice() {
  if (Platform.OS !== 'android') return false;
  const mfr = (Platform.constants?.Manufacturer ?? '').toLowerCase();
  return mfr === 'xiaomi';
}

// Open the Health Connect app so the user can grant permissions manually.
// Falls back to Play Store if HC app can't be opened.
export function openHealthConnectPermissions() {
  if (Platform.OS !== 'android') return;
  try {
    const { openHealthConnectSettings } = require('react-native-health-connect');
    openHealthConnectSettings();
  } catch {
    openHealthConnectInstall();
  }
}

// Open Play Store to Health Connect install/update page
export function openHealthConnectInstall() {
  Linking.openURL('market://details?id=com.google.android.apps.healthdata').catch(() =>
    Linking.openURL('https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata')
  );
}

// Request permission — ONLY call this from an explicit user action (button tap).
// Calling it on startup crashes on some devices. Use checkHCPermissions() for startup checks.
export async function initHealthConnect() {
  if (Platform.OS !== 'android') return false;
  try {
    const {
      getSdkStatus,
      initialize,
      requestPermission,
      SdkAvailabilityStatus,
    } = require('react-native-health-connect');

    const status = await getSdkStatus();
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) return false;

    await initialize();
    const grants = await requestPermission([
      { accessType: 'read', recordType: 'Steps' },
    ]);
    return grants.some(g => g.recordType === 'Steps' && g.accessType === 'read');
  } catch {
    return false;
  }
}

// Query total steps from Health Connect for a time range
export async function getStepsFromHC(from, to) {
  if (Platform.OS !== 'android') return null;
  try {
    const { readRecords } = require('react-native-health-connect');
    const result = await readRecords('Steps', {
      timeRangeFilter: {
        operator:  'between',
        startTime: from.toISOString(),
        endTime:   to.toISOString(),
      },
    });
    return result.records.reduce((sum, r) => sum + (r.count ?? 0), 0);
  } catch {
    return null;
  }
}

// Returns the total step count for a full calendar day (midnight–midnight).
// Works on iOS (CMPedometer) and Android HC. Returns null if unavailable.
export async function getStepsForDate(date) {
  const from = new Date(date);
  from.setHours(0, 0, 0, 0);
  const to = new Date(date);
  to.setDate(to.getDate() + 1);
  to.setHours(0, 0, 0, 0);

  if (Platform.OS === 'ios') {
    const [sensor, deSalud] = await Promise.all([
      Pedometer.getStepCountAsync(from, to).then((r) => r.steps ?? 0).catch(() => null),
      pasosDeSalud(from, to),
    ]);
    if (sensor == null && deSalud == null) return null;
    return Math.max(sensor ?? 0, deSalud ?? 0);
  }
  // Android: delegate to HC (returns null if HC unavailable)
  return getStepsFromHC(from, to);
}

// ── Calculations ──────────────────────────────────────────────────────────────

export function calcDistanceKm(steps, heightCm = 170) {
  const strideM = (heightCm * 0.414) / 100;
  return parseFloat(((steps * strideM) / 1000).toFixed(2));
}

// MET de caminata según velocidad, ecuación ACSM (superficie plana, sin inclinación):
// VO2 (ml/kg/min) = 0.1 * velocidad(m/min) + 3.5 (reposo). MET = VO2 / 3.5.
// Esta ecuación ya está normalizada por kg de peso corporal y es válida para
// cualquier sexo/edad: la velocidad y la masa corporal son las únicas variables
// que determinan el costo energético de caminar, no hace falta un factor aparte.
function walkingMET(speedKmH) {
  const speedMMin = (speedKmH * 1000) / 60;
  const vo2 = 0.1 * speedMMin + 3.5;
  return vo2 / 3.5;
}

// Tasa metabólica basal (Mifflin-St Jeor, kcal/día) — la ecuación estándar y
// validada en nutrición clínica para estimar el gasto en reposo. Es la que sí
// depende legítimamente de sexo y edad (a diferencia del costo de caminar en sí).
function bmrKcalPerDay(weightKg, heightCm, ageYears, sex) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  if (sex === 'masculino') return base + 5;
  if (sex === 'femenino')  return base - 161;
  return base - 78; // sexo no especificado: punto medio entre ambos offsets
}

// Calorías por caminar, basadas en MET (fisiológicamente fundado) en vez de una
// constante fija por paso. Usa la distancia derivada de la zancada (altura) y el
// tiempo real caminando si está disponible (si no, se estima con una cadencia
// típica de caminata moderada, ~100 pasos/min).
// - total:  gasto BRUTO mientras se camina (MET × peso × tiempo).
// - active: gasto NETO por caminar exclusivamente — se le resta el gasto que de
//   todos modos se hubiese quemado en reposo durante ese mismo tiempo (BMR/24 × horas).
export function calcCalories(steps, weightKg = 70, heightCm = 170, ageYears = 30, sex = null, minutesWalking = null) {
  if (!steps || steps <= 0) return { active: 0, total: 0 };

  const kg  = weightKg > 0 ? weightKg : 70;
  const cm  = heightCm > 0 ? heightCm : 170;
  const age = ageYears > 0 ? ageYears : 30;

  const distanceKm = calcDistanceKm(steps, cm);

  // Tiempo caminando: real si está disponible, si no se estima con cadencia típica
  // de ~100 pasos/min (umbral estándar de "caminata de intensidad moderada").
  const hours = minutesWalking > 0 ? minutesWalking / 60 : steps / 6000;
  const speedKmH = hours > 0 ? distanceKm / hours : 4.8;

  const met = Math.max(2.0, Math.min(6.0, walkingMET(speedKmH)));

  const totalKcal = met * kg * hours;
  const restingKcalDuringWalk = (bmrKcalPerDay(kg, cm, age, sex) / 24) * hours;
  const activeKcal = Math.max(0, totalKcal - restingKcalDuringWalk);

  return {
    total:  Math.round(totalKcal),
    active: Math.round(activeKcal),
  };
}

// Calorías por entrenamiento de gym (pesas, esfuerzo moderado ≈ MET 5.0),
// aplicando el mismo factor de edad en Home y Perfil (única fuente de verdad
// para que ambas pantallas siempre muestren el mismo número).
export function calcGymCalories(weightKg, minutes, ageYears = 30) {
  if (!minutes || minutes <= 0) return 0;
  const kg   = weightKg > 0 ? weightKg : 70;
  const edad = ageYears > 0 ? ageYears : 30;
  // Metabolismo baja ~0.3%/año desde los 30 — mismo ajuste que ya existía en Perfil.
  const ageFactor = Math.max(0.88, Math.min(1.10, 1 + (30 - Math.max(15, Math.min(70, edad))) * 0.003));
  return Math.round(5.0 * kg * minutes / 60 * ageFactor);
}

// ── Persistence ───────────────────────────────────────────────────────────────

export async function loadStepData() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return freshData();
    return { ...freshData(), ...JSON.parse(raw) };
  } catch {
    return freshData();
  }
}

export async function saveStepData(data) {
  try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

function freshData() {
  return {
    date:            todayDateString(),
    todaySteps:      0,
    lastAccumulated: 0,
  };
}