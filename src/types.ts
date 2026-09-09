// ── Screen identifiers ──
export type Screen =
  | 'home'
  | 'slip-type'
  | 'slip-non-negotiable'
  | 'context'
  | 'slip-insights'
  | 'help'
  | 'recommit'
  | 'mode'
  | 'timer'
  | 'result'
  | 'control'
  | 'commit'
  | 'learn'
  | 'dashboard'
  | 'history'
  | 'daily-audio'
  | 'timer-learn'
  | 'quiz'
  | 'check-in'
  | 'commitment'
  | 'structured-diet'
  | 'premium';

// ── Timer mode ──
export type TimerMode = 'single' | 'loop' | 'extended-fast';

// ── Slip Type ──
export type SlipType = 'slippery-zone' | 'non-negotiable';

// ── Slip context options ──
export type SlipContext =
  | 'people-social'
  | 'environment'
  | 'temptation'
  | 'celebration'
  | 'hunger'
  | 'time-of-day'
  | 'stress'
  | 'habit'
  | 'delay'
  | 'all-or-nothing';

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
  slipType?: SlipType;         // Phase 7B: 'slippery-zone' | 'non-negotiable'
  nonNegotiableText?: string;  // Selected non-negotiable rule text if non-negotiable slip
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
  slipType?: SlipType;
  nonNegotiableText?: string;
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
  'people-social':  'People / Social',
  'environment':    'Environment',
  'temptation':     'Temptation',
  'celebration':    'Celebration',
  'hunger':         'Hunger',
  'time-of-day':    'Time of day',
  'stress':         'Stress',
  'habit':          'Habit',
  'delay':          'Waiting / Delay',
  'all-or-nothing': 'All-or-nothing',
};

export const SLIP_CONTEXT_ICONS: Record<SlipContext, string> = {
  'people-social':  '👥',
  'environment':    '📍',
  'temptation':     '🍫',
  'celebration':    '🎉',
  'hunger':         '🍽️',
  'time-of-day':    '🕐',
  'stress':         '😤',
  'habit':          '🔁',
  'delay':          '⏳',
  'all-or-nothing': '🔥',
};

export const TIMER_MODE_LABELS: Record<TimerMode, string> = {
  'single': 'Single',
  'loop': 'Loop',
  'extended-fast': 'Extended Fast',
};
