/**
 * SDA AI Coach — Voice Session Helpers (Phase 38A)
 *
 * Dedicated interaction helpers for:
 * 1. Spoken Motivation: Anchors in authentic Why & non-shaming encouragement.
 * 2. Spoken Advice: Anchors in current structure, slippery zones, and immediate next move.
 *
 * Architecture Rule:
 * Coach reasoning first.
 * Validation second.
 * Speech third.
 * Never route to a separate generic motivational or advice AI.
 */

import { voiceController } from './voiceController';
import type { CoachResponse } from '../types';

/**
 * Executes an Audio Motivation interaction:
 * 1. Formulates the motivational user prompt in the active language.
 * 2. Sends through the canonical SDA Coach engine.
 * 3. Speaks the validated response aloud.
 */
export async function requestAudioMotivation(
  language: 'en' | 'es' | 'nl' = 'en'
): Promise<CoachResponse> {
  const prompt = language === 'es'
    ? 'Necesito motivación y apoyo con mi estructura alimentaria.'
    : (language === 'nl'
        ? 'Ik heb motivatie en ondersteuning nodig bij mijn eetstructuur.'
        : 'I need motivation and support with my eating structure right now.');

  return voiceController.submitSpokenMessage(prompt, language, true, 'motivation');
}

/**
 * Executes an Audio Advice interaction:
 * 1. Formulates the advice inquiry in the active language.
 * 2. Sends through the canonical SDA Coach engine.
 * 3. Speaks the validated response aloud.
 */
export async function requestAudioAdvice(
  language: 'en' | 'es' | 'nl' = 'en'
): Promise<CoachResponse> {
  const prompt = language === 'es'
    ? '¿En qué debería enfocarme ahora para proteger mi estructura?'
    : (language === 'nl'
        ? 'Waar moet ik me nu op richten om mijn structuur te beschermen?'
        : 'What should I focus on right now to protect my structure?');

  return voiceController.submitSpokenMessage(prompt, language, true, 'advice');
}
