/**
 * SDA AI Coach — Text-To-Speech (TTS) Providers (Phase 38A)
 *
 * Implements provider-independent speech synthesis abstractions:
 * 1. MockTextToSpeechProvider: Zero-network mock provider for tests and development.
 * 2. BrowserSpeechSynthesisProvider: Local browser SpeechSynthesis API.
 *
 * Critical Safety Rule:
 * ONLY final, validated user-visible Coach messages may ever be spoken.
 * Never synthesize system prompts, hidden chains, raw unprocessed model text,
 * action payloads, or proprietary raw manuscripts.
 */

import type {
  TextToSpeechOptions,
  TextToSpeechProvider,
} from './types';
import { hasBrowserSpeechSynthesis } from './voiceCapabilities';

/**
 * Safe Development & Test Mock TTS Provider.
 * Simulates playback lifecycle without audio hardware or network calls.
 */
export class MockTextToSpeechProvider implements TextToSpeechProvider {
  readonly id = 'mock_tts';
  readonly name = 'SDA Development Mock TTS Provider';

  private playing = false;
  private paused = false;
  private lastSpokenText: string | null = null;
  private currentTimeout: any = null;

  isAvailable(): boolean {
    return true;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  getLastSpokenText(): string | null {
    return this.lastSpokenText;
  }

  async speak(text: string, options?: TextToSpeechOptions): Promise<void> {
    const clean = text.trim();
    if (!clean) return;

    await this.stop();

    this.playing = true;
    this.paused = false;
    this.lastSpokenText = clean;

    if (options?.onStart) {
      options.onStart();
    }

    // In mock mode, complete after simulated duration or immediately in test
    const simulatedDurationMs = Math.min(200, Math.max(50, clean.length * 2));
    this.currentTimeout = setTimeout(() => {
      this.playing = false;
      this.paused = false;
      if (options?.onEnd) {
        options.onEnd();
      }
    }, simulatedDurationMs);
  }

  async stop(): Promise<void> {
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }
    this.playing = false;
    this.paused = false;
  }

  async pause(): Promise<void> {
    if (this.playing) {
      this.paused = true;
    }
  }

  async resume(): Promise<void> {
    if (this.playing && this.paused) {
      this.paused = false;
    }
  }
}

/**
 * Browser SpeechSynthesis Provider.
 * Uses native Web Speech API SpeechSynthesis without external network requests.
 */
export class BrowserSpeechSynthesisProvider implements TextToSpeechProvider {
  readonly id = 'browser_speech_synthesis_tts';
  readonly name = 'Browser Speech Synthesis';

  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private playing = false;

  isAvailable(): boolean {
    return hasBrowserSpeechSynthesis();
  }

  isPlaying(): boolean {
    if (typeof window === 'undefined' || !window.speechSynthesis) return false;
    return this.playing || window.speechSynthesis.speaking;
  }

  private mapLanguageCode(lang: 'en' | 'es' | 'nl'): string {
    switch (lang) {
      case 'es': return 'es-ES';
      case 'nl': return 'nl-NL';
      case 'en':
      default:
        return 'en-US';
    }
  }

  async speak(text: string, options?: TextToSpeechOptions): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Speech synthesis is not supported on this browser.');
    }

    const clean = text.trim();
    if (!clean) return;

    await this.stop();

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = this.mapLanguageCode(options?.language || 'en');
    utterance.rate = options?.rate ?? 1.0;
    utterance.pitch = options?.pitch ?? 1.0;
    utterance.volume = options?.volume ?? 1.0;

    utterance.onstart = () => {
      this.playing = true;
      if (options?.onStart) options.onStart();
    };

    utterance.onend = () => {
      this.playing = false;
      this.activeUtterance = null;
      if (options?.onEnd) options.onEnd();
    };

    utterance.onerror = (e) => {
      this.playing = false;
      this.activeUtterance = null;
      if (options?.onError) {
        options.onError(new Error(e?.error || 'Speech synthesis error'));
      }
    };

    this.activeUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  async stop(): Promise<void> {
    if (this.activeUtterance) {
      this.activeUtterance = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.playing = false;
  }

  async pause(): Promise<void> {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.pause();
    }
  }

  async resume(): Promise<void> {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.resume();
    }
  }
}

import { RemoteTextToSpeechProvider } from './remoteTTSProvider';

/**
 * Creates the appropriate TTS provider based on platform support.
 * Uses real server-side synthesis (RemoteTextToSpeechProvider) when in browser runtime.
 */
export function createDefaultTTSProvider(preferMock = false): TextToSpeechProvider {
  if (preferMock || typeof window === 'undefined') {
    return new MockTextToSpeechProvider();
  }
  if (typeof Audio !== 'undefined') {
    return new RemoteTextToSpeechProvider();
  }
  if (hasBrowserSpeechSynthesis()) {
    return new BrowserSpeechSynthesisProvider();
  }
  return new MockTextToSpeechProvider();
}
