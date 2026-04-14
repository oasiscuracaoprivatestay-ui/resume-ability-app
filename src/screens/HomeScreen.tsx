import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import LanguageSelector from '../components/LanguageSelector';
import './HomeScreen.css';

interface HomeScreenProps {
  onNavigate: (screen: Screen) => void;
}

export default function HomeScreen({ onNavigate }: HomeScreenProps) {
  const { t } = useTranslation();

  return (
    <div className="screen home-screen">
      <header className="home-top-bar">
        <button
          className="home-brand-btn"
          onClick={() => onNavigate('home')}
          aria-label="Home"
        >
          <span className="home-brand-title">{t.home_brand_title}</span>
          <span className="home-brand-sub">{t.home_brand}</span>
        </button>
        <div className="home-top-right">
          <LanguageSelector />
        </div>
      </header>

      <div className="home-content">
        <div className="home-question-block">
          <h1 className="home-question">
            {t.home_question}<br />
            <span className="accent-text">{t.home_question_accent}</span>
          </h1>
          <p className="home-subtitle">
            {t.home_subtitle}
          </p>
        </div>

        <div className="home-actions">
          <button
            id="btn-slipped"
            className="home-btn-slip"
            onClick={() => onNavigate('context')}
          >
            <span className="home-btn-icon">↻</span>
            <span>{t.home_slipped}</span>
          </button>
          <button
            id="btn-in-control"
            className="home-btn-control"
            onClick={() => onNavigate('control')}
          >
            <span className="home-btn-icon">✓</span>
            <span>{t.home_in_control}</span>
          </button>
        </div>
      </div>

      <nav className="home-nav">
        <button
          id="nav-dashboard"
          className="nav-link"
          onClick={() => onNavigate('dashboard')}
        >
          {t.home_dashboard}
        </button>
        <span className="nav-dot">·</span>
        <button
          id="nav-history"
          className="nav-link"
          onClick={() => onNavigate('history')}
        >
          {t.home_history}
        </button>
      </nav>
    </div>
  );
}
