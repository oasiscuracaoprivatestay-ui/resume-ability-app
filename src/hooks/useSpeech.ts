import { useState, useEffect, useCallback } from 'react';

/**
 * Text-to-speech hook using the Web Speech API.
 * Completely separate from the file-based useAudio hook.
 *
 * - Does NOT autoplay
 * - toggle(text) starts or stops speech
 * - Stops automatically on unmount
 */
export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Cancel any speech on unmount
  useEffect(() => {
    return () => {
      if (isAvailable) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isAvailable]);

  const toggle = useCallback(
    (text: string) => {
      if (!isAvailable) return;

      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      } else {
        // Clear any leftover utterances
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.92;
        utterance.pitch = 1;
        utterance.lang = 'en-US';

        utterance.onend = () => setIsSpeaking(false);
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
