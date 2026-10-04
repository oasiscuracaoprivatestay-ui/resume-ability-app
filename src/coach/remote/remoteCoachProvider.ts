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

      // 2. Prepare normalized DTO
      const payload: CoachGatewayRequestDTO = {
        message: request.message,
        language: request.language,
        context: request.context,
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

