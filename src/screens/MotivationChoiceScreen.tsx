import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import ScreenHeader from '../components/ScreenHeader';
import './MotivationChoiceScreen.css';

interface MotivationChoiceScreenProps {
  onBack: () => void;
  onNavigate: (screen: Screen) => void;
  onChooseAudio: () => void;
  onChooseText: () => void;
}

export default function MotivationChoiceScreen({
  onBack,
  onNavigate,
  onChooseAudio,
  onChooseText,
}: MotivationChoiceScreenProps) {
  const { t } = useTranslation();

  return (
    <div className="screen motivation-choice-screen">
      <ScreenHeader
        onBack={onBack}
        onHome={() => onNavigate('home')}
      />

      <div className="motivation-choice-content">
        <div className="motivation-choice-header">
          <span className="section-label">{t.motivation_choice_label}</span>
          <h1 className="motivation-choice-heading">{t.motivation_choice_heading}</h1>
          <p className="motivation-choice-sub">{t.motivation_choice_sub}</p>
        </div>

        <div className="motivation-choice-options">
          {/* Audio Option */}
          <button
            id="btn-motivation-audio"
            className="motivation-option-card motivation-option-card--audio"
            onClick={onChooseAudio}
          >
            <div className="motivation-option-icon-wrap" aria-hidden="true">
              <span className="motivation-option-icon">🎧</span>
            </div>
            <div className="motivation-option-text">
              <span className="motivation-option-title">{t.motivation_btn_audio}</span>
              <span className="motivation-option-desc">{t.motivation_btn_audio_desc}</span>
            </div>
            <span className="motivation-option-arrow" aria-hidden="true">›</span>
          </button>

          {/* Text Option */}
          <button
            id="btn-motivation-text"
            className="motivation-option-card motivation-option-card--text"
            onClick={onChooseText}
          >
            <div className="motivation-option-icon-wrap" aria-hidden="true">
              <span className="motivation-option-icon">📖</span>
            </div>
            <div className="motivation-option-text">
              <span className="motivation-option-title">{t.motivation_btn_text}</span>
              <span className="motivation-option-desc">{t.motivation_btn_text_desc}</span>
            </div>
            <span className="motivation-option-arrow" aria-hidden="true">›</span>
          </button>
        </div>
      </div>
    </div>
  );
}
