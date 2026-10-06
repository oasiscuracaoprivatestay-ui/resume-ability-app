import type { IncomingMessage, ServerResponse } from 'http';
import { upsertPushReminder } from '../_store.js';
import { isValidTimezone, normalizeReminderTimes } from '../_dueEngine.js';

const MAX_PAYLOAD_BYTES = 32 * 1024; // 32KB limit to prevent abuse

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  // Only accept POST
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch {}
    } else if (!body) {
      body = await new Promise((resolve, reject) => {
        let raw = '';
        let totalBytes = 0;
        req.on('data', chunk => {
          totalBytes += chunk.length;
          if (totalBytes > MAX_PAYLOAD_BYTES) {
            req.destroy();
            reject(new Error('PAYLOAD_TOO_LARGE'));
            return;
          }
          raw += chunk;
        });
        req.on('end', () => {
          try { resolve(JSON.parse(raw)); } catch { resolve({}); }
        });
        req.on('error', reject);
      });
    }

    const {
      installationId,
      subscription,
      timezone,
      locale,
      challengeId,
      challengeActive,
      reminderEnabled,
      reminderTimes,
      challengeEndsAt,
    } = body || {};

    // 1. Validate installationId
    if (
      !installationId ||
      typeof installationId !== 'string' ||
      installationId.length < 8 ||
      installationId.length > 128
    ) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'INVALID_INSTALLATION_ID' }));
      return;
    }

    // 2. Validate subscription shape and endpoint security
    if (
      !subscription ||
      typeof subscription.endpoint !== 'string' ||
      !subscription.endpoint.startsWith('https://') ||
      subscription.endpoint.length > 2048 ||
      !subscription.keys?.p256dh ||
      !subscription.keys?.auth
    ) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'INVALID_SUBSCRIPTION_SHAPE' }));
      return;
    }

    // 3. Validate timezone
    const safeTimezone = typeof timezone === 'string' && isValidTimezone(timezone)
      ? timezone.trim()
      : 'UTC';

    // 4. Validate and normalize reminder times (HH:mm format, unique, max 6)
    const safeReminderTimes = normalizeReminderTimes(Array.isArray(reminderTimes) ? reminderTimes : []);

    // 5. Validate challenge status and booleans
    const safeChallengeActive = Boolean(challengeActive);
    const safeReminderEnabled = Boolean(reminderEnabled);
    const safeChallengeId = typeof challengeId === 'string' && challengeId.length <= 64 ? challengeId : null;
    const safeChallengeEndsAt = typeof challengeEndsAt === 'number' && Number.isFinite(challengeEndsAt)
      ? challengeEndsAt
      : null;
    const safeLocale = locale === 'es' || locale === 'nl' || locale === 'en' ? locale : 'en';

    const now = Date.now();
    const success = await upsertPushReminder({
      installationId: installationId.trim(),
      subscription: {
        endpoint: subscription.endpoint.trim(),
        keys: {
          p256dh: String(subscription.keys.p256dh).trim(),
          auth: String(subscription.keys.auth).trim(),
        },
      },
      timezone: safeTimezone,
      locale: safeLocale,
      challengeId: safeChallengeId,
      challengeActive: safeChallengeActive,
      reminderEnabled: safeReminderEnabled,
      reminderTimes: safeReminderTimes,
      challengeEndsAt: safeChallengeEndsAt,
      createdAt: now,
      updatedAt: now,
    });

    if (!success) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'STORAGE_FAILED' }));
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true, savedAt: now }));
  } catch (err: any) {
    res.statusCode = err?.message === 'PAYLOAD_TOO_LARGE' ? 413 : 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err?.message || 'INTERNAL_SERVER_ERROR' }));
  }
}
