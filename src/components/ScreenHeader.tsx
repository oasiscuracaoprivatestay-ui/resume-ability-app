import { useTranslation } from '../i18n';

interface ScreenHeaderProps {
  onBack: () => void;
  onHome: () => void;
}

export default function ScreenHeader({ onBack, onHome }: ScreenHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="screen-header">
      <button
        className="header-btn"
        onClick={onBack}
        aria-label="Go back"
      >
        ←
      </button>
      <button
        className="screen-brand-btn"
        onClick={onHome}
        aria-label="Go home"
      >
        <span className="screen-brand-title">{t.home_brand_title}</span>
        <span className="screen-brand-sub">{t.home_brand}</span>
      </button>
      <button
        className="header-btn"
        onClick={onHome}
        aria-label="Go home"
      >
        ⌂
      </button>
    </header>
  );
}
