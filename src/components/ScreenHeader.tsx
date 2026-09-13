import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import GlobalScoreBadge from './GlobalScoreBadge';

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
        className="header-btn"
        onClick={onBack}
        aria-label="Go back"
      >
        ←
      </button>
      <button
        id="btn-header-brand"
        className="screen-brand-btn"
        onClick={onHome}
        aria-label="Go home"
      >
        <span className="screen-brand-title">{t.home_brand_title}</span>
        <span className="screen-brand-sub">{t.home_brand}</span>
      </button>
      <div className="screen-header-right">
        <GlobalScoreBadge onNavigate={onNavigate} />
        <button
          id="btn-header-home"
          className="header-btn"
          onClick={onHome}
          aria-label="Go home"
        >
          ⌂
        </button>
      </div>
    </header>
  );
}
