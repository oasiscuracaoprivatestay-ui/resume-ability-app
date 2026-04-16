import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Text-to-speech hook using the Web Speech API.
 * Completely separate from the file-based useAudio hook.
 *
 * - Does NOT autoplay
 * - toggle(text, lang) starts or stops speech
 * - Stops automatically on unmount
 * - Prefers softer, more natural voices when available
 */

/** BCP 47 language tag for each supported locale. */
const SPEECH_LANG: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
  nl: 'nl-NL',
};

/**
 * Ordered list of preferred voice-name substrings per locale.
 * The first available match wins. All comparisons are case-insensitive.
 * Falls back to the first voice that matches the BCP-47 language tag.
 */
const PREFERRED_VOICES: Record<string, string[]> = {
  en: [
    'samantha', // macOS / iOS — warm, natural
    'karen',    // macOS Australian — soft
    'moira',    // macOS Irish
    'zira',     // Windows — calm female
    'hazel',    // Windows UK
    'google us english female',
    'google uk english female',
    'ava',
    'allison',
    'victoria',
  ],
  es: [
    'mónica',   // macOS
    'paulina',  // macOS
    'google español female',
    'conchita', // AWS-style, sometimes exposed
  ],
  nl: [
    'xander',   // macOS
    'google nederlands',
    'ellen',
  ],
};

/** Pick the best available voice for a given locale. */
function pickVoice(locale: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const targetLang = SPEECH_LANG[locale] ?? 'en-US';
  const preferred = PREFERRED_VOICES[locale] ?? PREFERRED_VOICES.en;

  // 1. Try preferred voices by name substring
  for (const name of preferred) {
    const match = voices.find((v) =>
      v.name.toLowerCase().includes(name.toLowerCase()),
    );
    if (match) return match;
  }

  // 2. Try any voice matching the full BCP-47 tag (e.g. en-US)
  const langMatch = voices.find((v) => v.lang === targetLang);
  if (langMatch) return langMatch;

  // 3. Try any voice matching just the language prefix (e.g. "en")
  const prefix = targetLang.split('-')[0];
  const prefixMatch = voices.find((v) => v.lang.startsWith(prefix));
  if (prefixMatch) return prefixMatch;

  // 4. No match — let the browser decide
  return null;
}

export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // voices load asynchronously in most browsers; track when they are ready
  const [voicesReady, setVoicesReady] = useState(false);

  useEffect(() => {
    if (!isAvailable) return;

    const tryLoad = () => {
      if (window.speechSynthesis.getVoices().length > 0) {
        setVoicesReady(true);
      }
    };

    tryLoad(); // synchronous in some browsers
    window.speechSynthesis.addEventListener('voiceschanged', tryLoad);

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', tryLoad);
    };
  }, [isAvailable]);

  // Cancel any speech on unmount
  useEffect(() => {
    return () => {
      if (isAvailable) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isAvailable]);

  // Keep voicesReady in a ref so toggle() always reads the latest value
  const voicesReadyRef = useRef(voicesReady);
  voicesReadyRef.current = voicesReady;

  const toggle = useCallback(
    (text: string, locale = 'en') => {
      if (!isAvailable) return;

      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      } else {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        // ── Voice settings ──
        utterance.rate  = 0.82;  // noticeably slower, more deliberate
        utterance.pitch = 0.95;  // slightly lower than neutral → calmer
        utterance.volume = 1;
        utterance.lang  = SPEECH_LANG[locale] ?? 'en-US';

        // ── Voice selection ──
        if (voicesReadyRef.current) {
          const voice = pickVoice(locale);
          if (voice) utterance.voice = voice;
        }

        utterance.onend   = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        window.speechSynthesis.speak(utterance);
        setIsSpeaking(true);
      }
    },
    [isSpeaking, isAvailable],
  );

  const stop = useCallback(() => {
    if (isAvailable) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, [isAvailable]);

  return { isSpeaking, isAvailable, toggle, stop };
}
