/**
 * Web Push Notifications Engine — Phase 41D.2
 *
 * Implements browser Push API support detection, subscription lifecycle,
 * VAPID key conversion, persistent Upstash Redis synchronization,
 * and privacy-safe installation identification.
 */

import {
  loadPushSubscriptionState,
  savePushSubscriptionState,
  clearPushSubscriptionState,
} from './pushSubscriptionStorage';
import type { PushSubscriptionState } from './pushSubscriptionStorage';
import { getOrCreateInstallationId } from './installationStorage';

export type PushDeliveryStatus =
  | 'enabled'
  | 'available'
  | 'denied'
  | 'unsupported';

export interface ChallengePushSyncParams {
  challengeId: string | null;
  challengeActive: boolean;
  reminderEnabled: boolean;
  reminderTimes: string[];
  challengeEndsAt?: number | null;
  locale?: 'en' | 'es' | 'nl';
}

/**
 * Check if the browser environment supports Service Worker and PushManager.
 */
export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Determine whether device is running iOS.
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/**
 * Determine whether web app is running in installed standalone PWA mode.
 */
export function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  );
}

/**
 * Determine the current push delivery capability and user state.
 */
export function getPushDeliveryStatus(): PushDeliveryStatus {
  if (!isPushSupported()) {
    return 'unsupported';
  }

  if (Notification.permission === 'denied') {
    return 'denied';
  }

  const localState = loadPushSubscriptionState();
  if (Notification.permission === 'granted' && localState.isPushEnabled && localState.endpoint) {
    return 'enabled';
  }

  return 'available';
}

/**
 * Convert URL-safe base64 string to Uint8Array for applicationServerKey.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Get existing or register the active Service Worker.
 */
export async function getOrRegisterServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;

  try {
    let reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    }
    // Wait for the service worker to become active
    if (reg.installing || reg.waiting) {
      await new Promise<void>((resolve) => {
        const sw = reg!.installing || reg!.waiting;
        if (!sw) return resolve();
        sw.addEventListener('statechange', () => {
          if (sw.state === 'activated') resolve();
        });
      });
    }
    return reg;
  } catch (err) {
    console.warn('Service worker registration failed:', err);
    return null;
  }
}

/**
 * Synchronize current active Challenge reminder schedule to the persistent push backend.
 */
export async function syncChallengePushSchedule(
  params?: Partial<ChallengePushSyncParams>,
): Promise<boolean> {
  if (!isPushSupported()) return false;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return false;
  }

  try {
    const reg = await getOrRegisterServiceWorker();
    if (!reg) return false;

    const subscription = await reg.pushManager.getSubscription();
    if (!subscription) return false;

    const installationId = getOrCreateInstallationId();
    const userTimezone =
      typeof Intl !== 'undefined'
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : 'UTC';

    let config: ChallengePushSyncParams;
    if (params && params.challengeId !== undefined) {
      config = {
        challengeId: params.challengeId,
        challengeActive: Boolean(params.challengeActive),
        reminderEnabled: Boolean(params.reminderEnabled),
        reminderTimes: Array.isArray(params.reminderTimes) ? params.reminderTimes : [],
        challengeEndsAt: params.challengeEndsAt || null,
        locale: params.locale || 'en',
      };
    } else {
      const { loadActiveChallenge } = await import('../challenges/challengeStorage');
      const active = loadActiveChallenge();
      if (active && active.status === 'active') {
        const [y, m, d] = active.endDate.split('-').map(Number);
        const endsAt = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
        const savedLang = localStorage.getItem('resume-ability-language');
        const locale = savedLang === 'es' || savedLang === 'nl' || savedLang === 'en' ? savedLang : 'en';

        config = {
          challengeId: active.id,
          challengeActive: true,
          reminderEnabled: Boolean(active.reminderEnabled),
          reminderTimes: active.reminderTimes || [],
          challengeEndsAt: endsAt,
          locale,
        };
      } else {
        config = {
          challengeId: null,
          challengeActive: false,
          reminderEnabled: false,
          reminderTimes: [],
          challengeEndsAt: null,
          locale: 'en',
        };
      }
    }

    const payload = {
      installationId,
      subscription: subscription.toJSON(),
      timezone: userTimezone,
      locale: config.locale || 'en',
      challengeId: config.challengeId,
      challengeActive: config.challengeActive,
      reminderEnabled: config.reminderEnabled,
      reminderTimes: config.reminderTimes,
      challengeEndsAt: config.challengeEndsAt,
    };

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const state = loadPushSubscriptionState();
      savePushSubscriptionState({
        ...state,
        syncedToServer: true,
        lastSyncedAt: Date.now(),
        lastError: null,
      });
      return true;
    }
    return false;
  } catch (err: any) {
    console.warn('Challenge push sync failed:', err);
    return false;
  }
}

