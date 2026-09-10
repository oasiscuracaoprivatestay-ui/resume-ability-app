/**
 * Notification Scheduler & Engine — Phase 12
 *
 * Deterministic, local-time scheduling for gentle awareness reminders.
 * Handles:
 *   - Active hours verification
 *   - Deterministic randomization (±10-20 mins) per day without render jitter
 *   - Safe candidate generation for Check-In, Structured Diet, and Why / Resume-Ability
 *   - Deduplication and quiet-hours cooldowns
 *   - Browser Notification API trigger with navigation callback
 *   - In-app reminder candidate generation
 */

import type { Screen } from '../types';
import type { Translations } from '../i18n';
import type { NotificationSettings } from './notificationSettingsStorage';
import {
  loadNotificationSettings,
  loadReminderDeliveryState,
  getLocalTodayDateKey,
} from './notificationSettingsStorage';
import { loadPledge } from './pledgeStorage';
import { loadWeeklyDiet, getDayPlan, getLocalTodayKey } from './dietStorage';

export interface ReminderCandidate {
  key: string;               // Unique reminder key for today (e.g. "2026-09-10_checkin_10:00")
  type: 'check-in' | 'structured-diet' | 'why';
  title: string;
  body: string;
  actionLabel: string;
  targetScreen: Screen;
  icon: string;
}

export const COOLDOWN_DISMISSED_MS = 15 * 60 * 1000; // 15 minutes after "Not Now"

/**
 * Parse "HH:MM" 24h time into minutes from midnight (0..1439).
 */
