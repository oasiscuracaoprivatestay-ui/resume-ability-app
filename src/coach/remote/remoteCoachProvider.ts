/**
 * SDA AI Coach — Remote Coach Provider (Phase 36)
 *
 * Connects the frontend application to the server-side AI gateway (/api/coach)
 * while ensuring:
 * 1. Zero API keys or secrets in the browser runtime
 * 2. Guaranteed fallback to LocalCoachProvider on network/server/timeout failures
 * 3. Prevention of duplicate concurrent submissions
 * 4. Bounded conversation history transmission
 * 5. Strict preservation of preview-only Action Proposals (zero app mutation)
 */

import type {
  CoachMessage,
  CoachProvider,
  CoachRequest,
  CoachResponse,
  CoachActionType,
} from '../types';
import { LocalCoachProvider } from '../localCoachProvider';
import { deterministicUnderstandingEngine } from '../deterministicUnderstanding';
import { projectRemoteSafeContext } from '../coachContext';
import type {
  AIResponseEnvelope,
  CoachGatewayRequestDTO,
  FailureCategory,
  GatewayDiagnostics,
  SerializedChatMessage,
} from './types';
import { GATEWAY_TIMEOUT_MS, MAX_CONVERSATION_HISTORY } from './serverAIGateway';

export class RemoteCoachProvider implements CoachProvider {
  readonly id = 'remote_ai';
  readonly name = 'SDA Remote AI Gateway';

  private endpointUrl: string;
  private fallbackProvider: CoachProvider;
  private isRequestPending = false;
  private timeoutMs: number;
  private lastDiagnostics: GatewayDiagnostics | null = null;

  constructor(
    endpointUrl = '/api/coach',
    fallbackProvider: CoachProvider = new LocalCoachProvider(0),
    timeoutMs = GATEWAY_TIMEOUT_MS
  ) {
    this.endpointUrl = endpointUrl;
    this.fallbackProvider = fallbackProvider;
    this.timeoutMs = timeoutMs;
  }

  getFallbackProvider(): CoachProvider {
    return this.fallbackProvider;
  }

  isPending(): boolean {
    return this.isRequestPending;
  }

  getLastDiagnostics(): GatewayDiagnostics | null {
    return this.lastDiagnostics;
  }

