/**
 * Notification Settings & Delivery State Storage — Phase 12
 *
 * Dedicated storage for user reminder preferences and delivery tracking.
 * Storage keys:
 *   - 'resume-ability-notification-settings'
 *   - 'resume-ability-notification-state'
 *
 * Safe defaults, strict validation, zero throws on malformed JSON.
 */

export type ReminderFrequency = '15m' | '30m' | '1h' | 'twice-daily' | 'daily';

export interface NotificationSettings {
  version: 1;
  enabled: boolean;                 // Master toggle: default false
  checkInEnabled: boolean;          // Default: true
  structuredDietEnabled: boolean;   // Default: true
  resumeAbilityEnabled: boolean;    // Default: true
  frequency: ReminderFrequency;     // Default: 'daily'
  activeStart: string;              // Local 24h "HH:MM", default "08:00"
  activeEnd: string;                // Local 24h "HH:MM", default "21:00"
  dailyTimes: string[];             // ['10:00'] or ['10:00', '18:00']
  randomize: boolean;               // VARY REMINDER TIMES (default: false)
  showWhy: boolean;                 // SHOW MY WHY IN REMINDERS (default: false)
}

export interface ReminderDeliveryState {
  lastReminderAt: number;           // Epoch timestamp ms
  lastDismissedAt: number;          // Epoch timestamp ms (for "Not Now" cooldown)
  deliveredKeysToday: Record<string, number>; // reminderKey -> timestamp ms
  dateKey: string;                  // Local "YYYY-MM-DD" to prune old keys
}

const SETTINGS_KEY = 'resume-ability-notification-settings';
const STATE_KEY = 'resume-ability-notification-state';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  version: 1,
  enabled: false,
  checkInEnabled: true,
  structuredDietEnabled: true,
  resumeAbilityEnabled: true,
  frequency: 'daily',
  activeStart: '08:00',
  activeEnd: '21:00',
  dailyTimes: ['10:00'],
  randomize: false,
  showWhy: false,
};

/** Get device's current local calendar date formatted as YYYY-MM-DD */
export function getLocalTodayDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${date}`;
}

export const DEFAULT_DELIVERY_STATE: ReminderDeliveryState = {
  lastReminderAt: 0,
  lastDismissedAt: 0,
  deliveredKeysToday: {},
  dateKey: getLocalTodayDateKey(),
};

const VALID_FREQUENCIES: ReminderFrequency[] = ['15m', '30m', '1h', 'twice-daily', 'daily'];
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

function isValidTime(t: unknown): t is string {
  return typeof t === 'string' && TIME_REGEX.test(t);
}

/**
 * Load notification settings safely with validation.
 */
export function loadNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_NOTIFICATION_SETTINGS };

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_NOTIFICATION_SETTINGS };
    }

    const freq: ReminderFrequency = VALID_FREQUENCIES.includes(parsed.frequency)
      ? parsed.frequency
      : DEFAULT_NOTIFICATION_SETTINGS.frequency;

    const activeStart = isValidTime(parsed.activeStart)
      ? parsed.activeStart
      : DEFAULT_NOTIFICATION_SETTINGS.activeStart;

    const activeEnd = isValidTime(parsed.activeEnd)
      ? parsed.activeEnd
      : DEFAULT_NOTIFICATION_SETTINGS.activeEnd;

    let dailyTimes = DEFAULT_NOTIFICATION_SETTINGS.dailyTimes;
    if (Array.isArray(parsed.dailyTimes) && parsed.dailyTimes.every(isValidTime)) {
      dailyTimes = parsed.dailyTimes.length > 0 ? parsed.dailyTimes : ['10:00'];
    }

    return {
      version: 1,
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : false,
      checkInEnabled: typeof parsed.checkInEnabled === 'boolean' ? parsed.checkInEnabled : true,
      structuredDietEnabled: typeof parsed.structuredDietEnabled === 'boolean' ? parsed.structuredDietEnabled : true,
      resumeAbilityEnabled: typeof parsed.resumeAbilityEnabled === 'boolean' ? parsed.resumeAbilityEnabled : true,
      frequency: freq,
      activeStart,
      activeEnd,
      dailyTimes,
      randomize: typeof parsed.randomize === 'boolean' ? parsed.randomize : false,
      showWhy: typeof parsed.showWhy === 'boolean' ? parsed.showWhy : false,
    };
  } catch {
    return { ...DEFAULT_NOTIFICATION_SETTINGS };
  }
}

/**
 * Save notification settings.
 */
export function saveNotificationSettings(settings: NotificationSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save notification settings:', err);
  }
}

/**
 * Load reminder delivery state.
 * Automatically prunes deliveredKeys if the calendar date has rolled over.
 */
export function loadReminderDeliveryState(): ReminderDeliveryState {
  const todayKey = getLocalTodayDateKey();
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) {
      return { ...DEFAULT_DELIVERY_STATE, dateKey: todayKey };
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_DELIVERY_STATE, dateKey: todayKey };
    }

    // Prune if date changed
    if (parsed.dateKey !== todayKey) {
      return {
        lastReminderAt: typeof parsed.lastReminderAt === 'number' ? parsed.lastReminderAt : 0,
        lastDismissedAt: typeof parsed.lastDismissedAt === 'number' ? parsed.lastDismissedAt : 0,
        deliveredKeysToday: {},
        dateKey: todayKey,
      };
    }

    return {
      lastReminderAt: typeof parsed.lastReminderAt === 'number' ? parsed.lastReminderAt : 0,
      lastDismissedAt: typeof parsed.lastDismissedAt === 'number' ? parsed.lastDismissedAt : 0,
      deliveredKeysToday:
        parsed.deliveredKeysToday && typeof parsed.deliveredKeysToday === 'object'
          ? parsed.deliveredKeysToday
          : {},
      dateKey: todayKey,
    };
  } catch {
    return { ...DEFAULT_DELIVERY_STATE, dateKey: todayKey };
  }
}

/**
 * Save reminder delivery state.
 */
export function saveReminderDeliveryState(state: ReminderDeliveryState): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save reminder delivery state:', err);
  }
}

/**
 * Record that a reminder was delivered.
 */
export function recordReminderDelivered(reminderKey: string, timestamp = Date.now()): ReminderDeliveryState {
  const current = loadReminderDeliveryState();
  const next: ReminderDeliveryState = {
    ...current,
    lastReminderAt: timestamp,
    deliveredKeysToday: {
      ...current.deliveredKeysToday,
      [reminderKey]: timestamp,
    },
  };
  saveReminderDeliveryState(next);
  return next;
}

/**
 * Record that a reminder was dismissed ("Not Now") to start cooldown.
 */
export function recordReminderDismissed(timestamp = Date.now()): ReminderDeliveryState {
  const current = loadReminderDeliveryState();
  const next: ReminderDeliveryState = {
    ...current,
    lastDismissedAt: timestamp,
  };
  saveReminderDeliveryState(next);
  return next;
}
