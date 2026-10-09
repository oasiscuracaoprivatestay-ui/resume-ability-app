/**
 * Super Diet-Ability — Exercise & Activity Domain Types (Phase 43)
 *
 * Core Principles:
 * 1. Strictly optional: Physical activity is supported and encouraged, never required.
 * 2. Score-neutral: 0 XP. Exercise is not a currency to earn calories, offset food, or prevent slips.
 * 3. Challenge independence: Activity never alters Challenge completion, streaks, or check-in requirements.
 * 4. Opt-in challenge linking: Explicit user toggle, defaults to false/unlinked.
 * 5. Factual & non-clinical: No calorie calculations, metabolic burn metrics, or weight loss claims.
 */

export const ACTIVITY_STORAGE_KEY = 'resume-ability-activities';
export const ACTIVITIES_UPDATED_EVENT = 'resume-ability:activities-updated';

/**
 * Eight canonical activity categories.
 */
export const ACTIVITY_CATEGORIES = [
  'walking',
  'running',
  'cycling',
  'swimming',
  'strength_training',
  'mobility_yoga',
  'sports',
  'other_movement',
] as const;

export type ActivityCategory = typeof ACTIVITY_CATEGORIES[number];

/**
 * Optional perceived intensity levels.
 */
export const ACTIVITY_INTENSITIES = ['light', 'moderate', 'vigorous'] as const;
export type ActivityIntensity = typeof ACTIVITY_INTENSITIES[number];

/**
 * Factual activity record model.
 */
export interface ActivityRecord {
  /** Stable unique identifier (e.g. act_1728472800000_abc123) */
  id: string;
  /** One of the eight approved canonical categories */
  category: ActivityCategory;
  /** Optional custom descriptive title (maximum 50 characters) */
  customName?: string;
  /** Duration in minutes (valid positive integer between 1 and 720) */
  durationMinutes: number;
  /** Optional perceived intensity */
  intensity?: ActivityIntensity;
  /** Optional personal notes or reflections (maximum 300 characters) */
  notes?: string;
  /** Local calendar date in YYYY-MM-DD format */
  dateKey: string;
  /** Local time in HH:mm 24-hour format */
  time: string;
  /** Epoch timestamp representing occurrence time */
  timestamp: number;
  /** Epoch timestamp of record creation */
  createdAt: number;
  /** Epoch timestamp of last update */
  updatedAt: number;
  /** Optional associated Challenge ID if explicitly linked */
  associatedChallengeId?: string;
  /** Schema version */
  schemaVersion: 1;
}

/**
 * Versioned local storage root structure.
 */
export interface ActivityStore {
  version: 1;
  activities: ActivityRecord[];
}

/**
 * Input payload for creating a new activity.
 */
export interface CreateActivityInput {
  /** Specific custom ID if needed (e.g. for testing/migration); generated automatically if omitted */
  id?: string;
  category: ActivityCategory;
  durationMinutes: number;
  customName?: string;
  intensity?: ActivityIntensity;
  notes?: string;
  dateKey?: string;
  time?: string;
  timestamp?: number;
  associatedChallengeId?: string;
}

/**
 * Input payload for editing an existing activity.
 */
export interface UpdateActivityInput {
  category?: ActivityCategory;
  durationMinutes?: number;
  customName?: string | null;
  intensity?: ActivityIntensity | null;
  notes?: string | null;
  dateKey?: string;
  time?: string;
  timestamp?: number;
  associatedChallengeId?: string | null;
}

/**
 * Generic storage operation result.
 */
export interface StorageOperationResult<T = ActivityRecord> {
  success: boolean;
  data?: T;
  error?: string;
  isDuplicate?: boolean;
}

/**
 * Factual daily activity aggregation.
 */
export interface DailyActivitySummary {
  dateKey: string;
  count: number;
  totalDurationMinutes: number;
}
