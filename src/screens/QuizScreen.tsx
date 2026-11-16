import React, { useState } from 'react';
import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import { PremiumScreenHeader } from '../components/premium/PremiumScreenHeader';
import { AppIcon, type AppIconName } from '../components/icons/AppIcon';
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

const TIER_COLOUR = {
  strong: '#2dd4b3',
  moderate: '#38bdf8',
  needs: '#fbbf24',
} as const;

const TIER_ICONS: Record<'strong' | 'moderate' | 'needs', AppIconName> = {
  strong: 'award',
  moderate: 'bar-chart',
  needs: 'target',
};

const QUIZ_META_BY_LANG = {
  en: ['5 questions', 'Under 1 minute', 'No account needed'],
  es: ['5 preguntas', 'Menos de 1 minuto', 'Sin cuenta necesaria'],
  nl: ['5 vragen', 'Binnen 1 minuut', 'Geen account nodig'],
} as const;

export default function QuizScreen({ onNavigate }: QuizScreenProps) {
  const { t, lang } = useTranslation();

  const [step, setStep] = useState<Step>('start');
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);

  const questions = t.quiz_questions;
  const totalQuestions = questions.length;

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
    const points = selected + 1;
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

  const totalScore = answers.reduce((s, v) => s + v, 0);
  const tier = scoreLabel(totalScore);
  const maxScore = totalQuestions * 5;
  const pct = Math.round((totalScore / maxScore) * 100);
  const stepPct = Math.round(((qIndex + 1) / totalQuestions) * 100);

  const tierLabel = {
    strong: t.quiz_result_strong,
    moderate: t.quiz_result_moderate,
    needs: t.quiz_result_needs,
  }[tier];

  const tierBody = {
    strong: t.quiz_result_strong_body,
    moderate: t.quiz_result_moderate_body,
    needs: t.quiz_result_needs_body,
  }[tier];

  const metaItems = QUIZ_META_BY_LANG[lang] || QUIZ_META_BY_LANG.en;

  const homeRightAction = (
    <button
      id="btn-header-home"
      type="button"
      className="sda-premium-header__home-btn"
      onClick={() => onNavigate('home')}
      aria-label={t.btn_return_to_main || 'Go home'}
    >
      <AppIcon name="home" size={18} />
    </button>
  );

  // ── START / INTRO STEP ──
  if (step === 'start') {
    return (
      <div className="screen quiz-screen" id="quiz-screen-start">
        <PremiumScreenHeader
          className="sda-premium-header--compact"
          backId="btn-header-back"
          onBack={() => onNavigate('home')}
          backText={t.global_back || 'Back'}
          backAriaLabel={t.global_back || 'Go back'}
          title={t.quiz_start_label}
          showScoreBadge
          onNavigate={onNavigate}
          rightAction={homeRightAction}
        />

        <div className="quiz-body">
          <div className="quiz-intro-card">
            <div className="quiz-intro-top">
              <span className="quiz-intro-emblem" aria-hidden="true">
                <AppIcon name="target" size={22} strokeWidth={1.9} />
              </span>
              <span className="quiz-intro-eyebrow">{t.quiz_start_label}</span>
            </div>

            <h1 className="quiz-start-heading">{t.quiz_start_heading}</h1>
            <p className="quiz-start-body">{t.quiz_start_body}</p>

            <ul className="quiz-start-meta">
              <li>
                <AppIcon name="clipboard-list" size={14} strokeWidth={2} />
                <span>{metaItems[0]}</span>
              </li>
              <li>
                <AppIcon name="clock" size={14} strokeWidth={2} />
                <span>{metaItems[1]}</span>
              </li>
              <li>
                <AppIcon name="shield" size={14} strokeWidth={2} />
                <span>{metaItems[2]}</span>
              </li>
            </ul>

            <button
              id="btn-quiz-start"
              type="button"
              className="quiz-start-btn"
              onClick={handleStart}
            >
              <span>{t.quiz_start_btn}</span>
              <AppIcon name="arrow-right" size={17} strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── QUESTION STEP ──
  if (step === 'question') {
    const currentQ = questions[qIndex];
    const isNextDisabled = selected === null;

    return (
      <div className="screen quiz-screen" id="quiz-screen-question">
        <PremiumScreenHeader
          className="sda-premium-header--compact"
          backId="btn-header-back"
          onBack={() => {
            if (qIndex === 0) {
              setStep('start');
            } else {
              setQIndex(qIndex - 1);
              setAnswers(answers.slice(0, -1));
              setSelected(null);
            }
          }}
          backText={t.global_back || 'Back'}
          backAriaLabel={t.global_back || 'Go back'}
          title={t.quiz_start_label}
          showScoreBadge
          onNavigate={onNavigate}
          rightAction={homeRightAction}
        />

        <div className="quiz-body">
          {/* Upgraded Segmented Progress Card */}
          <div className="quiz-progress-card">
            <div className="quiz-progress-meta">
              <span className="quiz-q-counter">
                {t.quiz_q_label} {qIndex + 1} / {totalQuestions}
              </span>
              <span className="quiz-progress-pct">{stepPct}%</span>
            </div>
            <div className="quiz-segments" role="progressbar" aria-valuenow={qIndex + 1} aria-valuemin={1} aria-valuemax={totalQuestions}>
              {questions.map((_, idx) => {
                const state =
                  idx < qIndex
                    ? 'quiz-segment--done'
                    : idx === qIndex
                    ? 'quiz-segment--current'
                    : '';
                return <span key={idx} className={`quiz-segment ${state}`} />;
              })}
            </div>
          </div>

          <div className="quiz-q-card">
            <h2 className="quiz-q-text">{currentQ.q}</h2>

            <div className="quiz-options" role="radiogroup" aria-label={currentQ.q}>
              {currentQ.options.map((opt, i) => {
                const isSelected = selected === i;
                return (
                  <button
                    key={i}
                    id={`quiz-opt-${qIndex}-${i}`}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={`quiz-option${isSelected ? ' quiz-option--selected' : ''}`}
                    onClick={() => handleSelect(i)}
                  >
                    <span className="quiz-option-radio" aria-hidden="true">
                      {isSelected && <AppIcon name="check" size={12} strokeWidth={3} />}
                    </span>
                    <span className="quiz-option-text">{opt}</span>
                    <span className="quiz-option-pts" aria-hidden="true">
                      {i + 1}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              id="btn-quiz-next"
              type="button"
              className={`quiz-next-btn ${isNextDisabled ? 'quiz-next-btn--disabled' : 'quiz-next-btn--enabled'}`}
              disabled={isNextDisabled}
              onClick={handleNext}
            >
              <span>{qIndex + 1 < totalQuestions ? t.quiz_next : t.quiz_result_heading}</span>
              <AppIcon name="arrow-right" size={17} strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── RESULT STEP ──
  return (
    <div className="screen quiz-screen" id="quiz-screen-result">
      <PremiumScreenHeader
        className="sda-premium-header--compact"
        backId="btn-header-back"
        onBack={() => onNavigate('home')}
        backText={t.global_back || 'Back'}
        backAriaLabel={t.global_back || 'Go back'}
        title={t.quiz_result_label}
        showScoreBadge
        onNavigate={onNavigate}
        rightAction={homeRightAction}
      />

      <div className="quiz-body">
        <div className="quiz-result-card">
          <h1 className="quiz-result-heading">{t.quiz_result_heading}</h1>

          <div className="quiz-score-wrap">
            <div
              className="quiz-score-ring"
              style={{ '--tier-color': TIER_COLOUR[tier] } as React.CSSProperties}
            >
              <span className="quiz-score-icon" style={{ color: TIER_COLOUR[tier] }} aria-hidden="true">
                <AppIcon name={TIER_ICONS[tier]} size={20} strokeWidth={2} />
              </span>
              <span className="quiz-score-num">{totalScore}</span>
              <span className="quiz-score-max">/ {maxScore}</span>
            </div>

            <div className="quiz-meter-row">
              <div className="quiz-meter-wrap">
                <div
                  className="quiz-meter-fill"
                  style={{
                    width: `${pct}%`,
                    background: TIER_COLOUR[tier],
                  }}
                />
              </div>
              <span className="quiz-meter-pct" style={{ color: TIER_COLOUR[tier] }}>
                {pct}%
              </span>
            </div>

            <div
              className="quiz-tier-badge"
              style={{ borderColor: TIER_COLOUR[tier], color: TIER_COLOUR[tier] }}
            >
              {tierLabel}
            </div>
          </div>

          <p className="quiz-result-body">{tierBody}</p>

          <div className="quiz-result-actions">
            <button
              id="btn-quiz-cta"
              type="button"
              className="quiz-cta-btn"
              onClick={() => onNavigate('home')}
            >
              <span>{t.quiz_result_cta}</span>
              <AppIcon name="arrow-right" size={17} strokeWidth={2.2} />
            </button>
            <button
              id="btn-quiz-retake"
              type="button"
              className="quiz-retake-btn"
              onClick={handleRetake}
            >
              <AppIcon name="rotate-ccw" size={15} strokeWidth={2} />
              <span>{t.quiz_result_retake}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
