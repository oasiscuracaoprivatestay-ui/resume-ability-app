// ── Screen identifiers ──
export type Screen =
  | 'home'
  | 'context'
  | 'help'
  | 'mode'
  | 'timer'
  | 'result'
  | 'control'
  | 'learn'
  | 'dashboard'
  | 'history'
  | 'daily-audio'
  | 'premium';

// ── Timer mode ──
export type TimerMode = 'single' | 'loop' | 'extended-fast';

// ── Slip context options ──
export type SlipContext =
  | 'late-night'
  | 'stress'
  | 'social'
  | 'boredom'
  | 'habit'
  | 'after-meal';

// ── Slip record status ──
export type SlipStatus = 'recovered' | 'extended' | 'relapsed';

// ── Core slip record ──
export interface SlipRecord {
  id: string;
  timestamp: number;           // Date.now()
  context: SlipContext;
  mode: TimerMode;             // which timer mode was used
  recoveryDuration: number;    // in seconds
  status: SlipStatus;
  blocksCompleted?: number;    // blocks completed (loop mode)
  blocksTotal?: number;        // total planned blocks (loop mode)
}

// ── Active session (in-progress slip) ──
export interface ActiveSession {
  startedAt: number;           // Date.now()
  context: SlipContext;
  mode: TimerMode;
  timerDuration: number;       // per-block seconds (900 for single/loop, 0 for extended)
  extensions: number;          // manual +15 min extensions (single mode only)
  loopBlocks: number;          // total blocks (1 for single, N for loop, 0 for extended)
  completedBlocks: number;     // blocks completed so far
}

// ── Dashboard summary ──
export interface DashboardData {
  slipsToday: number;
  mostFrequentContext: SlipContext | null;
  averageRecoverySeconds: number;
}

// ── History summary ──
export interface WeekEntry {
  weekLabel: string;           // e.g. "Apr 1 – Apr 7"
  slipCount: number;
  averageRecoverySeconds: number;
}

// ── Helpers ──
export const SLIP_CONTEXT_LABELS: Record<SlipContext, string> = {
  'late-night': 'Late night',
  'stress': 'Stress',
  'social': 'Social',
  'boredom': 'Boredom',
  'habit': 'Habit',
  'after-meal': 'After meal',
};

export const SLIP_CONTEXT_ICONS: Record<SlipContext, string> = {
  'late-night': '🌙',
  'stress': '😤',
  'social': '👥',
  'boredom': '😶',
  'habit': '🔁',
  'after-meal': '🍽️',
};

export const TIMER_MODE_LABELS: Record<TimerMode, string> = {
  'single': 'Single',
  'loop': 'Loop',
  'extended-fast': 'Extended Fast',
};
