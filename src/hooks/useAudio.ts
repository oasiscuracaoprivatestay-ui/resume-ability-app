import { useRef, useState, useEffect, useCallback } from 'react';

/**
 * loadState tracks the *file* status, NOT playback:
 *   'loading' — audio source is being verified and loaded
 *   'ready'   — file confirmed and loaded, can be played
 *   'error'   — file does not exist or cannot be loaded
 *
 * Loading strategy:
 *   1. fetch(src, HEAD) to confirm file exists at HTTP level
 *   2. Only if fetch returns 200 → create Audio element and load
 *   3. Audio error event is a secondary fallback check
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
    let cancelled = false;

    // Reset states for new source
    setLoadState('loading');
    setIsPlaying(false);

    console.log('[useAudio] Loading:', src);

    // Step 1: Verify file exists via fetch HEAD
    fetch(src, { method: 'HEAD' })
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          console.warn('[useAudio] Fetch failed:', src, res.status);
          setLoadState('error');
          return;
        }

        console.log('[useAudio] Fetch OK:', src);

        // Step 2: File exists → create Audio element
        const audio = new Audio();
        audio.loop = true;
        audio.preload = 'auto';
        audioRef.current = audio;

        const onCanPlay = () => {
          if (cancelled) return;
          console.log('[useAudio] Ready:', src);
          setLoadState('ready');
          // Attempt autoplay
          audio.play()
            .then(() => {
              if (!cancelled) setIsPlaying(true);
            })
            .catch(() => {
              // Autoplay blocked — file is fine, user can press play
              if (!cancelled) setIsPlaying(false);
            });
        };

        const onError = () => {
          if (cancelled) return;
          // Secondary check: Audio element failed despite fetch success
          console.warn('[useAudio] Audio element error:', src);
          setLoadState('error');
          setIsPlaying(false);
        };

        audio.addEventListener('canplaythrough', onCanPlay, { once: true });
        audio.addEventListener('error', onError, { once: true });

        audio.src = src;
      })
      .catch(() => {
        if (cancelled) return;
        console.warn('[useAudio] Fetch network error:', src);
        setLoadState('error');
      });

    return () => {
      cancelled = true;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
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
