/**
 * SDA AI Coach — Remote Text-To-Speech (TTS) Provider (Phase 38B)
 *
 * Implements real speech synthesis using the serverless endpoint POST /api/voice/synthesize.
 *
 * Safety & Privacy Guarantees:
 * 1. ONLY final validated user-visible Coach text is ever synthesized.
 * 2. Zero raw API keys in browser: uses serverless gateway.
 * 3. Explicit error transparency: If remote TTS fails, it reports the error directly
 *    and keeps the text visible. It DOES NOT silently switch providers.
 * 4. Audio lifecycle cleanup: Blob URLs are revoked immediately after playback finishes or stops.
 * 5. Single active playback: starting any new playback stops the previous one immediately.
 */

import type {
  TextToSpeechOptions,
  TextToSpeechProvider,
} from './types';

export class RemoteTextToSpeechProvider implements TextToSpeechProvider {
  readonly id = 'remote_openai_tts';
  readonly name = 'OpenAI Remote Speech Synthesis';

  private endpointUrl: string;
  private activeAudio: HTMLAudioElement | null = null;
  private activeBlobUrl: string | null = null;
  private playing = false;
  private paused = false;

  constructor(endpointUrl = '/api/voice/synthesize') {
    this.endpointUrl = endpointUrl;
  }

  isAvailable(): boolean {
    return typeof window !== 'undefined' && typeof Audio !== 'undefined';
  }

  isPlaying(): boolean {
    return this.playing || (this.activeAudio !== null && !this.activeAudio.paused);
  }

  async speak(text: string, options?: TextToSpeechOptions): Promise<void> {
    const clean = text.trim();
    if (!clean) return;

    await this.stop();

    try {
      const response = await fetch(this.endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: clean,
          language: options?.language || 'en',
          responseType: 'coach_response',
        }),
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.error || `Voice synthesis server responded with status ${response.status}`);
      }

      const audioBlob = await response.blob();
      this.activeBlobUrl = URL.createObjectURL(audioBlob);
      this.activeAudio = new Audio(this.activeBlobUrl);

      this.activeAudio.onplay = () => {
        this.playing = true;
        this.paused = false;
        if (options?.onStart) options.onStart();
      };

      this.activeAudio.onended = () => {
        this.cleanup();
        if (options?.onEnd) options.onEnd();
      };

      this.activeAudio.onerror = () => {
        this.cleanup();
        if (options?.onError) {
          options.onError(new Error('Audio playback error'));
        }
      };

      await this.activeAudio.play();
    } catch (err: any) {
      this.cleanup();
      if (options?.onError) {
        options.onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }

  async stop(): Promise<void> {
    if (this.activeAudio) {
      try {
        this.activeAudio.pause();
        this.activeAudio.currentTime = 0;
      } catch {
        // Ignore
      }
    }
    this.cleanup();
  }

  async pause(): Promise<void> {
    if (this.activeAudio && !this.activeAudio.paused) {
      this.activeAudio.pause();
      this.paused = true;
    }
  }

  async resume(): Promise<void> {
    if (this.activeAudio && this.paused) {
      await this.activeAudio.play();
      this.paused = false;
    }
  }

  private cleanup(): void {
    this.playing = false;
    this.paused = false;
    if (this.activeBlobUrl) {
      try {
        URL.revokeObjectURL(this.activeBlobUrl);
      } catch {
        // Ignore
      }
      this.activeBlobUrl = null;
    }
    this.activeAudio = null;
  }
}
