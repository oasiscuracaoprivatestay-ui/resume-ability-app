import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import GlobalScoreBadge from './GlobalScoreBadge';
import { AppIcon } from './icons/AppIcon';

interface ScreenHeaderProps {
  onBack: () => void;
  onHome: () => void;
  onNavigate?: (screen: Screen) => void;
}

export default function ScreenHeader({ onBack, onHome, onNavigate }: ScreenHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="screen-header">
      <button
        id="btn-header-back"
        type="button"
        className="header-btn header-btn--back"
        onClick={onBack}
        aria-label={t.global_back || 'Go back'}
      >
        <AppIcon name="chevron-left" size={18} strokeWidth={2.2} />
        <span className="header-btn__label">{t.global_back || 'Back'}</span>
      </button>

      <button
        id="btn-header-brand"
        type="button"
        className="screen-brand-btn"
        onClick={onHome}
        aria-label={t.btn_return_to_main || 'Go home'}
      >
        <span className="screen-brand-title">{t.home_brand_title}</span>
        <span className="screen-brand-sub">{t.home_brand}</span>
      </button>

      <div className="screen-header-right">
        <GlobalScoreBadge onNavigate={onNavigate} />
        <button
          id="btn-header-home"
          type="button"
          className="header-btn header-btn--icon"
          onClick={onHome}
          aria-label={t.btn_return_to_main || 'Go home'}
        >
          <AppIcon name="home" size={18} strokeWidth={2} />
        </button>
      </div>
    </header>
  );
}
