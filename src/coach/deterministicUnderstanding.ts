/**
 * SDA AI Coach — Deterministic Understanding Engine (Phase 34)
 *
 * Implements the CoachUnderstandingProvider contract using deterministic parsing,
 * canonical app resolvers, and clear ambiguity modeling.
 *
 * Designed to be swappable with AIUnderstandingProvider in future phases without
 * changing UI or action contracts.
 */

import {
  ACTIVE_ABILITY_ID,
  CONFIDENCE_THRESHOLDS,
  type CoachUnderstanding,
  type CoachUnderstandingProvider,
  type UnderstandingRequest,
  type CoachEntities,
  type ParsedFoodItem,
  type CoachAmbiguity,
  type CoachIntentType,
  type CoachActionProposal,
} from './types';
import {
  resolveFoodTerm,
  resolveQuantity,
  resolveSoupPortion,
  resolveOutcome,
  resolveCheckInStatus,
  parseResumeDetails,
} from './coachResolvers';
import { parseNaturalTime, parseNaturalDate } from './coachDateTime';
import { createActionProposal } from './coachActions';
import { FOOD_CATEGORY_KEYS } from '../data/dietData';

export class DeterministicUnderstandingProvider implements CoachUnderstandingProvider {
  readonly id = 'deterministic';
  readonly name = 'Deterministic Understanding Engine';

