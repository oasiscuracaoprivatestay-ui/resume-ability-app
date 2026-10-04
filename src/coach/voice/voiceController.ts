/**
 * SDA AI Coach — Voice Controller & Session Orchestrator (Phase 38A)
 *
 * Coordinates microphone input, transcript hand-off, and spoken response playback.
 *
 * Enforces Core Safety Principles:
 * 1. VOICE IS AN INPUT/OUTPUT MODALITY, NOT A SECOND COACH BRAIN.
 * 2. Transcribed speech is routed directly to coachEngine.sendMessage() — zero separate reasoning.
 * 3. Only final validated Coach messages may be spoken aloud via TTS.
 * 4. Microphones activate ONLY upon explicit user interaction (no silent or automatic listening).
 * 5. Zero raw audio stored in localStorage, context, or database.
 * 6. Action proposals generated from voice input STILL require user confirmation (preview-only).
 */

import type {
  AudioResponseType,
  SpeechToTextProvider,
  TextToSpeechOptions,
  TextToSpeechProvider,
  VoicePlayback,
  VoiceSessionConfig,
  VoiceSessionState,
  VoiceTranscript,
} from './types';
import { createDefaultSTTProvider, MockSpeechToTextProvider } from './speechToTextProvider';
import { createDefaultTTSProvider, MockTextToSpeechProvider } from './textToSpeechProvider';
import { getVoiceCapabilityStatus } from './voiceCapabilities';
import { coachEngine } from '../coachEngine';
import type { CoachResponse } from '../types';

export class VoiceController {
  private sttProvider: SpeechToTextProvider;
  private ttsProvider: TextToSpeechProvider;

  private config: VoiceSessionConfig = {
    language: 'en',
    interactionMode: 'push_to_talk',
    responseModality: 'text_and_voice',
    autoSendOnTranscript: true,
  };

  private state: VoiceSessionState = {
    inputState: 'idle',
    outputState: 'idle',
    capabilityStatus: 'ready',
    activeTranscript: null,
    activePlayback: null,
    lastError: null,
  };

  private listeners: Array<(state: VoiceSessionState) => void> = [];
  private autoStopTimer: any = null;
  private onAutoStopCallback: ((transcript: VoiceTranscript | null) => void) | null = null;

  constructor(
    sttProvider?: SpeechToTextProvider,
    ttsProvider?: TextToSpeechProvider
  ) {
    this.sttProvider = sttProvider || createDefaultSTTProvider();
    this.ttsProvider = ttsProvider || createDefaultTTSProvider();
    this.state.capabilityStatus = getVoiceCapabilityStatus();
  }

  private clearAutoStopTimer(): void {
    if (this.autoStopTimer) {
      clearTimeout(this.autoStopTimer);
      this.autoStopTimer = null;
    }
  }

  // ── Provider Configuration ──────────────────────────────────────────────────

  setSTTProvider(provider: SpeechToTextProvider): void {
    this.sttProvider = provider;
  }

  getSTTProvider(): SpeechToTextProvider {
    return this.sttProvider;
  }

  setTTSProvider(provider: TextToSpeechProvider): void {
    this.ttsProvider = provider;
  }

  getTTSProvider(): TextToSpeechProvider {
    return this.ttsProvider;
  }

  useMockProviders(): void {
    this.sttProvider = new MockSpeechToTextProvider();
    this.ttsProvider = new MockTextToSpeechProvider();
    this.updateState({ capabilityStatus: 'ready' });
  }

  // ── State Management & Subscription ────────────────────────────────────────

  getState(): VoiceSessionState {
    return { ...this.state };
  }

  getConfig(): VoiceSessionConfig {
    return { ...this.config };
  }

