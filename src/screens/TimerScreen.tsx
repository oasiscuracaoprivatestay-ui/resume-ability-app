import { useState, useEffect, useCallback, useRef } from 'react';
import type { Screen, ActiveSession } from '../types';
import { useAudio } from '../hooks/useAudio';
import { useTranslation } from '../i18n';
import { localizeAudioPath } from '../utils/audioPath';
import ScreenHeader from '../components/ScreenHeader';
import TimerRing from '../components/TimerRing';
import './TimerScreen.css';

// ── Audio track system ──

type AudioMode = 'motivation' | 'alternative' | 'music';

interface Track {
  id: string;
  name: string;
  src: string;
  premium: boolean;
}

const AUDIO_MODES: AudioMode[] = ['motivation', 'alternative', 'music'];

const TRACKS: Record<AudioMode, Track[]> = {
  motivation: [
    { id: 'm1', name: 'Motivation 1', src: '/audio/motivation-1.mp3', premium: false },
    { id: 'm2', name: 'Motivation 2', src: '/audio/motivation-2.mp3', premium: false },
    { id: 'm3', name: 'Motivation 3', src: '/audio/motivation-3.mp3', premium: false },
    { id: 'm4', name: 'Motivation 4', src: '/audio/motivation-4.mp3', premium: false },
    { id: 'm5', name: 'Deep Focus', src: '', premium: true },
    { id: 'm6', name: 'Inner Strength', src: '', premium: true },
  ],
  alternative: [
    { id: 'a1', name: 'Alternative 1', src: '/audio/alternative-1.mp3', premium: false },
    { id: 'a2', name: 'Alternative 2', src: '/audio/alternative-2.mp3', premium: false },
    { id: 'a3', name: 'Calm Voice', src: '', premium: true },
    { id: 'a4', name: 'Guided Breath', src: '', premium: true },
  ],
  music: [
    { id: 'b1', name: 'Background 1', src: '/audio/background-1.mp3', premium: false },
    { id: 'b2', name: 'Background 2', src: '/audio/background-2.mp3', premium: false },
    { id: 'b3', name: 'Ambient Flow', src: '', premium: true },
    { id: 'b4', name: 'Night Rain', src: '', premium: true },
  ],
};

const AUDIO_LABEL_KEYS: Record<AudioMode, 'timer_motivational' | 'timer_alternative' | 'timer_music'> = {
  motivation: 'timer_motivational',
  alternative: 'timer_alternative',
  music: 'timer_music',
};

/** Get only playable (free) tracks for a mode. */
function getFreeTracks(mode: AudioMode): Track[] {
  return TRACKS[mode].filter((t) => !t.premium);
}

const AUDIO_MODE_KEY = 'resume-ability-audio-mode';

function loadAudioMode(): AudioMode {
  try {
    const saved = localStorage.getItem(AUDIO_MODE_KEY);
    if (saved === 'motivation' || saved === 'alternative' || saved === 'music') return saved;
  } catch { /* ignore */ }
  return 'motivation';
}

function saveAudioMode(mode: AudioMode) {
  try {
    localStorage.setItem(AUDIO_MODE_KEY, mode);
  } catch { /* ignore */ }
}

