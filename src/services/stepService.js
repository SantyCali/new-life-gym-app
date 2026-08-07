import { Platform, Linking } from 'react-native';
import { Pedometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// Returns steps from midnight to now (iOS only via CMPedometer)
export async function getStepsSinceMidnight() {
  const result = await Pedometer.getStepCountAsync(midnightToday(), new Date());
  return result.steps ?? 0;
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
    try {
      const result = await Pedometer.getStepCountAsync(from, to);
      return result.steps ?? 0;
    } catch { return null; }
  }
  // Android: delegate to HC (returns null if HC unavailable)
  return getStepsFromHC(from, to);
}

// ── Calculations ──────────────────────────────────────────────────────────────

export function calcCalories(steps, weightKg = 70, ageYears = 30) {
  const base = steps * 0.04 * (weightKg / 70);
  // Younger metabolism slightly higher, older slightly lower (±10% max)
  const ageFactor = Math.max(0.90, Math.min(1.10, 1 + (25 - Math.max(15, Math.min(75, ageYears))) * 0.004));
  return Math.round(base * ageFactor);
}

export function calcDistanceKm(steps, heightCm = 170) {
  const strideM = (heightCm * 0.414) / 100;
  return parseFloat(((steps * strideM) / 1000).toFixed(2));
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