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
  context: CoachContext,
  language: 'en' | 'es' | 'nl'
): AIResponseEnvelope {
  // 1. Check for Knowledge Gap or Non-Diet Ability
  const staticGap = checkKnowledgeGap(userMessage);
  const incomingGap = (raw as any)?.knowledgeGap || (raw as any)?.detectedKnowledgeGap;
  const rawGap = (incomingGap && typeof incomingGap === 'object')
    ? incomingGap
    : null;
  const isNonDietAbility = (raw as any)?.ability && (raw as any)?.ability !== 'diet';

  if (staticGap || rawGap || isNonDietAbility) {
    const gap = staticGap || (rawGap ? {
      requestedTopic: rawGap.pattern || rawGap.topic || rawGap.requestedTopic || 'Non-diet topic',
      reason: rawGap.reason || 'Not yet fully codified in app source.',
      status: rawGap.status || 'partial',
      fallbackMessage: (raw as any)?.coachingMessage || 'I only coach from verified Super Diet-Ability concepts.',
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
  let intent: CoachIntentType = (typeof raw === 'object' && raw?.intent && validIntents.includes(raw.intent))
    ? raw.intent
    : 'GENERAL_COACHING';
  const confidence = typeof raw === 'string'
    ? 0.5
    : (typeof raw?.confidence === 'number'
        ? Math.max(0, Math.min(1, raw.confidence))
        : 0.75);

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
    : (raw?.coachingMessage || 'I am here to support your structure.');
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

  // 4. Action Proposal Reconciliation (PREVIEW-ONLY, ZERO MUTATION)
  let proposedAction: CoachActionProposal | undefined = undefined;
  const rawObj = raw as any;
  const rawActionType = raw.proposedActionType || raw.actionProposal?.type || rawObj?.proposedAction?.type;
  const normalizedActionType = typeof rawActionType === 'string' ? rawActionType.toUpperCase() as CoachActionType : undefined;
  const actionType = normalizedActionType;
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
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: instructions },
      ];

      // Format bounded conversation history natively for OpenAI
      if (history && history.length > 0) {
        for (const h of history) {
          const role = h.role === 'coach' ? 'assistant' : 'user';
          messages.push({ role, content: h.text });
        }
      }

      messages.push({ role: 'user', content: userPrompt });

      const res = await fetch(endpointUrl, {
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
    // 3. Build comprehensive Grounding Pack & system instructions
    const pack = buildSDAGroundingPack(dto.message, dto.context, dto.language, dto.conversationHistory);
    const instructions = compileSDASystemPrompt(pack, dto.language);

    // Bounded conversation history
    const history = (dto.conversationHistory || []).slice(-MAX_CONVERSATION_HISTORY);

    // 4. Call AI provider with native multi-turn history
    const rawOutput = await callAIProvider(instructions, dto.message, config, history);

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
    let failureCategory: FailureCategory = 'NETWORK_ERROR';
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
