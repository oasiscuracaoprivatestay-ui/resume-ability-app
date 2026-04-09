import { useState, useEffect, useCallback } from 'react';
import type { Screen, ActiveSession } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import TimerRing from '../components/TimerRing';
import './TimerScreen.css';

interface TimerScreenProps {
  session: ActiveSession;
  onComplete: (durationSeconds: number) => void;
  onExtend: () => void;
  onRelapse: () => void;
  onNavigate: (screen: Screen) => void;
}

export default function TimerScreen({
  session,
  onComplete,
  onExtend,
  onRelapse,
  onNavigate,
}: TimerScreenProps) {
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
    const totalSeconds = Math.round((Date.now() - session.startedAt) / 1000);
    onComplete(totalSeconds);
  }, [session.startedAt, onComplete]);

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
        onBack={() => onNavigate('mode')}
        onHome={() => onNavigate('home')}
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
            onClick={onRelapse}
          >
            I ate again
          </button>
        </div>
      </div>
    </div>
  );
}
