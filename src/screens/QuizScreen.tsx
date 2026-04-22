import { useState } from 'react';
import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import ScreenHeader from '../components/ScreenHeader';
import './QuizScreen.css';

interface QuizScreenProps {
  onNavigate: (screen: Screen) => void;
}

type Step = 'start' | 'question' | 'result';

// Option index 0 = 1pt, index 4 = 5pt
function scoreLabel(score: number): 'strong' | 'moderate' | 'needs' {
  if (score >= 20) return 'strong';
  if (score >= 12) return 'moderate';
  return 'needs';
}

// Progress bar colour per tier
const TIER_COLOUR = {
  strong:   'var(--success)',
  moderate: 'var(--accent)',
  needs:    'var(--danger)',
} as const;

const TIER_EMOJI = { strong: '💪', moderate: '📈', needs: '🎯' } as const;

export default function QuizScreen({ onNavigate }: QuizScreenProps) {
  const { t } = useTranslation();

  const [step, setStep]               = useState<Step>('start');
  const [qIndex, setQIndex]           = useState(0);
  const [answers, setAnswers]         = useState<number[]>([]); // 1-5 per question
  const [selected, setSelected]       = useState<number | null>(null); // option for current q

  const questions = t.quiz_questions;
  const totalQuestions = questions.length;

  // ── handlers ──────────────────────────────────────────────────────────────

  const handleStart = () => {
    setQIndex(0);
    setAnswers([]);
    setSelected(null);
    setStep('question');
  };

  const handleSelect = (optionIndex: number) => {
    setSelected(optionIndex);
  };

  const handleNext = () => {
    if (selected === null) return;
    const points = selected + 1; // 0-indexed → 1-5
    const nextAnswers = [...answers, points];

    if (qIndex + 1 < totalQuestions) {
      setAnswers(nextAnswers);
      setQIndex(qIndex + 1);
      setSelected(null);
    } else {
      setAnswers(nextAnswers);
      setStep('result');
    }
  };

  const handleRetake = () => {
    setStep('start');
    setQIndex(0);
    setAnswers([]);
    setSelected(null);
  };

  // ── derived ───────────────────────────────────────────────────────────────

  const totalScore  = answers.reduce((s, v) => s + v, 0);
  const tier        = scoreLabel(totalScore);
  const maxScore    = totalQuestions * 5; // 25
  const pct         = Math.round((totalScore / maxScore) * 100);
  const progress    = ((qIndex) / totalQuestions) * 100; // question progress bar

  const tierLabel = {
    strong:   t.quiz_result_strong,
    moderate: t.quiz_result_moderate,
    needs:    t.quiz_result_needs,
  }[tier];

  const tierBody = {
    strong:   t.quiz_result_strong_body,
    moderate: t.quiz_result_moderate_body,
    needs:    t.quiz_result_needs_body,
  }[tier];

  // ── render ────────────────────────────────────────────────────────────────

  // ── START ──
  if (step === 'start') {
    return (
      <div className="screen quiz-screen">
        <ScreenHeader
          onBack={() => onNavigate('home')}
          onHome={() => onNavigate('home')}
        />
        <div className="quiz-start-content">
          <span className="section-label">{t.quiz_start_label}</span>
          <h1 className="quiz-start-heading">{t.quiz_start_heading}</h1>
          <p className="quiz-start-body">{t.quiz_start_body}</p>

          <ul className="quiz-start-meta">
            <li>✦ 5 questions</li>
            <li>✦ Under 1 minute</li>
            <li>✦ No account needed</li>
          </ul>

          <button
            id="btn-quiz-start"
            className="btn btn-primary btn-large quiz-start-btn"
            onClick={handleStart}
          >
            {t.quiz_start_btn}
          </button>
        </div>
      </div>
    );
  }

  // ── QUESTION ──
  if (step === 'question') {
    const currentQ = questions[qIndex];
    return (
      <div className="screen quiz-screen">
        <ScreenHeader
          onBack={() => {
            if (qIndex === 0) {
              setStep('start');
            } else {
              setQIndex(qIndex - 1);
              setAnswers(answers.slice(0, -1));
              setSelected(null);
            }
          }}
          onHome={() => onNavigate('home')}
        />

        {/* Progress bar */}
        <div className="quiz-progress-bar">
          <div
            className="quiz-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="quiz-q-content">
          <span className="quiz-q-counter">
            {t.quiz_q_label} {qIndex + 1} / {totalQuestions}
          </span>
          <h2 className="quiz-q-text">{currentQ.q}</h2>

          <div className="quiz-options">
            {currentQ.options.map((opt, i) => (
              <button
                key={i}
                id={`quiz-opt-${qIndex}-${i}`}
                className={`quiz-option${selected === i ? ' quiz-option--selected' : ''}`}
                onClick={() => handleSelect(i)}
              >
                <span className="quiz-option-dot" />
                <span className="quiz-option-text">{opt}</span>
                {/* Score hint: leftmost = weakest, rightmost = strongest */}
                <span className="quiz-option-pts">{i + 1}</span>
              </button>
            ))}
          </div>

          <button
            id="btn-quiz-next"
            className="btn btn-primary btn-large quiz-next-btn"
            disabled={selected === null}
            onClick={handleNext}
          >
            {qIndex + 1 < totalQuestions ? t.quiz_next : t.quiz_result_heading}
          </button>
        </div>
      </div>
    );
  }

  // ── RESULT ──
  return (
    <div className="screen quiz-screen">
      <ScreenHeader
        onBack={() => onNavigate('home')}
        onHome={() => onNavigate('home')}
      />

      <div className="quiz-result-content">
        <span className="section-label">{t.quiz_result_label}</span>
        <h1 className="quiz-result-heading">{t.quiz_result_heading}</h1>

        {/* Score ring / pill */}
        <div className="quiz-score-wrap">
          <div
            className="quiz-score-ring"
            style={{ '--tier-color': TIER_COLOUR[tier] } as React.CSSProperties}
          >
            <span className="quiz-score-emoji">{TIER_EMOJI[tier]}</span>
            <span className="quiz-score-num">{totalScore}</span>
            <span className="quiz-score-max">/ {maxScore}</span>
          </div>
          {/* Horizontal meter */}
          <div className="quiz-meter-wrap">
            <div
              className="quiz-meter-fill"
              style={{
                width: `${pct}%`,
                background: TIER_COLOUR[tier],
              }}
            />
          </div>
          <span className="quiz-meter-pct">{pct}%</span>
        </div>

        {/* Tier label */}
        <div
          className="quiz-tier-badge"
          style={{ borderColor: TIER_COLOUR[tier], color: TIER_COLOUR[tier] }}
        >
          {tierLabel}
        </div>

        {/* Explanation */}
        <p className="quiz-result-body">{tierBody}</p>

        {/* CTAs */}
        <div className="quiz-result-actions">
          <button
            id="btn-quiz-cta"
            className="btn btn-primary btn-large"
            onClick={() => onNavigate('home')}
          >
            {t.quiz_result_cta}
          </button>
          <button
            id="btn-quiz-retake"
            className="btn btn-ghost"
            onClick={handleRetake}
          >
            {t.quiz_result_retake}
          </button>
        </div>
      </div>
    </div>
  );
}
