/**
 * Super Diet-Ability — Persistent Minimizable Challenge Status Bar (Phase 7)
 *
 * Shows an active Challenge summary across all non-redundant screens.
 * Reuses existing Challenge storage and progress calculation utilities:
 *   - readActiveChallenge()
 *   - getCanonicalAbilityName()
 *   - formatTemplate()
 *
 * Features:
 *   - Hidden on home, challenges, and timer screens (where redundant or disruptive)
 *   - Shows real Challenge day, total duration, ability name, and subtle progress
 *   - Tapping navigates to Challenge Control Center (onNavigate('challenges'))
 *   - Minimizable/expandable with preference persisted to localStorage
 *   - Full EN/ES/NL localization and accessible keyboard navigation
 *   - Does not mutate scores, challenges, or check-ins (strictly read-only)
 */

import { useEffect, useState } from 'react';
import type { Screen } from '../../types';
import { useTranslation } from '../../i18n';
import {
  CHALLENGE_UPDATED_EVENT,
  getCanonicalAbilityName,
  type ChallengeInstance,
} from '../../challenges';
import { STATS_RESET_EVENT } from '../../utils/resetStats';
import { formatTemplate } from '../../utils/homeSelectors';
import { readActiveChallenge } from './readActiveChallenge';
import { AppIcon } from '../icons/AppIcon';
import './PersistentChallengeBar.css';

const STORAGE_KEY = 'sda_challenge_bar_minimized';

/**
 * Screens where showing the persistent bar is redundant (home already has full ChallengeHero,
 * challenges is the Control Center itself) or disruptive (timer/loop is focused urge-surfing).
 */
const HIDDEN_SCREENS: readonly Screen[] = ['home', 'challenges', 'timer'];

interface PersistentChallengeBarProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
}

export function PersistentChallengeBar({ currentScreen, onNavigate }: PersistentChallengeBarProps) {
  const { t } = useTranslation();
  const [challenge, setChallenge] = useState<ChallengeInstance | null>(() => readActiveChallenge());
  const [minimized, setMinimized] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const refresh = () => {
      setChallenge(readActiveChallenge());
    };

    refresh();
    window.addEventListener(CHALLENGE_UPDATED_EVENT, refresh);
    window.addEventListener(STATS_RESET_EVENT, refresh);

    return () => {
      window.removeEventListener(CHALLENGE_UPDATED_EVENT, refresh);
      window.removeEventListener(STATS_RESET_EVENT, refresh);
    };
  }, []);

  if (HIDDEN_SCREENS.includes(currentScreen)) {
    return null;
  }

  if (!challenge || challenge.status !== 'active') {
    return null;
  }

  const currentDay = challenge.currentDay;
  const totalDays = challenge.durationDays;
  const progressPct = Math.min(100, Math.max(0, Math.round((challenge.progress ?? 0) * 100)));
  const abilityName = getCanonicalAbilityName(challenge.abilityId);

  const dayLabel = formatTemplate(t.challenge_status_bar_day, {
    current: currentDay,
    total: totalDays,
  });

  const fullAccessibleLabel = `${t.challenge_status_bar_aria}: ${dayLabel}, ${abilityName}. ${t.challenge_status_bar_view}`;

  const handleNavigate = () => {
    onNavigate('challenges');
  };

  const handleToggleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMinimized((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  return (
    <aside
      className="sda-persistent-bar-wrapper"
      role="complementary"
      aria-label={t.challenge_status_bar_aria}
      id="persistent-challenge-status"
    >
      <div
        className={`sda-persistent-bar ${
          minimized ? 'sda-persistent-bar--minimized' : 'sda-persistent-bar--expanded'
        }`}
      >
        <button
          type="button"
          className="sda-bar-main"
          onClick={handleNavigate}
          aria-label={fullAccessibleLabel}
          id="btn-challenge-status-main"
        >
          {minimized ? (
            <>
              <span className="sda-bar-min-icon" aria-hidden="true">
                <AppIcon name="trophy" size={13} />
              </span>
              <span className="sda-bar-min-text">{dayLabel}</span>
              <span className="sda-bar-min-pct" aria-hidden="true">
                {progressPct}%
              </span>
            </>
          ) : (
            <>
              <div className="sda-bar-icon-box" aria-hidden="true">
                <AppIcon name="trophy" size={14} />
              </div>
              <div className="sda-bar-meta-col">
                <div className="sda-bar-meta-row">
                  <span className="sda-bar-day-badge">{dayLabel}</span>
                  <span className="sda-bar-separator" aria-hidden="true">
                    •
                  </span>
                  <span className="sda-bar-ability-name">{abilityName}</span>
                </div>
              </div>
              <div className="sda-bar-nav-hint">
                <span>{t.challenge_status_bar_view}</span>
                <AppIcon name="chevron-right" size={12} />
              </div>
            </>
          )}
        </button>

        <button
          type="button"
          id="btn-toggle-challenge-bar"
          className="sda-bar-toggle-btn"
          onClick={handleToggleMinimize}
          aria-label={minimized ? t.challenge_status_bar_expand : t.challenge_status_bar_minimize}
          aria-expanded={!minimized}
        >
          <AppIcon name={minimized ? 'chevron-down' : 'chevron-up'} size={14} />
        </button>

        {!minimized && (
          <div className="sda-bar-progress-track" aria-hidden="true">
            <div
              className="sda-bar-progress-fill"
              style={{ width: `${Math.max(progressPct, 2)}%` }}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
