/**
 * Super Diet-Ability — Premium Home Dashboard
 *
 * Approved dark-emerald & mountain-path design system:
 *   1. Header & Account Controls (Brand, Today's Score, Level, Lifetime Score,
 *      EN/ES/NL selector, Notifications, Settings, More drawer)
 *   2. Mountain-Path Hero ("The 7 Abilities") + Companion Official 7 Diet-Abilities List
 *   3. Active Challenge Status / Flagship 90-Day Invitation (<ChallengeHero />)
 *   4. Daily Check-In + Slipped Recovery + I Am in Control + Motivation
 *   5. Today's Focus (<TodayFocusCard /> — real next/current meal or beverage)
 *   6. Quick Actions (Plan My Next Meal, My Progress, Review Commitments, SDA AI Coach)
 *   7. Practice & Protection Tools (Urge Timer, Record Movement, Slippery Zones, Non-Negotiables)
 *   8. My Progress (<ProgressPreviewCard /> — live factual metrics only)
 *   9. Learn, Resources & Account Footer (Seven Diet-Abilities, SDA Terms, Quiz,
 *      15-Min Method, Daily Audio, History, Why & Commitment, Program, Feedback, Exit)
 *  10. Bottom Navigation (<BottomNav /> + <GlobalMoreSheet /> rendered by App.tsx)
 *
 * Strictly preserves all existing props, routes, scoring rules, event handlers,
 * localization keys, and element IDs without hardcoding any user data.
 */

import { useEffect, useState } from 'react';
import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import { PROGRAM_URL, FEEDBACK_EMAIL, FEEDBACK_SUBJECT } from '../config';
import LanguageSelector from '../components/LanguageSelector';
import GlobalScoreBadge from '../components/GlobalScoreBadge';
import { AppIcon } from '../components/icons/AppIcon';
import { ChallengeHero } from '../components/premium/ChallengeHero';
import { TodayFocusCard } from '../components/premium/TodayFocusCard';
import { ProgressPreviewCard } from '../components/premium/ProgressPreviewCard';
import { readActiveChallenge } from '../components/premium/readActiveChallenge';
import {
  calculateChallengePracticeStats,
  CHALLENGE_UPDATED_EVENT,
  CHALLENGE_OPEN_CHECKIN_KEY,
} from '../challenges';
import { getTodayCheckIns } from '../utils/checkInStorage';
import { SCORE_UPDATED_EVENT } from '../utils/scoringEngine';
import { STATS_RESET_EVENT } from '../utils/resetStats';
import '../components/premium/premium.css';
import './HomeScreen.css';

interface HomeScreenProps {
  onNavigate: (screen: Screen) => void;
  onStartTimer: () => void;
  onInControl?: () => void;
  onOpenMore?: () => void;
  moreOpen?: boolean;
}

interface CheckInState {
  hasActiveChallenge: boolean;
  checkedInToday: boolean;
}

function readCheckInState(): CheckInState {
  const ch = readActiveChallenge();
  if (ch) {
    return {
      hasActiveChallenge: true,
      checkedInToday: calculateChallengePracticeStats(ch).todayCheckedIn,
    };
  }
  let checkedInToday = false;
  try {
    checkedInToday = getTodayCheckIns().length > 0;
  } catch {
    // ignore
  }
  return { hasActiveChallenge: false, checkedInToday };
}