  setConfig(updates: Partial<VoiceSessionConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  subscribe(listener: (state: VoiceSessionState) => void): () => void {
    this.listeners.push(listener);
    listener(this.getState());
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private updateState(updates: Partial<VoiceSessionState>): void {
    this.state = { ...this.state, ...updates };
    this.listeners.forEach(l => l(this.getState()));
  }

  // ── Speech-To-Text (Voice Input) Lifecycle ──────────────────────────────────

  /**
   * Starts listening to user microphone after explicit user interaction.
   * Never called automatically.
   */
  async startListening(
    language: 'en' | 'es' | 'nl' = this.config.language,
    onInterim?: (partialText: string) => void,
    onAutoStop?: (transcript: VoiceTranscript | null) => void,
    maxDurationMs = 15000
  ): Promise<void> {
    if (this.state.inputState === 'listening' || this.state.inputState === 'transcribing') {
      return;
    }

    this.clearAutoStopTimer();
    this.onAutoStopCallback = onAutoStop || null;

    this.updateState({
      inputState: 'requesting_permission',
      lastError: null,
      activeTranscript: null,
    });

    try {
      await this.sttProvider.startListening(
        {
          language,
          continuous: false,
          interimResults: true,
        },
        (partial) => {
          this.updateState({ inputState: 'listening' });
          if (onInterim) onInterim(partial);
        },
        (err) => {
          this.clearAutoStopTimer();
          this.updateState({
            inputState: 'error',
            lastError: err.message,
          });
        }
      );

      // Verify that the provider is actually recording before establishing Listening state (Phase V1.1)
      if (typeof this.sttProvider.isListening === 'function' && !this.sttProvider.isListening()) {
        throw new Error('Audio recorder failed to enter active recording state.');
      }

      this.updateState({ inputState: 'listening' });

      // Lightweight 15-second safety auto-stop (Phase V1.1)
      this.autoStopTimer = setTimeout(async () => {
        if (this.state.inputState === 'listening') {
          console.log('[SDA-VOICE-CLIENT] 15-second safety auto-stop triggered');
          const cb = this.onAutoStopCallback;
          const transcript = await this.stopListening();
          if (cb) {
            cb(transcript);
          }
        }
      }, maxDurationMs);
    } catch (err: any) {
      this.clearAutoStopTimer();
      this.updateState({
        inputState: 'error',
        lastError: err?.message || 'Failed to start microphone',
      });
      throw err;
    }
  }

  /**
   * Stops listening, produces VoiceTranscript, and transitions to idle or complete.
   */
  async stopListening(): Promise<VoiceTranscript | null> {
    this.clearAutoStopTimer();

    if (this.state.inputState !== 'listening') {
      return null;
    }

    this.updateState({ inputState: 'transcribing' });

    try {
      const transcript = await this.sttProvider.stopListening();
      if (!transcript || !transcript.text.trim()) {
        this.updateState({ inputState: 'idle' });
        return null;
      }

      this.updateState({
        inputState: 'complete',
        activeTranscript: transcript,
      });

      // Reset to idle after brief completion state
      setTimeout(() => {
        if (this.state.inputState === 'complete') {
          this.updateState({ inputState: 'idle' });
        }
      }, 500);

      return transcript;
    } catch (err: any) {
      this.updateState({
        inputState: 'error',
        lastError: err?.message || 'Failed to transcribe speech',
      });
      return null;
    }
  }

  /**
   * Cancels active recording without producing a transcript.
   */
  async cancelListening(): Promise<void> {
    this.clearAutoStopTimer();
    await this.sttProvider.cancelListening();
    this.updateState({
      inputState: 'idle',
      activeTranscript: null,
    });
  }

  // ── Canonical Coach Integration ─────────────────────────────────────────────

  /**
   * Submits a spoken message through the CANONICAL Coach Engine.
   * Spoken and typed messages converge into the exact same brain.
   */
  async submitSpokenMessage(
    text: string,
    language: 'en' | 'es' | 'nl' = this.config.language,
    speakResponse = false,
    responseType: AudioResponseType = 'coach_response'
  ): Promise<CoachResponse> {
    const clean = text.trim();
    if (!clean) {
      throw new Error('Spoken message cannot be empty');
    }

    // 1. Send via existing CoachEngine
    const response = await coachEngine.sendMessage(clean, language);

    // 2. If voice output requested, pass the FINAL VALIDATED message to TTS
    if (speakResponse && response.message?.text) {
      await this.speakResponse(response.message.text, language, responseType, response.message.id);
    }

    return response;
  }

  // ── Text-To-Speech (Voice Output) Lifecycle ─────────────────────────────────

  /**
   * Speaks a validated Coach response aloud.
   * CRITICAL: Must ONLY be called with final, user-visible Coach text.
   */
  async speakResponse(
    text: string,
    language: 'en' | 'es' | 'nl' = this.config.language,
    responseType: AudioResponseType = 'coach_response',
    messageId?: string
  ): Promise<void> {
    const clean = text.trim();
    if (!clean) return;

    await this.stopSpeaking();

    const playback: VoicePlayback = {
      id: `vp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      messageId,
      text: clean,
      language,
      responseType,
      createdAt: Date.now(),
    };

    this.updateState({
      outputState: 'preparing',
      activePlayback: playback,
      lastError: null,
    });

    const options: TextToSpeechOptions = {
      language,
      onStart: () => {
        this.updateState({ outputState: 'speaking' });
      },
      onEnd: () => {
        this.updateState({
          outputState: 'complete',
          activePlayback: null,
        });
        setTimeout(() => {
          if (this.state.outputState === 'complete') {
            this.updateState({ outputState: 'idle' });
          }
        }, 200);
      },
      onError: (err) => {
        this.updateState({
          outputState: 'error',
          activePlayback: null,
          lastError: err.message,
        });
      },
    };

    try {
      await this.ttsProvider.speak(clean, options);
    } catch (err: any) {
      this.updateState({
        outputState: 'error',
        activePlayback: null,
        lastError: err?.message || 'Failed to synthesize speech',
      });
    }
  }

  async stopSpeaking(): Promise<void> {
    await this.ttsProvider.stop();
    this.updateState({
      outputState: 'idle',
      activePlayback: null,
    });
  }

  isPlaying(): boolean {
    return this.state.outputState === 'speaking' || this.ttsProvider.isPlaying();
  }

  isSpeakingMessage(messageId: string): boolean {
    return this.isPlaying() && this.state.activePlayback?.messageId === messageId;
  }
}

// Global Voice Controller Singleton
export const voiceController = new VoiceController();
