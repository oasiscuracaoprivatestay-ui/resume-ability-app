/**
 * SDA AI Coach — Voice Capabilities Detection (Phase 38A)
 *
 * Detects browser and runtime voice capabilities (Web Speech API, SpeechSynthesis,
 * audio permissions) in a safe, privacy-preserving manner.
 *
 * Zero external calls. Zero credentials required.
 */

import type { VoiceCapabilityStatus } from './types';

/**
 * Returns true if the browser supports Speech Recognition (Web Speech API).
 */
export function hasBrowserSpeechRecognition(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  );
}

/**
 * Returns true if the browser supports Speech Synthesis (Web Speech API).
 */
export function hasBrowserSpeechSynthesis(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean('speechSynthesis' in window && typeof window.speechSynthesis?.speak === 'function');
}

/**
 * Checks overall capability status for voice on the current platform.
 */
export function getVoiceCapabilityStatus(): VoiceCapabilityStatus {
  const stt = hasBrowserSpeechRecognition();
  const tts = hasBrowserSpeechSynthesis();

  if (stt || tts) {
    return 'ready';
  }

  // When native browser speech APIs are absent, development mock providers
  // still allow complete architectural testing.
  return 'planned';
}

/**
 * Diagnostic summary for voice readiness (safe for UI or status panels).
 */
export interface VoiceDiagnostics {
  sttAvailable: boolean;
  ttsAvailable: boolean;
  overallStatus: VoiceCapabilityStatus;
  mockMode: boolean;
  supportedLanguages: Array<'en' | 'es' | 'nl'>;
}

export function getVoiceDiagnostics(isMock = false): VoiceDiagnostics {
  return {
    sttAvailable: hasBrowserSpeechRecognition() || isMock,
    ttsAvailable: hasBrowserSpeechSynthesis() || isMock,
    overallStatus: isMock ? 'ready' : getVoiceCapabilityStatus(),
    mockMode: isMock,
    supportedLanguages: ['en', 'es', 'nl'],
  };
}
