/**
 * Super Diet-Ability — Premium Challenge Hero
 *
 * Uses the approved coastal sunrise photograph (/images/hero-atmosphere.jpg)
 * and reuses the existing Challenge engine verbatim:
 *   - readActiveChallenge / getChallengeDayBreakdown / calculateChallengePracticeStats
 *   - invitation eligibility + snooze (canShowChallengeInvitation, setChallengeInvitationSnooze)
 *
 * States:
 *   1. Active Challenge → actual ability, actual duration (1/3/7/30/90), current day,
 *      progress ring, days remaining, honest today status (cursive "I Am on Track" ONLY
 *      when supported by actual today application state), and 7-day check-in strip.
 *   2. No active Challenge, invitation eligible → flagship 90-Day Resume-Ability invite
 *      with "Start the 90-Day Challenge", "Choose another duration", and "Remind me later".
 *   3. No active Challenge, invitation snoozed → compact invite respecting snooze.
 *
 * Never writes scores or Challenge data itself.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../i18n';
import type { Screen } from '../../types';
import {
  getChallengeDayBreakdown,
  calculateChallengePracticeStats,
  canShowChallengeInvitation,
  setChallengeInvitationSnooze,
  markChallengeInvitationPrompted,
  getCanonicalAbilityName,
  CHALLENGE_UPDATED_EVENT,
  CHALLENGE_PRESELECT_DURATION_KEY,
  CHALLENGE_OPEN_DURATION_MODAL_KEY,
  type ChallengeInstance,
  type ChallengeDayProgress,
  type SnoozeOptionDays,
} from '../../challenges';
import { loadInControlEvents } from '../../utils/inControlStorage';
import { SCORE_UPDATED_EVENT } from '../../utils/scoringEngine';
import { STATS_RESET_EVENT } from '../../utils/resetStats';
import { getHeroWeekWindow, dateKeyToLocalDate, formatTemplate } from '../../utils/homeSelectors';
import { ProgressRing } from './ProgressRing';
import { readActiveChallenge } from './readActiveChallenge';
import { AppIcon } from '../icons/AppIcon';
import './ChallengeHero.css';

const HERO_IMAGE_URL = '/images/hero-atmosphere.jpg';
const FLAGSHIP_DURATION = 90;
const SNOOZE_OPTIONS: SnoozeOptionDays[] = [1, 3, 7, 14, 30];

interface ChallengeHeroProps {
  onNavigate: (screen: Screen) => void;
  onInControl?: () => void;
}

function hasInControlToday(): boolean {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return loadInControlEvents().some((e) => e.timestamp >= startOfDay);
  } catch {
    return false;
  }
}

export function ChallengeHero({ onNavigate }: ChallengeHeroProps) {
  const { t, lang } = useTranslation();
  const [challenge, setChallenge] = useState<ChallengeInstance | null>(null);
  const [days, setDays] = useState<ChallengeDayProgress[]>([]);
  const [inviteEligible, setInviteEligible] = useState(false);
  const [showSnooze, setShowSnooze] = useState(false);
  const [inControlToday, setInControlToday] = useState(false);

  const refresh = () => {
    const current = readActiveChallenge();
    setInControlToday(hasInControlToday());
    if (current && current.status === 'active') {
      setChallenge(current);
      setDays(getChallengeDayBreakdown(current));
      setInviteEligible(false);
    } else {
      setChallenge(null);
      setDays([]);
      setInviteEligible(canShowChallengeInvitation());
    }
  };

  useEffect(() => {
    refresh();
    const onUpdate = () => refresh();
    window.addEventListener(CHALLENGE_UPDATED_EVENT, onUpdate);
    window.addEventListener(SCORE_UPDATED_EVENT, onUpdate);
    window.addEventListener(STATS_RESET_EVENT, onUpdate);
    return () => {
      window.removeEventListener(CHALLENGE_UPDATED_EVENT, onUpdate);
      window.removeEventListener(SCORE_UPDATED_EVENT, onUpdate);
      window.removeEventListener(STATS_RESET_EVENT, onUpdate);
    };
  }, []);

  const weekWindow = useMemo(() => getHeroWeekWindow(days, 7), [days]);

  const weekdayFmt = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(lang, { weekday: 'narrow' });
    } catch {
      return null;
    }
  }, [lang]);

  const longDateFmt = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'short' });
    } catch {
      return null;
    }
  }, [lang]);

  const onTrackPill = (
    <div id="status-hero-ontrack" className="sda-hero-ontrack" role="status">
      <span className="sda-hero-ontrack-script">{t.home_in_control}</span>
      <span className="sda-hero-ontrack-check" aria-hidden="true">
        <AppIcon name="check" size={13} strokeWidth={3} />
      </span>
    </div>
  );

  // ── State 2 & 3: no active Challenge → flagship 90-Day invitation (never shows "I Am on Track") ──
  if (!challenge) {
    const startFlagship = () => {
      markChallengeInvitationPrompted();
      try {
        sessionStorage.setItem(CHALLENGE_PRESELECT_DURATION_KEY, String(FLAGSHIP_DURATION));
        sessionStorage.setItem(CHALLENGE_OPEN_DURATION_MODAL_KEY, '1');
      } catch {
        // ignore
      }
      onNavigate('challenges');
    };

    const handleSnooze = (option: SnoozeOptionDays | 'not_now') => {
      setChallengeInvitationSnooze(option);
      setShowSnooze(false);
      setInviteEligible(false);
    };

    return (
      <section
        id="home-ability-challenges"
        className={`sda-challenge-hero sda-challenge-hero--invite${
          inviteEligible ? '' : ' sda-challenge-hero--compact'
        }`}
        aria-labelledby="sda-hero-invite-title"
      >
        <div className="sda-hero-media" aria-hidden="true">
          <img src={HERO_IMAGE_URL} alt="" decoding="async" loading="eager" />
        </div>

        <div className="sda-hero-body" id="challenge-invitation-card">
          <div className="sda-hero-stage-copy">
            <span className="sda-hero-eyebrow">{t.home_hero_invite_eyebrow}</span>
            <h2 id="sda-hero-invite-title" className="sda-hero-title">
              {t.home_hero_invite_title}
            </h2>
            <span className="sda-hero-ability">
              {getCanonicalAbilityName('resume-ability')}
            </span>
            {inviteEligible && <p className="sda-hero-copy">{t.home_hero_invite_body}</p>}
          </div>

          <div className="sda-hero-invite-actions">
            <button
              id="btn-invite-start-challenge"
              type="button"
              className="sda-hero-cta-primary"
              onClick={startFlagship}
            >
              <span>{t.home_hero_invite_cta}</span>
              <AppIcon name="chevron-right" size={18} />
            </button>

            <div className="sda-hero-invite-links">
              <button
                id="btn-invite-other-duration"
                type="button"
                className="sda-hero-link-btn"
                onClick={() => {
                  markChallengeInvitationPrompted();
                  try {
                    sessionStorage.setItem(CHALLENGE_OPEN_DURATION_MODAL_KEY, '1');
                  } catch {
                    // ignore
                  }
                  onNavigate('challenges');
                }}
              >
                {t.home_hero_invite_other}
              </button>
              {inviteEligible && !showSnooze && (
                <button
                  id="btn-invite-remind-later"
                  type="button"
                  className="sda-hero-link-btn sda-hero-link-btn--muted"
                  onClick={() => setShowSnooze(true)}
                  aria-expanded={showSnooze}
                >
                  {t.home_hero_invite_later}
                </button>
              )}
            </div>

            {inviteEligible && showSnooze && (
              <div className="sda-hero-snooze" role="group" aria-label={t.challenge_snooze_heading}>
                <span className="sda-hero-snooze-label">{t.challenge_snooze_heading}</span>
                <div className="sda-hero-snooze-grid">
                  {SNOOZE_OPTIONS.map((d) => (
                    <button
                      key={d}
                      id={`btn-snooze-${d}d`}
                      type="button"
                      className="sda-hero-snooze-chip"
                      onClick={() => handleSnooze(d)}
                    >
                      {t[`challenge_snooze_${d}d` as 'challenge_snooze_1d']}
                    </button>
                  ))}
                  <button
                    id="btn-snooze-not-now"
                    type="button"
                    className="sda-hero-snooze-chip sda-hero-snooze-chip--ghost"
                    onClick={() => handleSnooze('not_now')}
                  >
                    {t.challenge_snooze_not_now}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  // ── State 1: active Challenge (all values strictly from the engine) ──
  const { currentDay, durationDays, daysRemaining } = challenge;
  const practiceStats = calculateChallengePracticeStats(challenge);
  const latestStatus = practiceStats.todayLatestStatus;

  const isConfirmedOnTrack =
    (practiceStats.todayCheckedIn &&
      (latestStatus === 'on-structure' || latestStatus === 'resumed')) ||
    (!practiceStats.todayCheckedIn && inControlToday);

  let statusPillLabel = t.home_challenge_checkin_pending;
  if (practiceStats.todayCheckedIn && !isConfirmedOnTrack) {
    if (latestStatus === 'near-slip') statusPillLabel = t.kpi_status_near_slip;
    else if (latestStatus === 'slip') statusPillLabel = t.kpi_status_slip;
    else if (latestStatus === 'off-structure-aware') statusPillLabel = t.kpi_status_off_structure_aware;
    else statusPillLabel = t.home_checkin_done_today;
  }

  const progress = Math.min(1, Math.max(0, currentDay / durationDays));
  const percent = Math.round(progress * 100);
  const ringAria = formatTemplate(t.home_hero_ring_aria, {
    current: currentDay,
    total: durationDays,
    percent,
  });
  const remainingLabel =
    daysRemaining === 0
      ? t.challenge_final_day
      : formatTemplate(t.challenge_days_remaining, { days: daysRemaining });

  return (
    <section
      id="home-ability-challenges"
      className="sda-challenge-hero sda-challenge-hero--active"
      aria-labelledby="sda-hero-title"
      data-duration={durationDays}
      data-current-day={currentDay}
    >
      <div className="sda-hero-media" aria-hidden="true">
        <img src={HERO_IMAGE_URL} alt="" decoding="async" loading="eager" />
      </div>

      <div className="sda-hero-body" id="active-challenge-card">
        <div className="sda-hero-top">
          <div className="sda-hero-stage-copy">
            <span className="sda-hero-eyebrow">{t.home_hero_eyebrow}</span>
            <h2 id="sda-hero-title" className="sda-hero-title">
              {formatTemplate(t.home_hero_title_days, { days: durationDays })}
            </h2>
            <span className="sda-hero-ability">
              {getCanonicalAbilityName(challenge.abilityId)}
            </span>
          </div>
          <button
            id="btn-home-view-challenge"
            type="button"
            className="sda-hero-icon-btn"
            onClick={() => onNavigate('challenges')}
            aria-label={t.home_hero_open_challenge}
            title={t.home_hero_open_challenge}
          >
            <AppIcon name="chevron-right" size={20} />
          </button>
        </div>

        <div className="sda-hero-mid">
          <ProgressRing value={progress} size={94} strokeWidth={8} ariaLabel={ringAria}>
            <span className="sda-ring-kicker">{t.home_hero_day_label}</span>
            <span className="sda-ring-number" id="sda-hero-current-day">
              {currentDay}
            </span>
            <span className="sda-ring-total">
              {formatTemplate(t.home_hero_of_total, { total: durationDays })}
            </span>
          </ProgressRing>

          <span className="sda-hero-remaining">{remainingLabel}</span>
        </div>

        <div className="sda-hero-bottom-status">
          {isConfirmedOnTrack ? (
            onTrackPill
          ) : (
            <span className="sda-hero-status-pending">{statusPillLabel}</span>
          )}
        </div>

        {weekWindow.length > 0 && (
          <ol className="sda-hero-days" aria-label={t.home_hero_days_strip_aria}>
            {weekWindow.map((d) => {
              const date = dateKeyToLocalDate(d.dateKey);
              const checked = (d.checkInsCount ?? 0) > 0;
              const letter = weekdayFmt ? weekdayFmt.format(date) : '';
              const label = `${formatTemplate(t.challenge_day_of_total, {
                current: d.dayIndex,
                total: durationDays,
              })}, ${longDateFmt ? longDateFmt.format(date) : d.dateKey}: ${
                checked ? t.home_hero_day_checked : t.home_hero_day_not_checked
              }`;
              const cls = [
                'sda-day',
                checked ? 'sda-day--checked' : '',
                d.isToday ? 'sda-day--today' : '',
                d.isFuture ? 'sda-day--future' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <li key={d.dayIndex} className={cls} aria-label={label} data-day-index={d.dayIndex}>
                  <span className="sda-day-dot" aria-hidden="true">
                    {checked ? <AppIcon name="check" size={13} strokeWidth={3} /> : d.dayIndex}
                  </span>
                  <span className="sda-day-letter" aria-hidden="true">
                    {letter}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}

export default ChallengeHero;
