/**
 * Super Diet-Ability Service Worker — Phase 14
 *
 * Handles:
 *   - Push notification delivery
 *   - Notification click interaction & deep-linking
 *   - Safe caching of core PWA shell assets
 *   - Clean client window focus and navigation
 */

const CACHE_NAME = 'sda-shell-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
];

// ── Lifecycle: Install ────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// ── Lifecycle: Activate ───────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// ── Fetch: Safe Non-Aggressive Caching ─────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache API routes or dynamic serverless requests
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // HTML navigation: Network-first to prevent stale code across deployments
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html') || caches.match('/');
      })
    );
    return;
  }

  // Static assets (CSS, JS, Fonts, Icons): Stale-while-revalidate
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.webmanifest')
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
  }
});

// ── Push Event: Background Notification ───────────────────────────────────────
self.addEventListener('push', (event) => {
  let payload = {
    title: 'Super Diet-Ability',
    body: 'Time for your Daily Check-In. Awareness is a win.',
    targetScreen: 'check-in',
    tag: 'sda-reminder',
    icon: '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
  };

  if (event.data) {
    try {
      const data = event.data.json();
      payload = { ...payload, ...data };
    } catch {
      payload.body = event.data.text() || payload.body;
    }
  }

  const notificationOptions = {
    body: payload.body,
    icon: payload.icon || '/icons/icon-192.svg',
    badge: payload.badge || '/icons/icon-192.svg',
    tag: payload.tag || 'sda-reminder',
    renotify: true,
    data: {
      targetScreen: payload.targetScreen || 'check-in',
      url: payload.url || `/?screen=${payload.targetScreen || 'check-in'}`,
      timestamp: Date.now(),
    },
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, notificationOptions)
  );
});

// ── Notification Click: Focus Client & Deep-Link ──────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notifData = event.notification.data || {};
  const targetScreen = notifData.targetScreen || 'check-in';
  const targetUrl = notifData.url || `/?screen=${targetScreen}`;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and post a navigation message
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NAVIGATE_SCREEN',
            screen: targetScreen,
          });
          return;
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
