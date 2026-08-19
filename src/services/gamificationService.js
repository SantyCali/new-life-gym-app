import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { todayDateString, localDateString } from './stepService';

// ── XP constants ──────────────────────────────────────────────────────────────
export const XP_PER_1K_STEPS  = 20;
export const XP_GOAL_BONUS    = 50;
export const XP_GYM_VISIT     = 150;
export const STEPS_FOR_STREAK = 5000;

// XP needed to go from level N to N+1
export function xpToNextLevel(level) { return Math.max(1, level) * 1000; }

function applyXPGain(currentXP, currentLevel, xpGain) {
  let xp    = (currentXP ?? 0) + xpGain;
  let level = (currentLevel ?? 1);
  while (xp >= xpToNextLevel(level)) {
    xp -= xpToNextLevel(level);
    level++;
  }
  return { xp: Math.max(0, xp), nivelJuego: level };
}

let _awarding = false;
export async function awardXPAndCoins(uid, xpGain) {
  if (!uid || !xpGain || _awarding) return;
  _awarding = true;
  try {
    const ref  = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const { xp = 0, nivelJuego = 1 } = snap.data();
    const updated = applyXPGain(xp, nivelJuego, xpGain);
    await updateDoc(ref, { ...updated, xpTotal: increment(xpGain) });
  } catch {}
  finally { _awarding = false; }
}

export async function checkAndAwardGymReward(uid) {
  if (!uid) return false;
  const today = todayDateString();
  try {
    const ref  = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    const { lastGymRewardDate, xp = 0, nivelJuego = 1 } = snap.data();
    if (lastGymRewardDate === today) return false;
    const updated = applyXPGain(xp, nivelJuego, XP_GYM_VISIT);
    await updateDoc(ref, {
      ...updated,
      lastGymRewardDate: today,
      gymVisitCount:     increment(1),
    });
    return true;
  } catch { return false; }
}

export async function updateStreak(uid, currentRacha, lastActiveDate) {
  if (!uid) return;
  const today = todayDateString();
  if (lastActiveDate === today) return;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = localDateString(yesterday);
  const newRacha = lastActiveDate === yStr ? (currentRacha ?? 0) + 1 : 1;
  try {
    const ref  = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    const mejorRacha = snap.exists() ? (snap.data().mejorRacha ?? 0) : 0;
    const updates = { lastActiveDate: today, racha: newRacha };
    if (newRacha > mejorRacha) updates.mejorRacha = newRacha;
    await updateDoc(ref, updates);
  } catch {}
}