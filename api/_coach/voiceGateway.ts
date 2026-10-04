/**
 * SDA AI Coach — Server-Side Voice Gateway (Phase 38B)
 *
 * Secure server-side processing for Speech-To-Text (STT) and Text-To-Speech (TTS).
 *
 * Security & Safety Principles:
 * 1. ZERO client-side secrets: AI_API_KEY remains strictly server-side.
 * 2. ZERO permanent audio persistence: audio is processed in-memory and discarded.
 * 3. Bounded limits: enforces audio size (10 MB max), TTS text length (2000 chars max), and request timeouts.
 * 4. Grounded vocabulary prompt: provides canonical SDA terms to STT without proprietary manuscript leaks.
 * 5. ONLY validated Coach response text may be synthesized via TTS.
 */

export const MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_TTS_TEXT_LENGTH = 2000;
export const VOICE_GATEWAY_TIMEOUT_MS = 15000;

export const DEFAULT_STT_MODEL = process.env.AI_VOICE_STT_MODEL || 'gpt-4o-transcribe';
export const DEFAULT_TTS_MODEL = process.env.AI_VOICE_TTS_MODEL || 'gpt-4o-mini-tts';
export const DEFAULT_TTS_VOICE = process.env.AI_VOICE_TTS_VOICE || 'alloy';

export const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/mp4',
  'audio/ogg',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mpeg',
  'audio/mp3',
];

export const SDA_VOCABULARY_PROMPT =
  'Resume-Ability, Loss-Maintenance Ability, Appetite-Fix Ability, Insulin-Aware Ability, ' +
  'Keto-Switching Ability, Circadian Eating Ability, Micro-Fasting Ability, ' +
  'Structured Diet, Slippery Zone, Non-Negotiable, 20% OFF TRACK.';

export interface NormalizedTranscriptDTO {
  text: string;
  language: 'en' | 'es' | 'nl';
  confidence: number | null;
  provider: 'openai' | 'mock';
}

export interface TranscribeRequestDTO {
  audioBase64?: string;
  mimeType?: string;
  language?: 'en' | 'es' | 'nl';
}

export interface SynthesizeRequestDTO {
  text: string;
  language?: 'en' | 'es' | 'nl';
  responseType?: 'coach_response' | 'motivation' | 'advice';
}

/**
 * Validates audio MIME type.
 */
export function isValidAudioMimeType(mime: string): boolean {
  if (!mime) return false;
  const normalized = mime.toLowerCase().split(';')[0].trim();
  return ALLOWED_AUDIO_MIME_TYPES.some(allowed => allowed.split(';')[0].trim() === normalized);
}

/**
 * Handles incoming STT transcription requests.
 */
