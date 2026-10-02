/**
 * SDA AI Coach — Secure Server-Side AI Gateway (Phase 36)
 *
 * Implements:
 * 1. Strict request validation & context minimization
 * 2. SDA knowledge projection & system instruction builder
 * 3. Provider-independent AI model interaction (OpenAI/Gemini/Anthropic compatible)
 * 4. Rigorous schema validation & canonical domain reconciliation
 * 5. Deterministic fallback triggers on provider errors or unconfigured keys
 * 6. Zero secret leakage to client payloads
 */

import type {
  CoachActionProposal,
  CoachActionType,
  CoachAmbiguity,
  CoachContext,
  CoachEntities,
  CoachIntentType,
  CoachUnderstanding,
} from '../types';
import type {
  DetailedBlockOutcome,
} from '../../utils/dietVerificationStorage';
import {
  ALL_DETAILED_OUTCOMES,
} from '../../utils/dietVerificationStorage';
import {
  FOOD_CATEGORY_KEYS,
  type FoodCategoryKey,
} from '../../data/dietData';
import type { CheckInStatus } from '../../utils/checkInStorage';
import {
  defaultSDAKnowledgeBase,
} from '../knowledge/sdaKnowledgeBuilder';
import {
  SDA_PRINCIPLES,
} from '../knowledge/sdaPrinciples';
import {
  SDA_TERMINOLOGY,
} from '../knowledge/sdaTerminology';
import type { SDACoachingMode } from '../knowledge/types';
import type {
  AIKnowledgeProjection,
  AIResponseEnvelope,
  CoachGatewayRequestDTO,
  RawAIModelOutput,
  ServerAIConfig,
} from './types';
import { resolveCategoryTerm } from '../coachResolvers';

// ── Bounded Constants ─────────────────────────────────────────────────────────

export const MAX_MESSAGE_LENGTH = 1500;
export const MAX_CONVERSATION_HISTORY = 10;
export const GATEWAY_TIMEOUT_MS = 10000;

// Valid canonical action types
export const CANONICAL_ACTION_TYPES: readonly CoachActionType[] = [
  'LOG_FOOD',
  'LOG_NEUTRAL',
  'LOG_SLIP',
  'LOG_RESUME',
  'LOG_CHECK_IN',
  'UPDATE_FOOD_LOG',
  'RECOMMIT',
] as const;

// Valid canonical check-in statuses
export const CANONICAL_CHECKIN_STATUSES: readonly CheckInStatus[] = [
  'on-structure',
  'near-slip',
  'slip',
] as const;

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

// ── 2. Knowledge Projection Builder ──────────────────────────────────────────

