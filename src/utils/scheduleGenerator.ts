/**
 * Shared Schedule Generation Engine — Super Diet-Ability
 *
 * Provides shared 15-minute grid time generation logic for:
 * 1. Quick Build
 * 2. Template Time-Block Builder (Phase 7B)
 *
 * Guarantees:
 * - 15-minute time grid alignment.
 * - Deterministic unique block IDs via generateBlockId().
 * - Safe overflow detection for schedules exceeding 24:00 (1440 minutes).
 * - Rich template content mapping without copying actual food photos.
 */

import type { DietTemplate } from '../data/dietTemplates';
import type { DayMode, StructuredDietBlock } from './dietStorage';
import { generateBlockId, sortBlocks, timeToMinutes } from './dietStorage';

export interface IntervalOption {
  minutes: number;
  hours: number;
}

export const SCHEDULE_INTERVAL_OPTIONS: IntervalOption[] = [
  { minutes: 30, hours: 0.5 },
  { minutes: 45, hours: 0.75 },
  { minutes: 60, hours: 1 },
  { minutes: 75, hours: 1.25 },
  { minutes: 90, hours: 1.5 },
  { minutes: 105, hours: 1.75 },
  { minutes: 120, hours: 2 },
  { minutes: 150, hours: 2.5 },
  { minutes: 180, hours: 3 },
  { minutes: 210, hours: 3.5 },
  { minutes: 240, hours: 4 },
];

export const BLOCK_COUNT_OPTIONS = [2, 3, 4, 5, 6, 7, 8];

export interface GeneratedTimeSlot {
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
}

export interface ScheduleGenerationResult {
  times: GeneratedTimeSlot[];
  isOverflow: boolean;
}

/**
 * Calculate start and end time pairs given a start time, count, and interval.
 */
export function generateScheduleTimes(
  startTime: string,
  blockCount: number,
  intervalMinutes: number,
  blockDurationMinutes = 30
): ScheduleGenerationResult {
  const startMins = timeToMinutes(startTime);
  const times: GeneratedTimeSlot[] = [];
  let overflow = false;

  for (let i = 0; i < blockCount; i++) {
    const blockStartMins = startMins + i * intervalMinutes;
    const blockEndMins = blockStartMins + blockDurationMinutes;

    // Current day boundary check: 24:00 (1440 minutes)
    if (blockEndMins > 1440) {
      overflow = true;
      break;
    }

    const sh = Math.floor(blockStartMins / 60);
    const sm = blockStartMins % 60;
    const eh = Math.floor(blockEndMins / 60);
    const em = blockEndMins % 60;

    const sStr = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;
    const eStr = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;

    times.push({ startTime: sStr, endTime: eStr });
  }

  return {
    times: overflow ? [] : times,
    isOverflow: overflow,
  };
}

/**
 * Generate Quick Build blocks with custom type and empty items.
 */
export function generateQuickBuildBlocks(
  startTime: string,
  blockCount: number,
  intervalMinutes: number
): { blocks: StructuredDietBlock[]; isOverflow: boolean } {
  const { times, isOverflow } = generateScheduleTimes(startTime, blockCount, intervalMinutes);

  if (isOverflow) {
    return { blocks: [], isOverflow: true };
  }

  const blocks: StructuredDietBlock[] = times.map(t => ({
    id: generateBlockId(),
    startTime: t.startTime,
    endTime: t.endTime,
    type: 'custom',
    items: [],
    customText: '',
  }));

  return {
    blocks,
    isOverflow: false,
  };
}

/**
 * Generate Template blocks mapping semantic template content (food categories, description, type)
 * into configured time slots.
 *
 * Content mapping strategy:
 * - If requested block count <= template block count: map first N template blocks.
 * - If requested block count > template block count: cycle template blocks (i % template.blocks.length).
 * - Food photos are NEVER copied.
 * - Brand new unique block IDs are always generated.
 */
export function generateTemplateBlocks(
  template: DietTemplate,
  startTime: string,
  blockCount: number,
  intervalMinutes: number
): { blocks: StructuredDietBlock[]; isOverflow: boolean; mode: DayMode } {
  const { times, isOverflow } = generateScheduleTimes(startTime, blockCount, intervalMinutes);

  if (isOverflow) {
    return { blocks: [], isOverflow: true, mode: template.targetMode };
  }

  const templateBlocks = template.blocks || [];
  const hasTemplateBlocks = templateBlocks.length > 0;

  const blocks: StructuredDietBlock[] = times.map((t, idx) => {
    const src = hasTemplateBlocks ? templateBlocks[idx % templateBlocks.length] : null;

    return {
      id: generateBlockId(),
      startTime: t.startTime,
      endTime: t.endTime,
      type: src?.type || 'custom',
      items: src?.items ? [...src.items] : [],
      customText: src?.customText || '',
      mealType: src?.mealType,
      foodCategories: src?.foodCategories ? [...src.foodCategories] : undefined,
      foodSelections: src?.foodSelections ? JSON.parse(JSON.stringify(src.foodSelections)) : undefined,
      customFoods: src?.customFoods ? JSON.parse(JSON.stringify(src.customFoods)) : undefined,
      foodPhoto: undefined,
      foodPhotos: undefined,
    };
  });

  return {
    blocks: sortBlocks(blocks),
    isOverflow: false,
    mode: template.targetMode,
  };
}
