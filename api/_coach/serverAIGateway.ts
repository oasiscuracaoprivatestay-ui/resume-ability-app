/**
 * SDA AI Coach — Secure Server-Side AI Gateway (Phase 36A Hotfix)
 *
 * Fully self-contained server logic located directly in api/_coach/.
 * Implements:
 * 1. Strict request validation & context minimization
 * 2. SDA knowledge projection & system instruction builder
 * 3. Provider-independent AI model interaction (OpenAI-compatible)
 * 4. Rigorous schema validation & canonical domain reconciliation
 * 5. Deterministic fallback triggers on provider errors or unconfigured keys
 * 6. Zero secret leakage to client payloads
 */

import {
  ALL_DETAILED_OUTCOMES,
  CANONICAL_ACTION_TYPES,
  CANONICAL_CHECKIN_STATUSES,
  FOOD_CATEGORY_KEYS,
  GATEWAY_TIMEOUT_MS,
  MAX_CONVERSATION_HISTORY,
  MAX_MESSAGE_LENGTH,
  type AIResponseEnvelope,
  type CheckInStatus,
  type CoachActionProposal,
  type CoachActionType,
  type CoachAmbiguity,
  type CoachContext,
  type CoachEntities,
  type CoachGatewayRequestDTO,
  type CoachIntentType,
  type CoachUnderstanding,
  type DetailedBlockOutcome,
  type FailureCategory,
  type FoodCategoryKey,
  type GatewayDiagnostics,
  type RawAIModelOutput,
  type SDACoachingMode,
  type SerializedChatMessage,
  type ServerAIConfig,
} from './types.js';
import {
  checkKnowledgeGap,
} from './knowledge.js';
export {
  buildAIKnowledgeProjection,
  buildSDAAISystemInstructions,
} from './knowledge.js';
import { resolveCategoryTerm } from './resolvers.js';
import {
  buildSDAGroundingPack,
  compileSDASystemPrompt,
} from './groundingPack.js';
import { classifyPersonalStateQuery } from '../../src/coach/personalProgressCoach.js';

// ── Test Mock Injection (Offline Automation Safety) ──────────────────────────

type MockAIHandler = (
  instructions: string,
  userPrompt: string
) => Promise<RawAIModelOutput | string>;

let mockAIHandler: MockAIHandler | null = null;

export function setMockAIHandlerForTesting(handler: MockAIHandler | null): void {
  mockAIHandler = handler;
}

// ── 1. Request DTO Validation ────────────────────────────────────────────────

export interface RequestValidationResult {
  valid: boolean;
  error?: string;
  statusCode?: number;
}

export function validateGatewayRequest(body: unknown): RequestValidationResult {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a valid JSON object', statusCode: 400 };
  }

  const dto = body as Partial<CoachGatewayRequestDTO>;

  // Message check
  if (typeof dto.message !== 'string') {
    return { valid: false, error: 'Message field is required and must be a string', statusCode: 400 };
  }
  const trimmed = dto.message.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Message cannot be empty', statusCode: 400 };
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return {
      valid: false,
      error: `Message exceeds maximum permitted length of ${MAX_MESSAGE_LENGTH} characters`,
      statusCode: 400,
    };
  }

  // Language check
  if (!dto.language || !['en', 'es', 'nl'].includes(dto.language)) {
    return { valid: false, error: 'Unsupported or missing language (must be "en", "es", or "nl")', statusCode: 400 };
  }

  // Context check
  if (!dto.context || typeof dto.context !== 'object') {
    return { valid: false, error: 'CoachContext is required', statusCode: 400 };
  }
  if (dto.context.ability !== 'diet') {
    return { valid: false, error: 'Only ability "diet" is currently supported in Phase 36', statusCode: 400 };
  }
  if (!dto.context.today || !dto.context.commitment || !dto.context.slipperyZones) {
    return { valid: false, error: 'Malformed CoachContext projection', statusCode: 400 };
  }

  // Conversation history length bound
  if (Array.isArray(dto.conversationHistory) && dto.conversationHistory.length > MAX_CONVERSATION_HISTORY) {
    return {
      valid: false,
      error: `Conversation history exceeds maximum bound of ${MAX_CONVERSATION_HISTORY} items`,
      statusCode: 400,
    };
  }

  return { valid: true };
}

// ── 2. Canonical Domain Reconciliation & Sanitization ────────────────────────