export function parseMinutes(timeStr: string): number {
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

/**
 * Check if local minutes is within active hours [start, end].
 */
export function isWithinActiveWindow(nowMinutes: number, startStr: string, endStr: string): boolean {
  const start = parseMinutes(startStr);
  const end = parseMinutes(endStr);
  if (start <= end) {
    return nowMinutes >= start && nowMinutes <= end;
  }
  // Overnight window fallback (e.g. 22:00 to 06:00)
  return nowMinutes >= start || nowMinutes <= end;
}

/**
 * Deterministic string hash for daily randomization.
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Calculate deterministic randomized offset in minutes (±15 min) for a given slot today.
 * Ensures the result stays strictly within the active window.
 */
export function getRandomizedMinutes(
  baseMinutes: number,
  slotKey: string,
  dateKey: string,
  startMinutes: number,
  endMinutes: number,
): number {
  const hash = simpleHash(`${dateKey}_${slotKey}`);
  // Offset between -15 and +15 minutes
  const offset = (hash % 31) - 15;
  const target = baseMinutes + offset;
  return Math.max(startMinutes, Math.min(endMinutes, target));
}

/**
 * Build reminder candidates for enabled types.
 */
export function buildCandidate(
  type: 'check-in' | 'structured-diet' | 'why',
  reminderKey: string,
  t: Translations,
  settings: NotificationSettings,
): ReminderCandidate {
  if (type === 'structured-diet') {
    const weekly = loadWeeklyDiet();
    const todayKey = getLocalTodayKey();
    const todayPlan = getDayPlan(weekly, todayKey);

    // If today has upcoming blocks, see if one is nearby
    let body = t.notif_rem_diet_body_general;
    if (todayPlan.mode === 'structured' && todayPlan.blocks.length > 0) {
      const now = new Date();
      const currentMins = now.getHours() * 60 + now.getMinutes();

      const upcoming = todayPlan.blocks.find(b => {
        const bMins = parseMinutes(b.startTime);
        return bMins >= currentMins && bMins - currentMins <= 45;
      });

      if (upcoming) {
        const typeName = (t[`sdb_type_${upcoming.type}` as keyof Translations] as string) || upcoming.type;
        body = t.notif_rem_diet_body_upcoming
          .replace('{block}', typeName)
          .replace('{time}', upcoming.startTime);
      }
    }

    return {
      key: reminderKey,
      type: 'structured-diet',
      title: t.notif_rem_diet_title,
      body,
      actionLabel: t.notif_btn_diet,
      targetScreen: 'structured-diet',
      icon: '🥗',
    };
  }

  if (type === 'why') {
    let body = t.notif_rem_why_body_general;
    if (settings.showWhy) {
      const pledge = loadPledge();
      if (pledge.reasons && pledge.reasons.length > 0 && pledge.reasons[0].trim()) {
        const reason = pledge.reasons[0].trim();
        const shortReason = reason.length > 60 ? reason.slice(0, 57) + '...' : reason;
        body = t.notif_rem_why_body_custom.replace('{why}', shortReason);
      }
    }

    return {
      key: reminderKey,
      type: 'why',
      title: t.notif_rem_why_title,
      body,
      actionLabel: t.notif_btn_reconnect,
      targetScreen: 'commitment',
      icon: '🎯',
    };
  }

  // Default: Check-in reminder
  // Rotate check-in body deterministically by day/hour
  const checkInBodies = [
    t.notif_rem_checkin_body_1,
    t.notif_rem_checkin_body_2,
    t.notif_rem_checkin_body_3,
  ];
  const now = new Date();
  const bodyIdx = (now.getHours() + now.getDate()) % checkInBodies.length;

  return {
    key: reminderKey,
    type: 'check-in',
    title: t.notif_rem_checkin_title,
    body: checkInBodies[bodyIdx] || t.notif_rem_checkin_body_1,
    actionLabel: t.notif_btn_checkin,
    targetScreen: 'check-in',
    icon: '🧭',
  };
}

/**
 * Evaluate if a scheduled reminder is due now.
 * Returns a ReminderCandidate if due and not yet delivered, otherwise null.
 */
export function evaluateNextReminder(
  t: Translations,
  settings = loadNotificationSettings(),
  delivery = loadReminderDeliveryState(),
  now = new Date(),
): ReminderCandidate | null {
  if (!settings.enabled) return null;

  const nowMs = now.getTime();
  const todayDateKey = getLocalTodayDateKey(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = parseMinutes(settings.activeStart);
  const endMinutes = parseMinutes(settings.activeEnd);

  // 1. Must be within user-defined active window
  if (!isWithinActiveWindow(nowMinutes, settings.activeStart, settings.activeEnd)) {
    return null;
  }

  // 2. Cooldown check: if dismissed with "Not Now" within 15 mins, hold off
  if (delivery.lastDismissedAt > 0 && nowMs - delivery.lastDismissedAt < COOLDOWN_DISMISSED_MS) {
    return null;
  }

  // 3. Assemble pool of enabled reminder types
  const enabledTypes: ('check-in' | 'structured-diet' | 'why')[] = [];
  if (settings.checkInEnabled) enabledTypes.push('check-in');

  // Structured Diet only enabled if today is structured
  if (settings.structuredDietEnabled) {
    const weekly = loadWeeklyDiet();
    const todayKey = getLocalTodayKey();
    const todayPlan = getDayPlan(weekly, todayKey);
    if (todayPlan.mode === 'structured') {
      enabledTypes.push('structured-diet');
    }
  }

  if (settings.resumeAbilityEnabled) enabledTypes.push('why');

  if (enabledTypes.length === 0) return null;

  // 4. Frequency evaluation
  const freq = settings.frequency;

  if (freq === 'daily' || freq === 'twice-daily') {
    const defaultTimes = freq === 'daily' ? ['10:00'] : ['10:00', '18:00'];
    const times = settings.dailyTimes && settings.dailyTimes.length > 0 ? settings.dailyTimes : defaultTimes;

    for (let i = 0; i < times.length; i++) {
      const baseTimeStr = times[i];
      const baseMins = parseMinutes(baseTimeStr);
      const targetMins = settings.randomize
        ? getRandomizedMinutes(baseMins, `slot_${i}`, todayDateKey, startMinutes, endMinutes)
        : baseMins;

      // Due if current local time is in [targetMins, targetMins + 15]
      const isDueNow = nowMinutes >= targetMins && nowMinutes <= targetMins + 15;
      const slotKey = `${todayDateKey}_slot_${i}_${baseTimeStr}`;

      if (isDueNow && !delivery.deliveredKeysToday[slotKey]) {
        // Pick type based on slot index
        const type = enabledTypes[i % enabledTypes.length];
        return buildCandidate(type, slotKey, t, settings);
      }
    }

    return null;
  }

  // Interval-based frequencies ('15m', '30m', '1h')
  const intervalMs =
    freq === '15m' ? 15 * 60 * 1000 :
    freq === '30m' ? 30 * 60 * 1000 :
    60 * 60 * 1000; // 1h

  const timeSinceLast = nowMs - delivery.lastReminderAt;
  if (timeSinceLast >= intervalMs) {
    // Generate a unique interval slot key for this block of time
    const intervalBlock = Math.floor(nowMs / intervalMs);
    const intervalKey = `${todayDateKey}_int_${freq}_${intervalBlock}`;

    if (!delivery.deliveredKeysToday[intervalKey]) {
      const typeIdx = Math.floor(nowMs / intervalMs) % enabledTypes.length;
      const type = enabledTypes[typeIdx];
      return buildCandidate(type, intervalKey, t, settings);
    }
  }

  return null;
}

/**
 * Trigger native browser notification if granted.
 * Gracefully ignores errors or missing browser support.
 */
export function dispatchBrowserNotification(
  candidate: ReminderCandidate,
  onNavigate?: (screen: Screen) => void,
): void {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  try {
    const notif = new Notification(candidate.title, {
      body: candidate.body,
      icon: '/audio/cover.jpg', // fallback existing asset or icon
      badge: '/audio/cover.jpg',
      tag: candidate.key,
    });

    notif.onclick = () => {
      try {
        window.focus();
      } catch {
        // ignore
      }
      notif.close();
      if (onNavigate) {
        onNavigate(candidate.targetScreen);
      }
    };
  } catch (err) {
    console.warn('Browser notification dispatch skipped:', err);
  }
}

/**
 * Request browser notification permission if in 'default' state.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }

  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}
