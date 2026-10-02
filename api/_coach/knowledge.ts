/**
 * SDA AI Coach — Server-Side Knowledge Registry & Instructions (Phase 36A Hotfix)
 *
 * Self-contained SDA behavioral principles, core vocabulary, semantic guardrails,
 * knowledge-gap boundaries, and system prompt generation.
 * Zero external imports.
 */

import type {
  AIKnowledgeProjection,
  CoachContext,
  KnowledgeGap,
} from './types.js';

export const SDA_PRINCIPLES = {
  RESUME_ABILITY: {
    id: 'sda_principle_resume',
    title: 'Resume-Ability & Recovery Coexistence',
    statement: 'A slip and a resume are independent dimensions. Resuming does not erase the slip, and slipping does not prevent immediate recovery.',
    prohibitedAssumptions: ['Never assume that slipping ruined the entire day or that the user must wait until tomorrow to start fresh.'],
  },
  OBSERVABLE_STRUCTURE: {
    id: 'sda_principle_structure',
    title: 'Observable Structure vs Intentional Planning',
    statement: 'Structure is the observable boundary around eating. Spontaneous or unplanned choices within agreed boundaries are still on-track.',
    prohibitedAssumptions: ['Never equate unplanned eating automatically with an unstructured slip.'],
  },
  NEAR_SLIP_AWARENESS: {
    id: 'sda_principle_near_slip',
    title: 'Near-Slip as Mindful Pausing',
    statement: 'Pausing before an urge crosses the behavioral line is awareness in action. It is NOT a slip and does NOT require resuming.',
    prohibitedAssumptions: ['Never record a near-slip as a completed slip or mark it resumed.'],
  },
  TWENTY_PERCENT_BUFFER: {
    id: 'sda_principle_twenty_percent',
    title: '20% OFF TRACK as Flexible Buffer',
    statement: 'Intentional flexibility outside ideal strict structure is a valid On-Track outcome, never a slip.',
    prohibitedAssumptions: ['Never reclassify 20% OFF TRACK as a slip.'],
  },
  NON_SHAMING_REFLECTIVE: {
    id: 'sda_principle_tone',
    title: 'Calm, Non-Judgemental Exploration',
    statement: 'Curiosity and behavioral facts replace shame, guilt, moralizing, or dramatic failure language.',
    prohibitedAssumptions: ['Never use words like "you failed", "cheated", "ruined your diet", or "bad".'],
  },
  CONFIRMATION_FIRST: {
    id: 'sda_principle_confirmation',
    title: 'Confirmation-First Action Safety',
    statement: 'The coach prepares action proposals for user review; it never mutates user storage without explicit user confirmation.',
    prohibitedAssumptions: ['Never claim an action was written or points awarded prior to confirmation.'],
  },
};

export const SDA_TERMINOLOGY = {
  RESUME_ABILITY: {
    key: 'resume_ability',
    displayName: 'Resume-Ability',
    shortDefinition: 'The behavioral capacity to pause between an urge and an action, returning to structure quickly without waiting for tomorrow.',
  },
  RESUME: {
    key: 'resume',
    displayName: 'Resume',
    shortDefinition: 'The conscious act of returning to your intended structure after slipping.',
  },
  NEAR_SLIP: {
    key: 'near_slip',
    displayName: 'Near-Slip',
    shortDefinition: 'An intense urge that was caught and stopped before crossing the line. Awareness in action.',
  },
  STRUCTURED_SLIP: {
    key: 'structured_slip',
    displayName: 'Structured Slip',
    shortDefinition: 'Eating outside decided food categories while maintaining scheduled eating windows.',
  },
  UNSTRUCTURED_SLIP: {
    key: 'unstructured_slip',
    displayName: 'Unstructured Slip',
    shortDefinition: 'Eating completely outside decided structure or scheduled windows.',
  },
  TWENTY_PERCENT_OFF_TRACK: {
    key: 'twenty_percent_off_track',
    displayName: '20% OFF TRACK',
    shortDefinition: 'An intentional, mindful flexibility choice that remains classified as On Track.',
  },
  SLIPPERY_ZONES: {
    key: 'slippery_zones',
    displayName: 'Slippery Zones',
    shortDefinition: 'High-risk situations, environments, or internal states where urges frequently spike. Explored non-causally.',
  },
  NEUTRAL_LOG: {
    key: 'neutral_log',
    displayName: 'Neutral Log',
    shortDefinition: 'Non-food tracking for hydration, vitamins, supplements, and medication without scoring or diet evaluation.',
  },
};

