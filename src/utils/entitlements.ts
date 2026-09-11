/**
 * entitlements.ts — Phase 24 Centralized Entitlement Foundation
 *
 * Provides safe, centralized access control for Free vs Premium motivation content.
 * Defaults safely to false (non-paying / free user).
 *
 * CRITICAL REQUIREMENTS (Phase 24):
 * - No payment processors, Google Play Billing, Apple subscriptions, or Stripe.
 * - No authentication or login required.
 * - Centralized helper so future billing implementations replace this single logic
 *   without scattering premium checks across components.
 */

const DEV_PREMIUM_OVERRIDE_KEY = 'ra_dev_premium_override';

/**
 * Checks whether the current user has active Premium access.
 * Safely defaults to `false`.
 * Supports an optional developer override key in localStorage for local validation.
 */
export function hasPremiumAccess(): boolean {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const override = window.localStorage.getItem(DEV_PREMIUM_OVERRIDE_KEY);
      if (override === 'true') return true;
    }
  } catch {
    // Ignore storage access errors in restricted environments
  }
  return false;
}

/**
 * Check if a content item is accessible to the current user.
 * Free content (`isPremium !== true`) is always accessible.
 */
export function isContentAccessible(item: { isPremium?: boolean }): boolean {
  if (!item.isPremium) return true;
  return hasPremiumAccess();
}
