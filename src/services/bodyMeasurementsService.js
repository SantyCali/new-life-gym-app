import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Always stores peso in kg internally.
// pesoUnidad is stored only as display preference.
export async function saveBodyMeasurements(uid, updates) {
  if (!uid) return;
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, updates);
}

// Build fechaNacimiento string from a year, keeping day/month if already stored.
export function buildFechaNacimiento(year, existingFecha) {
  if (!year) return null;
  const parts = existingFecha?.split('/') ?? [];
  const day   = parts[0] ?? '01';
  const month = parts[1] ?? '01';
  return `${day}/${month}/${year}`;
}

// Extract the year number from a "DD/MM/YYYY" string.
export function extractYear(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const parts = fechaNacimiento.split('/');
  if (parts.length !== 3 || !parts[2]) return null;
  const y = parseInt(parts[2], 10);
  return isNaN(y) ? null : y;
}

export function kgToLb(kg)  { return Math.round(kg  * 2.20462); }
export function lbToKg(lb)  { return Math.round(lb  / 2.20462); }
