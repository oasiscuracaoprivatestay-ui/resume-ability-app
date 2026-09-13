/**
 * Centralized Activity & Statistics Reset Utility
 *
 * Exposes resetAllStats() to safely and deterministically clear all activity,
 * event, and statistical history while strictly preserving:
 *   - Why reason(s)
 *   - Non-Negotiable list
 *   - Weekly Structured Diet plan (all 7 days, blocks, foods, times)
 *   - Reminder settings & notification preferences
 *   - Language preference
 *   - Audio playback mode
 */

import { clearSlips } from '../utils';
import { clearCheckIns } from './checkInStorage';
import { clearRecommitEvents } from './recommitStorage';
import { clearInControlEvents, clearCommitEvents } from './inControlStorage';
import { clearReviewEvents } from './reviewStorage';
import { clearAllDietVerifications } from './dietVerificationStorage';
import { resetPledgeStats } from './pledgeStorage';
import { clearBalance } from './balanceStorage';
import { clearNotificationDeliveryState } from './notificationSettingsStorage';
import { resetScoreStore } from './scoringEngine';
import { clearAllDailyReviews } from './dailyReviewStorage';
import { CELEBRATED_LEVEL_KEY } from './progressionEngine';

export const STATS_RESET_EVENT = 'resume-ability-stats-reset';

/**
 * Resets all user activity and statistical history.
 *
 * Safe against malformed data. Never throws.
 * Emits a window event so active components can refresh state immediately.
 */
export function resetAllStats(): void {
  try {
    // 1. Check-Ins & Check-In Wins
    clearCheckIns();

    // 2. Slips & Slip contexts
    clearSlips();

    // 3. Re-Commit events
    clearRecommitEvents();

    // 4. "I Am in Control" & Positive Commit events
    clearInControlEvents();
    clearCommitEvents();

    // 5. Non-Negotiable Review events
    clearReviewEvents();

    // 6. Structured Diet Daily Verifications & actual consumption logs
    clearAllDietVerifications();

    // 7. Surgical reset of Pledge stats (preserves Why reasons & NN rules list)
    resetPledgeStats();

    // 8. Legacy daily balance & slip records
    clearBalance();

    // 9. Transient notification delivery state (preserves notification settings)
    clearNotificationDeliveryState();

    // 10. Scoring Engine Store
    resetScoreStore();

    // 11. Daily Reviews
    clearAllDailyReviews();

    // 12. Level-up acknowledged state
    try {
      localStorage.removeItem(CELEBRATED_LEVEL_KEY);
    } catch {
      // ignore
    }

    // Notify listeners that stats have reset
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(STATS_RESET_EVENT));
    }
  } catch (err) {
    console.error('Error during stats reset:', err);
  }
}
