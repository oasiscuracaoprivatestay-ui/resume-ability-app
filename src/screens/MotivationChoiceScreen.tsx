import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import { PremiumScreenHeader } from '../components/premium/PremiumScreenHeader';
import { AppIcon } from '../components/icons/AppIcon';
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
    <div className="screen motivation-choice-screen" id="motivation-choice-screen">
      <PremiumScreenHeader
        backId="btn-header-back"
        onBack={onBack}
        backText={t.global_back || 'Back'}
        backAriaLabel={t.global_back || 'Go back'}
        title={t.motivation_choice_heading}
        subtitle={t.motivation_choice_sub}
        eyebrow={t.motivation_choice_label}
        showScoreBadge
        onNavigate={onNavigate}
        rightAction={
          <button
            id="btn-header-home"
            type="button"
            className="sda-premium-header__home-btn"
            onClick={() => onNavigate('home')}
            aria-label={t.btn_return_to_main || 'Go home'}
          >
            <AppIcon name="home" size={18} />
          </button>
        }
      />

      <div className="motivation-choice-content">
        <div className="motivation-choice-options">
          {/* Audio Option */}
          <button
            id="btn-motivation-audio"
            type="button"
            className="motivation-option-card motivation-option-card--audio"
            onClick={onChooseAudio}
          >
            <div className="motivation-option-icon-wrap" aria-hidden="true">
              <AppIcon name="headphones" size={24} />
            </div>
            <div className="motivation-option-text">
              <span className="motivation-option-title">{t.motivation_btn_audio}</span>
              <span className="motivation-option-desc">{t.motivation_btn_audio_desc}</span>
            </div>
            <span className="motivation-option-arrow" aria-hidden="true">
              <AppIcon name="chevron-right" size={18} />
            </span>
          </button>

          {/* Text Option */}
          <button
            id="btn-motivation-text"
            type="button"
            className="motivation-option-card motivation-option-card--text"
            onClick={onChooseText}
          >
            <div className="motivation-option-icon-wrap" aria-hidden="true">
              <AppIcon name="book-open" size={24} />
            </div>
            <div className="motivation-option-text">
              <span className="motivation-option-title">{t.motivation_btn_text}</span>
              <span className="motivation-option-desc">{t.motivation_btn_text_desc}</span>
            </div>
            <span className="motivation-option-arrow" aria-hidden="true">
              <AppIcon name="chevron-right" size={18} />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