  async understand(request: UnderstandingRequest): Promise<CoachUnderstanding> {
    const { text, language: _language = 'en', context } = request;
    const rawText = text.trim();

    const entities: CoachEntities = {};
    const ambiguities: CoachAmbiguity[] = [];
    let intent: CoachIntentType = 'GENERAL_COACHING';
    let confidence = 0.5;
    let requiresClarification = false;

    // ── 1. Date & Time Normalization ─────────────────────────────────────────
    const timeResult = parseNaturalTime(rawText);
    if (timeResult.time) {
      entities.startTime = timeResult.time;
    } else if (timeResult.isAmbiguous) {
      ambiguities.push({
        field: 'startTime',
        reason: timeResult.ambiguityReason || 'Please specify whether you mean AM or PM.',
        options: [
          { label: '8:00 AM', value: '08:00' },
          { label: '8:00 PM', value: '20:00' },
        ],
      });
      requiresClarification = true;
    }

    const dateResult = parseNaturalDate(rawText, context?.dateKey);
    if (dateResult.dateKey) {
      entities.date = dateResult.dateKey;
    }

    // ── 2. Check for Neutral Log ─────────────────────────────────────────────
    const isNeutralLog = checkNeutralLogPhrase(rawText);
    if (isNeutralLog) {
      intent = 'LOG_NEUTRAL';
      confidence = CONFIDENCE_THRESHOLDS.STRONG_DETERMINISTIC;
      entities.recordType = 'neutral';
      entities.description = isNeutralLog.description;

      const qty = resolveQuantity(rawText);
      if (qty) {
        entities.quantity = qty;
      }

      const proposal = createActionProposal(
        'LOG_NEUTRAL',
        {
          recordType: 'neutral',
          description: entities.description,
          date: entities.date,
          startTime: entities.startTime,
          quantity: entities.quantity,
        },
        formatNeutralProposalSummary(entities.description, entities.quantity, entities.startTime)
      );

      return {
        id: `und-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ability: ACTIVE_ABILITY_ID,
        rawText,
        intent,
        confidence,
        entities,
        ambiguities,
        requiresClarification,
        proposedAction: proposal,
      };
    }

    // ── 3. Check for Slip / Near-Slip / 20% OFF TRACK ────────────────────────
    const isExplicitOffTrack = /20%|20\s*percent|veinte\s*por\s*ciento|20\s*procent/i.test(rawText) &&
      /off\s*track|fuera|buiten/i.test(rawText);

    if (isExplicitOffTrack) {
      intent = 'LOG_SLIP';
      confidence = CONFIDENCE_THRESHOLDS.CANONICAL_EXACT;
      entities.outcome = 'twenty_percent_off_track';
      // NOT a slip, does NOT imply resumed

      const proposal = createActionProposal(
        'LOG_FOOD',
        {
          detailedOutcome: 'twenty_percent_off_track',
          date: entities.date,
          startTime: entities.startTime,
        },
        `20% OFF TRACK — ${entities.startTime || 'Today'}`
      );

      return {
        id: `und-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ability: ACTIVE_ABILITY_ID,
        rawText,
        intent,
        confidence,
        entities,
        ambiguities,
        requiresClarification,
        proposedAction: proposal,
      };
    }

    const outcomeRes = resolveOutcome(rawText);
    const slipKeyword = /\b(?:slipped|i slipped|deslic[eé]|uitgegleden|had a slip)\b/i.test(rawText);

    if (outcomeRes || slipKeyword) {
      intent = 'LOG_SLIP';

      if (outcomeRes) {
        confidence = CONFIDENCE_THRESHOLDS.CANONICAL_EXACT;
        entities.outcome = outcomeRes.outcome;
        entities.resumed = outcomeRes.resumed;
        entities.resumeDurationMinutes = outcomeRes.resumeDurationMinutes;
      } else {
        // "I slipped." without specifying subtype
        const resumeInfo = parseResumeDetails(rawText);
        entities.resumed = resumeInfo.resumed;
        entities.resumeDurationMinutes = resumeInfo.durationMinutes;

        confidence = CONFIDENCE_THRESHOLDS.STRONG_DETERMINISTIC;
        requiresClarification = true;
        ambiguities.push({
          field: 'outcome',
          reason: 'Please choose the type of slip to record it accurately.',
          options: [
            { label: 'Near-Slip', value: 'near_slip', description: 'Stopped before crossing the boundary' },
            { label: 'Structured Slip', value: 'structured_slip', description: 'Departed from plan within defined limits' },
            { label: 'Unstructured Slip', value: 'unstructured_slip', description: 'Total departure from food structure' },
          ],
        });
      }

      let proposal: CoachActionProposal | undefined;
      if (!requiresClarification && entities.outcome) {
        proposal = createActionProposal(
          'LOG_SLIP',
          {
            outcome: entities.outcome,
            resumed: entities.resumed || false,
            resumeDurationMinutes: entities.resumeDurationMinutes,
            date: entities.date,
            startTime: entities.startTime,
          },
          formatSlipProposalSummary(entities.outcome, entities.resumed, entities.resumeDurationMinutes, entities.startTime)
        );
      }

      return {
        id: `und-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ability: ACTIVE_ABILITY_ID,
        rawText,
        intent,
        confidence,
        entities,
        ambiguities,
        requiresClarification,
        proposedAction: proposal,
      };
    }

    // ── 4. Check for Daily Check-In ──────────────────────────────────────────
    const checkInStatus = resolveCheckInStatus(rawText);
    const isCheckInPhrase = /\b(?:check[- ]?in|i'm on structure|im on structure|close to slipping)\b/i.test(rawText);

    if (checkInStatus && isCheckInPhrase && !/had|ate|comí|gegeten/i.test(rawText)) {
      intent = 'LOG_CHECK_IN';
      confidence = CONFIDENCE_THRESHOLDS.CANONICAL_EXACT;
      entities.checkInStatus = checkInStatus;

      const proposal = createActionProposal(
        'LOG_CHECK_IN',
        {
          status: checkInStatus,
          date: entities.date,
          timestamp: Date.now(),
        },
        `Daily Check-In: ${checkInStatus === 'on-structure' ? 'On Structure' : (checkInStatus === 'near-slip' ? 'Near Slip' : 'Slip')}`
      );

      return {
        id: `und-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ability: ACTIVE_ABILITY_ID,
        rawText,
        intent,
        confidence,
        entities,
        ambiguities,
        requiresClarification,
        proposedAction: proposal,
      };
    }

    // ── 5. Check for Food Logging ────────────────────────────────────────────
    const foodItems = parseFoodItemsFromText(rawText);
    const hasFoodKeywords = /\b(?:had|ate|eating|eaten|com[ií]|cen[eé]|almorc[eé]|gegeten|eet|portions?|grams?|ml|soup|beef|chicken|rice)\b/i.test(rawText);

    if (foodItems.length > 0 || hasFoodKeywords) {
      intent = 'LOG_FOOD';
      entities.foodItems = foodItems;
      entities.recordType = 'food';

      // Check planned vs unplanned metadata
      if (/\b(?:planned|planeado|gepland)\b/i.test(rawText) && !/\b(?:didn't plan|unplanned|no planeado|ongepland)\b/i.test(rawText)) {
        entities.plannedStatus = 'planned';
      } else if (/\b(?:didn't plan|unplanned|spontaneous|no planeado|espont[aá]neo|ongepland)\b/i.test(rawText)) {
        entities.plannedStatus = 'unplanned';
      }

      // Check for unknown food safety
      const unknownFoodMatch = checkUnknownFoodPhrase(rawText, foodItems);
      if (unknownFoodMatch) {
        entities.foodItems.push(unknownFoodMatch);
        ambiguities.push({
          field: 'category',
          reason: `Which food category should I use for "${unknownFoodMatch.rawText}"?`,
          options: FOOD_CATEGORY_KEYS.map(cat => ({
            label: cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, ' '),
            value: cat,
          })),
        });
        requiresClarification = true;
      }

      // Calculate confidence
      if (foodItems.length > 0 && !requiresClarification) {
        confidence = Math.min(...foodItems.map(f => f.confidence));
      } else {
        confidence = CONFIDENCE_THRESHOLDS.POSSIBLE_MAPPING;
      }

      let proposal: CoachActionProposal | undefined;
      if (!requiresClarification && foodItems.length > 0 && confidence >= CONFIDENCE_THRESHOLDS.MINIMUM_FOR_PROPOSAL) {
        proposal = createActionProposal(
          'LOG_FOOD',
          {
            foodItems: entities.foodItems,
            plannedStatus: entities.plannedStatus,
            date: entities.date,
            startTime: entities.startTime,
          },
          formatFoodProposalSummary(entities.foodItems, entities.startTime)
        );
      }

      return {
        id: `und-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ability: ACTIVE_ABILITY_ID,
        rawText,
        intent,
        confidence,
        entities,
        ambiguities,
        requiresClarification,
        proposedAction: proposal,
      };
    }

    // ── 6. Fallback to Read-Only Coaching Intents ────────────────────────────
    if (/motivation|motívame|motivación|motivatie|struggling/i.test(rawText)) {
      intent = 'NEED_MOTIVATION';
      confidence = CONFIDENCE_THRESHOLDS.CANONICAL_EXACT;
    } else if (/why am i doing this|mi porqu[eé]|mijn waarom|my why/i.test(rawText)) {
      intent = 'REVIEW_WHY';
      confidence = CONFIDENCE_THRESHOLDS.CANONICAL_EXACT;
    } else if (/non-negotiable|no negociable|niet-onderhandelba/i.test(rawText)) {
      intent = 'REVIEW_NON_NEGOTIABLES';
      confidence = CONFIDENCE_THRESHOLDS.CANONICAL_EXACT;
    } else if (/what did i commit to|commitment|compromiso|belofte/i.test(rawText)) {
      intent = 'REVIEW_COMMITMENT';
      confidence = CONFIDENCE_THRESHOLDS.CANONICAL_EXACT;
    } else if (/slippery zone|zonas? resbaladiza|glijdende zone|valkuilen/i.test(rawText)) {
      intent = 'REVIEW_SLIPPERY_ZONES';
      confidence = CONFIDENCE_THRESHOLDS.CANONICAL_EXACT;
    } else if (/how am i doing|c[oó]mo voy hoy|hoe doe ik het vandaag|today status/i.test(rawText)) {
      intent = 'CHECK_TODAY_STATUS';
      confidence = CONFIDENCE_THRESHOLDS.CANONICAL_EXACT;
    } else if (/review my day|revisar mi d[ií]a|bekijk mijn dag|dagoverzicht/i.test(rawText)) {
      intent = 'REVIEW_DAY';
      confidence = CONFIDENCE_THRESHOLDS.CANONICAL_EXACT;
    }

    return {
      id: `und-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ability: ACTIVE_ABILITY_ID,
      rawText,
      intent,
      confidence,
      entities,
      ambiguities,
      requiresClarification,
    };
  }
}

// ── Private Helper Functions ──────────────────────────────────────────────────

function checkNeutralLogPhrase(text: string): { description: string } | null {
  const clean = text.toLowerCase();
  const vitaminMatch = clean.match(/\b(?:vitamin|vitamina|vitamine)\s+[a-z0-9]+\b/i);
  if (vitaminMatch) {
    const desc = vitaminMatch[0].charAt(0).toUpperCase() + vitaminMatch[0].slice(1);
    return { description: desc };
  }

  const supplementMatch = clean.match(/\b(?:supplement|suplemento|supplementen|creatine|magnesium|zinc|omega[- ]?3)\b/i);
  if (supplementMatch) {
    const desc = supplementMatch[0].charAt(0).toUpperCase() + supplementMatch[0].slice(1);
    return { description: desc };
  }

  return null;
}

function checkUnknownFoodPhrase(text: string, parsedItems: ParsedFoodItem[]): ParsedFoodItem | null {
  // If user says "I ate dragon stew" or "comí dragon stew" and no food item was resolved
  const match = text.match(/(?:ate|eating|had|com[ií]|gegeten)\s+([a-zA-Z\s]+?)(?:\s+(?:at|a las|om|yesterday|today|\d|portion)|$)/i);
  if (match) {
    const candidate = match[1].trim();
    // Exclude common stop words
    if (!['a', 'an', 'some', 'my', 'the', 'un', 'una', 'mi', 'een'].includes(candidate.toLowerCase())) {
      const alreadyParsed = parsedItems.some(item => candidate.toLowerCase().includes(item.rawText.toLowerCase()));
      if (!alreadyParsed && !resolveFoodTerm(candidate)) {
        return {
          rawText: candidate,
          foodLabel: candidate.charAt(0).toUpperCase() + candidate.slice(1),
          confidence: 0.5,
        };
      }
    }
  }
  return null;
}

/**
 * Splits text into segments (e.g. by "and", "y", "en", ",") and parses food items.
 */
function parseFoodItemsFromText(text: string): ParsedFoodItem[] {
  const items: ParsedFoodItem[] = [];

  // Split on "and", "y", "en", comma, but avoid splitting inside times
  const clauses = text.split(/(?:,|\band\b|\by\b|\ben\b)/i);

  for (const clause of clauses) {
    const trimmed = clause.trim();
    if (!trimmed) continue;

    const resolved = resolveFoodTerm(trimmed);
    if (resolved) {
      const qty = resolveQuantity(trimmed);
      const soupSize = resolveSoupPortion(trimmed);

      items.push({
        rawText: trimmed,
        foodKey: resolved.foodKey,
        foodLabel: resolved.foodLabel,
        categoryKey: resolved.categoryKey,
        categoryLabel: resolved.categoryLabel,
        quantity: qty || undefined,
        soupPortion: soupSize || undefined,
        confidence: resolved.confidence,
      });
    }
  }

  // If no items found from clauses, try full text
  if (items.length === 0) {
    const fullResolved = resolveFoodTerm(text);
    if (fullResolved) {
      const qty = resolveQuantity(text);
      const soupSize = resolveSoupPortion(text);

      items.push({
        rawText: text,
        foodKey: fullResolved.foodKey,
        foodLabel: fullResolved.foodLabel,
        categoryKey: fullResolved.categoryKey,
        categoryLabel: fullResolved.categoryLabel,
        quantity: qty || undefined,
        soupPortion: soupSize || undefined,
        confidence: fullResolved.confidence,
      });
    }
  }

  return items;
}

function formatFoodProposalSummary(items: ParsedFoodItem[], time?: string): string {
  const foodDetails = items.map(item => {
    let qStr = '';
    if (item.quantity?.portionCount) {
      qStr = ` — ${item.quantity.portionCount} portion${item.quantity.portionCount > 1 ? 's' : ''}`;
    } else if (item.quantity?.amount && item.quantity?.unit) {
      qStr = ` — ${item.quantity.amount} ${item.quantity.unit}`;
    } else if (item.soupPortion) {
      qStr = ` — ${item.soupPortion.charAt(0).toUpperCase() + item.soupPortion.slice(1)}`;
    }
    return `${item.foodLabel || item.rawText} (${item.categoryLabel || 'Food'}${qStr})`;
  }).join(' + ');

  return `Log Food: ${foodDetails}${time ? ` at ${time}` : ''}`;
}

function formatNeutralProposalSummary(description: string, quantity?: { amount?: number; unit?: string }, time?: string): string {
  const qStr = quantity?.amount ? ` (${quantity.amount} ${quantity.unit || ''})` : '';
  return `Log Neutral: ${description}${qStr}${time ? ` at ${time}` : ''}`;
}

function formatSlipProposalSummary(outcome: string, resumed?: boolean, duration?: number, time?: string): string {
  const outcomeLabel = outcome.replace(/_/g, ' ').toUpperCase();
  const resumedStr = resumed ? (duration ? ` (Resumed after ${duration}m)` : ' (Resumed)') : '';
  return `Log Slip: ${outcomeLabel}${resumedStr}${time ? ` at ${time}` : ''}`;
}

export const deterministicUnderstandingEngine = new DeterministicUnderstandingProvider();
