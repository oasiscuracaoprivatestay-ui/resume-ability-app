import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import { PremiumScreenHeader } from '../components/premium/PremiumScreenHeader';
import { AppIcon, type AppIconName } from '../components/icons/AppIcon';
import './TimerLearnScreen.css';

interface TimerLearnScreenProps {
  onNavigate: (screen: Screen) => void;
  onBack?: () => void;
}

// The four educational sections, keyed into i18n
const SECTIONS: { icon: AppIconName; titleKey: 'tl_a_title' | 'tl_b_title' | 'tl_c_title' | 'tl_d_title'; bodyKey: 'tl_a_body' | 'tl_b_body' | 'tl_c_body' | 'tl_d_body' }[] = [
  { icon: 'timer', titleKey: 'tl_a_title', bodyKey: 'tl_a_body' },
  { icon: 'activity', titleKey: 'tl_b_title', bodyKey: 'tl_b_body' },
  { icon: 'clipboard-list', titleKey: 'tl_c_title', bodyKey: 'tl_c_body' },
  { icon: 'check-circle', titleKey: 'tl_d_title', bodyKey: 'tl_d_body' },
];

export default function TimerLearnScreen({ onNavigate, onBack }: TimerLearnScreenProps) {
  const { t } = useTranslation();

  return (
    <div className="screen tl-screen" id="timer-learn-screen">
      <PremiumScreenHeader
        backId="btn-header-back"
        onBack={onBack ? onBack : () => onNavigate('home')}
        backText={t.global_back || 'Back'}
        backAriaLabel={t.global_back || 'Go back'}
        title={t.tl_heading}
        eyebrow={t.tl_label}
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

      <div className="tl-content">
        {/* Four structured educational cards — no duplicate page title */}
        <div className="tl-sections">
          {SECTIONS.map((s, idx) => (
            <article key={s.titleKey} className="tl-section">
              <div className="tl-section-head">
                <span className="tl-section-icon" aria-hidden="true">
                  <AppIcon name={s.icon} size={17} strokeWidth={1.95} />
                </span>
                <h2 className="tl-section-title">{t[s.titleKey]}</h2>
                <span className="tl-section-step" aria-hidden="true">
                  0{idx + 1}
                </span>
              </div>
              <p className="tl-section-body">{t[s.bodyKey]}</p>
            </article>
          ))}
        </div>

        {/* Actions */}
        <div className="tl-actions">
          <button
            id="btn-tl-start"
            type="button"
            className="tl-btn-primary"
            onClick={() => onNavigate('context')}
          >
            <span className="tl-btn-lead">
              <AppIcon name="timer" size={18} strokeWidth={2} />
              <span>{t.global_start_timer}</span>
            </span>
            <AppIcon name="arrow-right" size={16} strokeWidth={2.1} />
          </button>
          <button
            id="btn-tl-back"
            type="button"
            className="tl-btn-secondary"
            onClick={() => onNavigate('home')}
          >
            {t.tl_back}
          </button>
        </div>
      </div>
    </div>
  );
}
