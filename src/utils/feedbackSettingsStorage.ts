/**
 * Feedback Settings Storage Utility (Phase 17)
 *
 * Persists sound & haptic preferences to localStorage under 'resume-ability-feedback-settings'.
 * Defaults: soundEnabled: true, hapticsEnabled: true.
 * Safe malformed-JSON handling.
 */

export interface FeedbackSettings {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
}

export const FEEDBACK_SETTINGS_KEY = 'resume-ability-feedback-settings';

export const DEFAULT_FEEDBACK_SETTINGS: FeedbackSettings = {
  soundEnabled: true,
  hapticsEnabled: true,
};

/**
 * Checks if navigator.vibrate is supported in the current environment.
 */
export function isHapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/**
 * Loads feedback settings from localStorage with safe fallback.
 */
export function loadFeedbackSettings(): FeedbackSettings {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_FEEDBACK_SETTINGS };
    const raw = localStorage.getItem(FEEDBACK_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_FEEDBACK_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      soundEnabled: typeof parsed?.soundEnabled === 'boolean' ? parsed.soundEnabled : DEFAULT_FEEDBACK_SETTINGS.soundEnabled,
      hapticsEnabled: typeof parsed?.hapticsEnabled === 'boolean' ? parsed.hapticsEnabled : DEFAULT_FEEDBACK_SETTINGS.hapticsEnabled,
    };
  } catch {
    return { ...DEFAULT_FEEDBACK_SETTINGS };
  }
}

/**
 * Saves feedback settings to localStorage.
 */
export function saveFeedbackSettings(settings: Partial<FeedbackSettings>): FeedbackSettings {
  try {
    const current = loadFeedbackSettings();
    const updated: FeedbackSettings = {
      soundEnabled: typeof settings.soundEnabled === 'boolean' ? settings.soundEnabled : current.soundEnabled,
      hapticsEnabled: typeof settings.hapticsEnabled === 'boolean' ? settings.hapticsEnabled : current.hapticsEnabled,
    };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(FEEDBACK_SETTINGS_KEY, JSON.stringify(updated));
    }
    return updated;
  } catch {
    return { ...DEFAULT_FEEDBACK_SETTINGS };
  }
}

/**
 * Returns whether sound effects are currently enabled.
 */
export function isSoundEnabled(): boolean {
  return loadFeedbackSettings().soundEnabled;
}

/**
 * Returns whether tactile haptic feedback is currently enabled and supported.
 */
export function isHapticsEnabled(): boolean {
  return loadFeedbackSettings().hapticsEnabled;
}
