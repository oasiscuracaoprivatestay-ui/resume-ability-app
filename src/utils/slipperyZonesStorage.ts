/**
 * Persistent Storage for Personal Slippery Zones — Super Diet-Ability
 *
 * Namespace: resume-ability-slippery-zones
 *
 * Features:
 * - Stores user-defined personal recurring triggers, situations, environments, and habits.
 * - Tracks review count and last reviewed timestamp.
 * - Integrates with centralized scoring engine (SLIPPERY_ZONES_REVIEW: +15 pts once per day).
 * - Safe fallback for headless / server / storage-disabled environments.
 */

import { generateId } from '../utils';
import { getLocalDateKey } from './dietStorage';
import { recordScoreEvent } from './scoringEngine';

export const SLIPPERY_ZONES_STORAGE_KEY = 'resume-ability-slippery-zones';

export interface PersonalSlipperyZone {
  id: string;
  title: string;
  createdAt: string; // ISO string
  updatedAt?: string; // ISO string
}

export interface SlipperyZonesData {
  zones: PersonalSlipperyZone[];
  reviewCount: number;
  lastReviewedAt?: string; // ISO string
}

const DEFAULT_DATA: SlipperyZonesData = {
  zones: [],
  reviewCount: 0,
};

/**
 * Load personal slippery zones from localStorage.
 */
export function loadSlipperyZones(): SlipperyZonesData {
  try {
    const raw = localStorage.getItem(SLIPPERY_ZONES_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DATA, zones: [] };
    const parsed = JSON.parse(raw);
    return {
      zones: Array.isArray(parsed?.zones) ? parsed.zones : [],
      reviewCount: typeof parsed?.reviewCount === 'number' ? parsed.reviewCount : 0,
      lastReviewedAt: typeof parsed?.lastReviewedAt === 'string' ? parsed.lastReviewedAt : undefined,
    };
  } catch {
    return { ...DEFAULT_DATA, zones: [] };
  }
}

/**
 * Persist personal slippery zones to localStorage.
 */
export function saveSlipperyZones(data: SlipperyZonesData): void {
  try {
    localStorage.setItem(SLIPPERY_ZONES_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage quota or disabled fallback
  }
}

/**
 * Add a new personal slippery zone.
 */
export function addSlipperyZone(title: string): PersonalSlipperyZone {
  const trimmed = title.trim();
  if (!trimmed) {
    throw new Error('Title cannot be empty');
  }

  const data = loadSlipperyZones();
  const newZone: PersonalSlipperyZone = {
    id: `sz_${generateId()}`,
    title: trimmed,
    createdAt: new Date().toISOString(),
  };

  data.zones.push(newZone);
  saveSlipperyZones(data);
  return newZone;
}

/**
 * Update an existing personal slippery zone title.
 */
export function updateSlipperyZone(id: string, newTitle: string): PersonalSlipperyZone | null {
  const trimmed = newTitle.trim();
  if (!trimmed) return null;

  const data = loadSlipperyZones();
  const idx = data.zones.findIndex(z => z.id === id);
  if (idx === -1) return null;

  const updated: PersonalSlipperyZone = {
    ...data.zones[idx],
    title: trimmed,
    updatedAt: new Date().toISOString(),
  };

  data.zones[idx] = updated;
  saveSlipperyZones(data);
  return updated;
}

/**
 * Delete a personal slippery zone by id.
 */
export function deleteSlipperyZone(id: string): boolean {
  const data = loadSlipperyZones();
  const initialLength = data.zones.length;
  data.zones = data.zones.filter(z => z.id !== id);

  if (data.zones.length !== initialLength) {
    saveSlipperyZones(data);
    return true;
  }
  return false;
}

/**
 * Record a completed review confirmation (Hold to Confirm Review).
 * Updates review metadata and awards SLIPPERY_ZONES_REVIEW (+15 pts once per day).
 */
export function recordSlipperyZonesReview(): {
  updatedData: SlipperyZonesData;
  scoreAwarded: boolean;
} {
  const data = loadSlipperyZones();
  const nowIso = new Date().toISOString();
  const dateKey = getLocalDateKey();

  data.reviewCount = (data.reviewCount || 0) + 1;
  data.lastReviewedAt = nowIso;
  saveSlipperyZones(data);

  // Award points via deterministic sourceId deduplication (anti-farming)
  const scoreResult = recordScoreEvent({
    activityType: 'SLIPPERY_ZONES_REVIEW',
    sourceId: `slippery_zones_review_${dateKey}`,
    metadata: {
      reviewCount: data.reviewCount,
      zonesCount: data.zones.length,
    },
  });

  return {
    updatedData: data,
    scoreAwarded: scoreResult.status === 'awarded',
  };
}

/**
 * Format last reviewed timestamp into human-readable awareness string.
 */
export function formatLastReviewed(
  lastReviewedAt: string | undefined,
  t: {
    sz_never_reviewed: string;
    sz_reviewed_today: string;
    sz_last_reviewed: string;
  }
): string {
  if (!lastReviewedAt) {
    return t.sz_never_reviewed || 'Last reviewed: Never';
  }

  const reviewDate = new Date(lastReviewedAt);
  const todayKey = getLocalDateKey(new Date());
  const reviewKey = getLocalDateKey(reviewDate);

  if (reviewKey === todayKey) {
    return t.sz_reviewed_today || 'Last reviewed: Today';
  }

  const dateStr = reviewDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  return (t.sz_last_reviewed || 'Last reviewed: {date}').replace('{date}', dateStr);
}