export async function handleTranscribeVoice(
  payload: TranscribeRequestDTO,
  rawAudioBuffer?: Buffer
): Promise<{ status: number; body: Record<string, unknown> }> {
  const language = payload.language || 'en';
  let audioBuffer: Buffer;
  let mimeType = payload.mimeType || 'audio/webm';

  if (rawAudioBuffer && rawAudioBuffer.length > 0) {
    audioBuffer = rawAudioBuffer;
  } else if (payload.audioBase64) {
    try {
      audioBuffer = Buffer.from(payload.audioBase64, 'base64');
    } catch {
      return {
        status: 400,
        body: { error: 'Invalid base64 audio encoding', code: 'INVALID_AUDIO_DATA' },
      };
    }
  } else {
    return {
      status: 400,
      body: { error: 'Missing audio payload', code: 'MISSING_AUDIO_PAYLOAD' },
    };
  }

  // Size limit validation
  if (audioBuffer.length === 0) {
    return {
      status: 400,
      body: { error: 'Empty audio buffer', code: 'EMPTY_AUDIO' },
    };
  }

  if (audioBuffer.length > MAX_AUDIO_SIZE_BYTES) {
    return {
      status: 413,
      body: { error: 'Audio file exceeds 10 MB limit', code: 'PAYLOAD_TOO_LARGE' },
    };
  }

  // MIME validation
  if (!isValidAudioMimeType(mimeType)) {
    return {
      status: 415,
      body: { error: `Unsupported audio MIME type: ${mimeType}`, code: 'UNSUPPORTED_MEDIA_TYPE' },
    };
  }

  const apiKey = (process.env.AI_API_KEY || process.env.AI_PROVIDER_API_KEY || '').trim();

  // If no API key configured, return diagnostic failure
  if (!apiKey) {
    return {
      status: 503,
      body: {
        error: 'Voice transcription service unavailable: AI_API_KEY not configured.',
        failureCategory: 'KEY_NOT_CONFIGURED',
      },
    };
  }

  const model = DEFAULT_STT_MODEL;
  const startTime = Date.now();

  console.log('[SDA_VOICE_STT] Transcription requested', {
    mimeType,
    byteSize: audioBuffer.length,
    language,
  });

  try {
    const extension = mimeType.includes('mp4') ? 'mp4' : (mimeType.includes('ogg') ? 'ogg' : (mimeType.includes('wav') ? 'wav' : 'webm'));
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: mimeType });
    formData.append('file', blob, `recording.${extension}`);
    formData.append('model', model);
    formData.append('prompt', SDA_VOCABULARY_PROMPT);
    if (language) {
      formData.append('language', language);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), VOICE_GATEWAY_TIMEOUT_MS);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.error('[SDA_VOICE_STT] Provider failure', {
        mimeType,
        byteSize: audioBuffer.length,
        providerStatus: response.status,
        durationMs: Date.now() - startTime,
      });
      return {
        status: response.status >= 500 ? 502 : response.status,
        body: {
          error: 'Transcription provider error',
          code: 'PROVIDER_ERROR',
          providerStatus: response.status,
          details: errText.slice(0, 200),
        },
      };
    }

    const json = (await response.json()) as { text?: string };
    const transcribedText = (json.text || '').trim();
    const emptyTranscript = transcribedText.length === 0;

    console.log('[SDA_VOICE_STT] Provider success', {
      mimeType,
      byteSize: audioBuffer.length,
      providerStatus: response.status,
      emptyTranscript,
      durationMs: Date.now() - startTime,
    });

    const normalized: NormalizedTranscriptDTO = {
      text: transcribedText,
      language,
      confidence: null, // OpenAI transcription does not return token confidence scores
      provider: 'openai',
    };

    return {
      status: 200,
      body: normalized as unknown as Record<string, unknown>,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.error('[SDA_VOICE_STT] Transcription timeout', {
        mimeType,
        byteSize: audioBuffer.length,
        durationMs: Date.now() - startTime,
      });
      return {
        status: 504,
        body: { error: 'Voice transcription timed out', code: 'TIMEOUT' },
      };
    }
    console.error('[SDA_VOICE_STT] Network failure', {
      mimeType,
      byteSize: audioBuffer.length,
      error: err?.message || 'NETWORK_ERROR',
      durationMs: Date.now() - startTime,
    });
    return {
      status: 502,
      body: { error: 'Failed to communicate with voice transcription provider', code: 'NETWORK_ERROR' },
    };
  }
}

/**
 * Handles incoming TTS speech synthesis requests.
 */
export async function handleSynthesizeVoice(
  payload: SynthesizeRequestDTO
): Promise<{ status: number; contentType: string; buffer?: Buffer; errorBody?: Record<string, unknown> }> {
  const text = (payload.text || '').trim();

  if (!text) {
    return {
      status: 400,
      contentType: 'application/json',
      errorBody: { error: 'Text cannot be empty', code: 'EMPTY_TEXT' },
    };
  }

  if (text.length > MAX_TTS_TEXT_LENGTH) {
    return {
      status: 400,
      contentType: 'application/json',
      errorBody: { error: `Text exceeds maximum length of ${MAX_TTS_TEXT_LENGTH} characters`, code: 'TEXT_TOO_LONG' },
    };
  }

  const apiKey = (process.env.AI_API_KEY || process.env.AI_PROVIDER_API_KEY || '').trim();

  if (!apiKey) {
    return {
      status: 503,
      contentType: 'application/json',
      errorBody: {
        error: 'Voice synthesis service unavailable: AI_API_KEY not configured.',
        failureCategory: 'KEY_NOT_CONFIGURED',
      },
    };
  }

  const model = DEFAULT_TTS_MODEL;
  const voice = DEFAULT_TTS_VOICE;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), VOICE_GATEWAY_TIMEOUT_MS);

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: text,
        voice,
        response_format: 'mp3',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      return {
        status: response.status >= 500 ? 502 : response.status,
        contentType: 'application/json',
        errorBody: {
          error: 'Voice synthesis provider error',
          code: 'PROVIDER_ERROR',
          providerStatus: response.status,
          details: errText.slice(0, 200),
        },
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
      status: 200,
      contentType: 'audio/mpeg',
      buffer,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return {
        status: 504,
        contentType: 'application/json',
        errorBody: { error: 'Voice synthesis timed out', code: 'TIMEOUT' },
      };
    }
    return {
      status: 502,
      contentType: 'application/json',
      errorBody: { error: 'Failed to communicate with voice synthesis provider', code: 'NETWORK_ERROR' },
    };
  }
}
