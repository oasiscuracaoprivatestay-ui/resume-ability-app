import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import ScreenHeader from '../components/ScreenHeader';
import './SlipTypeScreen.css';

interface SlipTypeScreenProps {
  onNavigate: (screen: Screen) => void;
}

export default function SlipTypeScreen({ onNavigate }: SlipTypeScreenProps) {
  const { t } = useTranslation();

  return (
    <div className="screen slip-type-screen">
      <ScreenHeader
        onBack={() => onNavigate('home')}
        onHome={() => onNavigate('home')}
      />

      <div className="slip-type-content">
        <div className="slip-type-heading">
          <span className="section-label">{t.slip_type_title}</span>
          <h2 className="slip-type-question">
            {t.slip_type_subtitle}
          </h2>
        </div>

        <div className="slip-type-options">
          <button
            id="slip-type-sz"
            className="slip-type-card"
            onClick={() => onNavigate('context')}
          >
            <div className="slip-type-card-left">
              <span className="slip-type-card-icon">⚡</span>
              <div className="slip-type-card-text">
                <span className="slip-type-card-title">{t.slip_type_slippery_zone}</span>
                <span className="slip-type-card-desc">{t.slip_type_slippery_zone_desc}</span>
              </div>
            </div>
            <span className="slip-type-card-arrow">›</span>
          </button>

          <button
            id="slip-type-nn"
            className="slip-type-card"
            onClick={() => onNavigate('slip-non-negotiable')}
          >
            <div className="slip-type-card-left">
              <span className="slip-type-card-icon">🛡️</span>
              <div className="slip-type-card-text">
                <span className="slip-type-card-title">{t.slip_type_non_negotiable}</span>
                <span className="slip-type-card-desc">{t.slip_type_non_negotiable_desc}</span>
              </div>
            </div>
            <span className="slip-type-card-arrow">›</span>
          </button>
        </div>
      </div>
    </div>
  );
}
