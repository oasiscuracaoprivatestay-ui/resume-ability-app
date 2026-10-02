/**
 * SDA AI Coach — Local Intent Detection (Phase 33)
 *
 * Supports deterministic routing for starter prompts and core questions
 * across English, Spanish, and Dutch.
 */

import type { CoachIntent, CoachIntentType } from './types';

interface IntentRule {
  type: CoachIntentType;
  patterns: RegExp[];
}

const INTENT_RULES: IntentRule[] = [
  {
    type: 'NEED_MOTIVATION',
    patterns: [
      /motivation|motívame|motivación|motivatie/i,
      /help me get back|get back on structure|ayúdame a volver|help me terug|herpakken/i,
      /struggling|cuesta|moeite|hard today|difícil/i,
    ],
  },
  {
    type: 'REVIEW_WHY',
    patterns: [
      /why am i doing this|por qu[eé] estoy haciendo esto|waarom doe ik dit/i,
      /my why|mi porqu[eé]|mi razón|mi razon|mijn waarom/i,
    ],
  },
  {
    type: 'REVIEW_NON_NEGOTIABLES',
    patterns: [
      /non-negotiable|no negociable|niet-onderhandelba/i,
      /rules|reglas|regels/i,
    ],
  },
  {
    type: 'REVIEW_COMMITMENT',
    patterns: [
      /what did i commit to|a qu[eé] me compromet[ií]|waar heb ik me aan gecommitteerd/i,
      /my commitment|commitment|compromiso|belofte/i,
    ],
  },
  {
    type: 'REVIEW_SLIPPERY_ZONES',
    patterns: [
      /slippery zone|zonas? resbaladiza|glijdende zone/i,
      /triggers|disparadores|valkuilen/i,
    ],
  },
  {
    type: 'LOG_SLIP',
    patterns: [
      /^i slipped$|i slipped\b|me deslic[eé]|ik ben uitgegleden|had a slip/i,
    ],
  },
  {
    type: 'CHECK_TODAY_STATUS',
    patterns: [
      /how am i doing|how am i doing today|c[oó]mo voy hoy|hoe doe ik het vandaag/i,
      /today status|status hoy|status vandaag|today score/i,
    ],
  },
  {
    type: 'REVIEW_DAY',
    patterns: [
      /review my day|review day|revisar mi d[ií]a|resumen del d[ií]a|bekijk mijn dag|dagoverzicht/i,
      /summary of today|resumen de hoy/i,
    ],
  },
];

/**
 * Classifies an incoming user message into a high-level intent.
 */
export function detectCoachIntent(message: string): CoachIntent {
  const trimmed = message.trim();
  if (!trimmed) {
    return { type: 'GENERAL_COACHING', confidence: 0 };
  }

  for (const rule of INTENT_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(trimmed)) {
        return {
          type: rule.type,
          confidence: 0.95,
        };
      }
    }
  }

  return {
    type: 'GENERAL_COACHING',
    confidence: 0.5,
  };
}
