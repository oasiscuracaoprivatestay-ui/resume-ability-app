import { useRef, useState, useEffect, useCallback } from 'react';
import { useSpeech } from './useSpeech';

/**
 * Narration hook: tries premium audio first, falls back to browser TTS.
 *
 * Mode resolution:
 *   1. If `audioSrc` is provided → probe the file
 *      - canplaythrough → mode = 'audio'   (use HTML5 Audio)
 *      - error         → mode = 'speech'   (fall back to TTS)
 *   2. If `audioSrc` is null     → mode = 'speech' immediately
 *
 * The caller gets a unified API regardless of which system is active.
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
      setMode('speech');
      return;
    }

    setMode('checking');
    setAudioPlaying(false);

    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;

    const onCanPlay = () => setMode('audio');
    const onError = () => setMode('speech');
    const onEnded = () => setAudioPlaying(false);

    audio.addEventListener('canplaythrough', onCanPlay, { once: true });
    audio.addEventListener('error', onError, { once: true });
    audio.addEventListener('ended', onEnded);

    audio.src = audioSrc;

    return () => {
      audio.removeEventListener('canplaythrough', onCanPlay);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('ended', onEnded);
      audio.pause();
      audioRef.current = null;
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