function SevenNodesBrandMark() {
  return (
    <svg
      className="home-brand-mark"
      viewBox="0 0 36 36"
      width="32"
      height="32"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="18" cy="18" r="4.2" stroke="currentColor" strokeWidth="2.1" />
      <circle cx="18" cy="6.2" r="2.6" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="28.2" cy="12.1" r="2.6" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="28.2" cy="23.9" r="2.6" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="18" cy="29.8" r="2.6" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="7.8" cy="23.9" r="2.6" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="7.8" cy="12.1" r="2.6" stroke="currentColor" strokeWidth="1.9" />
      <line x1="18" y1="8.9" x2="18" y2="13.7" stroke="currentColor" strokeWidth="1.6" />
      <line x1="25.8" y1="13.5" x2="21.7" y2="15.9" stroke="currentColor" strokeWidth="1.6" />
      <line x1="25.8" y1="22.5" x2="21.7" y2="20.1" stroke="currentColor" strokeWidth="1.6" />
      <line x1="18" y1="27.1" x2="18" y2="22.3" stroke="currentColor" strokeWidth="1.6" />
      <line x1="10.2" y1="22.5" x2="14.3" y2="20.1" stroke="currentColor" strokeWidth="1.6" />
      <line x1="10.2" y1="13.5" x2="14.3" y2="15.9" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export default function HomeScreen({
  onNavigate,
  onStartTimer,
  onInControl,
  onOpenMore,
  moreOpen = false,
}: HomeScreenProps) {
  const { t } = useTranslation();
  const [checkIn, setCheckIn] = useState<CheckInState>(() => readCheckInState());

  useEffect(() => {
    const refresh = () => setCheckIn(readCheckInState());
    const events = [CHALLENGE_UPDATED_EVENT, SCORE_UPDATED_EVENT, STATS_RESET_EVENT];
    events.forEach((e) => window.addEventListener(e, refresh));
    return () => events.forEach((e) => window.removeEventListener(e, refresh));
  }, []);

  const handleDailyCheckIn = () => {
    if (checkIn.hasActiveChallenge) {
      try {
        sessionStorage.setItem(CHALLENGE_OPEN_CHECKIN_KEY, '1');
      } catch {
        // ignore
      }
      onNavigate('challenges');
    } else {
      onNavigate('check-in');
    }
  };

  const handleRecordMovement = () => {
    try {
      sessionStorage.setItem('activity_log_open_modal', 'true');
    } catch {
      // ignore
    }
    onNavigate('activity-log');
  };

  const handleOpenNonNegotiables = () => {
    try {
      sessionStorage.setItem('commitment_focus', 'nn');
    } catch {
      // ignore
    }
    onNavigate('commitment');
  };

  const handleExit = () => {
    history.back();
    setTimeout(() => {
      try {
        window.close();
      } catch {
        // ignore
      }
    }, 200);
  };

  return (
    <div className="screen home-screen home-premium sda-home">
      {/* ── 1. App Header & Account Controls ── */}
      <header className="home-top-bar">
        <div className="home-top-primary">
          <h1 className="home-brand-h1">
            <button
              type="button"
              className="home-brand-btn"
              onClick={() => onNavigate('home')}
              aria-label={t.home_brand_title}
            >
              <SevenNodesBrandMark />
              <span className="home-brand-copy">
                <span className="home-brand-title">{t.home_brand_title}</span>
                <span className="home-brand-kicker">{t.home_brand_system_sub}</span>
              </span>
            </button>
          </h1>

          <div className="home-top-actions">
            <button
              id="btn-header-reminders"
              type="button"
              className="sda-header-icon-btn"
              onClick={() => onNavigate('notification-settings')}
              aria-label={t.nav_reminders}
              title={t.nav_reminders}
            >
              <AppIcon name="bell" size={19} />
            </button>
            <button
              id="btn-header-settings"
              type="button"
              className="sda-header-icon-btn"
              onClick={() => onNavigate('settings')}
              aria-label={t.nav_settings}
              title={t.nav_settings}
            >
              <AppIcon name="settings" size={19} />
            </button>
            <button
              id="btn-home-menu"
              type="button"
              className="sda-header-icon-btn"
              onClick={() => onOpenMore?.()}
              aria-label={t.home_menu_open}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              aria-controls="sda-more-sheet"
            >
              <AppIcon name="menu" size={20} />
            </button>
          </div>
        </div>

        <div className="home-top-right">
          <GlobalScoreBadge onNavigate={onNavigate} />
          <div className="home-top-lang">
            <LanguageSelector />
          </div>
        </div>
      </header>

      <main className="sda-content home-premium-grid">
        <div className="home-col home-col--primary">
          {/* ── 2. Flagship 90-Day / Active Challenge Hero ── */}
          <ChallengeHero onNavigate={onNavigate} onInControl={onInControl} />

          {/* ── 4. Daily Check-In + Recovery, In-Control & Motivation ── */}
          <section className="home-checkin-block" aria-label={t.ci_entry_label}>
            <div className="home-checkin-primary-row">
              <button
                id="btn-daily-checkin"
                type="button"
                className="sda-checkin-cta"
                onClick={handleDailyCheckIn}
              >
                <span className="sda-checkin-cta-icon" aria-hidden="true">
                  <AppIcon name="calendar" size={22} />
                </span>
                <span className="home-checkin-text">
                  <span className="home-checkin-label">
                    {checkIn.checkedInToday ? t.challenge_btn_checkin_again : t.ci_entry_label}
                  </span>
                  {checkIn.checkedInToday ? (
                    <span className="home-checkin-status">
                      <AppIcon name="check" size={13} strokeWidth={3} />
                      <span>{t.home_checkin_done_today}</span>
                    </span>
                  ) : (
                    <span className="home-checkin-sub">{t.ci_entry_sub}</span>
                  )}
                </span>
                <AppIcon name="chevron-right" size={20} className="sda-checkin-chevron" />
              </button>

              <button
                id="btn-slipped"
                type="button"
                className="home-slip-chip"
                onClick={() => onNavigate('slip-type')}
              >
                <AppIcon name="rotate-ccw" size={19} />
                <span>{t.home_slipped_chip}</span>
              </button>
            </div>

            <div className="home-checkin-secondary-row">
              <button
                id="btn-in-control"
                type="button"
                className="sda-support-btn"
                onClick={onInControl ?? (() => onNavigate('control'))}
              >
                <AppIcon name="check-circle" size={17} />
                <span>{t.home_action_in_control}</span>
              </button>
              <button
                id="btn-home-action-motivation"
                type="button"
                className="sda-support-btn"
                onClick={() => onNavigate('motivation-choice')}
              >
                <AppIcon name="headphones" size={17} />
                <span>{t.home_motivation}</span>
              </button>
            </div>
          </section>

          {/* ── 5. Today's Focus ── */}
          <TodayFocusCard onNavigate={onNavigate} />
        </div>

        <div className="home-col home-col--secondary">
          {/* ── 6. Quick Actions ── */}
          <section className="home-quick" aria-labelledby="home-quick-title">
            <h2 id="home-quick-title" className="home-section-title">{t.home_quick_title}</h2>
            <div className="home-quick-grid">
              <button
                id="btn-structured-diet"
                type="button"
                className="home-quick-tile"
                onClick={() => onNavigate('structured-diet')}
              >
                <span className="home-quick-icon" aria-hidden="true">
                  <AppIcon name="utensils" size={19} />
                </span>
                <span className="home-quick-label">{t.home_quick_plan_meal}</span>
              </button>

              <button
                id="btn-home-progress"
                type="button"
                className="home-quick-tile"
                onClick={() => onNavigate('progress-victories')}
              >
                <span className="home-quick-icon" aria-hidden="true">
                  <AppIcon name="bar-chart" size={19} />
                </span>
                <span className="home-quick-label">{t.home_quick_progress}</span>
              </button>

              <button
                id="btn-my-commitments"
                type="button"
                className="home-quick-tile"
                onClick={() => onNavigate('my-commitments')}
              >
                <span className="home-quick-icon" aria-hidden="true">
                  <AppIcon name="clipboard-list" size={19} />
                </span>
                <span className="home-quick-label">{t.home_quick_commitments}</span>
              </button>

              <button
                id="btn-sda-coach"
                type="button"
                className="home-quick-tile"
                onClick={() => onNavigate('coach')}
              >
                <span className="home-quick-icon" aria-hidden="true">
                  <AppIcon name="message-circle" size={19} />
                </span>
                <span className="home-quick-label">{t.home_quick_coach_full}</span>
              </button>
            </div>
          </section>

          {/* ── 7. Practice & Protection Tools ── */}
          <section className="home-tools" aria-labelledby="home-tools-title">
            <h2 id="home-tools-title" className="home-section-title">{t.home_tools_title}</h2>
            <div className="home-quick-grid">
              <button
                id="btn-home-action-timer"
                type="button"
                className="home-quick-tile"
                onClick={onStartTimer}
              >
                <span className="home-quick-icon" aria-hidden="true">
                  <AppIcon name="timer" size={19} />
                </span>
                <span className="home-quick-label">
                  {t.home_timer_label || t.global_start_timer}
                </span>
              </button>

              <button
                id="btn-home-action-activity"
                type="button"
                className="home-quick-tile"
                onClick={handleRecordMovement}
              >
                <span className="home-quick-icon" aria-hidden="true">
                  <AppIcon name="footprints" size={19} />
                </span>
                <span className="home-quick-label">{t.act_btn_record}</span>
              </button>

              <button
                id="btn-home-action-slippery-zones"
                type="button"
                className="home-quick-tile"
                onClick={() => onNavigate('my-slippery-zones')}
              >
                <span className="home-quick-icon" aria-hidden="true">
                  <AppIcon name="alert-triangle" size={19} />
                </span>
                <span className="home-quick-label">{t.home_slippery_zones_shortcut}</span>
              </button>

              <button
                id="btn-home-action-non-negotiables"
                type="button"
                className="home-quick-tile"
                onClick={handleOpenNonNegotiables}
              >
                <span className="home-quick-icon" aria-hidden="true">
                  <AppIcon name="shield" size={19} />
                </span>
                <span className="home-quick-label">{t.commit_nn_section}</span>
              </button>
            </div>
          </section>

          {/* ── 8. My Progress ── */}
          <ProgressPreviewCard onNavigate={onNavigate} />
        </div>

        {/* ── 9. Learn, Resources & Account Links ── */}
        <section className="sda-card home-resources" aria-labelledby="home-resources-title">
          <h2 id="home-resources-title" className="sda-card-title">{t.home_resources_title}</h2>
          <div className="home-resources-grid">
            <button
              id="btn-home-link-seven-abilities"
              type="button"
              className="sda-resource-chip"
              onClick={() => onNavigate('seven-abilities')}
            >
              <AppIcon name="layers" size={15} />
              <span>{t.seven_abilities_nav_home}</span>
            </button>

            <button
              id="btn-home-link-sda-terms"
              type="button"
              className="sda-resource-chip"
              onClick={() => onNavigate('sda-terms')}
            >
              <AppIcon name="book-open" size={15} />
              <span>{t.sda_terms_link}</span>
            </button>

            <button
              id="btn-home-link-quiz"
              type="button"
              className="sda-resource-chip"
              onClick={() => onNavigate('quiz')}
            >
              <AppIcon name="help-circle" size={15} />
              <span>{t.home_quiz_link}</span>
            </button>

            <button
              id="btn-home-link-timer-learn"
              type="button"
              className="sda-resource-chip"
              onClick={() => onNavigate('timer-learn')}
            >
              <AppIcon name="clock" size={15} />
              <span>{t.home_timer_learn_link}</span>
            </button>

            <button
              id="btn-home-link-daily-audio"
              type="button"
              className="sda-resource-chip"
              onClick={() => onNavigate('daily-audio')}
            >
              <AppIcon name="music" size={15} />
              <span>{t.home_daily_audio}</span>
            </button>

            <button
              id="btn-home-link-history"
              type="button"
              className="sda-resource-chip"
              onClick={() => onNavigate('history')}
            >
              <AppIcon name="history" size={15} />
              <span>{t.home_history}</span>
            </button>

            <button
              id="btn-home-link-commitment"
              type="button"
              className="sda-resource-chip"
              onClick={() => onNavigate('commitment')}
            >
              <AppIcon name="heart" size={15} />
              <span>{t.commit_label}</span>
            </button>

            <button
              id="btn-home-link-dashboard"
              type="button"
              className="sda-resource-chip"
              onClick={() => onNavigate('dashboard')}
            >
              <AppIcon name="bar-chart" size={15} />
              <span>{t.home_dashboard}</span>
            </button>

            <button
              id="btn-home-link-program"
              type="button"
              className="sda-resource-chip"
              onClick={() => window.open(PROGRAM_URL, '_blank', 'noopener,noreferrer')}
            >
              <AppIcon name="external-link" size={15} />
              <span>{t.prog_btn_label}</span>
            </button>

            <button
              id="btn-home-link-feedback"
              type="button"
              className="sda-resource-chip"
              onClick={() =>
                window.open(
                  `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(FEEDBACK_SUBJECT)}`,
                  '_blank'
                )
              }
            >
              <AppIcon name="mail" size={15} />
              <span>{t.home_feedback}</span>
            </button>

            <button
              id="btn-home-link-exit"
              type="button"
              className="sda-resource-chip sda-resource-chip--muted"
              onClick={handleExit}
            >
              <AppIcon name="log-out" size={15} />
              <span>{t.home_exit}</span>
            </button>
          </div>
        </section>
      </main>

      {/* Backward compatibility alias for btn-main-commitment */}
      <button
        id="btn-main-commitment"
        type="button"
        style={{ display: 'none' }}
        aria-hidden="true"
        tabIndex={-1}
        onClick={() => onNavigate('commitment')}
      >
        {t.commit_label}
      </button>

      {/* Discreet Global SDA Brand & Slogan */}
      <footer className="home-brand-hero" aria-label={t.sda_slogan}>
        <span className="home-brand-hero-badge">SDA</span>
        <p className="home-brand-hero-slogan">{t.sda_slogan_tagline}</p>
      </footer>
    </div>
  );
}
