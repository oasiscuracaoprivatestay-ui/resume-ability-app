/**
 * SDA Ability Challenges System — Challenge Diet Summary Card (Phase 41G / Phase 3 Midnight Emerald)
 *
 * Lightweight daily summary of today's Structured Diet:
 * 1. Reads today's planned blocks and active profile without mounting the heavy StructuredDietScreen.
 * 2. Compares against daily verification records to determine block status (On Track, 20% Flexible, Slip, Pending).
 * 3. Strictly preserves 20% flexibility semantics (never counted as a slip).
 * 4. Navigates cleanly to StructuredDietScreen for full verification and adjustments.
 */

import React from 'react';
import { useTranslation } from '../i18n';
import {
  getDayPlan,
  getLocalTodayKey,
  getLocalDateKey,
  getActiveProfile,
  getGoalDisplayName,
  getBlockPrimaryDescription,
} from '../utils/dietStorage';
import {
  getDailyDietVerification,
  getDailyVerificationStats,
} from '../utils/dietVerificationStorage';
import { AppIcon, type AppIconName } from './icons/AppIcon';
import './ChallengeDietSummaryCard.css';

interface ChallengeDietSummaryCardProps {
  onNavigate: (screen: any) => void;
}

export const ChallengeDietSummaryCard: React.FC<ChallengeDietSummaryCardProps> = ({ onNavigate }) => {
  const { t } = useTranslation();

  const todayKey = getLocalTodayKey();
  const dateKey = getLocalDateKey();
  const activeProfile = getActiveProfile();
  const dayPlan = activeProfile?.diet
    ? getDayPlan(activeProfile.diet, todayKey)
    : { dayKey: todayKey, dayOfWeek: 0, mode: 'structured' as const, blocks: [] };
  const verification = getDailyDietVerification(dateKey);
  const scheduledBlockIds = dayPlan.blocks.map((b) => b.id);
  const stats = getDailyVerificationStats(dayPlan.blocks.length, dateKey, scheduledBlockIds);

  const profileDisplayName = activeProfile
    ? getGoalDisplayName(activeProfile, t) || activeProfile.name
    : 'Diet Plan';
  const isFree = dayPlan.mode === 'free';
  const displayedBlocks = dayPlan.blocks.slice(0, 4);
  const progressPct =
    stats.plannedCount > 0
      ? Math.min(100, Math.round((stats.reportedCount / stats.plannedCount) * 100))
      : 0;

  return (
    <div className="challenge-diet-card" id="challenge-diet-summary-card">
      <div className="challenge-diet-header">
        <div className="challenge-diet-title-wrap">
          <span className="challenge-diet-icon" aria-hidden="true">
            <AppIcon name="utensils" size={18} />
          </span>
          <div className="challenge-diet-meta">
            <h4 className="challenge-diet-title">
              {t.challenge_diet_summary_title || "Today's Structured Diet"}
            </h4>
            <div className="challenge-diet-badges">
              <span className="challenge-diet-profile-pill">{profileDisplayName}</span>
              {isFree ? (
                <span className="challenge-diet-mode-pill challenge-diet-mode-pill--free">
                  {t.challenge_diet_mode_free || 'Free Day'}
                </span>
              ) : (
                <span className="challenge-diet-mode-pill challenge-diet-mode-pill--structured">
                  {t.challenge_diet_mode_structured || 'Structured'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="challenge-diet-progress-col">
          <span className="challenge-diet-progress-text">
            {t.challenge_diet_blocks_verified
              ?.replace('{verified}', String(stats.reportedCount))
              ?.replace('{total}', String(stats.plannedCount)) ||
              `${stats.reportedCount} of ${stats.plannedCount} blocks verified`}
          </span>
          <div className="challenge-diet-progress-bar-wrap" aria-hidden="true">
            <div
              className="challenge-diet-progress-bar-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {dayPlan.blocks.length === 0 ? (
        <div className="challenge-diet-empty">
          <p>{t.challenge_diet_no_blocks || 'No meal blocks scheduled for today.'}</p>
        </div>
      ) : (
        <div className="challenge-diet-blocks-list">
          {displayedBlocks.map((block) => {
            const entry = verification?.entries?.find(
              (e) => e.plannedBlockId === block.id || e.id === block.id
            );

            let statusType: 'on-track' | 'flexible' | 'slip' | 'pending' = 'pending';
            let statusLabel = t.challenge_diet_status_pending || 'Pending';
            let statusIcon: AppIconName | null = null;

            if (entry) {
              if (entry.status === 'on-track') {
                if (entry.detailedOutcome === 'twenty_percent_off_track') {
                  statusType = 'flexible';
                  statusLabel = t.challenge_diet_status_flexible || '20% Off Track';
                  statusIcon = 'zap';
                } else {
                  statusType = 'on-track';
                  statusLabel = t.challenge_diet_status_on_track || 'On Track';
                  statusIcon = 'check';
                }
              } else if (entry.status === 'slip') {
                statusType = 'slip';
                statusLabel = t.challenge_diet_status_slip || 'True Slip';
                statusIcon = 'rotate-ccw';
              }
            }

            const primaryDesc = getBlockPrimaryDescription(block, t) || block.type;

            return (
              <div
                key={block.id}
                className={`challenge-diet-block-item challenge-diet-block-item--${statusType}`}
              >
                <div className="challenge-diet-block-meta-row">
                  <span className="challenge-diet-block-time">
                    <AppIcon name="clock" size={12} />
                    <span>
                      {block.startTime} – {block.endTime}
                    </span>
                  </span>
                  <span className={`challenge-diet-status-tag challenge-diet-status-tag--${statusType}`}>
                    {statusIcon ? (
                      <AppIcon name={statusIcon} size={11} strokeWidth={2.5} />
                    ) : (
                      <span className="challenge-diet-pending-dot" aria-hidden="true" />
                    )}
                    <span>{statusLabel}</span>
                  </span>
                </div>
                <p className="challenge-diet-block-desc">{primaryDesc}</p>
              </div>
            );
          })}
          {dayPlan.blocks.length > 4 && (
            <div className="challenge-diet-more-hint">
              {(t.challenge_diet_more_blocks || '+{count} more planned blocks').replace(
                '{count}',
                String(dayPlan.blocks.length - 4)
              )}
            </div>
          )}
        </div>
      )}

      <div className="challenge-diet-actions">
        <button
          type="button"
          id="btn-challenge-open-diet"
          className="challenge-diet-open-btn"
          onClick={() => onNavigate('structured-diet')}
        >
          <span>{t.challenge_diet_btn_open || 'Open Structured Diet'}</span>
          <AppIcon name="chevron-right" size={16} />
        </button>
      </div>
    </div>
  );
};