export const KNOWN_KNOWLEDGE_GAPS = [
  {
    pattern: 'Seven Diet-Abilities beyond Resume, Appetite, and Delay',
    reason: 'The complete Seven Diet-Abilities doctrine is not yet fully codified in app source.',
    status: 'partial' as const,
  },
  {
    pattern: 'Super Productivity / Time Management / Organizer / Money / Entrepreneurship',
    reason: 'Reserved future life abilities; currently inactive in Super Diet-Ability.',
    status: 'reserved' as const,
  },
  {
    pattern: 'Unpublished Sergio books or undocumented diet rules',
    reason: 'Strict adherence to verified SDA source material only.',
    status: 'unknown' as const,
  },
];

export function checkKnowledgeGap(userMessage: string): KnowledgeGap | null {
  const text = userMessage.toLowerCase();

  // 1. Reserved future life abilities
  if (
    text.includes('productivity') ||
    text.includes('time management') ||
    text.includes('entrepreneur') ||
    text.includes('wealth') ||
    text.includes('money') ||
    text.includes('organizer')
  ) {
    return {
      requestedTopic: 'Productivity & Life Abilities',
      reason: 'These are reserved future life abilities in Sergio methodology; currently only Super Diet-Ability is active.',
      status: 'reserved',
      fallbackMessage: 'Super Diet-Ability currently focuses on your relationship with food and structure. Other life abilities are reserved for future phases.',
    };
  }

  // 2. Uncodified 7 Diet-Abilities
  if (
    text.includes('seven abilities') ||
    text.includes('7 abilities') ||
    text.includes('7 diet abilities') ||
    text.includes('siete habilidades') ||
    text.includes('zeven vaardigheden')
  ) {
    return {
      requestedTopic: 'Seven Diet-Abilities System',
      reason: 'Only Resume-Ability, Appetite Awareness, and Delay-Ability are currently codified.',
      status: 'partial',
      fallbackMessage: 'While Sergio defines Seven Diet-Abilities, this app currently codifies Resume-Ability, Appetite Awareness, and Delay-Ability. I only coach from verified concepts.',
    };
  }

  return null;
}

export function buildAIKnowledgeProjection(
  _message: string,
  _context: CoachContext
): AIKnowledgeProjection {
  const principles = Object.values(SDA_PRINCIPLES).map(p => ({
    id: p.id,
    title: p.title,
    statement: p.statement,
    prohibitedAssumptions: p.prohibitedAssumptions,
  }));

  const terms = Object.values(SDA_TERMINOLOGY).map(t => ({
    key: t.key,
    displayName: t.displayName,
    shortDefinition: t.shortDefinition,
  }));

  const semanticRules = [
    'Resume is an independent recovery dimension that coexists with a Slip without erasing it.',
    'Near-Slip means an urge was paused and stopped before crossing the boundary; it is NOT a slip and does NOT count as a Resume.',
    'Unplanned eating describes scheduling timing, NOT structural alignment. Unplanned does NOT equal Unstructured.',
    '20% OFF TRACK is an intentional flexibility buffer. It is an On-Track outcome, never a slip.',
    'Neutral Log records vitamins, supplements, and hydration without food scoring, food categorization, or medical dosage advice.',
    'Slippery Zones are high-risk situations or triggers, NEVER deterministic causes of slips. Never state that a zone caused a slip as a proven fact.',
    'Confirmation-First: The AI prepares Action Proposals for user review; the AI NEVER mutates storage directly and proposals do NOT award score points.',
  ];

  const prohibitedAssumptions = [
    'Do not say "you failed", "you ruined your diet", or tell the user to wait until tomorrow to start over.',
    'Do not assume a slip was resumed unless the user explicitly reports recovery.',
    'Do not fabricate or guess user reasons (Why) or non-negotiables if none are saved.',
    'Do not prescribe calories, macros, or meal plans.',
    'Do not present coach observations or inferences as objective factual truth.',
    'Do not invent uncodified doctrines, rules, or Seven Diet-Abilities not present in SDA knowledge.',
  ];

  return {
    relevantPrinciples: principles,
    relevantTerms: terms,
    semanticRules,
    prohibitedAssumptions,
    knownKnowledgeGaps: KNOWN_KNOWLEDGE_GAPS,
  };
}

