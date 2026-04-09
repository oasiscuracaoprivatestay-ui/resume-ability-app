import { useState, useEffect, useCallback } from 'react';
import type { Screen, ActiveSession } from '../types';
import { useAudio } from '../hooks/useAudio';
import ScreenHeader from '../components/ScreenHeader';
import TimerRing from '../components/TimerRing';
import './TimerScreen.css';

// ── Audio mode system ──

type AudioMode = 'motivation' | 'alternative' | 'music';

const AUDIO_MODES: AudioMode[] = ['motivation', 'alternative', 'music'];

const AUDIO_FILES: Record<AudioMode, string> = {
  motivation: '/audio/motivation-default.mp3',
  alternative: '/audio/guidance-alternative.mp3',
  music: '/audio/background-music.mp3',
};

const AUDIO_LABELS: Record<AudioMode, string> = {
  motivation: 'Motivational',
  alternative: 'Alternative',
  music: 'Music',
};

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
  // ── Audio mode state (persisted) ──
  const [audioMode, setAudioMode] = useState<AudioMode>(loadAudioMode);
  const audioSrc = AUDIO_FILES[audioMode];
  const { isPlaying, isMuted, isAvailable, togglePlay, toggleMute, stop: stopAudio } = useAudio(audioSrc);

  const handleAudioModeChange = (mode: AudioMode) => {
    setAudioMode(mode);
    saveAudioMode(mode);
  };

  // ── Countdown state (single + loop) ──
  const [remaining, setRemaining] = useState(
    session.mode === 'extended-fast' ? 0 : session.timerDuration,
  );
  const [currentBlock, setCurrentBlock] = useState(1);

  // ── Count-up state (extended-fast) ──
  const [elapsed, setElapsed] = useState(0);

  // ── Reset remaining on manual extension (single mode) ──
  useEffect(() => {
    if (session.mode === 'extended-fast') return;
    setRemaining(session.timerDuration);
  }, [session.timerDuration, session.extensions, session.mode]);

  // ── Countdown tick (single + loop) ──
  useEffect(() => {
    if (session.mode === 'extended-fast') return;
    if (remaining <= 0) return;

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
  }, [remaining > 0, session.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loop auto-restart ──
  useEffect(() => {
    if (session.mode !== 'loop') return;
    if (remaining !== 0) return;
    if (currentBlock >= session.loopBlocks) return; // all blocks done

    const timeout = setTimeout(() => {
      setCurrentBlock((prev) => prev + 1);
      setRemaining(session.timerDuration);
    }, 800);

    return () => clearTimeout(timeout);
  }, [remaining, currentBlock, session.mode, session.loopBlocks, session.timerDuration]);

  // ── Count-up tick (extended-fast) ──
  useEffect(() => {
    if (session.mode !== 'extended-fast') return;

    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [session.mode]);

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

  const ringProps = isCountUp
    ? { displaySeconds: elapsed, progress: 0, isCountUp: true }
    : {
        displaySeconds: remaining,
        progress:
          session.timerDuration > 0
            ? 1 - remaining / session.timerDuration
            : 0,
      };

  // ── Visibility rules ──
  const showExtend = session.mode === 'single';

  return (
    <div className="screen timer-screen">
      <ScreenHeader
        onBack={() => handleNavigate('mode')}
        onHome={() => handleNavigate('home')}
      />

      <div className="timer-content">
        {session.mode === 'loop' && (
          <div className="timer-block-indicator">
            Block {currentBlock} of {session.loopBlocks}
          </div>
        )}

        <TimerRing {...ringProps} />

        <p className="timer-message">Resume. Not postpone.</p>

        {isLoopDone && (
          <p className="timer-loop-done">All blocks completed</p>
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
                {AUDIO_LABELS[mode]}
              </button>
            ))}
          </div>

          {isAvailable && (
            <div className="audio-controls">
              <button
                id="btn-audio-play"
                className="audio-btn"
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
              >
                {isPlaying ? '⏸' : '▶'}
              </button>
              <button
                id="btn-audio-mute"
                className="audio-btn"
                onClick={toggleMute}
                aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
              >
                {isMuted ? '🔇' : '🔊'}
              </button>
            </div>
          )}
        </div>

        <div className="timer-actions">
          <button
            id="btn-recovered"
            className="btn btn-primary btn-large"
            onClick={handleComplete}
          >
            I'm back in control
          </button>
          {showExtend && (
            <button
              id="btn-extend"
              className="btn btn-secondary"
              onClick={onExtend}
            >
              +15 min
            </button>
          )}
          <button
            id="btn-relapse"
            className="btn-text"
            onClick={handleRelapse}
          >
            I ate again
          </button>
        </div>
      </div>
    </div>
  );
}