/**
 * Subscribe to Web Push notifications.
 * Never requests permission automatically on load — must be called upon explicit user tap.
 */
export async function subscribeToPush(
  vapidPublicKey?: string,
): Promise<{ success: boolean; status: PushDeliveryStatus; error?: string }> {
  if (!isPushSupported()) {
    return { success: false, status: 'unsupported', error: 'NOT_SUPPORTED' };
  }

  // 1. Request permission
  let permission = Notification.permission;
  if (permission === 'default') {
    try {
      permission = await Notification.requestPermission();
    } catch {
      permission = Notification.permission;
    }
  }

  if (permission !== 'granted') {
    return {
      success: false,
      status: permission === 'denied' ? 'denied' : 'available',
      error: permission === 'denied' ? 'PERMISSION_DENIED' : 'PERMISSION_DISMISSED',
    };
  }

  // 2. Get active service worker registration
  const reg = await getOrRegisterServiceWorker();
  if (!reg) {
    return { success: false, status: 'available', error: 'SW_REGISTRATION_FAILED' };
  }

  // 3. Resolve VAPID public key
  const publicKey =
    vapidPublicKey ||
    (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ||
    '';

  let subscription: PushSubscription | null = null;
  try {
    // Check for existing subscription first
    subscription = await reg.pushManager.getSubscription();

    if (!subscription) {
      const subscribeOptions: PushSubscriptionOptionsInit = {
        userVisibleOnly: true,
      };

      if (publicKey && publicKey.trim().length > 0) {
        subscribeOptions.applicationServerKey = urlBase64ToUint8Array(publicKey.trim());
      }

      subscription = await reg.pushManager.subscribe(subscribeOptions);
    }
  } catch (err) {
    console.warn('PushManager subscription failed:', err);
    return { success: false, status: 'available', error: 'PUSH_SUBSCRIBE_FAILED' };
  }

  if (!subscription) {
    return { success: false, status: 'available', error: 'NO_SUBSCRIPTION' };
  }

  // 4. Extract subscription data and update local state
  const subJson = subscription.toJSON();
  const endpoint = subJson.endpoint || subscription.endpoint;
  const p256dh = subJson.keys?.p256dh || null;
  const auth = subJson.keys?.auth || null;

  const pushState: PushSubscriptionState = {
    version: 1,
    isPushEnabled: true,
    endpoint,
    p256dh,
    auth,
    syncedToServer: false,
    lastSyncedAt: null,
    lastError: null,
  };

  savePushSubscriptionState(pushState);

  // 5. Sync active challenge schedule to persistent backend
  await syncChallengePushSchedule();

  return { success: true, status: 'enabled' };
}

/**
 * Unsubscribe from Web Push notifications.
 */
export async function unsubscribeFromPush(): Promise<{ success: boolean }> {
  if (!isPushSupported()) {
    clearPushSubscriptionState();
    return { success: true };
  }

  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      const subscription = await reg.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        // Notify backend of removal
        try {
          const installationId = getOrCreateInstallationId();
          await fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint, installationId }),
          });
        } catch {
          // ignore
        }
      }
    }
  } catch (err) {
    console.warn('Error during push unsubscribe:', err);
  }

  clearPushSubscriptionState();
  return { success: true };
}

/**
 * Send a test push notification.
 * If backend push is available, sends through /api/push/test.
 * Returns whether real background push was used or fallback is needed.
 */
export async function sendTestPush(): Promise<{
  success: boolean;
  isBackendPush: boolean;
  error?: string;
}> {
  if (!isPushSupported()) {
    return { success: false, isBackendPush: false, error: 'NOT_SUPPORTED' };
  }

  const localState = loadPushSubscriptionState();
  if (!localState.isPushEnabled || !localState.endpoint) {
    return { success: false, isBackendPush: false, error: 'NOT_ENABLED' };
  }

  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      return { success: false, isBackendPush: false, error: 'NO_SW' };
    }

    const sub = await reg.pushManager.getSubscription();
    if (!sub) {
      return { success: false, isBackendPush: false, error: 'NO_SUBSCRIPTION' };
    }

    const res = await fetch('/api/push/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: sub.toJSON(),
        title: 'Super Diet-Ability',
        body: 'Time for your Daily Check-In. Awareness is a win.',
        targetScreen: 'challenges',
      }),
    });

    if (res.ok) {
      return { success: true, isBackendPush: true };
    }

    const data = await res.json().catch(() => ({}));
    return {
      success: false,
      isBackendPush: false,
      error: data.error || `HTTP_${res.status}`,
    };
  } catch (err) {
    return {
      success: false,
      isBackendPush: false,
      error: (err as Error).message,
    };
  }
}
