import { useRef, useState, useEffect, useCallback } from 'react';
import { useSpeech } from './useSpeech';

/**
 * Narration hook: tries premium audio first, falls back to browser TTS.
 *
 * Loading strategy:
 *   1. If audioSrc is null → speech mode immediately
 *   2. If audioSrc is provided:
 *      a. fetch(src, HEAD) to confirm file exists
 *      b. If 200 → create Audio element, wait for canplaythrough → mode = 'audio'
 *      c. If fetch fails OR Audio errors → mode = 'speech' (TTS fallback)
 *
 * No autoplay — playback starts only when toggle() is called.
 */
export type NarrationMode = 'checking' | 'audio' | 'speech';

export function useNarration(audioSrc: string | null, fallbackText: string) {
  const [mode, setMode] = useState<NarrationMode>(
    audioSrc ? 'checking' : 'speech',
  );

  // ── Premium audio element ──
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);

  // ── Browser TTS fallback ──
  const {
    isSpeaking,
    isAvailable: speechAvailable,
    toggle: toggleSpeech,
    stop: stopSpeech,
  } = useSpeech();

  // ── Probe premium audio file ──
  useEffect(() => {
    if (!audioSrc) {
      console.log('[useNarration] No audio src, using speech');
      setMode('speech');
      return;
    }

    let cancelled = false;

    setMode('checking');
    setAudioPlaying(false);

    console.log('[useNarration] Probing:', audioSrc);

    // Step 1: Verify file exists via fetch HEAD
    fetch(audioSrc, { method: 'HEAD' })
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          console.log('[useNarration] File not found, falling back to speech:', audioSrc, res.status);
          setMode('speech');
          return;
        }

        console.log('[useNarration] File exists:', audioSrc);

        // Step 2: File exists → create Audio element
        const audio = new Audio();
        audio.preload = 'auto';
        audioRef.current = audio;

        const onCanPlay = () => {
          if (cancelled) return;
          console.log('[useNarration] Audio ready:', audioSrc);
          setMode('audio');
        };

        const onError = () => {
          if (cancelled) return;
          console.warn('[useNarration] Audio element error despite fetch OK:', audioSrc);
          setMode('speech');
        };

        const onEnded = () => setAudioPlaying(false);

        audio.addEventListener('canplaythrough', onCanPlay, { once: true });
        audio.addEventListener('error', onError, { once: true });
        audio.addEventListener('ended', onEnded);

        audio.src = audioSrc;
      })
      .catch(() => {
        if (cancelled) return;
        console.warn('[useNarration] Fetch network error:', audioSrc);
        setMode('speech');
      });

    return () => {
      cancelled = true;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [audioSrc]);

  // ── Unified toggle ──
  const toggle = useCallback(() => {
    if (mode === 'audio' && audioRef.current) {
      if (audioPlaying) {
        audioRef.current.pause();
        setAudioPlaying(false);
      } else {
        audioRef.current
          .play()
          .then(() => setAudioPlaying(true))
          .catch(() => {});
      }
    } else if (mode === 'speech') {
      toggleSpeech(fallbackText);
    }
  }, [mode, audioPlaying, fallbackText, toggleSpeech]);

  // ── Unified stop ──
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setAudioPlaying(false);
    }
    stopSpeech();
  }, [stopSpeech]);

  // ── Unified state ──
  const isPlaying = mode === 'audio' ? audioPlaying : isSpeaking;
  const isAvailable =
    mode === 'audio' || (mode === 'speech' && speechAvailable);

  return { isPlaying, isAvailable, mode, toggle, stop };
}
