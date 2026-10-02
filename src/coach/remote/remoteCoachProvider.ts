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
} from '../types';
import { LocalCoachProvider } from '../localCoachProvider';
import type {
  AIResponseEnvelope,
  CoachGatewayRequestDTO,
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
      // 1. Prepare bounded history (last N messages)
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
          this.lastDiagnostics = {
            providerAvailable: false,
            remoteAttempted: true,
            remoteSucceeded: false,
            fallbackUsed: true,
            failureCategory: 'PROVIDER_REJECTED',
          };
          // Non-200 HTTP response -> fallback
          return await this.fallbackProvider.sendMessage(request);
        }

        const data = await response.json();
        if (data.diagnostics) {
          this.lastDiagnostics = data.diagnostics;
        }

        // Check if gateway signaled fallback
        if (data.fallbackUsed || !data.understanding || !data.coaching) {
          return await this.fallbackProvider.sendMessage(request);
        }

        const envelope = data as AIResponseEnvelope;

        // Construct client CoachMessage
        let responseText = envelope.coaching.message;
        if (envelope.coaching.followUpQuestion && !responseText.includes(envelope.coaching.followUpQuestion)) {
          responseText = `${responseText}\n\n${envelope.coaching.followUpQuestion}`;
        }

        const coachMsg: CoachMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          role: 'coach',
          text: responseText,
          createdAt: Date.now(),
          actionProposal: envelope.proposedAction,
          understanding: envelope.understanding,
        };

        return {
          message: coachMsg,
          intent: {
            type: envelope.understanding.intent,
            confidence: envelope.understanding.confidence,
          },
          understanding: envelope.understanding,
          actionProposal: envelope.proposedAction,
        };
      } catch (fetchError: any) {
        clearTimeout(timeoutHandle);
        this.lastDiagnostics = {
          providerAvailable: false,
          remoteAttempted: true,
          remoteSucceeded: false,
          fallbackUsed: true,
          failureCategory: fetchError?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR',
        };
        // Network failure, abort/timeout, or parse error -> fallback to deterministic engine
        return await this.fallbackProvider.sendMessage(request);
      }
    } finally {
      this.isRequestPending = false;
    }
  }
}

