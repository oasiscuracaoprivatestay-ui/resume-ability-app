/**
 * SDA AI Coach — Speech-To-Text (STT) Providers (Phase 38A)
 *
 * Implements provider-independent speech transcription abstractions:
 * 1. MockSpeechToTextProvider: Safe, deterministic, zero-network mock provider for tests and dev.
 * 2. BrowserSpeechToTextProvider: Local Web Speech API recognition (when supported by browser).
 *
 * Privacy Rules:
 * - Never activate microphone automatically
 * - No raw audio files stored in localStorage or context
 * - Transcripts immediately become normal user text in the canonical Coach pipeline
 */

import type {
  SpeechToTextOptions,
  SpeechToTextProvider,
  VoiceTranscript,
} from './types';
import { hasBrowserSpeechRecognition } from './voiceCapabilities';

/**
 * Safe Development & Test Mock STT Provider.
 * Allows simulating user speech without microphone access or network calls.
 */
export class MockSpeechToTextProvider implements SpeechToTextProvider {
  readonly id = 'mock_stt';
  readonly name = 'SDA Development Mock STT Provider';

  private active = false;
  private queuedText: string = 'I almost slipped because I was stressed.';
  private currentLanguage: 'en' | 'es' | 'nl' = 'en';

  isAvailable(): boolean {
    return true;
  }

  isListening(): boolean {
    return this.active;
  }

  /**
   * Set the text that will be produced by the mock provider upon next listen/stop.
   */
  setMockTranscript(text: string, language: 'en' | 'es' | 'nl' = 'en'): void {
    this.queuedText = text;
    this.currentLanguage = language;
  }

  async startListening(
    options?: SpeechToTextOptions,
    onInterim?: (partialText: string) => void,
    _onError?: (err: Error) => void
  ): Promise<void> {
    this.active = true;
    if (options?.language) {
      this.currentLanguage = options.language;
    }
    // Simulate brief interim progress if callback provided
    if (onInterim && this.queuedText.length > 5) {
      const half = this.queuedText.slice(0, Math.floor(this.queuedText.length / 2));
      setTimeout(() => {
        if (this.active) onInterim(half);
      }, 50);
    }
  }

  async stopListening(): Promise<VoiceTranscript | null> {
    if (!this.active) return null;
    this.active = false;

    const transcript: VoiceTranscript = {
      id: `vt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: this.queuedText.trim(),
      language: this.currentLanguage,
      confidence: 0.95,
      createdAt: Date.now(),
      source: 'voice',
    };

    return transcript;
  }

  async cancelListening(): Promise<void> {
    this.active = false;
  }
}

/**
 * Browser Web Speech API STT Provider.
 * Utilizes local browser speech recognition if supported (Chrome, Safari, Edge).
 */
export class BrowserSpeechToTextProvider implements SpeechToTextProvider {
  readonly id = 'browser_web_speech_stt';
  readonly name = 'Browser Web Speech Recognition';

  private recognition: any = null;
  private active = false;
  private currentLanguage: 'en' | 'es' | 'nl' = 'en';
  private accumulatedText = '';
  private interimText = '';

  isAvailable(): boolean {
    return hasBrowserSpeechRecognition();
  }

  isListening(): boolean {
    return this.active;
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

  async startListening(
    options?: SpeechToTextOptions,
    onInterim?: (partialText: string) => void,
    onError?: (err: Error) => void
  ): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Browser speech recognition is not supported on this device.');
    }

    if (this.active) {
      await this.cancelListening();
    }

    this.currentLanguage = options?.language || 'en';
    this.accumulatedText = '';
    this.interimText = '';

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.recognition = new SpeechRec();
    this.recognition.continuous = options?.continuous ?? false;
    this.recognition.interimResults = options?.interimResults ?? true;
    this.recognition.lang = this.mapLanguageCode(this.currentLanguage);

    this.recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        if (item.isFinal) {
          final += item[0].transcript + ' ';
        } else {
          interim += item[0].transcript;
        }
      }

      if (final) {
        this.accumulatedText += final;
      }
      this.interimText = interim;

      if (onInterim) {
        onInterim((this.accumulatedText + ' ' + interim).trim());
      }
    };

    this.recognition.onerror = (event: any) => {
      this.active = false;
      if (onError) {
        onError(new Error(event?.error || 'Speech recognition error'));
      }
    };

    this.recognition.onend = () => {
      this.active = false;
    };

    try {
      this.active = true;
      this.recognition.start();
    } catch (err: any) {
      this.active = false;
      throw err;
    }
  }

  async stopListening(): Promise<VoiceTranscript | null> {
    if (!this.recognition || !this.active) {
      return null;
    }

    return new Promise<VoiceTranscript | null>((resolve) => {
      const finish = () => {
        this.active = false;
        const total = (this.accumulatedText + ' ' + this.interimText).trim();
        if (!total) {
          resolve(null);
          return;
        }
        resolve({
          id: `vt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          text: total,
          language: this.currentLanguage,
          confidence: 0.9,
          createdAt: Date.now(),
          source: 'voice',
        });
      };

      this.recognition.onend = finish;
      try {
        this.recognition.stop();
      } catch {
        finish();
      }
    });
  }

  async cancelListening(): Promise<void> {
    if (!this.recognition) return;
    this.active = false;
    try {
      this.recognition.abort();
    } catch {
      // Ignore abort errors
    }
  }
}

import { RemoteSpeechToTextProvider } from './remoteSTTProvider';

/**
 * Creates the appropriate STT provider based on platform support.
 * Uses real server-side transcription (RemoteSpeechToTextProvider) when in browser runtime.
 */
export function createDefaultSTTProvider(preferMock = false): SpeechToTextProvider {
  if (preferMock || typeof window === 'undefined') {
    return new MockSpeechToTextProvider();
  }
  if (typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)) {
    return new RemoteSpeechToTextProvider();
  }
  if (hasBrowserSpeechRecognition()) {
    return new BrowserSpeechToTextProvider();
  }
  return new MockSpeechToTextProvider();
}
