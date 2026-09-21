import type { Screen, SlipContext } from '../types';
import { SLIP_CONTEXT_ICONS } from '../types';
import { useTranslation } from '../i18n';
import ScreenHeader from '../components/ScreenHeader';
import TermHelp from '../components/TermHelp';
import './ContextScreen.css';

interface ContextScreenProps {
  onSelect: (context: SlipContext) => void;
  onNavigate: (screen: Screen) => void;
}

const CONTEXTS: SlipContext[] = [
  'stress',
  'people-social',
  'environment',
  'habit',
  'temptation',
  'hunger',
  'celebration',
  'time-of-day',
  'delay',
  'all-or-nothing',
];

const CTX_KEYS: Record<SlipContext, keyof ReturnType<typeof useTranslation>['t']> = {
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

export default function ContextScreen({ onSelect, onNavigate }: ContextScreenProps) {
  const { t } = useTranslation();

  return (
    <div className="screen context-screen">
      <ScreenHeader
        onBack={() => onNavigate('slip-type')}
        onHome={() => onNavigate('home')}
      />

      <div className="context-content">
        <div className="context-heading">
          <div className="context-title-row">
            <span className="section-label">{t.ctx_label}</span>
            <TermHelp termKey="sz" btnId="btn-help-ctx-sz" />
          </div>
          <h2 className="context-question">
            {t.ctx_question}<br />
            <span className="accent-text">{t.ctx_question_accent}</span>
          </h2>
          <p className="context-subtitle-hint">
            {t.sda_term_sz_def}
          </p>
        </div>

        <div className="context-grid">
          {CONTEXTS.map((ctx) => (
            <button
              key={ctx}
              id={`ctx-${ctx}`}
              className="context-option"
              onClick={() => onSelect(ctx)}
            >
              <span className="context-icon">{SLIP_CONTEXT_ICONS[ctx]}</span>
              <span className="context-label">{t[CTX_KEYS[ctx]] as string}</span>
            </button>
          ))}
        </div>

        {/* ── Subtle timer education link ── */}
        <button
          id="btn-ctx-learn"
          className="ctx-learn-link"
          onClick={() => onNavigate('timer-learn')}
        >
          {t.ctx_learn_link}
        </button>

        {/* Cancel / Return to Main Menu Action (Phase 29B) */}
        <div className="recommit-cancel-wrap">
          <button
            id="btn-ctx-cancel"
            type="button"
            className="recommit-cancel-btn"
            onClick={() => onNavigate('home')}
            aria-label={t.btn_cancel_to_main}
          >
            ✕ {t.btn_cancel_to_main}
          </button>
        </div>
      </div>
    </div>
  );
}
