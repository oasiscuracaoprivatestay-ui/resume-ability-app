import { useRef, useState, useEffect, useCallback } from 'react';

/**
 * loadState tracks the *file* status, NOT playback:
 *   'loading' — audio source is being fetched
 *   'ready'   — file loaded, can be played
 *   'error'   — file could not be loaded (404, network, format)
 *
 * isPlaying tracks whether audio is currently playing.
 * These two concepts are fully independent.
 */
export type AudioLoadState = 'loading' | 'ready' | 'error';

export function useAudio(src: string) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [loadState, setLoadState] = useState<AudioLoadState>('loading');

  useEffect(() => {
    const audio = new Audio();
    audio.loop = true;
    audio.preload = 'auto';
    audioRef.current = audio;

    // Reset states for new source
    setLoadState('loading');
    setIsPlaying(false);

    const onCanPlay = () => {
      setLoadState('ready');
      // File confirmed loaded — attempt autoplay
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          // Autoplay blocked by browser policy — file is fine,
          // user can manually press play. Do NOT touch loadState.
          setIsPlaying(false);
        });
    };

    const onError = () => {
      // Genuine load failure (404, network, bad format)
      setLoadState('error');
      setIsPlaying(false);
    };

    audio.addEventListener('canplaythrough', onCanPlay, { once: true });
    audio.addEventListener('error', onError, { once: true });

    // Set src AFTER listeners are attached so we never miss events
    audio.src = src;

    return () => {
      audio.removeEventListener('canplaythrough', onCanPlay);
      audio.removeEventListener('error', onError);
      audio.pause();
      audioRef.current = null;
    };
  }, [src]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current || loadState !== 'ready') return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    }
  }, [isPlaying, loadState]);

  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  const stop = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
  }, []);

  return { isPlaying, isMuted, loadState, togglePlay, toggleMute, stop };
}
