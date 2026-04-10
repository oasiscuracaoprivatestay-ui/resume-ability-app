import type { Screen, SlipContext } from '../types';
import { SLIP_CONTEXT_ICONS } from '../types';
import { useTranslation } from '../i18n';
import ScreenHeader from '../components/ScreenHeader';
import './ContextScreen.css';

interface ContextScreenProps {
  onSelect: (context: SlipContext) => void;
  onNavigate: (screen: Screen) => void;
}

const CONTEXTS: SlipContext[] = [
  'late-night',
  'stress',
  'social',
  'boredom',
  'habit',
  'after-meal',
];

const CTX_KEYS: Record<SlipContext, keyof ReturnType<typeof useTranslation>['t']> = {
  'late-night': 'ctx_late_night',
  'stress': 'ctx_stress',
  'social': 'ctx_social',
  'boredom': 'ctx_boredom',
  'habit': 'ctx_habit',
  'after-meal': 'ctx_after_meal',
};

export default function ContextScreen({ onSelect, onNavigate }: ContextScreenProps) {
  const { t } = useTranslation();

  return (
    <div className="screen context-screen">
      <ScreenHeader
        onBack={() => onNavigate('home')}
        onHome={() => onNavigate('home')}
      />

      <div className="context-content">
        <div className="context-heading">
          <span className="section-label">{t.ctx_label}</span>
          <h2 className="context-question">
            {t.ctx_question}<br />
            <span className="accent-text">{t.ctx_question_accent}</span>
          </h2>
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
      </div>
    </div>
  );
}
