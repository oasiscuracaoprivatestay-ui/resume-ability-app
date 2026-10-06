/**
 * Installation Identifier Storage — Phase 41D.2
 *
 * Provides a privacy-safe, random, client-generated device installation ID
 * for associating push notification schedules without user accounts or tracking.
 *
 * Principles:
 * - Purely random (UUID v4)
 * - Zero device fingerprinting or hardware derivation
 * - Isolated from AI Coach, scoring, and analytics
 * - Automatically refreshed if app storage is cleared
 */

const INSTALLATION_ID_KEY = 'resume-ability-installation-id';

/**
 * Generate a cryptographically random RFC 4122 version 4 UUID.
 */
function generateRandomUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback using crypto.getRandomValues
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10xx
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Math.random fallback (for legacy runtimes)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Retrieves the existing installation ID or generates and persists a new one.
 */
export function getOrCreateInstallationId(): string {
  if (typeof window === 'undefined') {
    return generateRandomUUID();
  }

  try {
    const existing = localStorage.getItem(INSTALLATION_ID_KEY);
    if (existing && typeof existing === 'string' && existing.trim().length >= 8) {
      return existing.trim();
    }

    const newId = generateRandomUUID();
    localStorage.setItem(INSTALLATION_ID_KEY, newId);
    return newId;
  } catch {
    return generateRandomUUID();
  }
}