export function buildAIKnowledgeProjection(
  _message: string,
  _context: CoachContext
): AIKnowledgeProjection {

  // Principles projection
  const principles = Object.values(SDA_PRINCIPLES).map(p => ({
    id: p.id,
    title: p.title,
    statement: p.statement,
    prohibitedAssumptions: p.prohibitedAssumptions,
  }));

  // Selected relevant terms
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

  const knownKnowledgeGaps = [
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

  return {
    relevantPrinciples: principles,
    relevantTerms: terms,
    semanticRules,
    prohibitedAssumptions,
    knownKnowledgeGaps,
  };
}

// ── 3. System Instruction Builder ────────────────────────────────────────────

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

// ── 4. Canonical Domain Reconciliation & Sanitization ────────────────────────

export function validateAndReconcileAIResponse(
  raw: RawAIModelOutput,
  userMessage: string,
  context: CoachContext,
  language: 'en' | 'es' | 'nl'
): AIResponseEnvelope {
  // 1. Check for Knowledge Gap or Non-Diet Ability
  const staticGap = defaultSDAKnowledgeBase.checkKnowledgeGap(userMessage);
  const rawGap = raw.detectedKnowledgeGap || (raw as any).knowledgeGap;
  const isNonDietAbility = (raw as any).ability && (raw as any).ability !== 'diet';

  if (staticGap || rawGap || isNonDietAbility) {
    const gap = staticGap || (rawGap ? {
      requestedTopic: rawGap.topic || rawGap.pattern || 'Non-diet topic',
      reason: rawGap.reason || 'Not yet fully codified in app source.',
      status: rawGap.status || 'partial',
      fallbackMessage: raw.coachingMessage || 'I only coach from verified Super Diet-Ability concepts.',
    } : {
      requestedTopic: String((raw as any).ability),
      reason: 'Only Diet-Ability is active in Phase 36.',
      status: 'reserved' as const,
      fallbackMessage: raw.coachingMessage || 'Only Diet-Ability is supported.',
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
  const intent: CoachIntentType = validIntents.includes(raw.intent) ? raw.intent : 'GENERAL_COACHING';
  const confidence = typeof raw.confidence === 'number'
    ? Math.max(0, Math.min(1, raw.confidence))
    : 0.75;

  // 3. Entities Reconciliation
  const entities: CoachEntities = {};
  const ambiguities: CoachAmbiguity[] = [];

  if (Array.isArray(raw.ambiguities)) {
    ambiguities.push(...raw.ambiguities);
  }
  if (raw.clarificationField && raw.clarificationReason) {
    ambiguities.push({
      field: raw.clarificationField,
      reason: raw.clarificationReason,
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
  let coachingMsg = raw.coachingMessage || 'I am here to support your structure.';
  if (coachingMsg.toLowerCase().includes('caused your slip') || coachingMsg.toLowerCase().includes('caused this slip')) {
    // Sanitize non-causal framing
    const zoneMatch = context.slipperyZones.zones.find(z => coachingMsg.toLowerCase().includes(z.toLowerCase()));
    if (zoneMatch) {
      coachingMsg = language === 'es'
        ? `"${zoneMatch}" es una de tus Zonas Resbaladizas guardadas. ¿Formó parte de este momento?`
        : (language === 'nl'
            ? `"${zoneMatch}" is een van je opgeslagen Glijdende Zones. Speelde dit een rol?`
            : `"${zoneMatch}" is one of your identified Slippery Zones. Was it part of what happened here?`);
    }
  }

  // 4. Action Proposal Reconciliation (PREVIEW-ONLY, ZERO MUTATION)
  let proposedAction: CoachActionProposal | undefined = undefined;
  const actionType = (raw.proposedActionType || raw.actionProposal?.type) as CoachActionType | undefined;
  if (actionType) {
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
          payload: (raw.proposedActionPayload || raw.actionProposal?.payload || {}) as Record<string, unknown>,
          humanReadableSummary: raw.proposedActionSummary || raw.actionProposal?.humanReadableSummary || `${actionType} proposal`,
        };
      }
    } else {
      ambiguities.push({
        field: 'actionType',
        reason: `Unsupported action type "${actionType}"`,
      });
    }
  }

  const requiresClarification = Boolean(
    raw.requiresClarification || ambiguities.length > 0 || raw.clarificationField
  );

  const understanding: CoachUnderstanding = {
    id: `und-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ability: 'diet',
    rawText: userMessage,
    intent,
    confidence,
    entities,
    ambiguities,
    requiresClarification,
    proposedAction,
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

  return {
    version: 1,
    ability: 'diet',
    understanding,
    coaching: {
      mode: finalMode,
      message: coachingMsg,
      followUpQuestion: raw.followUpQuestion,
    },
    proposedAction,
  };
}

// ── 5. Provider Call Execution ───────────────────────────────────────────────

export async function callAIProvider(
  instructions: string,
  userPrompt: string,
  config?: Partial<ServerAIConfig>
): Promise<RawAIModelOutput> {
  // Use mock if injected (Offline test safety)
  if (mockAIHandler) {
    const mockRes = await mockAIHandler(instructions, userPrompt);
    if (typeof mockRes === 'string') {
      return JSON.parse(mockRes);
    }
    return mockRes;
  }

  const rawKey = config?.apiKey !== undefined
    ? config.apiKey
    : (process.env.AI_API_KEY || process.env.AI_PROVIDER_API_KEY || '');
  const apiKey = typeof rawKey === 'string' ? rawKey.trim() : '';
  if (!apiKey) {
    throw new Error('AI_API_KEY_NOT_CONFIGURED');
  }

  const provider = config?.provider || (process.env.AI_PROVIDER as any) || 'openai';
  const model = config?.model || process.env.AI_MODEL || 'gpt-4o-mini';
  const endpointUrl = config?.endpointUrl || process.env.AI_BASE_URL || 'https://api.openai.com/v1/chat/completions';

  if (provider === 'openai') {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GATEWAY_TIMEOUT_MS);

    try {
      const res = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: instructions },
            { role: 'user', content: userPrompt },
          ],
          temperature: config?.temperature ?? 0.2,
          max_tokens: config?.maxTokens ?? 700,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`PROVIDER_HTTP_${res.status}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('EMPTY_PROVIDER_RESPONSE');
      }

      return JSON.parse(content) as RawAIModelOutput;
    } catch (err: any) {
      if (err?.name === 'AbortError' || controller.signal.aborted) {
        throw new Error('GATEWAY_TIMEOUT');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`UNSUPPORTED_PROVIDER_${provider}`);
}

// ── 6. Main Server Gateway Turn Handler ──────────────────────────────────────

export async function handleCoachGatewayRequest(
  body: unknown,
  config?: Partial<ServerAIConfig>
): Promise<{
  status: number;
  envelope: (AIResponseEnvelope & { error?: string }) | {
    error: string;
    fallbackUsed: boolean;
    diagnostics: import('./types').GatewayDiagnostics;
  };
}> {
  // 1. Validate incoming request
  const validation = validateGatewayRequest(body);
  if (!validation.valid) {
    return {
      status: validation.statusCode || 400,
      envelope: {
        error: validation.error || 'BAD_REQUEST',
        fallbackUsed: true,
        diagnostics: {
          providerAvailable: false,
          remoteAttempted: false,
          remoteSucceeded: false,
          fallbackUsed: true,
          failureCategory: 'BAD_REQUEST',
        },
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
    return {
      status: 200,
      envelope: {
        error: 'AI_KEY_NOT_CONFIGURED_FALLBACK_ACTIVE',
        fallbackUsed: true,
        diagnostics: {
          providerAvailable: false,
          remoteAttempted: false,
          remoteSucceeded: false,
          fallbackUsed: true,
          failureCategory: 'KEY_NOT_CONFIGURED',
        },
      },
    };
  }

  try {
    // 3. Build knowledge projection & system instructions
    const projection = buildAIKnowledgeProjection(dto.message, dto.context);
    const instructions = buildSDAAISystemInstructions(dto.language, projection, dto.context);

    // Bounded conversation history formatting
    const history = (dto.conversationHistory || []).slice(-MAX_CONVERSATION_HISTORY);
    const historyBlock = history.length > 0
      ? `Recent Conversation:\n${history.map(h => `${h.role.toUpperCase()}: ${h.text}`).join('\n')}\n\n`
      : '';
    const userPrompt = `${historyBlock}USER: ${dto.message}`;

    // 4. Call AI provider
    const rawOutput = await callAIProvider(instructions, userPrompt, config);

    // 5. Reconcile with canonical domain truth
    const envelope = validateAndReconcileAIResponse(rawOutput, dto.message, dto.context, dto.language);
    envelope.fallbackUsed = false;
    envelope.diagnostics = {
      providerAvailable: true,
      remoteAttempted: true,
      remoteSucceeded: true,
      fallbackUsed: false,
      failureCategory: 'NONE',
    };

    return {
      status: 200,
      envelope,
    };
  } catch (err: any) {
    let failureCategory: import('./types').FailureCategory = 'NETWORK_ERROR';
    const msg = String(err?.message || '');
    if (err?.name === 'AbortError' || msg.includes('TIMEOUT') || msg.includes('aborted')) {
      failureCategory = 'TIMEOUT';
    } else if (msg.includes('PROVIDER_HTTP_')) {
      failureCategory = 'PROVIDER_REJECTED';
    } else if (msg.includes('AI_API_KEY_NOT_CONFIGURED')) {
      failureCategory = 'KEY_NOT_CONFIGURED';
    } else if (msg.includes('EMPTY_PROVIDER') || msg.includes('JSON') || msg.includes('VALIDATION')) {
      failureCategory = 'VALIDATION_FAILED';
    }

    // Safe error without leaking internal secrets or stack traces
    return {
      status: 200,
      envelope: {
        error: 'AI_GATEWAY_FAILURE_FALLBACK_ACTIVE',
        fallbackUsed: true,
        diagnostics: {
          providerAvailable: Boolean(apiKey),
          remoteAttempted: true,
          remoteSucceeded: false,
          fallbackUsed: true,
          failureCategory,
        },
      },
    };
  }
}

