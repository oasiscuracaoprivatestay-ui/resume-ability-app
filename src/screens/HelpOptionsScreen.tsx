import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import ScreenHeader from '../components/ScreenHeader';
import './HelpOptionsScreen.css';

interface HelpOptionsScreenProps {
  onNavigate: (screen: Screen) => void;
}

export default function HelpOptionsScreen({ onNavigate }: HelpOptionsScreenProps) {
  const { t } = useTranslation();

  return (
    <div className="screen help-screen">
      <ScreenHeader
        onBack={() => onNavigate('slip-insights')}
        onHome={() => onNavigate('home')}
      />

      <div className="help-content">
        <div className="help-heading">
          <span className="section-label">{t.help_label}</span>
          <h2 className="help-question">
            {t.help_question}<br />
            <span className="accent-text">{t.help_question_accent}</span>
          </h2>
        </div>

        <div className="help-options">
          <button
            id="help-recommit"
            className="help-card help-card--recommit"
            onClick={() => onNavigate('recommit')}
          >
            <div className="help-card-left">
              <span className="help-card-icon">↻</span>
              <div className="help-card-text">
                <span className="help-card-title">{t.help_recommit_title}</span>
                <span className="help-card-desc">{t.help_recommit_desc}</span>
              </div>
            </div>
            <span className="help-card-arrow">›</span>
          </button>

          <button
            id="help-timer"
            className="help-card"
            onClick={() => onNavigate('mode')}
          >
            <div className="help-card-left">
              <span className="help-card-icon">◎</span>
              <div className="help-card-text">
                <span className="help-card-title">{t.help_timer_title}</span>
                <span className="help-card-desc">{t.help_timer_desc}</span>
              </div>
            </div>
          </button>

          <button
            id="help-learn"
            className="help-card"
            onClick={() => onNavigate('learn')}
          >
            <div className="help-card-left">
              <span className="help-card-icon">📖</span>
              <div className="help-card-text">
                <span className="help-card-title">{t.help_learn_title}</span>
                <span className="help-card-desc">{t.help_learn_desc}</span>
              </div>
            </div>
          </button>

          <button
            id="help-ai"
            className="help-card help-card--disabled"
            disabled
          >
            <div className="help-card-left">
              <span className="help-card-icon">💬</span>
              <div className="help-card-text">
                <span className="help-card-title">{t.help_ai_title}</span>
                <span className="help-card-desc">{t.help_ai_desc}</span>
              </div>
            </div>
            <span className="help-card-badge">{t.help_ai_badge}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
