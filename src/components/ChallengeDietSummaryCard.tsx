/**
 * SDA Ability Challenges System — Challenge Diet Summary Card (Phase 41G)
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

  const profileDisplayName = activeProfile ? (getGoalDisplayName(activeProfile, t) || activeProfile.name) : 'Diet Plan';
  const isFree = dayPlan.mode === 'free';
  const displayedBlocks = dayPlan.blocks.slice(0, 4);

  return (
    <div className="challenge-diet-card" id="challenge-diet-summary-card">
      <div className="challenge-diet-header">
        <div className="challenge-diet-title-wrap">
          <span className="challenge-diet-icon">🥗</span>
          <div className="challenge-diet-meta">
            <h3 className="challenge-diet-title">
              {t.challenge_diet_summary_title || "Today's Structured Diet"}
            </h3>
            <div className="challenge-diet-badges">
              <span className="challenge-diet-profile-pill">
                {profileDisplayName}
              </span>
              {isFree ? (
                <span className="challenge-diet-mode-pill challenge-diet-mode-pill--free">
                  Free Day
                </span>
              ) : (
                <span className="challenge-diet-mode-pill challenge-diet-mode-pill--structured">
                  Structured
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
          <div className="challenge-diet-progress-bar-wrap">
            <div
              className="challenge-diet-progress-bar-fill"
              style={{
                width: `${stats.plannedCount > 0 ? Math.min(100, Math.round((stats.reportedCount / stats.plannedCount) * 100)) : 0}%`,
              }}
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
            let statusIcon = '○';

            if (entry) {
              if (entry.status === 'on-track') {
                if (entry.detailedOutcome === 'twenty_percent_off_track') {
                  statusType = 'flexible';
                  statusLabel = t.challenge_diet_status_flexible || '20% Off Track';
                  statusIcon = '⚡';
                } else {
                  statusType = 'on-track';
                  statusLabel = t.challenge_diet_status_on_track || 'On Track';
                  statusIcon = '✓';
                }
              } else if (entry.status === 'slip') {
                statusType = 'slip';
                statusLabel = t.challenge_diet_status_slip || 'True Slip';
                statusIcon = '↻';
              }
            }

            const primaryDesc = getBlockPrimaryDescription(block, t) || block.type;

            return (
              <div key={block.id} className={`challenge-diet-block-item challenge-diet-block-item--${statusType}`}>
                <div className="challenge-diet-block-left">
                  <span className="challenge-diet-block-time">
                    {block.startTime} – {block.endTime}
                  </span>
                  <span className="challenge-diet-block-desc">{primaryDesc}</span>
                </div>
                <div className="challenge-diet-block-right">
                  <span className={`challenge-diet-status-tag challenge-diet-status-tag--${statusType}`}>
                    <span>{statusIcon}</span>
                    <span>{statusLabel}</span>
                  </span>
                </div>
              </div>
            );
          })}
          {dayPlan.blocks.length > 4 && (
            <div className="challenge-diet-more-hint">
              +{dayPlan.blocks.length - 4} more planned blocks
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
          <span>→</span>
        </button>
      </div>
    </div>
  );
};
