/**
 * SDA AI Coach — Engine Facade (Phase 33)
 *
 * Provider-agnostic coordinator for the Coach system.
 * Manages conversation lifecycle, context injection, and provider delegation.
 */

import type {
  CoachProvider,
  CoachResponse,
  CoachMessage,
  CoachContext,
} from './types';
import { RemoteCoachProvider } from './remote/remoteCoachProvider';
import { buildCoachContext } from './coachContext';
import { loadCoachConversation, saveCoachConversation } from './coachStorage';

class CoachEngine {
  private provider: CoachProvider;

  constructor(provider: CoachProvider = new RemoteCoachProvider()) {
    this.provider = provider;
  }

  setProvider(provider: CoachProvider): void {
    this.provider = provider;
  }

  getProvider(): CoachProvider {
    return this.provider;
  }

  /**
   * Process a user message:
   * 1. Validates input
   * 2. Persists user message
   * 3. Projects normalized read-only context
   * 4. Queries active provider
   * 5. Persists coach response
   * 6. Returns response to UI
   */
  async sendMessage(
    text: string,
    language: 'en' | 'es' | 'nl' = 'en',
    customContext?: CoachContext
  ): Promise<CoachResponse> {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error('Message cannot be empty');
    }

    const conv = loadCoachConversation();

    const userMessage: CoachMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role: 'user',
      text: trimmed,
      createdAt: Date.now(),
    };

    // Append user message immediately
    conv.messages.push(userMessage);
    saveCoachConversation(conv);

    // Build read-only context
    const context = customContext || buildCoachContext();

    try {
      const response = await this.provider.sendMessage({
        message: trimmed,
        conversationHistory: conv.messages,
        context,
        language,
      });

      // Append coach response
      conv.messages.push(response.message);
      saveCoachConversation(conv);

      return response;
    } catch (err) {
      const errorMsg: CoachMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'coach',
        text: 'Sorry, I encountered an issue processing your request. Please try again.',
        createdAt: Date.now(),
      };
      conv.messages.push(errorMsg);
      saveCoachConversation(conv);

      return {
        message: errorMsg,
      };
    }
  }
}

export const coachEngine = new CoachEngine();
