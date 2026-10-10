/**
 * Super Diet-Ability — Compact "My Progress" preview (Phase 2)
 *
 * Real data only, read from existing stores:
 *   - Days checked in (active Challenge practice stats)
 *   - Resume Rate (null → "No slips yet", never a fake 0% / 100%)
 *   - Today's score (scoring engine)
 *   - Movement minutes today (activity store; score-neutral)
 *
 * The full My Progress & Victories experience arrives in a later phase;
 * "See all" opens the existing Dashboard.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n';
import type { Screen } from '../../types';
import {
  calculateChallengePracticeStats,
  CHALLENGE_UPDATED_EVENT,
} from '../../challenges';
import { readActiveChallenge } from './readActiveChallenge';
import { getTodayScore, SCORE_UPDATED_EVENT } from '../../utils/scoringEngine';
import { getDailyActivitySummary, ACTIVITIES_UPDATED_EVENT } from '../../activities';
import { getLocalDateKey } from '../../utils/dietStorage';
import { STATS_RESET_EVENT } from '../../utils/resetStats';
import { formatTemplate } from '../../utils/homeSelectors';
import { AppIcon, type AppIconName } from '../icons/AppIcon';

interface ProgressPreviewCardProps {
  onNavigate: (screen: Screen) => void;
}

interface Snapshot {
  daysChecked: number | null;
  durationDays: number | null;
  resumeRate: number | null;
  todayScore: number;
  movementMinutes: number;
}

function readSnapshot(): Snapshot {
  let daysChecked: number | null = null;
  let durationDays: number | null = null;
  let resumeRate: number | null = null;
  try {
    const ch = readActiveChallenge();
    if (ch) {
      daysChecked = calculateChallengePracticeStats(ch).daysCheckedIn;
      durationDays = ch.durationDays;
      resumeRate = ch.relevantEventCounts?.resumeRate ?? null;
    }
  } catch {
    // ignore
  }
  let todayScore = 0;
  try {
    todayScore = getTodayScore();
  } catch {
    // ignore
  }
  let movementMinutes = 0;
  try {
    movementMinutes = getDailyActivitySummary(getLocalDateKey()).totalDurationMinutes;
  } catch {
    // ignore
  }
  return { daysChecked, durationDays, resumeRate, todayScore, movementMinutes };
}

export function ProgressPreviewCard({ onNavigate }: ProgressPreviewCardProps) {
  const { t } = useTranslation();
  const [snap, setSnap] = useState<Snapshot>(() => readSnapshot());

  useEffect(() => {
    const refresh = () => setSnap(readSnapshot());
    const events = [CHALLENGE_UPDATED_EVENT, SCORE_UPDATED_EVENT, ACTIVITIES_UPDATED_EVENT, STATS_RESET_EVENT];
    events.forEach((e) => window.addEventListener(e, refresh));
    return () => events.forEach((e) => window.removeEventListener(e, refresh));
  }, []);

  const metrics: { id: string; icon: AppIconName; label: string; value: string; sub?: string }[] = [
    {
      id: 'home-progress-days',
      icon: 'check-circle',
      label: t.home_progress_days_checked,
      value: snap.daysChecked === null ? '—' : String(snap.daysChecked),
      sub:
        snap.durationDays === null
          ? undefined
          : formatTemplate(t.home_hero_of_total, { total: snap.durationDays }),
    },
    {
      id: 'home-progress-resume',
      icon: 'rotate-ccw',
      label: t.home_progress_resume_rate,
      value: snap.resumeRate === null ? '—' : `${snap.resumeRate}%`,
      sub: snap.resumeRate === null && snap.daysChecked !== null ? t.home_progress_resume_none : undefined,
    },
    {
      id: 'home-progress-score',
      icon: 'sparkles',
      label: t.home_progress_today_score,
      value: String(snap.todayScore),
    },
    {
      id: 'home-progress-movement',
      icon: 'footprints',
      label: t.home_progress_movement,
      value: formatTemplate(t.home_progress_minutes, { minutes: snap.movementMinutes }),
    },
  ];

  return (
    <section className="sda-card sda-progress" aria-labelledby="sda-progress-title" id="home-progress-preview">
      <header className="sda-card-head">
        <h2 id="sda-progress-title" className="sda-card-title">{t.home_progress_title}</h2>
        <button
          id="btn-home-progress-see-all"
          type="button"
          className="sda-link-btn"
          onClick={() => onNavigate('progress-victories')}
        >
          {t.home_progress_see_all}
          <AppIcon name="chevron-right" size={14} />
        </button>
      </header>
      <ul className="sda-progress-grid">
        {metrics.map((m) => (
          <li key={m.id} id={m.id} className="sda-metric">
            <span className="sda-metric-icon" aria-hidden="true">
              <AppIcon name={m.icon} size={18} />
            </span>
            <span className="sda-metric-value">{m.value}</span>
            <span className="sda-metric-label">{m.label}</span>
            {m.sub && <span className="sda-metric-sub">{m.sub}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default ProgressPreviewCard;
