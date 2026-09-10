import type { IncomingMessage, ServerResponse } from 'http';
import webpush from 'web-push';
import { getAllSubscriptions, removeSubscription } from '../_store';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Support GET/POST for Vercel Cron triggers
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  // Optional: Verify CRON_SECRET if configured
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${cronSecret}`) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'UNAUTHORIZED_CRON' }));
      return;
    }
  }

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

  const subscriptions = getAllSubscriptions();
  const now = new Date();
  let evaluated = 0;
  let delivered = 0;
  let expired = 0;

  for (const sub of subscriptions) {
    evaluated++;
    try {
      // Determine local hour and minute for the user's timezone
      const tz = sub.timezone || 'UTC';
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      });

      const parts = formatter.formatToParts(now);
      const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
      const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
      const currentMins = hour * 60 + minute;

      const activeStartMins = parseTime(sub.settings?.activeStart || '08:00');
      const activeEndMins = parseTime(sub.settings?.activeEnd || '21:00');

      // Check if current user local time is within active hours
      const isWithinActive = activeStartMins <= activeEndMins
        ? currentMins >= activeStartMins && currentMins <= activeEndMins
        : currentMins >= activeStartMins || currentMins <= activeEndMins;

      if (!isWithinActive) {
        continue;
      }

      // Check due status (cooldown of at least 15 minutes between pushes)
      const lastDelivered = sub.lastDeliveredAt || 0;
      if (now.getTime() - lastDelivered < 15 * 60 * 1000) {
        continue;
      }

      const payload = JSON.stringify({
        title: 'Super Diet-Ability',
        body: 'Take a moment to check in with your structure. Awareness is a win.',
        targetScreen: 'check-in',
        tag: `sda-scheduled-${now.toISOString().split('T')[0]}`,
        icon: '/icons/icon-192.svg',
        badge: '/icons/icon-192.svg',
      });

      await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: sub.keys,
      }, payload);

      sub.lastDeliveredAt = now.getTime();
      delivered++;
    } catch (err: any) {
      // If subscription expired or was cancelled by user (410 Gone / 404 Not Found), prune it
      if (err.statusCode === 410 || err.statusCode === 404) {
        removeSubscription(sub.endpoint);
        expired++;
      }
    }
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    success: true,
    timestamp: now.toISOString(),
    evaluated,
    delivered,
    expired,
  }));
}

function parseTime(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(n => parseInt(n, 10) || 0);
  return h * 60 + m;
}