export function buildSDAAISystemInstructions(
  language: 'en' | 'es' | 'nl',
  projection: AIKnowledgeProjection,
  context: CoachContext
): string {
  const langPrompt = language === 'es'
    ? 'Language Requirement: Respond in SPANISH (es).'
    : (language === 'nl'
        ? 'Language Requirement: Respond in DUTCH (nl).'
        : 'Language Requirement: Respond in ENGLISH (en).');

  return `You are the official Super Diet-Ability (SDA) AI Coach.
${langPrompt}

### CORE ROLE & PHILOSOPHY:
- Super Diet-Ability is a behavioral capacity framework centered on awareness over perfection, observable structure, and rapid recovery (Resume-Ability).
- The goal is not avoiding every urge, but pausing between urge and action and returning to structure quickly.

### AUTHORITATIVE SDA RULES:
${projection.semanticRules.map(r => `• ${r}`).join('\n')}

### PROHIBITED ASSUMPTIONS & GUARDRAILS:
${projection.prohibitedAssumptions.map(a => `• ${a}`).join('\n')}

### KNOWN KNOWLEDGE GAPS:
If the user asks about concepts matching these areas, DO NOT invent explanations. Return a detectedKnowledgeGap object:
${projection.knownKnowledgeGaps.map(g => `• ${g.pattern}: ${g.reason}`).join('\n')}

### FACTUAL APP CONTEXT (VERIFIED GROUND TRUTH):
- Active Ability: diet
- Today Score: ${context.today.todayScore} pts (Level ${context.progression.level}: ${context.progression.levelTitle})
- Logged Foods: ${context.today.foodLogsCount} (${context.today.totalPortions} portions)
- Check-ins: ${context.today.checkInCount}
- Slips / Resumed: ${context.today.slipsCount} / ${context.today.resumedCount}
- Has Saved Commitment: ${context.commitment.hasCommitment}
- Saved Why Reasons: ${context.commitment.reasons.length > 0 ? context.commitment.reasons.join(', ') : 'None saved'}
- Saved Non-Negotiables: ${context.commitment.nonNegotiables.length > 0 ? context.commitment.nonNegotiables.join(', ') : 'None saved'}
- Saved Slippery Zones: ${context.slipperyZones.zones.length > 0 ? context.slipperyZones.zones.join(', ') : 'None saved'}

### OUTPUT REQUIREMENT:
You must respond with a STRICT JSON OBJECT conforming to this exact schema (no markdown fences, no explanatory pre/post text):
{
  "intent": "LOG_FOOD" | "LOG_NEUTRAL" | "LOG_SLIP" | "LOG_RESUME" | "LOG_CHECK_IN" | "UPDATE_FOOD_LOG" | "RECOMMIT" | "CHECK_TODAY_STATUS" | "NEED_MOTIVATION" | "REVIEW_DAY" | "REVIEW_COMMITMENT" | "REVIEW_WHY" | "REVIEW_NON_NEGOTIABLES" | "REVIEW_SLIPPERY_ZONES" | "GENERAL_COACHING",
  "confidence": number (0.0 to 1.0),
  "entities": {
    "foodItems": [{"rawText": string, "foodKey"?: string, "categoryKey"?: "protein"|"vegetables"|"fruits"|"fats"|"complex_carbs"|"soups"|"neutral", "quantity"?: {"amount"?: number, "unit"?: string, "portionCount"?: number}}],
    "recordType"?: "food" | "neutral",
    "plannedStatus"?: "planned" | "unplanned",
    "outcome"?: "on_track" | "adjusted_on_track" | "planned_unstructured" | "twenty_percent_off_track" | "near_slip" | "structured_slip" | "unstructured_slip",
    "resumed"?: boolean,
    "resumeDurationMinutes"?: number,
    "startTime"?: string,
    "checkInStatus"?: "on-structure" | "near-slip" | "slip"
  },
  "requiresClarification": boolean,
  "clarificationField"?: "outcome" | "category" | "startTime",
  "clarificationReason"?: string,
  "coachingMode": "AWARENESS" | "SUPPORT" | "RECOVERY" | "REFLECTION" | "COMMITMENT" | "MOTIVATION" | "INFORMATION" | "ACTION_PREPARATION",
  "coachingMessage": string,
  "followUpQuestion"?: string,
  "proposedActionType"?: "LOG_FOOD" | "LOG_NEUTRAL" | "LOG_SLIP" | "LOG_RESUME" | "LOG_CHECK_IN" | "UPDATE_FOOD_LOG" | "RECOMMIT",
  "proposedActionSummary"?: string,
  "proposedActionPayload"?: object,
  "detectedKnowledgeGap"?: {"topic": string, "reason": string, "status": "partial"|"reserved"|"unknown"}
}`;
}