/** Pick a random free track, avoiding lastId if possible. */
function pickRandomTrack(mode: AudioMode, lastId: string | null): Track {
  const free = getFreeTracks(mode);
  if (free.length === 0) return TRACKS[mode][0]; // fallback
  if (free.length === 1) return free[0];
  const candidates = free.filter((t) => t.id !== lastId);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

const ADD_SECONDS = 15 * 60; // 15 minutes in seconds

// ── Component ──

interface TimerScreenProps {
  session: ActiveSession;
  onComplete: (durationSeconds: number, blocksCompleted?: number) => void;
  onExtend: () => void;
  onRelapse: (blocksCompleted?: number) => void;
  onNavigate: (screen: Screen) => void;
}

export default function TimerScreen({
  session,
  onComplete,
  onExtend,
  onRelapse,
  onNavigate,
}: TimerScreenProps) {
  // ── Translations ──
  const { lang, t } = useTranslation();

  // ── Audio mode state (persisted) ──
  const [audioMode, setAudioMode] = useState<AudioMode>(loadAudioMode);
  const [currentTrack, setCurrentTrack] = useState<Track>(() =>
    pickRandomTrack(loadAudioMode(), null),
  );

  // Ref to track current mode inside the onTrackEnd callback
  const audioModeRef = useRef<AudioMode>(audioMode);
  audioModeRef.current = audioMode;
  const lastTrackIdRef = useRef<string | null>(currentTrack.id);

  /** Pick next free track from current mode, avoiding consecutive repeat. */
  const advanceTrack = useCallback(() => {
    const mode = audioModeRef.current;
    const next = pickRandomTrack(mode, lastTrackIdRef.current);
    lastTrackIdRef.current = next.id;
    setCurrentTrack(next);
  }, []);

  // Resolve language-specific audio path — music is language-independent
  const localizedSrc =
    audioMode === 'music'
      ? currentTrack.src
      : localizeAudioPath(currentTrack.src, lang);

  const { isPlaying, isMuted, loadState, togglePlay, toggleMute, stop: stopAudio } =
    useAudio(localizedSrc, { onTrackEnd: advanceTrack });

  const handleAudioModeChange = (mode: AudioMode) => {
    setAudioMode(mode);
    saveAudioMode(mode);
    const next = pickRandomTrack(mode, lastTrackIdRef.current);
    lastTrackIdRef.current = next.id;
    setCurrentTrack(next);
  };

  /** Play a specific free track by id. */
  const handleTrackSelect = (track: Track) => {
    if (track.premium) {
      stopAudio();
      onNavigate('premium');
      return;
    }
    lastTrackIdRef.current = track.id;
    setCurrentTrack(track);
  };

  /** Manual skip — user taps "next" */
  const handleNextTrack = useCallback(() => {
    advanceTrack();
  }, [advanceTrack]);

  // ── Countdown state (single + loop) ──
  const [remaining, setRemaining] = useState(
    session.mode === 'extended-fast' ? 0 : session.timerDuration,
  );
  const [currentBlock, setCurrentBlock] = useState(1);
  const [blockToast, setBlockToast] = useState<string | null>(null);

  // ── Pause state — tracks whether the user has manually paused ──
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  isPausedRef.current = isPaused;

  // ── Block transition toast (loop mode) ──
  useEffect(() => {
    if (session.mode !== 'loop' || currentBlock <= 1) return;
    setBlockToast(t.timer_block_started.replace('{x}', String(currentBlock)));
    const timeout = setTimeout(() => setBlockToast(null), 2000);
    return () => clearTimeout(timeout);
  }, [currentBlock, session.mode, t]);

  // ── Count-up state (extended-fast) ──
  const [elapsed, setElapsed] = useState(0);

  // ── Reset remaining on manual extension (single mode) ──
  // Note: we do NOT reset on session.timerDuration changes caused by +15
  // because +15 is additive. We only respond to session.extensions (onExtend).
  const prevExtensionsRef = useRef(session.extensions ?? 0);
  useEffect(() => {
    if (session.mode === 'extended-fast') return;
    const prev = prevExtensionsRef.current;
    const curr = session.extensions ?? 0;
    if (curr !== prev) {
      // onExtend was called — reset to fresh block
      prevExtensionsRef.current = curr;
      setRemaining(session.timerDuration);
      setIsPaused(false);
    }
  }, [session.extensions, session.timerDuration, session.mode]);

  // ── Countdown tick (single + loop) — respects pause ──
  useEffect(() => {
    if (session.mode === 'extended-fast') return;
    if (remaining <= 0) return;
    if (isPaused) return; // ← paused: stop the tick

    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [remaining > 0, isPaused, session.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loop auto-restart ──
  useEffect(() => {
    if (session.mode !== 'loop') return;
    if (remaining !== 0) return;
    if (isPaused) return;
    if (currentBlock >= session.loopBlocks) return; // all blocks done

    const timeout = setTimeout(() => {
      setCurrentBlock((prev) => prev + 1);
      setRemaining(session.timerDuration);
    }, 800);

    return () => clearTimeout(timeout);
  }, [remaining, currentBlock, isPaused, session.mode, session.loopBlocks, session.timerDuration]);

  // ── Count-up tick (extended-fast) — also respects pause ──
  useEffect(() => {
    if (session.mode !== 'extended-fast') return;
    if (isPaused) return;

    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [session.mode, isPaused]);

  // ── Timer controls ──

  /** Toggle pause / resume. Does NOT touch audio. */
  const handleTogglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  /**
   * +15 min: ADDS 15 minutes to the current remaining time.
   * Stacks on each press: 10 → 25 → 40 → ...
   * Also resumes the timer if it was paused.
   */
  const handleAdd15 = useCallback(() => {
    setRemaining((prev) => prev + ADD_SECONDS);
    setIsPaused(false); // resume if paused
  }, []);

  /**
   * Reset: returns to the original session duration (15 min / custom).
   * Respects current pause state — does not auto-unpause.
   */
  const handleReset = useCallback(() => {
    setRemaining(session.timerDuration);
    // intentionally does NOT touch isPaused —
    // if the timer was paused, it stays paused at the fresh duration
  }, [session.timerDuration]);

  // ── Wall-clock elapsed for completion ──
  const handleComplete = useCallback(() => {
    stopAudio();
    const totalSeconds = Math.round((Date.now() - session.startedAt) / 1000);
    const blocks = session.mode === 'loop' ? currentBlock : undefined;
    onComplete(totalSeconds, blocks);
  }, [session.startedAt, session.mode, currentBlock, onComplete, stopAudio]);

  // ── Relapse handler ──
  const handleRelapse = useCallback(() => {
    stopAudio();
    const blocks = session.mode === 'loop' ? currentBlock : undefined;
    onRelapse(blocks);
  }, [session.mode, currentBlock, onRelapse, stopAudio]);

  // ── Navigation with audio cleanup ──
  const handleNavigate = useCallback((target: Screen) => {
    stopAudio();
    onNavigate(target);
  }, [onNavigate, stopAudio]);

  // ── Compute ring props ──
  const isCountUp = session.mode === 'extended-fast';
  const isLoopDone =
    session.mode === 'loop' &&
    remaining === 0 &&
    currentBlock >= session.loopBlocks;

  // For the ring, use the initial session duration as the cycle reference
  // so +15 extensions expand the ring gracefully rather than jumping back
  const ringTotal = session.timerDuration;
  const ringProgress = isCountUp
    ? 0
    : ringTotal > 0
      ? Math.min(1, 1 - remaining / ringTotal) // clamps at 0 minimum via Math.min if remaining > ringTotal
      : 0;

  const ringProps = isCountUp
    ? { displaySeconds: elapsed, progress: 0, isCountUp: true }
    : {
        displaySeconds: remaining,
        progress: remaining > ringTotal ? 0 : ringProgress,
      };

  // ── Visibility rules ──
  const isCountdown = session.mode !== 'extended-fast';

  return (
    <div className="screen timer-screen">
      <ScreenHeader
        onBack={() => handleNavigate('mode')}
        onHome={() => handleNavigate('home')}
      />

      <div className="timer-content">
        {session.mode === 'loop' && (
          <>
            <div className="timer-block-indicator" key={currentBlock}>
              {t.timer_block_of.replace('{x}', String(currentBlock)).replace('{y}', String(session.loopBlocks))}
            </div>
            {blockToast && (
              <p className="timer-block-toast" key={`toast-${currentBlock}`}>
                {blockToast}
              </p>
            )}
          </>
        )}

        <TimerRing {...ringProps} />

        {/* ── Timer controls: +15 | Pause/Resume | Reset ── */}
        {isCountdown && (
          <div className="timer-controls">
            <button
              id="btn-add15"
              className="timer-ctrl-btn timer-ctrl-btn--add"
              onClick={handleAdd15}
              aria-label="Add 15 minutes"
            >
              {t.timer_add15}
            </button>
            <button
              id="btn-pause"
              className={`timer-ctrl-btn timer-ctrl-btn--primary${isPaused ? ' timer-ctrl-btn--paused' : ''}`}
              onClick={handleTogglePause}
              aria-label={isPaused ? t.timer_resume : t.timer_pause}
            >
              {isPaused ? '▶' : '⏸'}
              <span className="timer-ctrl-label">
                {isPaused ? t.timer_resume : t.timer_pause}
              </span>
            </button>
            <button
              id="btn-reset"
              className="timer-ctrl-btn timer-ctrl-btn--reset"
              onClick={handleReset}
              aria-label="Reset timer"
            >
              {t.timer_reset}
            </button>
          </div>
        )}

        {isPaused && isCountdown && (
          <p className="timer-paused-label">— {t.timer_pause.toUpperCase()} —</p>
        )}

        <p className="timer-message">{t.timer_message}</p>

        {isLoopDone && (
          <p className="timer-loop-done">{t.timer_all_blocks}</p>
        )}

        {/* ── Audio mode selector + controls ── */}
        <div className="audio-section">
          <div className="audio-mode-selector">
            {AUDIO_MODES.map((mode) => (
              <button
                key={mode}
                className={`audio-mode-pill${audioMode === mode ? ' audio-mode-pill--active' : ''}`}
                onClick={() => handleAudioModeChange(mode)}
              >
                {t[AUDIO_LABEL_KEYS[mode]]}
              </button>
            ))}
          </div>

          <div className="audio-controls">
            <button
              id="btn-audio-play"
              className={`audio-btn${loadState !== 'ready' ? ' audio-btn--disabled' : ''}`}
              onClick={togglePlay}
              disabled={loadState !== 'ready'}
              aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button
              id="btn-audio-next"
              className={`audio-btn${loadState !== 'ready' ? ' audio-btn--disabled' : ''}`}
              onClick={handleNextTrack}
              disabled={loadState !== 'ready'}
              aria-label="Next track"
            >
              ⏭
            </button>
            <button
              id="btn-audio-mute"
              className={`audio-btn${loadState !== 'ready' ? ' audio-btn--disabled' : ''}`}
              onClick={toggleMute}
              disabled={loadState !== 'ready'}
              aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
            >
              {isMuted ? '🔇' : '🔊'}
            </button>
          </div>
          {loadState === 'error' && (
            <p className="audio-error">{t.timer_audio_error}</p>
          )}

          {/* ── Mini playlist ── */}
          <div className="playlist-panel">
            {TRACKS[audioMode].map((track) => (
              <button
                key={track.id}
                className={`playlist-track${
                  track.id === currentTrack.id ? ' playlist-track--active' : ''
                }${track.premium ? ' playlist-track--locked' : ''}`}
                onClick={() => handleTrackSelect(track)}
              >
                <span className="playlist-track-name">{track.name}</span>
                {track.premium && <span className="playlist-lock">🔒 Premium</span>}
                {!track.premium && track.id === currentTrack.id && isPlaying && (
                  <span className="playlist-playing">♫</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="timer-actions">
          <button
            id="btn-recovered"
            className="btn btn-primary btn-large"
            onClick={handleComplete}
          >
            {t.timer_recovered}
          </button>
          {session.mode === 'single' && (
            <button
              id="btn-extend"
              className="btn btn-secondary"
              onClick={onExtend}
            >
              {t.timer_extend}
            </button>
          )}
          <button
            id="btn-relapse"
            className="btn-text"
            onClick={handleRelapse}
          >
            {t.timer_relapsed}
          </button>
        </div>
      </div>
    </div>
  );
}
