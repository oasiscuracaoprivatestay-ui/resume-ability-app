import { useMemo, useCallback } from 'react';
import type { Screen, SlipContext } from '../types';
import { SLIP_CONTEXT_ICONS } from '../types';
import { useTranslation } from '../i18n';
import { useNarration } from '../hooks/useNarration';
import { getCoaching } from '../data/coaching';
import type { CoachingCategory } from '../data/coaching';
import { localizeAudioPath } from '../utils/audioPath';
import ScreenHeader from '../components/ScreenHeader';
import './LearnScreen.css';

// ── Mapping: SlipContext → CoachingCategory ──

const CONTEXT_TO_COACHING: Record<SlipContext, CoachingCategory> = {
  'stress':         'emotional',
  'people-social':  'people_social',
  'environment':    'environment',
  'habit':          'habit',
  'temptation':     'temptation',
  'hunger':         'hunger',
  'celebration':    'celebration',
  'time-of-day':    'time_of_day',
  'delay':          'delay',
  'all-or-nothing': 'all_or_nothing',
};

/**
 * Premium narration audio paths (future ElevenLabs integration).
 * Drop pre-generated .mp3 files here to override browser TTS.
 * If a file doesn't exist, the hook falls back to SpeechSynthesis.
 */
const PREMIUM_AUDIO: Record<CoachingCategory, string> = {
  emotional:      '/audio/learn/emotional.mp3',
  people_social:  '/audio/learn/people-social.mp3',
  environment:    '/audio/learn/environment.mp3',
  habit:          '/audio/learn/habit.mp3',
  temptation:     '/audio/learn/temptation.mp3',
  hunger:         '/audio/learn/hunger.mp3',
  celebration:    '/audio/learn/celebration.mp3',
  time_of_day:    '/audio/learn/time-of-day.mp3',
  delay:          '/audio/learn/delay.mp3',
  all_or_nothing: '/audio/learn/all-or-nothing.mp3',
};

// ── Component ──

interface LearnScreenProps {
  context: SlipContext | null;
  onNavigate: (screen: Screen) => void;
}

export default function LearnScreen({ context, onNavigate }: LearnScreenProps) {
  const { lang, t } = useTranslation();

  const CTX_KEYS: Record<SlipContext, keyof typeof t> = {
    'stress':         'ctx_stress',
    'people-social':  'ctx_people_social',
    'environment':    'ctx_environment',
    'habit':          'ctx_habit',
    'temptation':     'ctx_temptation',
    'hunger':         'ctx_hunger',
    'celebration':    'ctx_celebration',
    'time-of-day':    'ctx_time_of_day',
    'delay':          'ctx_delay',
    'all-or-nothing': 'ctx_all_or_nothing',
  };

  const label = context ? (t[CTX_KEYS[context]] as string) : 'Unknown';
  const icon = context ? SLIP_CONTEXT_ICONS[context] : '?';

  const category: CoachingCategory = context
    ? CONTEXT_TO_COACHING[context]
    : 'emotional';

  const content = getCoaching(lang, category);

  // ── Narration (premium audio or browser TTS fallback) ──
  const premiumSrc = localizeAudioPath(PREMIUM_AUDIO[category], lang);

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
