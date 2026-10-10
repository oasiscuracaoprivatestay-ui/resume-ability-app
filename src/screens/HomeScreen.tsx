/**
 * Super Diet-Ability — Premium Home (Phase 2 redesign)
 *
 * Information hierarchy (approved):
 *   1. Active Challenge hero (or flagship 90-Day invite) — <ChallengeHero />
 *   2. Daily Check-In (primary action) + "I slipped — resume now" chip
 *   3. Today's Focus (real next meal / beverage)
 *   4. Quick Actions (2×2)
 *   5. Compact My Progress preview (real metrics only)
 *   6. Everything else via the bottom navigation and the More sheet
 *
 * Behaviour preservation:
 *   - Props are unchanged (onNavigate, onStartTimer, onInControl).
 *   - "I Am on Track" calls the existing onInControl handler (I_AM_IN_CONTROL event).
 *   - No score events are recorded here; existing screens/handlers own all scoring.
 *   - Every previous Home entry point remains reachable (More sheet), with the
 *     same element ids used by existing automated regression scripts.
 */

import { useEffect, useState } from 'react';
import type { Screen } from '../types';
import { useTranslation } from '../i18n';
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
    return { hasActiveChallenge: true, checkedInToday: calculateChallengePracticeStats(ch).todayCheckedIn };
  }
  let checkedInToday = false;
  try {
    checkedInToday = getTodayCheckIns().length > 0;
  } catch {
    // ignore
  }
  return { hasActiveChallenge: false, checkedInToday };
}

export default function HomeScreen({
  onNavigate,
  onStartTimer: _onStartTimer,
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

  // Daily Check-In: with an active Challenge, open the Challenge check-in
  // (existing deep-link path); otherwise open the global Daily Check-In screen.
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



  return (
    <>
      <div className="screen home-screen home-premium">
        <header className="home-top-bar">
          <h1 className="home-brand-h1">
            <button className="home-brand-btn" onClick={() => onNavigate('home')} aria-label={t.home_brand_title}>
              <span className="home-brand-kicker">SUPER</span>
              <span className="home-brand-title">DIET-ABILITY</span>
            </button>
          </h1>
          <div className="home-top-right">
            <GlobalScoreBadge onNavigate={onNavigate} />
            <div className="home-top-lang">
              <LanguageSelector />
            </div>
            <button
              id="btn-home-menu"
              type="button"
              className="sda-icon-btn"
              onClick={() => onOpenMore?.()}
              aria-label={t.home_menu_open}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              aria-controls="sda-more-sheet"
            >
              <AppIcon name="menu" size={22} />
            </button>
          </div>
        </header>

        <main className="home-premium-grid">
          <div className="home-col home-col--primary">
            {/* 1. Active Challenge hero / flagship invite */}
            <ChallengeHero onNavigate={onNavigate} onInControl={onInControl} />

            {/* 2. Daily Check-In — primary action */}
            <div className="home-checkin-block">
              <button id="btn-daily-checkin" type="button" className="sda-btn-primary sda-btn-primary--xl" onClick={handleDailyCheckIn}>
                <span className="home-checkin-text">
                  <span className="home-checkin-label">
                    {checkIn.checkedInToday ? t.challenge_btn_checkin_again : t.ci_entry_label}
                  </span>
                  {checkIn.checkedInToday && (
                    <span className="home-checkin-status">
                      <AppIcon name="check" size={13} strokeWidth={3} />
                      {t.home_checkin_done_today}
                    </span>
                  )}
                </span>
                <AppIcon name="chevron-right" size={22} />
              </button>
              <button id="btn-slipped" type="button" className="home-slip-chip" onClick={() => onNavigate('slip-type')}>
                <AppIcon name="rotate-ccw" size={16} />
                <span>{t.home_slipped_chip}</span>
              </button>
            </div>

            {/* 3. Today's Focus */}
            <TodayFocusCard onNavigate={onNavigate} />
          </div>

          <div className="home-col home-col--secondary">
            {/* 4. Quick Actions */}
            <section className="home-quick" aria-labelledby="home-quick-title">
              <h2 id="home-quick-title" className="home-section-title">{t.home_quick_title}</h2>
              <div className="home-quick-grid">
                <button id="btn-structured-diet" type="button" className="home-quick-tile" onClick={() => onNavigate('structured-diet')}>
                  <span className="home-quick-icon" aria-hidden="true"><AppIcon name="utensils" size={22} /></span>
                  <span className="home-quick-label">{t.home_quick_plan_meal}</span>
                </button>
                <button id="btn-home-progress" type="button" className="home-quick-tile" onClick={() => onNavigate('progress-victories')}>
                  <span className="home-quick-icon" aria-hidden="true"><AppIcon name="bar-chart" size={22} /></span>
                  <span className="home-quick-label">{t.home_quick_progress}</span>
                </button>
                <button id="btn-my-commitments" type="button" className="home-quick-tile" onClick={() => onNavigate('my-commitments')}>
                  <span className="home-quick-icon" aria-hidden="true"><AppIcon name="clipboard-list" size={22} /></span>
                  <span className="home-quick-label">{t.home_quick_commitments}</span>
                </button>
                <button id="btn-sda-coach" type="button" className="home-quick-tile" onClick={() => onNavigate('coach')}>
                  <span className="home-quick-icon" aria-hidden="true"><AppIcon name="message-circle" size={22} /></span>
                  <span className="home-quick-label">{t.home_quick_coach}</span>
                </button>
              </div>
            </section>

            {/* 5. Compact My Progress preview */}
            <ProgressPreviewCard onNavigate={onNavigate} />
          </div>
        </main>

        {/* Backward compatibility alias for btn-main-commitment */}
        <button
          id="btn-main-commitment"
          style={{ display: 'none' }}
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => onNavigate('commitment')}
        >
          {t.commit_label}
        </button>

        {/* ── Global SDA Brand & Slogan (Phase 26H), kept discreet at the end of Home ── */}
        <footer className="home-brand-hero" aria-label={t.sda_slogan}>
          <span className="home-brand-hero-badge">SDA</span>
          <p className="home-brand-hero-slogan">{t.sda_slogan_tagline}</p>
        </footer>
      </div>
    </>
  );
}