  async sendMessage(request: CoachRequest): Promise<CoachResponse> {
    if (this.isRequestPending) {
      throw new Error('A coaching request is already in progress.');
    }

    this.isRequestPending = true;

    try {
      // 1. Run deterministic understanding engine on user's exact message (Phase 39B.1)
      const deterministic = await deterministicUnderstandingEngine.understand({
        text: request.message,
        language: request.language,
        context: request.context,
      });

      // 2. Prepare bounded history (last N messages)
      const boundedHistory: SerializedChatMessage[] = (request.conversationHistory || [])
        .slice(-MAX_CONVERSATION_HISTORY)
        .map(m => ({ role: m.role, text: m.text }));

      // 3. Project remote-safe context (Phase 40B Privacy Boundary)
      const remoteSafeContext = request.context
        ? projectRemoteSafeContext(request.context, request.message)
        : request.context;

      // 4. Prepare normalized DTO
      const payload: CoachGatewayRequestDTO = {
        message: request.message,
        language: request.language,
        context: remoteSafeContext,
        conversationHistory: boundedHistory,
      };

      // 3. Setup timeout controller
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(this.endpointUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutHandle);

        if (!response.ok) {
          const status = response.status;
          let failureCategory: FailureCategory = 'PROVIDER_REJECTED';
          if (status === 401 || status === 403) {
            failureCategory = 'AUTH_FAILED';
          } else if (status === 429) {
            failureCategory = 'RATE_LIMIT_OR_QUOTA';
          } else if (status === 400) {
            failureCategory = 'BAD_REQUEST';
          }
          this.lastDiagnostics = {
            provider: 'openai',
            providerAvailable: false,
            remoteAttempted: true,
            providerHttpOk: false,
            providerHttpStatus: status,
            remoteSucceeded: false,
            fallbackUsed: true,
            failureCategory,
          };
          if (typeof window !== 'undefined') {
            (window as any).__LAST_COACH_DIAGNOSTICS__ = this.lastDiagnostics;
          }
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[RemoteCoachProvider] Fallback active due to HTTP status:', status);
          }
          // Non-200 HTTP response -> fallback
          return await this.fallbackProvider.sendMessage(request);
        }

        const data = await response.json();
        if (data.diagnostics) {
          this.lastDiagnostics = data.diagnostics;
          if (typeof window !== 'undefined') {
            (window as any).__LAST_COACH_DIAGNOSTICS__ = data.diagnostics;
          }
        }

        // Check if gateway signaled fallback
        if (data.fallbackUsed || !data.understanding || !data.coaching) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[RemoteCoachProvider] Gateway fallback used:', data.diagnostics?.failureCategory);
          }
          return await this.fallbackProvider.sendMessage(request);
        }

        const envelope = data as AIResponseEnvelope;

        // Construct client CoachMessage
        let responseText = envelope.coaching.message;
        if (envelope.coaching.followUpQuestion && !responseText.includes(envelope.coaching.followUpQuestion)) {
          responseText = `${responseText}\n\n${envelope.coaching.followUpQuestion}`;
        }

        // Deterministic Proposal Authority (Phase 39B.1)
        // Supported safe proposal families: LOG_CHECK_IN, LOG_FOOD, LOG_SLIP, LOG_NEUTRAL, LOG_RESUME
        const SAFE_PROPOSAL_TYPES: readonly CoachActionType[] = ['LOG_CHECK_IN', 'LOG_FOOD', 'LOG_SLIP', 'LOG_NEUTRAL', 'LOG_RESUME'];
        const safeDeterministicProposal =
          !deterministic.requiresClarification &&
          deterministic.proposedAction &&
          SAFE_PROPOSAL_TYPES.includes(deterministic.proposedAction.type)
            ? deterministic.proposedAction
            : undefined;

        // Remote AI output must NEVER override or invent executable proposals.
        // Executable proposal authority comes strictly from deterministic understanding.
        const effectiveProposal = safeDeterministicProposal;

        // Semantic Reconciliation (Phase 39C.1):
        const lang = request.language || 'en';

        // 1. State D: Zero unresolved targets for Resume -> clear, supportive message without proposal
        if (deterministic.intent === 'LOG_RESUME' && !effectiveProposal && !deterministic.requiresClarification) {
          const NO_TARGET_MESSAGES: Record<string, string> = {
            en: "You're already back on structure, and there isn't an unresolved slip that needs to be marked as resumed. Keep moving forward with your structure.",
            es: "Ya estás de vuelta en tu estructura y no hay ningún desliz pendiente por marcar como retomado. Sigue adelante con tu estructura.",
            nl: "Je bent alweer op schema en er is geen openstaande uitglijder die nog als hervat gemarkeerd moet worden. Blijf gefocust doorgaan met je schema.",
          };
          responseText = NO_TARGET_MESSAGES[lang] || NO_TARGET_MESSAGES.en;
        }

        // 2. State B: Resume proposal exists -> cleanse check-in confusion
        if (effectiveProposal && effectiveProposal.type === 'LOG_RESUME') {
          const checkInConfusionPattern = /(?:you(?:'ve| have)?\s+checked\s+in\s+as\s+on[- ]?structure|you(?:'ve| have)?\s+checked\s+in\b|has\s+hecho\s+un\s+check[- ]?in|te\s+has\s+registrado\s+como\s+en\s+estructura|je\s+hebt\s+ingecheckt\s+als\s+op\s+schema)/gi;
          if (checkInConfusionPattern.test(responseText)) {
            const RESUME_ACK: Record<string, string> = {
              en: "You're back on structure. That's Resume-Ability in action.",
              es: "Estás de vuelta en tu estructura. Eso es Resume-Ability en acción.",
              nl: "Je bent weer op schema. Dat is Resume-Ability in actie.",
            };
            responseText = responseText.replace(checkInConfusionPattern, RESUME_ACK[lang] || RESUME_ACK.en);
          }
        }

        // 3. Pre-Confirmation Persistence Sanitization (Section 5)
        if (effectiveProposal) {
          const prematureClaims = [
            { pattern: /(?:your\s+resume\s+has\s+been\s+recorded|tu\s+retorno\s+ha\s+sido\s+registrado|je\s+hervatting\s+is\s+vastgelegd)/gi, replace: lang === 'es' ? 'Puedes confirmar este registro de Resume abajo' : (lang === 'nl' ? 'Je kunt deze hervatting hieronder bevestigen' : "Review the proposal below to confirm your Resume") },
            { pattern: /(?:your\s+slip\s+has\s+been\s+marked\s+as\s+resumed|tu\s+desliz\s+ha\s+sido\s+marcado\s+como\s+retomado|je\s+uitglijder\s+is\s+gemarkeerd\s+als\s+hervat)/gi, replace: lang === 'es' ? 'Puedes confirmar el Resume de tu desliz abajo' : (lang === 'nl' ? 'Je kunt de hervatting van je uitglijder hieronder bevestigen' : "Review the proposal below to resume your slip") },
            { pattern: /(?:i(?:'ve| have)?\s+marked\s+(?:your\s+slip\s+as\s+resumed|you\s+as\s+resumed)|he\s+marcado\s+tu\s+desliz\s+como\s+retomado|ik\s+heb\s+je\s+uitglijder\s+als\s+hervat\s+gemarkeerd)/gi, replace: lang === 'es' ? 'He preparado la propuesta de Resume' : (lang === 'nl' ? 'Ik heb het hervattingsvoorstel klaargezet' : "I've prepared the Resume proposal") },
            { pattern: /(?:i(?:'ve| have)?\s+(?:logged|recorded)\s+your\s+(?:meal|food)|he\s+registrado\s+tu\s+(?:comida|alimento)|ik\s+heb\s+je\s+maaltijd\s+(?:gelogd|vastgelegd))/gi, replace: lang === 'es' ? 'He preparado el registro de este alimento' : (lang === 'nl' ? 'Ik heb dit maaltijdvoorstel klaargezet' : "I've prepared this food log proposal") },
            { pattern: /(?:your\s+(?:meal|food)\s+has\s+been\s+(?:logged|recorded)|tu\s+comida\s+ha\s+sido\s+registrada|je\s+maaltijd\s+is\s+(?:gelogd|vastgelegd))/gi, replace: lang === 'es' ? 'Revisa la propuesta abajo para confirmar' : (lang === 'nl' ? 'Bekijk het voorstel hieronder om te bevestigen' : "Review the proposal below to confirm") },
            { pattern: /(?:you(?:'ve| have)?\s+successfully\s+checked\s+in|has\s+completado\s+tu\s+check[- ]?in|je\s+bent\s+succesvol\s+ingecheckt)/gi, replace: lang === 'es' ? 'He preparado tu Daily Check-In' : (lang === 'nl' ? 'Ik heb je Daily Check-In klaargezet' : "I've prepared your Daily Check-In proposal") },
            { pattern: /(?:your\s+check[- ]?in\s+has\s+been\s+recorded|tu\s+check[- ]?in\s+ha\s+sido\s+registrado|je\s+check[- ]?in\s+is\s+vastgelegd)/gi, replace: lang === 'es' ? 'Revisa tu Daily Check-In abajo para confirmar' : (lang === 'nl' ? 'Bekijk je Daily Check-In hieronder om te bevestigen' : "Review your Daily Check-In below to confirm") },
            { pattern: /(?:your\s+slip\s+has\s+been\s+recorded|tu\s+desliz\s+ha\s+sido\s+registrado|je\s+uitglijder\s+is\s+vastgelegd)/gi, replace: lang === 'es' ? 'He preparado el registro de tu desliz' : (lang === 'nl' ? 'Ik heb je uitglijdervoorstel klaargezet' : "I've prepared this slip proposal") },
            { pattern: /(?:i(?:'ve| have)?\s+recorded\s+your\s+slip|he\s+registrado\s+tu\s+desliz|ik\s+heb\s+je\s+uitglijder\s+vastgelegd)/gi, replace: lang === 'es' ? 'He preparado el registro de tu desliz' : (lang === 'nl' ? 'Ik heb je uitglijdervoorstel klaargezet' : "I've prepared this slip proposal") },
          ];

          for (const claim of prematureClaims) {
            responseText = responseText.replace(claim.pattern, claim.replace);
          }
        }

        const coachMsg: CoachMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          role: 'coach',
          text: responseText,
          createdAt: Date.now(),
          actionProposal: effectiveProposal,
          understanding: deterministic,
        };

        return {
          message: coachMsg,
          intent: {
            type: deterministic.intent !== 'GENERAL_COACHING' ? deterministic.intent : envelope.understanding.intent,
            confidence: deterministic.intent !== 'GENERAL_COACHING' ? deterministic.confidence : envelope.understanding.confidence,
          },
          understanding: deterministic,
          actionProposal: effectiveProposal,
        };
      } catch (fetchError: any) {
        clearTimeout(timeoutHandle);
        const isTimeout = fetchError?.name === 'AbortError';
        this.lastDiagnostics = {
          provider: 'openai',
          providerAvailable: false,
          remoteAttempted: true,
          providerHttpOk: false,
          remoteSucceeded: false,
          fallbackUsed: true,
          failureCategory: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
        };
        if (typeof window !== 'undefined') {
          (window as any).__LAST_COACH_DIAGNOSTICS__ = this.lastDiagnostics;
        }
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[RemoteCoachProvider] Fetch error fallback:', this.lastDiagnostics.failureCategory);
        }
        // Network failure, abort/timeout, or parse error -> fallback to deterministic engine
        return await this.fallbackProvider.sendMessage(request);
      }
    } finally {
      this.isRequestPending = false;
    }
  }
}

