/**
 * Super Diet-Ability — Premium Challenge Hero (Phase 2)
 *
 * The primary Home hero. Reuses the existing Challenge engine verbatim:
 *   - syncCurrentChallenge / getChallengeDayBreakdown / calculateChallengePracticeStats
 *   - invitation eligibility + snooze (canShowChallengeInvitation, setChallengeInvitationSnooze)
 *
 * States:
 *   1. Active Challenge → actual ability, actual duration (1/3/7/30/90), current day,
 *      progress ring, and a compact window of real Challenge days with check-in marks.
 *   2. No active Challenge, invitation eligible → flagship 90-Day Resume-Ability invite
 *      with "Remind me later" snooze.
 *   3. No active Challenge, invitation snoozed → compact invite (respects the snooze).
 *
 * The "I Am on Track" control calls the existing onInControl handler unchanged.
 * This component never writes scores or Challenge data itself.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../i18n';
import type { Screen } from '../../types';
import {
  getChallengeDayBreakdown,
  canShowChallengeInvitation,
  setChallengeInvitationSnooze,
  markChallengeInvitationPrompted,
  getCanonicalAbilityName,
  CHALLENGE_UPDATED_EVENT,
  CHALLENGE_PRESELECT_DURATION_KEY,
  type ChallengeInstance,
  type ChallengeDayProgress,
  type SnoozeOptionDays,
} from '../../challenges';
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

export function ChallengeHero({ onNavigate, onInControl }: ChallengeHeroProps) {
  const { t, lang } = useTranslation();
  const [challenge, setChallenge] = useState<ChallengeInstance | null>(null);
  const [days, setDays] = useState<ChallengeDayProgress[]>([]);
  const [inviteEligible, setInviteEligible] = useState(false);
  const [showSnooze, setShowSnooze] = useState(false);

  const refresh = () => {
    const current = readActiveChallenge();
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
    window.addEventListener(STATS_RESET_EVENT, onUpdate);
    return () => {
      window.removeEventListener(CHALLENGE_UPDATED_EVENT, onUpdate);
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

  const onTrackButton = (
    <button
      id="btn-in-control"
      type="button"
      className="sda-hero-ontrack"
      onClick={onInControl ?? (() => onNavigate('control'))}
    >
      <span className="sda-hero-ontrack-script">{t.home_in_control}</span>
      <span className="sda-hero-ontrack-check" aria-hidden="true">
        <AppIcon name="check" size={14} strokeWidth={3} />
      </span>
    </button>
  );

  // ── State 2 & 3: no active Challenge → flagship 90-Day invitation ──
  if (!challenge) {
    const startFlagship = () => {
      markChallengeInvitationPrompted();
      try {
        sessionStorage.setItem(CHALLENGE_PRESELECT_DURATION_KEY, String(FLAGSHIP_DURATION));
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
        className={`sda-hero sda-hero--invite${inviteEligible ? '' : ' sda-hero--compact'}`}
        aria-labelledby="sda-hero-invite-title"
      >
        <div className="sda-hero-media" aria-hidden="true">
          <img src={HERO_IMAGE_URL} alt="" decoding="async" loading="eager" />
        </div>
        <div className="sda-hero-body" id="challenge-invitation-card">
          <span className="sda-hero-eyebrow">{t.home_hero_invite_eyebrow}</span>
          <h2 id="sda-hero-invite-title" className="sda-hero-title">
            {t.home_hero_invite_title}
          </h2>
          <span className="sda-hero-ability">{getCanonicalAbilityName('resume-ability')}</span>
          {inviteEligible && <p className="sda-hero-copy">{t.home_hero_invite_body}</p>}

          <div className="sda-hero-invite-actions">
            <button
              id="btn-invite-start-challenge"
              type="button"
              className="sda-btn-primary"
              onClick={startFlagship}
            >
              <span>{t.home_hero_invite_cta}</span>
              <AppIcon name="chevron-right" size={18} />
            </button>
            <div className="sda-hero-invite-links">
              <button
                id="btn-invite-other-duration"
                type="button"
                className="sda-link-btn"
                onClick={() => {
                  markChallengeInvitationPrompted();
                  onNavigate('challenges');
                }}
              >
                {t.home_hero_invite_other}
              </button>
              {inviteEligible && !showSnooze && (
                <button
                  id="btn-invite-remind-later"
                  type="button"
                  className="sda-link-btn sda-link-btn--muted"
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
                      className="sda-chip"
                      onClick={() => handleSnooze(d)}
                    >
                      {t[`challenge_snooze_${d}d` as 'challenge_snooze_1d']}
                    </button>
                  ))}
                  <button
                    id="btn-snooze-not-now"
                    type="button"
                    className="sda-chip sda-chip--ghost"
                    onClick={() => handleSnooze('not_now')}
                  >
                    {t.challenge_snooze_not_now}
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="sda-hero-ontrack-row">{onTrackButton}</div>
        </div>
      </section>
    );
  }

  // ── State 1: active Challenge (all values from the engine) ──
  const { currentDay, durationDays, daysRemaining } = challenge;
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
      className="sda-hero sda-hero--active"
      aria-labelledby="sda-hero-title"
      data-duration={durationDays}
      data-current-day={currentDay}
    >
      <div className="sda-hero-media" aria-hidden="true">
        <img src={HERO_IMAGE_URL} alt="" decoding="async" loading="eager" />
      </div>
      <div className="sda-hero-body" id="active-challenge-card">
        <div className="sda-hero-top">
          <div>
            <span className="sda-hero-eyebrow">{t.home_hero_eyebrow}</span>
            <h2 id="sda-hero-title" className="sda-hero-title">
              {formatTemplate(t.home_hero_title_days, { days: durationDays })}
            </h2>
            <span className="sda-hero-ability">{getCanonicalAbilityName(challenge.abilityId)}</span>
          </div>
          <button
            id="btn-home-view-challenge"
            type="button"
            className="sda-icon-btn"
            onClick={() => onNavigate('challenges')}
            aria-label={t.home_hero_open_challenge}
            title={t.home_hero_open_challenge}
          >
            <AppIcon name="chevron-right" size={20} />
          </button>
        </div>

        <div className="sda-hero-mid">
          <ProgressRing value={progress} size={128} strokeWidth={9} ariaLabel={ringAria}>
            <span className="sda-ring-kicker">{t.home_hero_day_label}</span>
            <span className="sda-ring-number" id="sda-hero-current-day">{currentDay}</span>
            <span className="sda-ring-total">
              {formatTemplate(t.home_hero_of_total, { total: durationDays })}
            </span>
          </ProgressRing>
          <div className="sda-hero-mid-side">
            <span className="sda-hero-remaining">{remainingLabel}</span>
            {onTrackButton}
          </div>
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
                    {checked ? <AppIcon name="check" size={13} strokeWidth={3} /> : null}
                  </span>
                  <span className="sda-day-letter" aria-hidden="true">{letter}</span>
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
