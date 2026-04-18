import type { SlipRecord, DashboardData, WeekEntry, SlipContext } from './types';

const STORAGE_KEY = 'resume-ability-slips';

// ── Persistence ──

export function loadSlips(): SlipRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    // Backward compatibility: default mode to 'single' for old records
    return (JSON.parse(raw) as Record<string, unknown>[]).map((s) => ({
      ...s,
      mode: s.mode || 'single',
    })) as SlipRecord[];
  } catch {
    return [];
  }
}

export function saveSlip(record: SlipRecord): void {
  const slips = loadSlips();
  slips.push(record);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slips));
}

/** Patch an existing slip record by ID (used to enrich with timer outcome). */
export function updateSlip(id: string, patch: Partial<SlipRecord>): void {
  const slips = loadSlips();
  const idx = slips.findIndex((s) => s.id === id);
  if (idx !== -1) {
    slips[idx] = { ...slips[idx], ...patch };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slips));
  }
}

export function clearSlips(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ── Date range filtering ──

export type HistoryRange = 'today' | '7d' | '30d' | 'all';

export function filterSlipsByRange(slips: SlipRecord[], range: HistoryRange): SlipRecord[] {
  if (range === 'all') return slips;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let cutoff: number;
  switch (range) {
    case 'today':
      cutoff = now.getTime();
      break;
    case '7d':
      cutoff = now.getTime() - 6 * 24 * 60 * 60 * 1000;
      break;
    case '30d':
      cutoff = now.getTime() - 29 * 24 * 60 * 60 * 1000;
      break;
  }
  return slips.filter((s) => s.timestamp >= cutoff);
}

// ── Date/time formatting for log view ──

export function formatDateTime(timestamp: number): { date: string; time: string } {
  const d = new Date(timestamp);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const date = `${months[d.getMonth()]} ${d.getDate()}`;
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  const time = `${h}:${m}`;
  return { date, time };
}

// ── ID generation ──

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── Time formatting ──

export function formatTimer(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (secs === 0) return `${mins} min`;
  return `${mins} min ${secs}s`;
}

// ── Dashboard data ──

export function computeDashboard(slips: SlipRecord[]): DashboardData {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();

  const todaySlips = slips.filter((s) => s.timestamp >= todayStart);

  // Most frequent context (all time)
  const contextCounts: Partial<Record<SlipContext, number>> = {};
  for (const s of slips) {
    contextCounts[s.context] = (contextCounts[s.context] || 0) + 1;
  }
  let mostFrequentContext: SlipContext | null = null;
  let maxCount = 0;
  for (const [ctx, count] of Object.entries(contextCounts)) {
    if (count! > maxCount) {
      maxCount = count!;
      mostFrequentContext = ctx as SlipContext;
    }
  }

  // Average recovery (all time)
  const avg =
    slips.length > 0
      ? slips.reduce((sum, s) => sum + s.recoveryDuration, 0) / slips.length
      : 0;

  return {
    slipsToday: todaySlips.length,
    mostFrequentContext,
    averageRecoverySeconds: Math.round(avg),
  };
}

// ── History data ──

export function computeWeeklyHistory(slips: SlipRecord[]): WeekEntry[] {
  if (slips.length === 0) return [];

  // Sort oldest first
  const sorted = [...slips].sort((a, b) => a.timestamp - b.timestamp);

  // Group by week (Monday start)
  const weeks: Map<string, SlipRecord[]> = new Map();

  for (const s of sorted) {
    const d = new Date(s.timestamp);
    const monday = getMonday(d);
    const key = monday.toISOString().split('T')[0];
    if (!weeks.has(key)) weeks.set(key, []);
    weeks.get(key)!.push(s);
  }

  const entries: WeekEntry[] = [];
  for (const [key, records] of weeks) {
    const monday = new Date(key);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);

    const weekLabel = `${formatShortDate(monday)} – ${formatShortDate(sunday)}`;
    const avgRecovery =
      records.reduce((sum, r) => sum + r.recoveryDuration, 0) / records.length;

    entries.push({
      weekLabel,
      slipCount: records.length,
      averageRecoverySeconds: Math.round(avgRecovery),
    });
  }

  return entries.reverse(); // newest first
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatShortDate(d: Date): string {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}
