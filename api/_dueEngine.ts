/**
 * Due Reminder Calculation Engine — Phase 41D.2
 *
 * Pure, deterministic, timezone-aware calculation of due reminder slots.
 * Server-timezone agnostic: evaluates strictly in the subscriber's IANA timezone.
 */

export interface DueReminderEvaluationInput {
  now?: Date;
  timezone: string;
  reminderTimes: string[];
  challengeActive: boolean;
  reminderEnabled: boolean;
  challengeId?: string | null;
  challengeEndsAt?: number | null; // epoch ms
  windowMinutes?: number;          // delivery window tolerance in minutes (default: 15)
}

export interface DueSlotResult {
  slotTime: string;      // "HH:mm"
  localDate: string;     // "YYYY-MM-DD"
  claimKey: string;      // "${challengeId}|${localDate}|${slotTime}"
}

/**
 * Validates whether an IANA timezone identifier is valid in this environment.
 */
export function isValidTimezone(tz: string): boolean {
  if (!tz || typeof tz !== 'string' || tz.trim().length === 0) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates and normalizes HH:mm time strings.
 * Filters out malformed strings, deduplicates, and sorts chronologically.
 * Caps at maxSlots (default: 6).
 */
export function normalizeReminderTimes(times: string[], maxSlots = 6): string[] {
  if (!Array.isArray(times)) return [];
  const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
  const valid = times
    .map(t => (typeof t === 'string' ? t.trim() : ''))
    .filter(t => timeRegex.test(t));
  
  const unique = Array.from(new Set(valid));
  unique.sort((a, b) => {
    const [hA, mA] = a.split(':').map(Number);
    const [hB, mB] = b.split(':').map(Number);
    return hA * 60 + mA - (hB * 60 + mB);
  });
  return unique.slice(0, maxSlots);
}

/**
 * Resolves current local date ("YYYY-MM-DD") and minutes from midnight (0..1439)
 * for a given UTC Date and IANA timezone.
 */
export function getLocalTimeParts(
  date: Date,
  timezone: string,
): { localDate: string; currentMinutes: number; hour: number; minute: number } {
  const safeTz = isValidTimezone(timezone) ? timezone.trim() : 'UTC';
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') {
      partMap[p.type] = p.value;
    }
  }

  const year = partMap.year || '1970';
  const month = (partMap.month || '01').padStart(2, '0');
  const day = (partMap.day || '01').padStart(2, '0');
  const localDate = `${year}-${month}-${day}`;

  let rawHour = parseInt(partMap.hour || '0', 10);
  // In 24h format, some engines format midnight as 24
  if (rawHour === 24) rawHour = 0;
  const hour = rawHour;
  const minute = parseInt(partMap.minute || '0', 10);
  const currentMinutes = hour * 60 + minute;

  return { localDate, currentMinutes, hour, minute };
}

/**
 * Pure evaluation of due reminder slots.
 * Returns an array of due slots that fall within the current evaluation window.
 */
export function evaluateDueSlots(input: DueReminderEvaluationInput): DueSlotResult[] {
  const {
    now = new Date(),
    timezone,
    reminderTimes,
    challengeActive,
    reminderEnabled,
    challengeId = 'challenge',
    challengeEndsAt,
    windowMinutes = 15,
  } = input;

  // 1. Inactivity guards
  if (!challengeActive || !reminderEnabled) {
    return [];
  }

  // 2. Challenge expiration guard
  if (challengeEndsAt && now.getTime() > challengeEndsAt) {
    return [];
  }

  // 3. Normalize configured slots
  const slots = normalizeReminderTimes(reminderTimes);
  if (slots.length === 0) {
    return [];
  }

  // 4. Resolve local wall-clock time
  const { localDate, currentMinutes } = getLocalTimeParts(now, timezone);

  const dueSlots: DueSlotResult[] = [];

  for (const slot of slots) {
    const [h, m] = slot.split(':').map(Number);
    const slotMinutes = h * 60 + m;

    // Due if currentMinutes is in [slotMinutes, slotMinutes + windowMinutes)
    if (currentMinutes >= slotMinutes && currentMinutes < slotMinutes + windowMinutes) {
      const claimKey = `${challengeId || 'challenge'}|${localDate}|${slot}`;
      dueSlots.push({
        slotTime: slot,
        localDate,
        claimKey,
      });
    }
  }

  return dueSlots;
}