export function validateAndReconcileAIResponse(
  raw: RawAIModelOutput,
  userMessage: string,
  context?: CoachContext,
  language: 'en' | 'es' | 'nl' = 'en'
): AIResponseEnvelope {
  const safeRaw = (raw && typeof raw === 'object') ? raw as Record<string, any> : {};

  // 1. Check for Knowledge Gap or Non-Diet Ability
  const staticGap = checkKnowledgeGap(userMessage);
  const incomingGap = safeRaw.knowledgeGap || safeRaw.detectedKnowledgeGap;
  const rawGap = (incomingGap && typeof incomingGap === 'object')
    ? incomingGap
    : null;
  const isNonDietAbility = safeRaw.ability && safeRaw.ability !== 'diet';

  if (staticGap || rawGap || isNonDietAbility) {
    const gap = staticGap || (rawGap ? {
      requestedTopic: rawGap.pattern || rawGap.topic || rawGap.requestedTopic || 'Non-diet topic',
      reason: rawGap.reason || 'Not yet fully codified in app source.',
      status: rawGap.status || 'partial',
      fallbackMessage: safeRaw.coachingMessage || safeRaw.coachMessage || safeRaw.message || 'I only coach from verified Super Diet-Ability concepts.',
    } : {
      requestedTopic: String(safeRaw.ability),
      reason: 'Only Diet-Ability is active in Phase 36.',
      status: 'reserved' as const,
      fallbackMessage: safeRaw.coachingMessage || safeRaw.coachMessage || safeRaw.message || 'Only Diet-Ability is supported.',
    });

    return {
      version: 1,
      ability: 'diet',
      understanding: {
        id: `und-${Date.now()}`,
        ability: 'diet',
        rawText: userMessage,
        intent: 'GENERAL_COACHING',
        confidence: 0.95,
        entities: {},
        ambiguities: [],
        requiresClarification: false,
      },
      coaching: {
        mode: 'INFORMATION',
        message: gap.fallbackMessage || (
          language === 'es'
            ? `Aún no dispongo de suficiente material oficial de SDA para "${gap.requestedTopic}". Solo respondo con base en principios verificados de Super Diet-Ability.`
            : (language === 'nl'
                ? `Ik heb nog niet voldoende officieel SDA-bronnenmateriaal voor "${gap.requestedTopic}". Ik coach uitsluitend op basis van vastgelegde Super Diet-Ability concepten.`
                : `I don't have enough SDA source material for "${gap.requestedTopic}" yet. I only coach from verified Super Diet-Ability concepts.`)
        ),
      },
      knowledgeGap: gap,
    };
  }

  // 2. Intent validation
  const validIntents: CoachIntentType[] = [
    'LOG_FOOD', 'LOG_NEUTRAL', 'LOG_SLIP', 'LOG_RESUME', 'LOG_CHECK_IN',
    'UPDATE_FOOD_LOG', 'RECOMMIT', 'CHECK_TODAY_STATUS', 'NEED_MOTIVATION',
    'REVIEW_DAY', 'REVIEW_COMMITMENT', 'REVIEW_WHY', 'REVIEW_NON_NEGOTIABLES',
    'REVIEW_SLIPPERY_ZONES', 'GENERAL_COACHING',
  ];
  let intent: CoachIntentType = (typeof raw === 'object' && safeRaw.intent && validIntents.includes(safeRaw.intent))
    ? safeRaw.intent
    : 'GENERAL_COACHING';
  const confidence = typeof raw === 'string'
    ? 0.5
    : (typeof safeRaw.confidence === 'number'
        ? Math.max(0, Math.min(1, safeRaw.confidence))
        : 0.75);

  // 3. Entities Reconciliation
  const entities: CoachEntities = {};
  const ambiguities: CoachAmbiguity[] = [];

  if (Array.isArray(safeRaw.ambiguities)) {
    ambiguities.push(...safeRaw.ambiguities);
  }
  if (safeRaw.clarificationField && safeRaw.clarificationReason) {
    ambiguities.push({
      field: safeRaw.clarificationField,
      reason: safeRaw.clarificationReason,
    });
  }

  // Outcome reconciliation
  if (raw.entities?.outcome) {
    let out = raw.entities.outcome as string;
    if (out === 'slip_unstructured') out = 'unstructured_slip';
    if (out === 'slip_structured') out = 'structured_slip';
    if (ALL_DETAILED_OUTCOMES.includes(out as DetailedBlockOutcome)) {
      entities.outcome = out as DetailedBlockOutcome;
    } else {
      ambiguities.push({
        field: 'outcome',
        reason: `Unsupported outcome "${raw.entities.outcome}". Must be a canonical SDA outcome.`,
      });
    }
  }

  // Resumed reconciliation
  if (typeof raw.entities?.resumed === 'boolean') {
    entities.resumed = raw.entities.resumed;
  }
  if (typeof raw.entities?.resumeDurationMinutes === 'number') {
    entities.resumeDurationMinutes = raw.entities.resumeDurationMinutes;
  }

  // Check-In status
  if (raw.entities?.checkInStatus) {
    if (CANONICAL_CHECKIN_STATUSES.includes(raw.entities.checkInStatus as CheckInStatus)) {
      entities.checkInStatus = raw.entities.checkInStatus as CheckInStatus;
    }
  }

  // Near-Slip cannot be Resumed (SDA semantic rule)
  if (entities.checkInStatus === 'near-slip' || entities.outcome === 'near_slip') {
    entities.resumed = false;
    entities.resumeDurationMinutes = undefined;
  }

  // Planned status
  if (raw.entities?.plannedStatus === 'planned' || raw.entities?.plannedStatus === 'unplanned') {
    entities.plannedStatus = raw.entities.plannedStatus;
  }

  const rawLower = userMessage.toLowerCase();

  // Guard: "I didn't plan it, but stayed within my structure" -> Unplanned On-Track, NOT Unstructured Slip
  if (
    rawLower.includes('within my structure') ||
    rawLower.includes('dentro de mi estructura') ||
    rawLower.includes('binnen mijn structuur')
  ) {
    if (entities.outcome === 'unstructured_slip') {
      entities.outcome = 'on_track';
    }
  }

  // Guard: Intentional flexibility / outside ideal structure but not a slip -> 20% OFF TRACK
  if (
    (rawLower.includes('20%') || rawLower.includes('twenty percent') || rawLower.includes('outside my ideal structure') || rawLower.includes('intentional flexibility')) &&
    (rawLower.includes("wasn't a slip") || rawLower.includes('not a slip') || rawLower.includes('no fue un desliz') || rawLower.includes('geen uitglijder'))
  ) {
    entities.outcome = 'twenty_percent_off_track';
  }

  // Guard: Losing control / intense urge alone is NOT a completed slip
  const isUrgeOnly =
    (rawLower.includes('losing control') || rawLower.includes('perdiendo el control') || rawLower.includes('controle verliezen') ||
     rawLower.includes('craving') || rawLower.includes('tempted') || rawLower.includes('urge')) &&
    !rawLower.includes('ate') && !rawLower.includes('had ') && !rawLower.includes('slipped') && !rawLower.includes('deslicé') && !rawLower.includes('uitgegleden');
  if (isUrgeOnly) {
    if (intent === 'LOG_SLIP') {
      intent = 'GENERAL_COACHING';
    }
    if (entities.outcome && (entities.outcome === 'structured_slip' || entities.outcome === 'unstructured_slip')) {
      delete entities.outcome;
    }
  }

  // Time format check (HH:MM 24h)
  if (raw.entities?.startTime) {
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(raw.entities.startTime)) {
      entities.startTime = raw.entities.startTime;
    } else {
      ambiguities.push({
        field: 'startTime',
        reason: 'Time must be in 24-hour HH:MM format',
      });
    }
  }

  // Food items category reconciliation
  if (Array.isArray(raw.entities?.foodItems)) {
    entities.foodItems = raw.entities.foodItems.map(item => {
      let resolvedCategory: FoodCategoryKey | undefined = undefined;
      if (item.categoryKey) {
        if (FOOD_CATEGORY_KEYS.includes(item.categoryKey as FoodCategoryKey)) {
          resolvedCategory = item.categoryKey as FoodCategoryKey;
        } else {
          // Attempt canonical resolution
          const matched = resolveCategoryTerm(String(item.categoryKey));
          if (matched) {
            resolvedCategory = matched;
          } else {
            ambiguities.push({
              field: 'category',
              reason: `Category "${item.categoryKey}" is not a canonical SDA category.`,
            });
          }
        }
      }

      return {
        rawText: item.rawText || 'Food item',
        foodKey: item.foodKey,
        categoryKey: resolvedCategory,
        quantity: item.quantity,
        confidence: item.confidence ?? 0.8,
      };
    });
  }

  // Slippery zones trigger check: Guard against causal attribution
  let coachingMsg = typeof raw === 'string'
    ? raw
    : (safeRaw.coachingMessage || safeRaw.coachMessage || safeRaw.message || safeRaw.response || 'I am here to support your structure.');
  if (coachingMsg.toLowerCase().includes('caused your slip') || coachingMsg.toLowerCase().includes('caused this slip')) {
    // Sanitize non-causal framing
    const zoneMatch = context?.slipperyZones?.zones?.find(z => coachingMsg.toLowerCase().includes(z.toLowerCase()));
    if (zoneMatch) {
      coachingMsg = language === 'es'
        ? `"${zoneMatch}" es una de tus Zonas Resbaladizas guardadas. ¿Formó parte de este momento?`
        : (language === 'nl'
            ? `"${zoneMatch}" is een van je opgeslagen Glijdende Zones. Speelde dit een rol?`
            : `"${zoneMatch}" is one of your identified Slippery Zones. Was it part of what happened here?`);
    }
  }

  // Guard: 20% OFF TRACK is strictly lifestyle flexibility buffer, NEVER a carbohydrate percentage or macronutrient quota
  const carbHallucinationPattern = /20%\s*(?:healthy\s*)?carb|20%\s*gezonde\s*koolhydrat|20%\s*carbohidrato|20%\s*de\s*(?:tu\s*dieta\s*en\s*)?carbohidrato|20%\s*of\s*(?:your\s*diet\s*from\s*)?carb|20%\s*OFF\s*TRACK\s*(?:means|significa|betekent)\s*20%\s*carb/i;
  if (carbHallucinationPattern.test(coachingMsg)) {
    coachingMsg = language === 'es'
      ? '20% OFF TRACK es un margen de flexibilidad intencional en el estilo de vida (basado en el principio de consistencia 80/20 de Sergio Laurant). Cuenta como un resultado En Estructura (+5 puntos), no es un desliz y no tiene ninguna relación con porcentajes de carbohidratos ni metas de macronutrientes.'
      : (language === 'nl'
          ? '20% OFF TRACK is een bewuste flexibiliteitsbuffer voor je levensstijl (gebaseerd op het 80/20-consistentieprincipe van Sergio Laurant). Het telt als een On Track-uitkomst (+5 punten), is geen uitglijder en heeft niets te maken met koolhydraatpercentages of macronutriëntendoelen.'
          : "20% OFF TRACK is an intentional lifestyle flexibility buffer within Sergio Laurant's 80/20 consistency principle. It is an On-Track outcome (+5 pts), not a slip, and has zero connection to carbohydrate percentages or macronutrient quotas.");
  }

  // Personal State Question Guardrails (Phase 40C)
  const personalStateCategory = classifyPersonalStateQuery(userMessage);

  // Guard: Zero-denominator Resume Rate must never display 0%
  const dietResumeRate = context?.dietSlipResume?.dietResumeRate ?? null;
  if (personalStateCategory === 'SLIP_RESUME_STATUS' && dietResumeRate === null && /resume rate|tasa de resume/i.test(userMessage)) {
    if (/\b0%(?!\d)/.test(coachingMsg)) {
      coachingMsg = language === 'es'
        ? 'No tienes oportunidades de desliz elegibles hoy, por lo que aún no hay una tasa de Resume para calcular.'
        : (language === 'nl'
            ? 'Je hebt vandaag geen in aanmerking komende uitglijders, dus er is nog geen Resume Rate te berekenen.'
            : "You don't have any eligible Diet Slip opportunities today, so there isn't a Resume Rate to calculate yet.");
    }
  }

  // Guard: Metric separation - do not let todayPoints be reported as the Resume-Ability score
  if (personalStateCategory === 'RESUME_ABILITY_STATUS') {
    const todayPts = context?.scoring?.todayPoints ?? context?.today?.todayScore ?? 0;
    const resumeIndex = context?.resumeAbility?.dailyResumeAbilityIndex ?? null;
    const conflationPattern = new RegExp(`(?:resume[- ]ability\\s*(?:score|index)\\s*(?:is\\s*)?${todayPts}\\b)`, 'i');
    if (resumeIndex !== null && conflationPattern.test(coachingMsg) && todayPts !== resumeIndex) {
      coachingMsg = coachingMsg.replace(conflationPattern, `Daily Resume-Ability Index is ${resumeIndex}/100`);
    }
  }

  // Guard: Personal Recall Zero-State & Factual Reconciliation (Phase 40D.2)
  if (personalStateCategory === 'COMMITMENT_RECALL') {
    const whyCount = context?.commitment?.whyCount ?? (Array.isArray(context?.commitment?.reasons) ? context.commitment.reasons.length : 0);
    const safeReasons = Array.isArray(context?.turnScopedSensitive?.reasons) ? context.turnScopedSensitive.reasons : [];

    if (whyCount === 0 || (safeReasons.length === 0 && whyCount === 0)) {
      coachingMsg = language === 'es'
        ? 'Aún no has guardado motivos personales en tu Porqué. Puedes añadirlos en Mis Compromisos.'
        : (language === 'nl'
            ? 'Je hebt nog geen persoonlijke Waarom-redenen opgeslagen. Je kunt ze toevoegen in Mijn Verplichtingen.'
            : "You haven't saved any personal Why reasons yet. You can add your reasons in My Commitment.");
    } else if (safeReasons.length > 0) {
      const quotesAnySafe = safeReasons.some(r => coachingMsg.toLowerCase().includes(r.toLowerCase()));
      if (!quotesAnySafe) {
        const list = safeReasons.map((r, i) => `${i + 1}. "${r}"`).join('\n');
        coachingMsg = language === 'es'
          ? `Aquí está tu Porqué personal:\n${list}\n\nTen presente este propósito cuando sientas impulsos.`
          : (language === 'nl'
              ? `Dit is jouw persoonlijke Waarom:\n${list}\n\nHoud dit doel voor ogen wanneer er verleiding ontstaat.`
              : `Here is your personal Why:\n${list}\n\nKeep this purpose front of mind whenever urges arise.`);
      }
    } else if (whyCount > 0 && safeReasons.length === 0) {
      coachingMsg = language === 'es'
        ? 'Tienes motivos personales guardados, pero el texto no está disponible en el contexto actual del Coach. Puedes verlos en Mis Compromisos.'
        : (language === 'nl'
            ? 'Je hebt persoonlijke redenen opgeslagen, maar de tekst is niet beschikbaar in de huidige Coach-context. Je kunt ze bekijken in Mijn Verplichtingen.'
            : "You have saved Why reasons, but their text isn't available in the current Coach context. You can view them in My Commitment.");
    }
  }

  if (personalStateCategory === 'NON_NEGOTIABLE_RECALL') {
    const nnCount = context?.nonNegotiables?.nonNegotiablesCount ?? (Array.isArray(context?.commitment?.nonNegotiables) ? context.commitment.nonNegotiables.length : 0);
    const safeRules = Array.isArray(context?.turnScopedSensitive?.nonNegotiables) ? context.turnScopedSensitive.nonNegotiables : [];

    if (nnCount === 0 || (safeRules.length === 0 && nnCount === 0)) {
      coachingMsg = language === 'es'
        ? 'Aún no has definido reglas No Negociables. Puedes añadirlas en Mis Compromisos.'
        : (language === 'nl'
            ? 'Je hebt nog geen niet-onderhandelbare regels ingesteld. Je kunt ze toevoegen in Mijn Verplichtingen.'
            : "You haven't set any Non-Negotiables yet. You can add them in My Commitment.");
    } else if (safeRules.length > 0) {
      const quotesAnySafe = safeRules.some(r => coachingMsg.toLowerCase().includes(r.toLowerCase()));
      if (!quotesAnySafe) {
        const list = safeRules.map((n, i) => `${i + 1}. 🛡️ ${n}`).join('\n');
        coachingMsg = language === 'es'
          ? `Aquí están tus No Negociables:\n${list}\n\nEstos límites te protegen contra desvíos involuntarios.`
          : (language === 'nl'
              ? `Dit zijn jouw niet-onderhandelbare regels:\n${list}\n\nDeze grenzen beschermen je tegen onbewust afdwalen.`
              : `Here are your Non-Negotiables:\n${list}\n\nThese boundaries protect you from unthinking drift.`);
      }
    } else if (nnCount > 0 && safeRules.length === 0) {
      coachingMsg = language === 'es'
        ? 'Tienes reglas No Negociables guardadas, pero el texto no está disponible en el contexto actual del Coach. Puedes verlas en Mis Compromisos.'
        : (language === 'nl'
            ? 'Je hebt niet-onderhandelbare regels opgeslagen, maar de tekst is niet beschikbaar in de huidige Coach-context. Je kunt ze bekijken in Mijn Verplichtingen.'
            : "You have saved Non-Negotiables, but their text isn't available in the current Coach context. You can view them in My Commitment.");
    }
  }

  // 4. Action Proposal Reconciliation (PREVIEW-ONLY, ZERO MUTATION)
  let proposedAction: CoachActionProposal | undefined = undefined;
  const rawObj = raw as any;
  const rawActionType = raw.proposedActionType || raw.actionProposal?.type || rawObj?.proposedAction?.type;
  const normalizedActionType = typeof rawActionType === 'string' ? rawActionType.toUpperCase() as CoachActionType : undefined;
  const actionType = normalizedActionType;

  if (personalStateCategory) {
    // Read-only personal state queries NEVER create action proposals
    proposedAction = undefined;
  } else if (actionType) {
    if (CANONICAL_ACTION_TYPES.includes(actionType)) {
      if (entities.outcome === 'twenty_percent_off_track' && actionType === 'LOG_SLIP') {
        ambiguities.push({
          field: 'actionType',
          reason: '20% OFF TRACK is an On-Track outcome, not a Slip.',
        });
      } else {
        proposedAction = {
          id: `prop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          ability: 'diet',
          type: actionType,
          confidence: confidence,
          requiresConfirmation: true, // STRICTLY MANDATORY - USER CANNOT OVERRIDE
          payload: (raw.proposedActionPayload || raw.actionProposal?.payload || rawObj?.proposedAction?.payload || {}) as Record<string, unknown>,
          humanReadableSummary: raw.proposedActionSummary || raw.actionProposal?.humanReadableSummary || rawObj?.proposedAction?.humanReadableSummary || `${actionType} proposal`,
        };
      }
    } else {
      ambiguities.push({
        field: 'actionType',
        reason: `Unsupported action type "${actionType}"`,
      });
    }
  }

  const requiresClarification = personalStateCategory
    ? false
    : Boolean(raw.requiresClarification || ambiguities.length > 0 || raw.clarificationField);

  const understanding: CoachUnderstanding = {
    id: `und-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ability: 'diet',
    rawText: userMessage,
    intent: personalStateCategory
      ? (personalStateCategory === 'COMMITMENT_RECALL' ? 'REVIEW_WHY' : (personalStateCategory === 'NON_NEGOTIABLE_RECALL' ? 'REVIEW_NON_NEGOTIABLES' : 'CHECK_TODAY_STATUS'))
      : intent,
    confidence,
    entities: {
      ...entities,
      queryCategory: personalStateCategory || undefined,
    },
    ambiguities,
    requiresClarification,
    proposedAction,
    queryCategory: personalStateCategory || undefined,
  };

  let finalMode: SDACoachingMode = 'SUPPORT';
  if (raw.coachingMode && typeof raw.coachingMode === 'string') {
    const upper = raw.coachingMode.toUpperCase() as SDACoachingMode;
    const validModes: SDACoachingMode[] = [
      'AWARENESS',
      'SUPPORT',
      'RECOVERY',
      'REFLECTION',
      'COMMITMENT',
      'MOTIVATION',
      'INFORMATION',
      'ACTION_PREPARATION',
    ];
    if (validModes.includes(upper)) {
      finalMode = upper;
    }
  } else {
    if (intent === 'LOG_SLIP' || intent === 'LOG_RESUME') {
      finalMode = 'RECOVERY';
    } else if (entities.checkInStatus === 'near-slip') {
      finalMode = 'AWARENESS';
    } else if (intent === 'NEED_MOTIVATION') {
      finalMode = 'MOTIVATION';
    } else if (intent === 'REVIEW_COMMITMENT' || intent === 'REVIEW_WHY' || intent === 'REVIEW_NON_NEGOTIABLES') {
      finalMode = 'COMMITMENT';
    } else if (intent === 'REVIEW_DAY' || intent === 'CHECK_TODAY_STATUS') {
      finalMode = 'REFLECTION';
    } else if (proposedAction) {
      finalMode = 'ACTION_PREPARATION';
    }
  }

  // ── Conversational Semantic Reconciliation (Phase 39B.2) ───────────────────
  // Operational SDA classifications (20% OFF TRACK, unplanned, slip, on structure)
  // must be evidence-based and must NOT be invented by the LLM for ordinary food reporting.
  const isFoodLog = intent === 'LOG_FOOD' ||
    /\b(ate|had|eating|portion|portions|grams|g\b|ml\b|cup|oz\b|chicken|beef|rice|salad|fish|eggs|bread|soup|dinner|lunch|breakfast)\b/i.test(rawLower);

  let finalFollowUpQuestion = raw.followUpQuestion;

  if (isFoodLog) {
    const has20PercentSupport =
      /(?:\b20%|\b20\s*percent\b|\bveinte\s*por\s*ciento\b|\btwintig\s*procent\b)/i.test(rawLower) ||
      entities.outcome === 'twenty_percent_off_track';
    const hasUnplannedSupport =
      /\b(?:unplanned|didn't plan|did not plan|no planead[oa]|ongepland|wasn't in my plan|not in my plan|outside my plan|fuera de mi plan|niet in mijn plan)\b/i.test(rawLower) ||
      entities.plannedStatus === 'unplanned';
    const hasSlipSupport =
      /\b(?:slip|slipped|slipping|deslic[eé]|desliz|uitglijder|uitgegleden)\b/i.test(rawLower) ||
      entities.outcome === 'structured_slip' ||
      entities.outcome === 'unstructured_slip' ||
      entities.outcome === 'near_slip';
    const hasNearSlipSupport =
      /\b(?:near[-\s]?slip|casi\s*me\s*salgo|bijna\s*uitgegleden|close\s*to\s*slipping)\b/i.test(rawLower) ||
      entities.checkInStatus === 'near-slip' ||
      entities.outcome === 'near_slip';
    const hasResumeSupport =
      /\b(?:resume|resumed|resuming|retom[eé]|hervat)\b/i.test(rawLower) ||
      entities.resumed === true;
    const hasOnStructureSupport =
      /\b(?:on structure|on-structure|en estructura|op schema)\b/i.test(rawLower) ||
      entities.checkInStatus === 'on-structure';

    const isSentenceUnsupported = (s: string) => {
      const sTrim = s.trim();
      if (!sTrim) return false;
      if (!has20PercentSupport && /(?:\b20%|\b20\s*percent\b|\bveinte\s*por\s*ciento\b|\btwintig\s*procent\b)/i.test(sTrim)) return true;
      if (!hasUnplannedSupport && /\b(?:unplanned|no planead[oa]|ongepland)\b/i.test(sTrim)) return true;
      if (!hasSlipSupport && /\b(?:counts? as a slip|is a slip|was a slip|cuenta como desliz|es un desliz|fue un desliz|is een uitglijder|telt als uitglijder|that counts as a slip)\b/i.test(sTrim)) return true;
      if (!hasNearSlipSupport && /\b(?:counts? as a near[-\s]?slip|is a near[-\s]?slip|counts as near-slip)\b/i.test(sTrim)) return true;
      if (!hasResumeSupport && /\b(?:you resumed|resumed after|retomaste después|hervat na)\b/i.test(sTrim)) return true;
      if (!hasOnStructureSupport && /\b(?:stayed (?:perfectly )?on structure|perfectamente en estructura|perfect op schema)\b/i.test(sTrim)) return true;
      return false;
    };

    const sentenceRegex = /[^.!?]+[.!?]+|\S+$/g;
    const sentences = coachingMsg.match(sentenceRegex) || [coachingMsg];
    const validSentences = sentences.filter((s: string) => !isSentenceUnsupported(s));

    if (validSentences.length === 0) {
      const NEUTRAL_FOOD_LOG_FALLBACK: Record<'en' | 'es' | 'nl', string> = {
        en: 'I can help you log this food entry. Review the details below and confirm if they are correct.',
        es: 'Puedo ayudarte a registrar este alimento. Revisa los detalles abajo y confirma si son correctos.',
        nl: 'Ik kan je helpen deze maaltijd te loggen. Bekijk de onderstaande details en bevestig of ze kloppen.',
      };
      coachingMsg = NEUTRAL_FOOD_LOG_FALLBACK[language] || NEUTRAL_FOOD_LOG_FALLBACK.en;
    } else {
      coachingMsg = validSentences.map((s: string) => s.trim()).join(' ');
    }

    if (finalFollowUpQuestion && isSentenceUnsupported(finalFollowUpQuestion)) {
      finalFollowUpQuestion = undefined;
    }
  }

  // ── Conversational Semantic Reconciliation (Phase 39C.1 — Resume vs Check-In) ─
  const isResumeIntent = intent === 'LOG_RESUME' ||
    actionType === 'LOG_RESUME' ||
    /\b(back on structure|back on track|resumed|resume my slip|resume the slip|resume last slip|resume the latest slip|got back on track|returned to my structure)\b/i.test(rawLower) ||
    /\b(de vuelta en estructura|volv[ií] a la estructura|retomado|retom[eé]|retomar mi desliz|retomar el desliz)\b/i.test(rawLower) ||
    /\b(weer op schema|terug op schema|hervat)\b/i.test(rawLower);

  if (isResumeIntent) {
    // If the LLM confused returning to structure with checking in (e.g. "You've checked in as on-structure")
    const checkInConfusionPattern = /(?:you(?:'ve| have)?\s+checked\s+in\s+as\s+on[- ]?structure|you(?:'ve| have)?\s+checked\s+in\b|has\s+hecho\s+un\s+check[- ]?in|te\s+has\s+registrado\s+como\s+en\s+estructura|je\s+hebt\s+ingecheckt\s+als\s+op\s+schema)/gi;
    if (checkInConfusionPattern.test(coachingMsg)) {
      const RESUME_ACK_REPLACEMENT: Record<'en' | 'es' | 'nl', string> = {
        en: "You're back on structure. That's Resume-Ability in action.",
        es: "Estás de vuelta en tu estructura. Eso es Resume-Ability en acción.",
        nl: "Je bent weer op schema. Dat is Resume-Ability in actie.",
      };
      coachingMsg = coachingMsg.replace(checkInConfusionPattern, RESUME_ACK_REPLACEMENT[language] || RESUME_ACK_REPLACEMENT.en);
    }
  }

  // ── Pre-Confirmation Persistence Sanitization (Phase 39C.1 — Section 5) ────────
  // When an action proposal is prepared for user review (requiresConfirmation is true),
  // conversational AI must NOT claim that the action was already completed, saved, or recorded.
  if (proposedAction) {
    const prematureClaims = [
      // Resume claims
      { pattern: /(?:your\s+resume\s+has\s+been\s+recorded|tu\s+retorno\s+ha\s+sido\s+registrado|je\s+hervatting\s+is\s+vastgelegd)/gi, replace: language === 'es' ? 'Puedes confirmar este registro de Resume abajo' : (language === 'nl' ? 'Je kunt deze hervatting hieronder bevestigen' : "Review the proposal below to confirm your Resume") },
      { pattern: /(?:your\s+slip\s+has\s+been\s+marked\s+as\s+resumed|tu\s+desliz\s+ha\s+sido\s+marcado\s+como\s+retomado|je\s+uitglijder\s+is\s+gemarkeerd\s+als\s+hervat)/gi, replace: language === 'es' ? 'Puedes confirmar el Resume de tu desliz abajo' : (language === 'nl' ? 'Je kunt de hervatting van je uitglijder hieronder bevestigen' : "Review the proposal below to resume your slip") },
      { pattern: /(?:i(?:'ve| have)?\s+marked\s+(?:your\s+slip\s+as\s+resumed|you\s+as\s+resumed)|he\s+marcado\s+tu\s+desliz\s+como\s+retomado|ik\s+heb\s+je\s+uitglijder\s+als\s+hervat\s+gemarkeerd)/gi, replace: language === 'es' ? 'He preparado la propuesta de Resume' : (language === 'nl' ? 'Ik heb het hervattingsvoorstel klaargezet' : "I've prepared the Resume proposal") },
      // Food claims
      { pattern: /(?:i(?:'ve| have)?\s+(?:logged|recorded)\s+your\s+(?:meal|food)|he\s+registrado\s+tu\s+(?:comida|alimento)|ik\s+heb\s+je\s+maaltijd\s+(?:gelogd|vastgelegd))/gi, replace: language === 'es' ? 'He preparado el registro de este alimento' : (language === 'nl' ? 'Ik heb dit maaltijdvoorstel klaargezet' : "I've prepared this food log proposal") },
      { pattern: /(?:your\s+(?:meal|food)\s+has\s+been\s+(?:logged|recorded)|tu\s+comida\s+ha\s+sido\s+registrada|je\s+maaltijd\s+is\s+(?:gelogd|vastgelegd))/gi, replace: language === 'es' ? 'Revisa la propuesta abajo para confirmar' : (language === 'nl' ? 'Bekijk het voorstel hieronder om te bevestigen' : "Review the proposal below to confirm") },
      // Check-in claims
      { pattern: /(?:you(?:'ve| have)?\s+successfully\s+checked\s+in|has\s+completado\s+tu\s+check[- ]?in|je\s+bent\s+succesvol\s+ingecheckt)/gi, replace: language === 'es' ? 'He preparado tu Daily Check-In' : (language === 'nl' ? 'Ik heb je Daily Check-In klaargezet' : "I've prepared your Daily Check-In proposal") },
      { pattern: /(?:your\s+check[- ]?in\s+has\s+been\s+recorded|tu\s+check[- ]?in\s+ha\s+sido\s+registrado|je\s+check[- ]?in\s+is\s+vastgelegd)/gi, replace: language === 'es' ? 'Revisa tu Daily Check-In abajo para confirmar' : (language === 'nl' ? 'Bekijk je Daily Check-In hieronder om te bevestigen' : "Review your Daily Check-In below to confirm") },
      // Slip claims
      { pattern: /(?:your\s+slip\s+has\s+been\s+recorded|tu\s+desliz\s+ha\s+sido\s+registrado|je\s+uitglijder\s+is\s+vastgelegd)/gi, replace: language === 'es' ? 'He preparado el registro de tu desliz' : (language === 'nl' ? 'Ik heb je uitglijdervoorstel klaargezet' : "I've prepared this slip proposal") },
      { pattern: /(?:i(?:'ve| have)?\s+recorded\s+your\s+slip|he\s+registrado\s+tu\s+desliz|ik\s+heb\s+je\s+uitglijder\s+vastgelegd)/gi, replace: language === 'es' ? 'He preparado el registro de tu desliz' : (language === 'nl' ? 'Ik heb je uitglijdervoorstel klaargezet' : "I've prepared this slip proposal") },
    ];

    for (const claim of prematureClaims) {
      coachingMsg = coachingMsg.replace(claim.pattern, claim.replace);
    }
  }

  return {
    version: 1,
    ability: 'diet',
    understanding,
    coaching: {
      mode: finalMode,
      message: coachingMsg,
      followUpQuestion: finalFollowUpQuestion,
    },
    proposedAction,
  };
}

// ── Helper: JSON parsing with markdown code fence stripping ──────────────────

export function parseJSONFromModel(rawText: string): RawAIModelOutput {
  const trimmed = rawText.trim();
  let cleaned = trimmed;
  // Strip markdown code fences if present (e.g. ```json ... ``` or ``` ... ```)
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  // Try direct parse
  try {
    return JSON.parse(cleaned);
  } catch (parseErr) {
    // If model output has extra commentary around JSON, attempt substring extraction of outer object
    const startIdx = cleaned.indexOf('{');
    const endIdx = cleaned.lastIndexOf('}');
    if (startIdx !== -1 && endIdx > startIdx) {
      const slice = cleaned.slice(startIdx, endIdx + 1);
      return JSON.parse(slice);
    }
    throw parseErr;
  }
}

export class ProviderError extends Error {
  providerHttpOk: boolean;
  providerHttpStatus?: number;
  failureCategory: FailureCategory;
  structuredOutputParsed: boolean;

  constructor(
    message: string,
    failureCategory: FailureCategory,
    providerHttpOk = false,
    providerHttpStatus?: number,
    structuredOutputParsed = false
  ) {
    super(message);
    this.name = 'ProviderError';
    this.failureCategory = failureCategory;
    this.providerHttpOk = providerHttpOk;
    this.providerHttpStatus = providerHttpStatus;
    this.structuredOutputParsed = structuredOutputParsed;
  }
}

// ── 3. Provider Call Execution ───────────────────────────────────────────────

export async function callAIProvider(
  instructions: string,
  userPrompt: string,
  config?: Partial<ServerAIConfig>,
  history?: SerializedChatMessage[]
): Promise<RawAIModelOutput> {
  // Use mock if injected (Offline test safety)
  if (mockAIHandler) {
    const mockRes = await mockAIHandler(instructions, userPrompt);
    let parsed: RawAIModelOutput;
    if (typeof mockRes === 'string') {
      try {
        parsed = parseJSONFromModel(mockRes);
      } catch (_parseErr) {
        throw new ProviderError('FAILED_TO_PARSE_JSON_STRUCTURE', 'STRUCTURED_OUTPUT_PARSE', true, 200, false);
      }
    } else {
      parsed = mockRes;
    }
    (parsed as any)._meta = {
      providerHttpOk: true,
      providerHttpStatus: 200,
      structuredOutputParsed: true,
    };
    return parsed;
  }

  const rawKey = config?.apiKey !== undefined
    ? config.apiKey
    : (process.env.AI_API_KEY || process.env.AI_PROVIDER_API_KEY || '');
  const apiKey = typeof rawKey === 'string' ? rawKey.trim() : '';
  if (!apiKey) {
    throw new ProviderError('AI_API_KEY_NOT_CONFIGURED', 'KEY_NOT_CONFIGURED', false);
  }

  const provider = config?.provider || (process.env.AI_PROVIDER as any) || 'openai';
  const model = config?.model || process.env.AI_MODEL || 'gpt-4o-mini';
  const endpointUrl = config?.endpointUrl || process.env.AI_BASE_URL || 'https://api.openai.com/v1/chat/completions';

  if (provider === 'openai') {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GATEWAY_TIMEOUT_MS);

    try {
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: instructions },
      ];

      // Format bounded conversation history natively for OpenAI
      if (history && history.length > 0) {
        const trimmedPrompt = userPrompt.trim();
        // Omit duplicate trailing user message if already present in history
        const filtered = [...history];
        const last = filtered[filtered.length - 1];
        if (last && last.role === 'user' && last.text.trim() === trimmedPrompt) {
          filtered.pop();
        }
        for (const h of filtered) {
          const role = h.role === 'coach' ? 'assistant' : 'user';
          messages.push({ role, content: h.text });
        }
      }

      messages.push({ role: 'user', content: userPrompt });

      let res: Response;
      try {
        res = await fetch(endpointUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            response_format: { type: 'json_object' },
            messages,
            temperature: config?.temperature ?? 0.2,
            max_tokens: config?.maxTokens ?? 1000,
          }),
          signal: controller.signal,
        });
      } catch (fetchErr: any) {
        if (fetchErr?.name === 'AbortError' || controller.signal.aborted) {
          throw new ProviderError('GATEWAY_TIMEOUT', 'TIMEOUT', false);
        }
        throw new ProviderError('NETWORK_ERROR', 'NETWORK_ERROR', false);
      }

      if (!res.ok) {
        const status = res.status;
        let failureCat: FailureCategory = 'PROVIDER_REJECTED';
        if (status === 401 || status === 403) {
          failureCat = 'AUTH_FAILED';
        } else if (status === 429) {
          failureCat = 'RATE_LIMIT_OR_QUOTA';
        } else if (status === 400) {
          failureCat = 'BAD_REQUEST';
        }
        throw new ProviderError(`PROVIDER_HTTP_${status}`, failureCat, false, status);
      }

      let data: any;
      try {
        data = await res.json();
      } catch (_jsonErr) {
        throw new ProviderError('INVALID_PROVIDER_JSON', 'STRUCTURED_OUTPUT_PARSE', true, res.status, false);
      }

      const content = data?.choices?.[0]?.message?.content;
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        throw new ProviderError('EMPTY_PROVIDER_RESPONSE', 'EMPTY_RESPONSE', true, res.status, false);
      }

      let parsed: RawAIModelOutput;
      try {
        parsed = parseJSONFromModel(content);
      } catch (_parseErr) {
        throw new ProviderError('FAILED_TO_PARSE_JSON_STRUCTURE', 'STRUCTURED_OUTPUT_PARSE', true, res.status, false);
      }

      (parsed as any)._meta = {
        providerHttpOk: true,
        providerHttpStatus: res.status,
        structuredOutputParsed: true,
      };

      return parsed;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new ProviderError(`UNSUPPORTED_PROVIDER_${provider}`, 'PROVIDER_REJECTED', false);
}

// ── 4. Main Server Gateway Turn Handler ──────────────────────────────────────

export async function handleCoachGatewayRequest(
  body: unknown,
  config?: Partial<ServerAIConfig>
): Promise<{
  status: number;
  envelope: (AIResponseEnvelope & { error?: string }) | {
    error: string;
    fallbackUsed: boolean;
    diagnostics: GatewayDiagnostics;
  };
}> {
  const provider = config?.provider || (process.env.AI_PROVIDER as any) || 'openai';
  const model = config?.model || process.env.AI_MODEL || 'gpt-4o-mini';

  // 1. Validate incoming request
  const validation = validateGatewayRequest(body);
  if (!validation.valid) {
    const diag: GatewayDiagnostics = {
      provider,
      model,
      providerAvailable: false,
      remoteAttempted: false,
      remoteSucceeded: false,
      fallbackUsed: true,
      failureCategory: 'BAD_REQUEST',
    };
    return {
      status: validation.statusCode || 400,
      envelope: {
        error: validation.error || 'BAD_REQUEST',
        fallbackUsed: true,
        diagnostics: diag,
      },
    };
  }

  const dto = body as CoachGatewayRequestDTO;
  const rawKey = config?.apiKey !== undefined
    ? config.apiKey
    : (process.env.AI_API_KEY || process.env.AI_PROVIDER_API_KEY || '');
  const apiKey = typeof rawKey === 'string' ? rawKey.trim() : '';

  // 2. If no server API key configured, signal fallback without throwing
  if (!apiKey && !mockAIHandler) {
    const diag: GatewayDiagnostics = {
      provider,
      model,
      providerAvailable: false,
      remoteAttempted: false,
      remoteSucceeded: false,
      fallbackUsed: true,
      failureCategory: 'KEY_NOT_CONFIGURED',
      conversationTurnsIncluded: (dto.conversationHistory || []).length,
    };
    return {
      status: 200,
      envelope: {
        error: 'AI_KEY_NOT_CONFIGURED_FALLBACK_ACTIVE',
        fallbackUsed: true,
        diagnostics: diag,
      },
    };
  }

  const history = (dto.conversationHistory || []).slice(-MAX_CONVERSATION_HISTORY);
  const diagnostics: GatewayDiagnostics = {
    provider,
    model,
    providerAvailable: Boolean(apiKey) || Boolean(mockAIHandler),
    remoteAttempted: true,
    providerHttpOk: undefined,
    providerHttpStatus: undefined,
    remoteSucceeded: false,
    structuredOutputParsed: false,
    structuredOutputValid: false,
    reconciliationApplied: false,
    fallbackUsed: false,
    failureCategory: 'NONE',
    coachingMode: undefined,
    conversationTurnsIncluded: history.length,
  };

  try {
    // 3. Build comprehensive Grounding Pack & system instructions
    const pack = buildSDAGroundingPack(
      dto.message,
      dto.context,
      dto.language,
      dto.conversationHistory,
      dto.responseModality || 'text'
    );
    const instructions = compileSDASystemPrompt(pack, dto.language);

    // 4. Call AI provider with native multi-turn history
    const rawOutput = await callAIProvider(instructions, dto.message, config, history);

    const meta = (rawOutput as any)?._meta;
    diagnostics.providerHttpOk = meta?.providerHttpOk ?? true;
    diagnostics.providerHttpStatus = meta?.providerHttpStatus ?? 200;
    diagnostics.structuredOutputParsed = meta?.structuredOutputParsed ?? true;

    // 5. Reconcile with canonical domain truth
    const envelope = validateAndReconcileAIResponse(rawOutput, dto.message, dto.context, dto.language);
    diagnostics.structuredOutputValid = true;
    diagnostics.reconciliationApplied = true;
    diagnostics.remoteSucceeded = true;
    diagnostics.fallbackUsed = false;
    diagnostics.failureCategory = 'NONE';
    diagnostics.coachingMode = envelope.coaching.mode;

    envelope.fallbackUsed = false;
    envelope.diagnostics = diagnostics;

    if (pack.groundedKnowledgeUnits && pack.groundedKnowledgeUnits.length > 0) {
      envelope.groundingTrace = {
        groundedKnowledgeIds: pack.groundedKnowledgeIds || [],
        sourceTypes: pack.groundedKnowledgeUnits.map((u) => u.sourceType),
        books: pack.groundedKnowledgeUnits.map((u) => u.bookNumber).filter(Boolean) as number[],
        chapters: pack.groundedKnowledgeUnits.map((u) => u.chapter).filter(Boolean) as number[],
        abilities: pack.groundedKnowledgeUnits.map((u) => u.abilityId),
        topics: pack.groundedKnowledgeUnits.map((u) => u.topic || ''),
      };
    }

    // Minimal safe production log on success (NO PROMPT, NO USER TEXT, NO SECRETS)
    console.log(
      `[SDA_COACH_REMOTE] provider=${diagnostics.provider} httpOk=true status=${diagnostics.providerHttpStatus} parsed=true valid=true fallback=false mode=${diagnostics.coachingMode}`
    );

    return {
      status: 200,
      envelope,
    };
  } catch (err: any) {
    diagnostics.fallbackUsed = true;
    diagnostics.remoteSucceeded = false;

    if (err instanceof ProviderError) {
      diagnostics.providerHttpOk = err.providerHttpOk;
      diagnostics.providerHttpStatus = err.providerHttpStatus;
      diagnostics.failureCategory = err.failureCategory;
      diagnostics.structuredOutputParsed = err.structuredOutputParsed;
      diagnostics.structuredOutputValid = false;
      diagnostics.reconciliationApplied = false;
    } else {
      let failureCategory: FailureCategory = 'NETWORK_ERROR';
      const msg = String(err?.message || '');
      if (err?.name === 'AbortError' || msg.includes('TIMEOUT') || msg.includes('aborted')) {
        failureCategory = 'TIMEOUT';
      } else if (msg.includes('PROVIDER_HTTP_')) {
        failureCategory = 'PROVIDER_REJECTED';
      } else if (msg.includes('AI_API_KEY_NOT_CONFIGURED')) {
        failureCategory = 'KEY_NOT_CONFIGURED';
      } else if (msg.includes('EMPTY_PROVIDER')) {
        failureCategory = 'EMPTY_RESPONSE';
      } else if (msg.includes('JSON') || msg.includes('PARSE')) {
        failureCategory = 'STRUCTURED_OUTPUT_PARSE';
      } else if (msg.includes('VALIDATION')) {
        failureCategory = 'VALIDATION_FAILED';
      }
      diagnostics.providerHttpOk = false;
      diagnostics.failureCategory = failureCategory;
      diagnostics.structuredOutputParsed = false;
      diagnostics.structuredOutputValid = false;
      diagnostics.reconciliationApplied = false;
    }

    // Safe error log line for failed remote attempts (NO PROMPT, NO USER TEXT, NO API KEY, NO RAW BODY)
    console.error(
      `[SDA_COACH_REMOTE] provider=${diagnostics.provider} httpOk=${Boolean(diagnostics.providerHttpOk)} status=${diagnostics.providerHttpStatus ?? 'none'} parsed=${Boolean(diagnostics.structuredOutputParsed)} valid=${Boolean(diagnostics.structuredOutputValid)} fallback=true failure=${diagnostics.failureCategory}`
    );

    return {
      status: 200,
      envelope: {
        error: 'AI_GATEWAY_FAILURE_FALLBACK_ACTIVE',
        fallbackUsed: true,
        diagnostics,
      },
    };
  }
}
