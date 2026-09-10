/**
 * Local Push Subscription Storage — Phase 14
 *
 * Dedicated storage for local push subscription state.
 * Namespace: 'resume-ability-push-subscription'
 * Preserved across stats resets. Safe defaults, zero throws on malformed JSON.
 */

export interface PushSubscriptionState {
  version: 1;
  isPushEnabled: boolean;
  endpoint: string | null;
  p256dh: string | null;
  auth: string | null;
  syncedToServer: boolean;
  lastSyncedAt: number | null;
  lastError: string | null;
}

const PUSH_STORAGE_KEY = 'resume-ability-push-subscription';

export const DEFAULT_PUSH_STATE: PushSubscriptionState = {
  version: 1,
  isPushEnabled: false,
  endpoint: null,
  p256dh: null,
  auth: null,
  syncedToServer: false,
  lastSyncedAt: null,
  lastError: null,
};

export function loadPushSubscriptionState(): PushSubscriptionState {
  try {
    const raw = localStorage.getItem(PUSH_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PUSH_STATE };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_PUSH_STATE };

    return {
      version: 1,
      isPushEnabled: Boolean(parsed.isPushEnabled),
      endpoint: typeof parsed.endpoint === 'string' ? parsed.endpoint : null,
      p256dh: typeof parsed.p256dh === 'string' ? parsed.p256dh : null,
      auth: typeof parsed.auth === 'string' ? parsed.auth : null,
      syncedToServer: Boolean(parsed.syncedToServer),
      lastSyncedAt: typeof parsed.lastSyncedAt === 'number' ? parsed.lastSyncedAt : null,
      lastError: typeof parsed.lastError === 'string' ? parsed.lastError : null,
    };
  } catch {
    return { ...DEFAULT_PUSH_STATE };
  }
}

export function savePushSubscriptionState(state: PushSubscriptionState): void {
  try {
    localStorage.setItem(PUSH_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Fail silently in private/restricted storage mode
  }
}

export function clearPushSubscriptionState(): void {
  try {
    localStorage.removeItem(PUSH_STORAGE_KEY);
  } catch {
    // Fail silently in private/restricted storage mode
  }
}
