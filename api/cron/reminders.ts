import type { IncomingMessage, ServerResponse } from 'http';
import webpush from 'web-push';
import { getAllActiveReminders, deletePushReminder, acquireSlotLock, releaseSlotLock } from '../_store.js';
import { evaluateDueSlots } from '../_dueEngine.js';
import { verifyQStashSignature } from '../_qstashAuth.js';

// Safe, privacy-preserving notification copy by locale
const NOTIFICATION_COPY: Record<string, { title: string; body: string }> = {
  en: {
    title: 'SDA Challenge Check-In',
    body: 'Take a moment to check in with your Challenge.',
  },
  es: {
    title: 'Check-in del Desafío SDA',
    body: 'Tómate un momento para registrar tu Desafío.',
  },
  nl: {
    title: 'SDA Challenge Check-In',
    body: 'Neem een moment om in te checken bij je Challenge.',
  },
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Support GET and POST for QStash triggers
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  // Parse raw body for signature verification if present
  let rawBody = '';
  if (req.method === 'POST') {
    rawBody = await new Promise<string>((resolve) => {
      let data = '';
      req.on('data', chunk => { data += chunk; });
      req.on('end', () => resolve(data));
      req.on('error', () => resolve(''));
    });
  }

  // 1. Dual Security Layer: QStash Signature OR CRON_SECRET Bearer Token
  const qstashSignature = req.headers['upstash-signature'];
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;

  let isAuthorized = false;

  // Path A: Upstash QStash HMAC-SHA256 signature verification
  if (qstashSignature && typeof qstashSignature === 'string') {
    const validQStash = await verifyQStashSignature({
      signature: qstashSignature,
      body: rawBody,
    });
    if (validQStash) {
      isAuthorized = true;
    }
  }

  // Path B: CRON_SECRET authorization for manual or administrative triggers
  if (!isAuthorized && cronSecret && authHeader) {
    if (authHeader === `Bearer ${cronSecret}`) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'UNAUTHORIZED' }));
    return;
  }

  // 2. Resolve VAPID configuration
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:support@superdietability.com';

  if (!vapidPublicKey || !vapidPrivateKey) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      status: 'SKIPPED',
      message: 'VAPID keys not configured on server.',
    }));
    return;
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const now = new Date();
  const activeReminders = await getAllActiveReminders();

  let evaluated = 0;
  let dueCount = 0;
  let sent = 0;
  let skippedLocked = 0;
  let expired = 0;
  let failed = 0;

  for (const record of activeReminders) {
    evaluated++;

    // Evaluate due slots for this installation's timezone and schedule (15m window)
    const dueSlots = evaluateDueSlots({
      now,
      timezone: record.timezone,
      reminderTimes: record.reminderTimes,
      challengeActive: record.challengeActive,
      reminderEnabled: record.reminderEnabled,
      challengeId: record.challengeId,
      challengeEndsAt: record.challengeEndsAt,
      windowMinutes: 15,
    });

    for (const slot of dueSlots) {
      dueCount++;

      // 3. Atomic deduplication: Acquire single-delivery claim for this slot
      const lockAcquired = await acquireSlotLock(slot.claimKey, 86400);
      if (!lockAcquired) {
        skippedLocked++;
        continue;
      }

      // 4. Build privacy-safe notification payload (generic, non-revealing)
      const copy = NOTIFICATION_COPY[record.locale || 'en'] || NOTIFICATION_COPY.en;
      const payload = JSON.stringify({
        title: copy.title,
        body: copy.body,
        targetScreen: 'challenges',
        action: 'check-in',
        url: '/?screen=challenges&action=check-in',
        tag: `sda-challenge-${slot.slotTime}`,
        icon: '/icons/icon-192.svg',
        badge: '/icons/icon-192.svg',
        type: 'challenge-reminder',
      });

      try {
        await webpush.sendNotification({
          endpoint: record.subscription.endpoint,
          keys: {
            p256dh: record.subscription.keys.p256dh,
            auth: record.subscription.keys.auth,
          },
        }, payload);
        sent++;
      } catch (err: any) {
        // 5. Cleanup expired or cancelled push subscriptions (HTTP 410 Gone / 404 Not Found)
        if (err.statusCode === 410 || err.statusCode === 404) {
          await deletePushReminder(record.installationId);
          expired++;
        } else {
          // 6. On transient failure: release the lock so a scheduler retry can re-attempt
          await releaseSlotLock(slot.claimKey);
          failed++;
          console.warn('Push delivery transient failure for installation', {
            statusCode: err.statusCode,
            message: err.message,
          });
        }
      }
    }
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    success: true,
    timestamp: now.toISOString(),
    processed: evaluated,
    due: dueCount,
    sent,
    expired,
    failed,
    skippedLocked,
  }));
}
