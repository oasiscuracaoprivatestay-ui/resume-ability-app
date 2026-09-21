import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import ScreenHeader from '../components/ScreenHeader';
import TermHelp from '../components/TermHelp';
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
          <div className="slip-type-title-row">
            <span className="section-label">{t.slip_type_title}</span>
            <TermHelp termKey="slip" btnId="btn-help-slip" />
          </div>
          <h2 className="slip-type-question">
            {t.slip_type_subtitle}
          </h2>
          <p className="slip-type-intro-hint">
            {t.sda_term_slip_def}
          </p>
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
                <div className="slip-type-card-title-row">
                  <span className="slip-type-card-title">{t.slip_type_slippery_zone}</span>
                  <TermHelp termKey="sz" btnId="btn-help-sz" />
                </div>
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
                <div className="slip-type-card-title-row">
                  <span className="slip-type-card-title">{t.slip_type_non_negotiable}</span>
                  <TermHelp termKey="nn" btnId="btn-help-nn" />
                </div>
                <span className="slip-type-card-desc">{t.slip_type_non_negotiable_desc}</span>
              </div>
            </div>
            <span className="slip-type-card-arrow">›</span>
          </button>
        </div>

        {/* Cancel / Return to Main Menu Action (Phase 29B) */}
        <div className="recommit-cancel-wrap">
          <button
            id="btn-slip-type-cancel"
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
