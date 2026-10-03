/**
 * SDA AI Coach — Voice Domain Types (Phase 38A)
 *
 * Provider-independent architecture for voice chat, voice responses,
 * audio motivation, and audio advice.
 *
 * Core Principle:
 * VOICE IS AN INPUT/OUTPUT MODALITY, NOT A SECOND COACH BRAIN.
 * Spoken transcripts enter the exact same canonical Coach pipeline as typed text.
 * Only final validated Coach responses are passed to text-to-speech.
 */

// ── Voice Capability & Lifecycle States ──────────────────────────────────────

export type VoiceCapabilityStatus =
  | 'unavailable'
  | 'planned'
  | 'ready'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'error';

export type VoiceInputState =
  | 'idle'
  | 'requesting_permission'
  | 'listening'
  | 'transcribing'
  | 'complete'
  | 'error';

export type VoiceOutputState =
  | 'idle'
  | 'preparing'
  | 'speaking'
  | 'paused'
  | 'complete'
  | 'error';

export type VoiceInteractionMode =
  | 'push_to_talk'
  | 'future_realtime';

export type AudioResponseType =
  | 'coach_response'
  | 'motivation'
  | 'advice';

export type ResponseModality =
  | 'text'
  | 'voice'
  | 'text_and_voice';

// ── Voice Transcripts & Playback Models ──────────────────────────────────────

export interface VoiceTranscript {
  id: string;
  text: string;
  language: 'en' | 'es' | 'nl';
  confidence?: number;
  createdAt: number;
  source: 'voice';
}

export interface VoicePlayback {
  id: string;
  messageId?: string;
  text: string;
  language: 'en' | 'es' | 'nl';
  responseType: AudioResponseType;
  createdAt: number;
}

// ── Speech-To-Text (STT) Contract ───────────────────────────────────────────

export interface SpeechToTextOptions {
  language?: 'en' | 'es' | 'nl';
  continuous?: boolean;
  interimResults?: boolean;
  timeoutMs?: number;
}

export interface SpeechToTextProvider {
  readonly id: string;
  readonly name: string;
  isAvailable(): boolean;
  startListening(
    options?: SpeechToTextOptions,
    onInterim?: (partialText: string) => void,
    onError?: (err: Error) => void
  ): Promise<void>;
  stopListening(): Promise<VoiceTranscript | null>;
  cancelListening(): Promise<void>;
  isListening(): boolean;
}

// ── Text-To-Speech (TTS) Contract ───────────────────────────────────────────

export interface TextToSpeechOptions {
  language?: 'en' | 'es' | 'nl';
  rate?: number;
  pitch?: number;
  volume?: number;
  voiceName?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: Error) => void;
}

export interface TextToSpeechProvider {
  readonly id: string;
  readonly name: string;
  isAvailable(): boolean;
  speak(text: string, options?: TextToSpeechOptions): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  isPlaying(): boolean;
}

// ── Future Realtime Voice Provider Abstraction ──────────────────────────────

export interface RealtimeVoiceSessionConfig {
  sessionId: string;
  language: 'en' | 'es' | 'nl';
  turnDetection?: 'server_vad' | 'client_push_to_talk';
  audioFormat?: 'pcm16' | 'opus';
  sampleRate?: number;
}

export interface RealtimeVoiceProvider {
  readonly id: string;
  readonly name: string;
  isAvailable(): boolean;
  connectSession(config: RealtimeVoiceSessionConfig): Promise<void>;
  disconnectSession(): Promise<void>;
  isConnected(): boolean;
}

// ── Voice Session Configuration & State ─────────────────────────────────────

export interface VoiceSessionConfig {
  language: 'en' | 'es' | 'nl';
  interactionMode: VoiceInteractionMode;
  responseModality: ResponseModality;
  autoSendOnTranscript: boolean;
}

export interface VoiceSessionState {
  inputState: VoiceInputState;
  outputState: VoiceOutputState;
  capabilityStatus: VoiceCapabilityStatus;
  activeTranscript: VoiceTranscript | null;
  activePlayback: VoicePlayback | null;
  lastError: string | null;
}
