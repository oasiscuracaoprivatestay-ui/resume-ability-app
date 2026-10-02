/**
 * SDA AI Coach — Centralized Date & Time Normalization (Phase 34)
 *
 * Normalizes natural language time and date phrases into local 24h "HH:MM"
 * and "YYYY-MM-DD" local date keys without timezone drift.
 */

import { getLocalDateKey } from '../utils/dietStorage';
import { shiftDateKey } from '../utils/progressionEngine';

export interface ParsedTimeResult {
  time?: string; // 24h "HH:MM"
  isAmbiguous?: boolean;
  ambiguityReason?: string;
  matchedText?: string;
}

export interface ParsedDateResult {
  dateKey?: string; // YYYY-MM-DD
  matchedText?: string;
}

/**
 * Normalizes a time phrase into 24-hour "HH:MM".
 * Detects ambiguity when hour is provided without AM/PM or clear context (e.g. "at 8").
 */
export function parseNaturalTime(text: string): ParsedTimeResult {
  const clean = text.toLowerCase();

  // 1. Explicit keywords: noon / midnight
  if (/\bnoon\b|\bmediod[ií]a\b|\bmiddag\b/i.test(clean)) {
    return { time: '12:00', matchedText: 'noon' };
  }
  if (/\bmidnight\b|\bmedianoche\b|\bmiddernacht\b/i.test(clean)) {
    return { time: '00:00', matchedText: 'midnight' };
  }

  // 2. 24-hour exact formats (e.g. "13:00", "08:30", "at 14:15")
  const match24 = clean.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (match24) {
    const hours = String(parseInt(match24[1], 10)).padStart(2, '0');
    const minutes = match24[2];
    return {
      time: `${hours}:${minutes}`,
      matchedText: match24[0],
    };
  }

  // 3. 12-hour format with AM / PM (e.g. "1pm", "1:30pm", "8am", "8:15 am", "1 pm")
  const match12 = clean.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm|a\.m\.|p\.m\.)\b/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = match12[2] ? match12[2] : '00';
    const meridian = match12[3].toLowerCase().replace(/\./g, '');

    if (meridian === 'pm' && hours < 12) {
      hours += 12;
    } else if (meridian === 'am' && hours === 12) {
      hours = 0;
    }

    return {
      time: `${String(hours).padStart(2, '0')}:${minutes}`,
      matchedText: match12[0],
    };
  }

  // 4. Ambiguous hour without AM/PM (e.g. "at 8", "a las 8", "om 8", "at 8 o'clock")
  const matchAmbiguous = clean.match(/(?:at|a las|om)\s+(1[0-2]|0?[1-9])(?:\s*o['’]?clock)?(?!\s*(?::|[0-9]|am|pm|a\.m|p\.m))/i);
  if (matchAmbiguous) {
    return {
      isAmbiguous: true,
      ambiguityReason: `Time "${matchAmbiguous[0]}" does not specify AM or PM.`,
      matchedText: matchAmbiguous[0],
    };
  }

  return {};
}

/**
 * Normalizes relative or explicit date phrases into local YYYY-MM-DD.
 */
export function parseNaturalDate(text: string, referenceDateKey = getLocalDateKey()): ParsedDateResult {
  const clean = text.toLowerCase();

  // "yesterday", "ayer", "gisteren"
  if (/\byesterday\b|\bayer\b|\bgisteren\b/i.test(clean)) {
    return {
      dateKey: shiftDateKey(referenceDateKey, -1),
      matchedText: 'yesterday',
    };
  }

  // "today", "hoy", "vandaag"
  if (/\btoday\b|\bhoy\b|\bvandaag\b/i.test(clean)) {
    return {
      dateKey: referenceDateKey,
      matchedText: 'today',
    };
  }

  // Explicit YYYY-MM-DD
  const matchIso = clean.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (matchIso) {
    return {
      dateKey: matchIso[0],
      matchedText: matchIso[0],
    };
  }

  return {
    dateKey: referenceDateKey,
  };
}
