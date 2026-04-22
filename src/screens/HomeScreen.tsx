import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import { PROGRAM_URL, FEEDBACK_EMAIL, FEEDBACK_SUBJECT } from '../config';
import LanguageSelector from '../components/LanguageSelector';
import './HomeScreen.css';

interface HomeScreenProps {
  onNavigate: (screen: Screen) => void;
}

export default function HomeScreen({ onNavigate }: HomeScreenProps) {
  const { t } = useTranslation();

  // On Home, back button / OS already handles exit via App.tsx popstate.
  // This gives a visible tap target for the same action.
  const handleExit = () => {
    // history.back() fires popstate; since we're on home the handler does
    // nothing and the browser/Android OS performs the exit.
    history.back();
    // Fallback for desktop browsers where back() may do nothing:
    setTimeout(() => window.close(), 200);
  };

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
          <button
            id="btn-exit-app"
            className="home-exit-btn"
            onClick={handleExit}
            aria-label={t.home_exit}
          >
            <span className="home-exit-icon">✕</span>
            <span className="home-exit-label">{t.home_exit}</span>
          </button>
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
            id="btn-motivation"
            className="home-btn-motivation"
            onClick={() => onNavigate('daily-audio')}
          >
            <span className="home-btn-icon">♫</span>
            <span>{t.home_motivation}</span>
          </button>
          <button
            id="btn-in-control"
            className="home-btn-control"
            onClick={() => onNavigate('control')}
          >
            <span className="home-btn-icon">✓</span>
            <span className="home-btn-control-label">
              <span className="home-btn-control-primary">{t.home_in_control}</span>
              <span className="home-btn-control-secondary">Keep your balance</span>
            </span>
          </button>

          {/* ── Secondary CTAs — inline, never floating on home ── */}
          <div className="home-secondary-row">
            <button
              id="btn-home-program"
              className="home-secondary-btn home-secondary-btn--program"
              onClick={() => window.open(PROGRAM_URL, '_blank', 'noopener,noreferrer')}
              aria-label={t.prog_btn_label}
            >
              <span>🔓</span>
              <span>{t.prog_btn_label}</span>
            </button>
            <button
              id="btn-home-timer"
              className="home-secondary-btn home-secondary-btn--timer"
              onClick={() => onNavigate('context')}
              aria-label={t.global_start_timer}
            >
              <span>⏱</span>
              <span>{t.global_start_timer}</span>
            </button>
          </div>

          {/* ── Subtle link to timer education ── */}
          <button
            id="btn-timer-learn"
            className="home-learn-link"
            onClick={() => onNavigate('timer-learn')}
          >
            {t.home_timer_learn_link} →
          </button>
          <button
            id="btn-quiz-entry"
            className="home-learn-link home-quiz-link"
            onClick={() => onNavigate('quiz')}
          >
            {t.home_quiz_link}
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
          id="nav-daily-audio"
          className="nav-link"
          onClick={() => onNavigate('daily-audio')}
        >
          {t.home_daily_audio}
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

      {/* ── Feedback link — bottom of screen, minimal ── */}
      <button
        id="btn-feedback"
        className="home-feedback-btn"
        onClick={() =>
          window.open(
            `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(FEEDBACK_SUBJECT)}`,
            '_blank',
          )
        }
        aria-label={t.home_feedback}
      >
        <span className="home-feedback-icon">✉️</span>
        <span>{t.home_feedback}</span>
      </button>
    </div>
  );
}
