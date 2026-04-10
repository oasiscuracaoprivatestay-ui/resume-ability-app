import { useMemo, useCallback } from 'react';
import type { Screen, SlipContext } from '../types';
import { SLIP_CONTEXT_ICONS } from '../types';
import { useTranslation } from '../i18n';
import { useNarration } from '../hooks/useNarration';
import ScreenHeader from '../components/ScreenHeader';
import './LearnScreen.css';

// ── Coaching category type ──

type CoachingCategory =
  | 'emotional'
  | 'trigger'
  | 'habit'
  | 'not_hungry'
  | 'loss_of_control';

interface CoachingSection {
  title: string;
  body: string;
}

interface CoachingContent {
  sections: CoachingSection[];
}

// ── Structured coaching data ──

const COACHING: Record<CoachingCategory, CoachingContent> = {
  emotional: {
    sections: [
      {
        title: 'What happened',
        body: "You didn't eat because your body needed fuel.\nYou reacted to a feeling.",
      },
      {
        title: 'Why it happens',
        body: 'Emotions create urgency.\nYour brain is trying to regulate discomfort quickly.',
      },
      {
        title: 'What this tests',
        body: 'This is your ability to stay present without reacting.',
      },
      {
        title: 'What to do next',
        body: 'Pause. Breathe. Wait 15 minutes.\nLet the emotion settle before you act again.',
      },
    ],
  },
  trigger: {
    sections: [
      {
        title: 'What happened',
        body: 'Something in your environment triggered the urge to eat.',
      },
      {
        title: 'Why it happens',
        body: 'Your brain links places, people, and moments with food.',
      },
      {
        title: 'What this tests',
        body: 'Your awareness and interruption ability.',
      },
      {
        title: 'What to do next',
        body: 'Step away. Break the pattern.\nChange your environment or delay the action.',
      },
    ],
  },
  habit: {
    sections: [
      {
        title: 'What happened',
        body: 'You followed a routine, not a real need.',
      },
      {
        title: 'Why it happens',
        body: 'Your brain runs automatic patterns to save energy.',
      },
      {
        title: 'What this tests',
        body: 'Your ability to interrupt autopilot behavior.',
      },
      {
        title: 'What to do next',
        body: 'Pause and ask: "Am I actually hungry?"\nDelay the habit and observe the urge.',
      },
    ],
  },
  not_hungry: {
    sections: [
      {
        title: 'What happened',
        body: "You felt like eating, but it wasn't hunger.",
      },
      {
        title: 'Why it happens',
        body: 'Cravings often mimic hunger signals.',
      },
      {
        title: 'What this tests',
        body: 'Your ability to distinguish hunger vs appetite.',
      },
      {
        title: 'What to do next',
        body: 'Wait 15 minutes.\nIf hunger is real, it will remain stable.',
      },
    ],
  },
  loss_of_control: {
    sections: [
      {
        title: 'What happened',
        body: 'You acted quickly without awareness.',
      },
      {
        title: 'Why it happens',
        body: 'Strong impulses override conscious decisions.',
      },
      {
        title: 'What this tests',
        body: 'Your recovery speed.',
      },
      {
        title: 'What to do next',
        body: 'Reset immediately.\nOne action does not define the rest of your day.',
      },
    ],
  },
};

// ── Mapping: SlipContext → CoachingCategory ──

const CONTEXT_TO_COACHING: Record<SlipContext, CoachingCategory> = {
  'stress': 'emotional',
  'social': 'trigger',
  'habit': 'habit',
  'boredom': 'not_hungry',
  'after-meal': 'not_hungry',
  'late-night': 'loss_of_control',
};

/**
 * Premium narration audio paths (future ElevenLabs integration).
 * Drop pre-generated .mp3 files here to override browser TTS.
 * If a file doesn't exist, the hook falls back to SpeechSynthesis.
 */
const PREMIUM_AUDIO: Record<CoachingCategory, string> = {
  emotional: '/audio/learn/emotional.mp3',
  trigger: '/audio/learn/trigger.mp3',
  habit: '/audio/learn/habit.mp3',
  not_hungry: '/audio/learn/not-hungry.mp3',
  loss_of_control: '/audio/learn/control.mp3',
};

// ── Component ──

interface LearnScreenProps {
  context: SlipContext | null;
  onNavigate: (screen: Screen) => void;
}

export default function LearnScreen({ context, onNavigate }: LearnScreenProps) {
  const { t } = useTranslation();

  const CTX_KEYS: Record<SlipContext, keyof typeof t> = {
    'late-night': 'ctx_late_night',
    'stress': 'ctx_stress',
    'social': 'ctx_social',
    'boredom': 'ctx_boredom',
    'habit': 'ctx_habit',
    'after-meal': 'ctx_after_meal',
  };

  const label = context ? (t[CTX_KEYS[context]] as string) : 'Unknown';
  const icon = context ? SLIP_CONTEXT_ICONS[context] : '?';

  const category: CoachingCategory = context
    ? CONTEXT_TO_COACHING[context]
    : 'loss_of_control';

  const content = COACHING[category];

  // ── Narration (premium audio or browser TTS fallback) ──
  const premiumSrc = PREMIUM_AUDIO[category];

  const narrationText = useMemo(
    () =>
      content.sections
        .map((s) => `${s.title}. ${s.body.replace(/\n/g, ' ')}`)
        .join('. '),
    [content],
  );

  const { isPlaying: isNarrating, isAvailable: narrationAvailable, toggle: toggleNarration, stop: stopNarration } =
    useNarration(premiumSrc, narrationText);

  const handleNavigate = useCallback(
    (target: Screen) => {
      stopNarration();
      onNavigate(target);
    },
    [onNavigate, stopNarration],
  );

  return (
    <div className="screen learn-screen">
      <ScreenHeader
        onBack={() => handleNavigate('help')}
        onHome={() => handleNavigate('home')}
      />

      <div className="learn-content">
        <div className="learn-heading">
          <span className="section-label">{t.learn_label}</span>
          <div className="learn-context-badge">
            <span>{icon}</span>
            <span>{label}</span>
          </div>
        </div>

        <div className="learn-sections">
          {content.sections.map((section, index) => (
            <div className="learn-section" key={index}>
              <h3 className="learn-section-title">{section.title}</h3>
              <p className="learn-section-body">
                {section.body.split('\n').map((line, i) => (
                  <span key={i}>
                    {line}
                    {i < section.body.split('\n').length - 1 && <br />}
                  </span>
                ))}
              </p>
            </div>
          ))}
        </div>

        {narrationAvailable && (
          <button
            id="btn-listen"
            className={`listen-btn${isNarrating ? ' listen-btn--active' : ''}`}
            onClick={toggleNarration}
          >
            <span className="listen-btn-icon">{isNarrating ? '⏹' : '🔊'}</span>
            <span>{isNarrating ? t.learn_stop : t.learn_listen}</span>
          </button>
        )}

        <div className="learn-actions">
          <button
            id="btn-learn-timer"
            className="btn btn-primary btn-large"
            onClick={() => handleNavigate('mode')}
          >
            {t.learn_start_timer}
          </button>

          <button
            id="btn-learn-back"
            className="btn-text"
            onClick={() => handleNavigate('help')}
          >
            {t.learn_back}
          </button>
        </div>
      </div>
    </div>
  );
}
