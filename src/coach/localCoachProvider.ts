/**
 * SDA AI Coach — Local Provider (Phase 33 & Phase 34 Engine)
 *
 * Integrates deterministic structured understanding (intents, entities, ambiguities,
 * and action proposals) with contextual responses from CoachContext.
 *
 * Zero external network calls. Zero third-party AI APIs.
 * Fully conforms to the provider-independent CoachProvider contract.
 */

import type {
  CoachProvider,
  CoachRequest,
  CoachResponse,
  CoachMessage,
  CoachIntent,
  CoachActionProposal,
  CoachUnderstanding,
} from './types';
import { detectCoachIntent } from './coachIntents';
import { createActionProposal } from './coachActions';
import { deterministicUnderstandingEngine } from './deterministicUnderstanding';
import {
  defaultSDAKnowledgeBase,
  buildCoachingPlan,
  generateCoachingResponse,
} from './knowledge';

export class LocalCoachProvider implements CoachProvider {
  readonly id = 'local';
  readonly name = 'Local SDA Engine';

  // Configurable delay for async realism (set to 0 during tests)
  simulatedDelayMs: number;

  constructor(simulatedDelayMs = 200) {
    this.simulatedDelayMs = simulatedDelayMs;
  }

  async sendMessage(request: CoachRequest): Promise<CoachResponse> {
    if (this.simulatedDelayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.simulatedDelayMs));
    }

    const { message, context, language } = request;
    const lang = language || 'en';

    // 1. Structured Understanding Analysis (Phase 34)
    const understanding: CoachUnderstanding = await deterministicUnderstandingEngine.understand({
      text: message,
      language: lang,
      context,
    });

    // Also obtain legacy high-level intent for backwards compatibility
    const legacyIntent: CoachIntent = detectCoachIntent(message);
    const effectiveIntentType = understanding.intent !== 'GENERAL_COACHING'
      ? understanding.intent
      : legacyIntent.type;

    // Harmonize intent on understanding for planner consistency
    if (understanding.intent === 'GENERAL_COACHING' && legacyIntent.type !== 'GENERAL_COACHING') {
      understanding.intent = legacyIntent.type;
    }

    // 2. Build Structured SDA Coaching Plan (Phase 35 Methodology Layer)
    const plan = buildCoachingPlan({
      message,
      understanding,
      context,
      knowledgeBase: defaultSDAKnowledgeBase,
      language: lang,
    });

    let responseText = '';
    let actionProposal: CoachActionProposal | undefined = plan.actionProposal || understanding.proposedAction;

    // 3. Handle Clarification / Ambiguity (Phase 34 + Phase 35 Recovery Framing)
    if (understanding.requiresClarification && understanding.ambiguities.length > 0) {
      const amb = understanding.ambiguities[0];
      if (amb.field === 'outcome') {
        responseText = generateCoachingResponse(plan, lang);
        actionProposal = createActionProposal(
          'LOG_SLIP',
          { outcome: 'structured_slip', timestamp: Date.now() },
          lang === 'es' ? 'Registrar Desliz' : (lang === 'nl' ? 'Uitglijder vastleggen' : 'Record Slip & open Recovery Timer')
        );
      } else if (amb.field === 'category') {
        const foodName = understanding.entities.foodItems?.[0]?.rawText || 'este alimento';
        responseText = lang === 'es'
          ? `¿A qué categoría pertenece "${foodName}"?`
          : (lang === 'nl'
            ? `Bij welke categorie hoort "${foodName}"?`
            : `Which food category should I use for "${foodName}"?`);
      } else if (amb.field === 'startTime') {
        responseText = lang === 'es'
          ? '¿Te refieres a la mañana (AM) o a la noche (PM)?'
          : (lang === 'nl'
            ? 'Bedoel je in de ochtend (AM) of in de avond (PM)?'
            : 'Did you mean AM or PM?');
      } else {
        responseText = amb.reason;
      }
    } else {
      // 4. Deterministic Methodology-Grounded Response (Phase 35 Planner Output)
      responseText = generateCoachingResponse(plan, lang);
    }

    const coachMsg: CoachMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role: 'coach',
      text: responseText,
      createdAt: Date.now(),
      actionProposal,
      understanding,
    };

    return {
      message: coachMsg,
      intent: { type: effectiveIntentType, confidence: understanding.confidence },
      understanding,
      actionProposal,
    };
  }
}
