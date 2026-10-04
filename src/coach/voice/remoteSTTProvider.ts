/**
 * SDA AI Coach — Remote Speech-To-Text (STT) Provider (Phase 38B)
 *
 * Implements real speech transcription using the serverless endpoint POST /api/voice/transcribe.
 *
 * Security & Data Flow:
 * Browser Microphone → AudioRecorder → Audio Blob in memory
 * → POST /api/voice/transcribe (server-side proxy handles provider credentials)
 * → VoiceTranscript (text enters canonical CoachEngine pipeline)
 * → Audio Blob is immediately discarded from memory.
 */

import type {
  SpeechToTextOptions,
  SpeechToTextProvider,
  VoiceTranscript,
} from './types';
import { AudioRecorder } from './audioRecorder';

/**
 * Asynchronously converts an audio Blob to a base64 payload string without data URI scheme.
 * Avoids CPU-intensive byte loops and large intermediate array allocations on mobile devices.
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        const commaIndex = result.indexOf(',');
        resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
      } else {
        reject(new Error('Unexpected FileReader result format during audio base64 conversion'));
      }
    };
    reader.onerror = () => {
      reject(reader.error || new Error('FileReader error during audio conversion'));
    };
    reader.readAsDataURL(blob);
  });
}

export class RemoteSpeechToTextProvider implements SpeechToTextProvider {
  readonly id = 'remote_openai_stt';
  readonly name = 'OpenAI Remote Speech Transcription';

  private recorder: AudioRecorder;
  private endpointUrl: string;
  private currentLanguage: 'en' | 'es' | 'nl' = 'en';

  constructor(endpointUrl = '/api/voice/transcribe') {
    this.recorder = new AudioRecorder();
    this.endpointUrl = endpointUrl;
  }

  isAvailable(): boolean {
    return typeof window !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
  }

  isListening(): boolean {
    return this.recorder.isRecording();
  }

  async startListening(
    options?: SpeechToTextOptions,
    _onInterim?: (partialText: string) => void,
    _onError?: (err: Error) => void
  ): Promise<void> {
    this.currentLanguage = options?.language || 'en';
    await this.recorder.start();
  }

  async stopListening(): Promise<VoiceTranscript | null> {
    const result = await this.recorder.stop();
    if (!result || !result.blob || result.blob.size === 0) {
      console.warn('[SDA-VOICE-CLIENT] empty_recording');
      return null;
    }

    try {
      console.log('[SDA-VOICE-CLIENT] transcription_requested', {
        mimeType: result.mimeType,
        blobSize: result.blob.size,
        language: this.currentLanguage,
      });

      // Browser-native asynchronous base64 conversion (Phase V1.1)
      const base64Audio = await blobToBase64(result.blob);

      const payload = {
        audioBase64: base64Audio,
        mimeType: result.mimeType,
        language: this.currentLanguage,
      };

      const response = await fetch(this.endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        console.error('[SDA-VOICE-CLIENT] transcription_failed', {
          status: response.status,
          mimeType: result.mimeType,
        });
        throw new Error(errorJson.error || `Voice transcription failed with status ${response.status}`);
      }

      const json = await response.json();
      const text = (json.text || '').trim();

      if (!text) {
        console.warn('[SDA-VOICE-CLIENT] transcription_empty', {
          mimeType: result.mimeType,
        });
        return null;
      }

      console.log('[SDA-VOICE-CLIENT] transcription_succeeded', {
        mimeType: result.mimeType,
        language: this.currentLanguage,
      });

      const transcript: VoiceTranscript = {
        id: `vt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        text,
        language: this.currentLanguage,
        confidence: typeof json.confidence === 'number' ? json.confidence : undefined,
        createdAt: Date.now(),
        source: 'voice',
      };

      return transcript;
    } catch (err: any) {
      console.error('[SDA-VOICE-CLIENT] transcription_failed', {
        message: err.message,
      });
      throw new Error(err.message || 'Voice transcription failed');
    }
  }

  async cancelListening(): Promise<void> {
    await this.recorder.cancel();
  }
}
