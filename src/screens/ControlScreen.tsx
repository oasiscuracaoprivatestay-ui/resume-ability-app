import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import ScreenHeader from '../components/ScreenHeader';
import { playFeedback } from '../utils/feedback';
import { generateId } from '../utils';
import { saveCommitEvent } from '../utils/inControlStorage';
import './ControlScreen.css';

interface ControlScreenProps {
  onNavigate: (screen: Screen) => void;
  onCommitSuccess?: () => void;
}

type ControlStep = 'control' | 'success';

const HOLD_MS = 2500;

export default function ControlScreen({ onNavigate, onCommitSuccess }: ControlScreenProps) {
  const { t } = useTranslation();

  const [step, setStep] = useState<ControlStep>('control');
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);

  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const holdCompletedRef = useRef(false);

  const message = useMemo(
    () => t.control_messages[Math.floor(Math.random() * t.control_messages.length)],
    [t],
  );

  // Cancel hold if released early or pointer leaves
  const cancelHold = useCallback(() => {
    if (holdCompletedRef.current) return;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    startRef.current = null;
    setHolding(false);
    setProgress(0);
  }, []);

  // Pointer hold mechanics
  const startHold = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (step !== 'control' || holdCompletedRef.current) return;
      setHolding(true);
      startRef.current = performance.now();

      const tick = (now: number) => {
        if (startRef.current === null) return;
        const p = Math.min((now - startRef.current) / HOLD_MS, 1);
        setProgress(p);

        if (p < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          holdCompletedRef.current = true;
          rafRef.current = null;
          startRef.current = null;
          setHolding(false);
          setProgress(1);

          playFeedback('commit');

          if (onCommitSuccess) {
            onCommitSuccess();
          } else {
            saveCommitEvent({
              id: generateId(),
              timestamp: Date.now(),
              source: 'in-control',
            });
          }

          setTimeout(() => {
            setStep('success');
          }, 250);
        }
      };

      rafRef.current = requestAnimationFrame(tick);
    },
    [step, onCommitSuccess],
  );

  // Keyboard accessibility
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if ((e.key === ' ' || e.key === 'Enter') && !holding && !holdCompletedRef.current) {
        e.preventDefault();
        setHolding(true);
        startRef.current = performance.now();

        const tick = (now: number) => {
          if (startRef.current === null) return;
          const p = Math.min((now - startRef.current) / HOLD_MS, 1);
          setProgress(p);

          if (p < 1) {
            rafRef.current = requestAnimationFrame(tick);
          } else {
            holdCompletedRef.current = true;
            rafRef.current = null;
            startRef.current = null;
            setHolding(false);
            setProgress(1);

            playFeedback('commit');

            if (onCommitSuccess) {
              onCommitSuccess();
            } else {
              saveCommitEvent({
                id: generateId(),
                timestamp: Date.now(),
                source: 'in-control',
              });
            }

            setTimeout(() => {
              setStep('success');
            }, 250);
          }
        };

        rafRef.current = requestAnimationFrame(tick);
      }
    },
    [holding, onCommitSuccess],
  );

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === ' ' || e.key === 'Enter') {
        cancelHold();
      }
    },
    [cancelHold],
  );

  // Clean up RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="screen control-screen">
      <ScreenHeader
        onBack={() => onNavigate('home')}
        onHome={() => onNavigate('home')}
      />

      {step === 'control' ? (
        <>
          <div className="control-content">
            <div className="control-heading">
              <span className="section-label">{t.control_badge}</span>
              <h2 className="control-title">{t.control_win_title}</h2>
              <p className="control-subtitle">{t.control_win_subtitle}</p>
            </div>
            <div className="control-celebration-container">
              <div className="control-pulse-ring control-pulse-ring--1" />
              <div className="control-pulse-ring control-pulse-ring--2" />
              <div className="control-icon-wrapper">
                <span className="control-icon">✓</span>
              </div>
            </div>

            <div className="control-message-card">
              <p className="control-message">"{message}"</p>
            </div>
          </div>

          <div className="control-actions">
            {/* ── Visual instruction prompt for hold action ── */}
            <div className="control-hold-instruction-block">
              <p className="control-hold-instruction">{t.commit_hold_instruction}</p>
              <span className="control-hold-arrow" aria-hidden="true">↓</span>
            </div>

            {/* ── Hold to Commit Action Button ── */}
            <button
              id="btn-control-commit"
              type="button"
              className={`btn btn-primary btn-large control-btn-commit ${holding ? 'control-btn-commit--holding' : ''}`}
              onPointerDown={startHold}
              onPointerUp={cancelHold}
              onPointerLeave={cancelHold}
              onPointerCancel={cancelHold}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              onContextMenu={(e) => e.preventDefault()}
              aria-label={`${t.control_btn_commit} - ${t.commit_btn_hold}`}
            >
              <div
                className="control-btn-progress-fill"
                style={{ width: `${progress * 100}%` }}
                aria-hidden="true"
              />
              <div className="control-btn-content">
                <span className="control-btn-icon" aria-hidden="true">⚡</span>
                <span className="control-btn-text">
                  {holding ? `${t.commit_btn_holding} ${Math.round(progress * 100)}%` : t.control_btn_commit}
                </span>
              </div>
            </button>

            <button
              id="btn-control-home"
              type="button"
              className="btn btn-secondary control-btn-home"
              onClick={() => onNavigate('home')}
            >
              {t.control_btn_home}
            </button>
          </div>
        </>
      ) : (
        /* ── Success Win Screen ── */
        <div className="commit-success-content" id="commit-success-screen">
          <div className="commit-success-icon-wrap">
            <span className="commit-success-icon">✓</span>
          </div>

          <span className="section-label">{t.commit_badge}</span>
          <h2 className="commit-success-heading">{t.commit_success_heading}</h2>
          <p className="commit-success-body">{t.commit_success_body}</p>

          <button
            id="btn-commit-home"
            className="commit-btn-home"
            onClick={() => onNavigate('home')}
          >
            {t.commit_btn_main_menu}
          </button>
        </div>
      )}
    </div>
  );
}

