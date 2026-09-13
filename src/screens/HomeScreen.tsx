import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import { PROGRAM_URL, FEEDBACK_EMAIL, FEEDBACK_SUBJECT } from '../config';
import LanguageSelector from '../components/LanguageSelector';
import GlobalScoreBadge from '../components/GlobalScoreBadge';
import './HomeScreen.css';

interface HomeScreenProps {
  onNavigate: (screen: Screen) => void;
  onStartTimer: () => void;
  onInControl?: () => void;
}

export default function HomeScreen({ onNavigate, onStartTimer, onInControl }: HomeScreenProps) {
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
          <GlobalScoreBadge onNavigate={onNavigate} />
          <LanguageSelector />
          <button
            id="btn-header-reminders"
            className="home-reminders-btn"
            onClick={() => onNavigate('notification-settings')}
            aria-label={t.notif_screen_title}
            title={t.notif_screen_title}
          >
            🔔
          </button>
          <button
            id="btn-header-settings"
            className="home-settings-btn"
            onClick={() => onNavigate('settings')}
            aria-label={t.settings_title}
            title={t.settings_title}
          >
            ⚙️
          </button>
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
        </div>

        <div className="home-actions">
          {/* ── Daily Check-In entry ── PRIMARY ACTION ── */}
          <button
            id="btn-daily-checkin"
            className="home-btn-checkin"
            onClick={() => onNavigate('check-in')}
          >
            <div className="home-btn-checkin-left">
              <span className="home-btn-checkin-eyebrow">Daily Check-In</span>
              <span className="home-btn-checkin-label">{t.ci_entry_label}</span>
              <span className="home-btn-checkin-sub">{t.ci_entry_sub}</span>
            </div>
            <span className="home-btn-checkin-arrow">›</span>
          </button>

          <button
            id="btn-slipped"
            className="home-btn-slip"
            onClick={() => onNavigate('slip-type')}
          >
            <span className="home-btn-icon">↻</span>
            <span>{t.home_slipped}</span>
          </button>
          <button
            id="btn-motivation"
            className="home-btn-motivation"
            onClick={() => onNavigate('motivation-choice')}
          >
            <span className="home-btn-icon">♫</span>
            <span>{t.home_motivation}</span>
          </button>
          <button
            id="btn-in-control"
            className="home-btn-control"
            onClick={onInControl ?? (() => onNavigate('control'))}
          >
            <span className="home-btn-icon">✓</span>
            <span>{t.home_in_control}</span>
          </button>
          <button
            id="btn-structured-diet"
            className="home-btn-diet"
            onClick={() => onNavigate('structured-diet')}
          >
            <span className="home-btn-icon">🥗</span>
            <span>{t.home_structured_diet}</span>
          </button>

          {/* ── Main Menu Direct Access: Commitment & Non-Negotiables ── */}
          <button
            id="btn-main-commitment"
            className="home-btn-action home-btn-action--commitment"
            onClick={() => onNavigate('commitment')}
          >
            <span className="home-btn-icon">🛡️</span>
            <span>{t.commit_label}</span>
          </button>
          <button
            id="btn-main-non-negotiables"
            className="home-btn-action home-btn-action--nn"
            onClick={() => {
              sessionStorage.setItem('commitment_focus', 'nn');
              onNavigate('commitment');
            }}
          >
            <span className="home-btn-icon">⭐</span>
            <span>{t.commit_nn_section}</span>
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
              onClick={onStartTimer}
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
            id="btn-sda-terms-link"
            className="home-learn-link home-sda-terms-link"
            onClick={() => onNavigate('sda-terms')}
          >
            {t.sda_terms_link} →
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

      <nav className="home-nav" aria-label="Bottom Navigation">
        <button
          id="nav-dashboard"
          className="nav-link"
          onClick={() => onNavigate('dashboard')}
          aria-label={t.home_dashboard}
        >
          <span className="nav-icon" aria-hidden="true">📊</span>
          <span className="nav-label">{t.home_dashboard}</span>
        </button>
        <button
          id="nav-daily-audio"
          className="nav-link"
          onClick={() => onNavigate('daily-audio')}
          aria-label={t.home_daily_audio}
        >
          <span className="nav-icon" aria-hidden="true">🎧</span>
          <span className="nav-label">{t.home_daily_audio}</span>
        </button>
        <button
          id="nav-history"
          className="nav-link"
          onClick={() => onNavigate('history')}
          aria-label={t.home_history}
        >
          <span className="nav-icon" aria-hidden="true">🕒</span>
          <span className="nav-label">{t.home_history}</span>
        </button>
        <button
          id="nav-commitment"
          className="nav-link nav-link--commitment"
          onClick={() => onNavigate('commitment')}
          aria-label={t.commit_label}
        >
          <span className="nav-icon" aria-hidden="true">🛡️</span>
          <span className="nav-label">{t.commit_label}</span>
        </button>
        <button
          id="nav-reminders"
          className="nav-link"
          onClick={() => onNavigate('notification-settings')}
          aria-label={t.nav_reminders}
        >
          <span className="nav-icon" aria-hidden="true">🔔</span>
          <span className="nav-label">{t.nav_reminders}</span>
        </button>
        <button
          id="nav-settings"
          className="nav-link"
          onClick={() => onNavigate('settings')}
          aria-label={t.nav_settings}
        >
          <span className="nav-icon" aria-hidden="true">⚙️</span>
          <span className="nav-label">{t.nav_settings}</span>
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
