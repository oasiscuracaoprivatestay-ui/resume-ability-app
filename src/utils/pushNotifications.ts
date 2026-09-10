/**
 * Web Push Notifications Engine — Phase 14
 *
 * Implements browser Push API support detection, subscription lifecycle,
 * VAPID key conversion, and backend synchronization.
 */

import {
  loadPushSubscriptionState,
  savePushSubscriptionState,
  clearPushSubscriptionState,
} from './pushSubscriptionStorage';
import type { PushSubscriptionState } from './pushSubscriptionStorage';
import { loadNotificationSettings } from './notificationSettingsStorage';

export type PushDeliveryStatus =
  | 'enabled'
  | 'available'
  | 'denied'
  | 'unsupported';

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

  // 4. Extract subscription data
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

  // 5. Sync subscription to backend (Level 1 / Level 2 support)
  try {
    const settings = loadNotificationSettings();
    const userTimezone =
      typeof Intl !== 'undefined'
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : 'UTC';

    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subJson,
        settings: {
          frequency: settings.frequency,
          activeStart: settings.activeStart,
          activeEnd: settings.activeEnd,
          dailyTimes: settings.dailyTimes,
          randomize: settings.randomize,
          showWhy: settings.showWhy,
        },
        timezone: userTimezone,
      }),
    });

    if (response.ok) {
      pushState.syncedToServer = true;
      pushState.lastSyncedAt = Date.now();
      savePushSubscriptionState(pushState);
    }
  } catch {
    // Backend may be offline or in local static dev mode — local push remains valid
  }

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
          await fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint }),
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
        targetScreen: 'check-in',
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
