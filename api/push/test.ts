import type { IncomingMessage, ServerResponse } from 'http';
import webpush from 'web-push';

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
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
      body = await new Promise((resolve) => {
        let raw = '';
        req.on('data', chunk => { raw += chunk; });
        req.on('end', () => {
          try { resolve(JSON.parse(raw)); } catch { resolve({}); }
        });
      });
    }

    const { subscription, title, body: textBody, targetScreen } = body || {};

    if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'INVALID_SUBSCRIPTION' }));
      return;
    }

    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:support@superdietability.com';

    if (!vapidPublicKey || !vapidPrivateKey) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: 'VAPID_KEYS_NOT_CONFIGURED',
        message: 'VAPID environment variables (VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY) must be configured in Vercel.',
      }));
      return;
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const payload = JSON.stringify({
      title: title || 'Super Diet-Ability',
      body: textBody || 'Time for your Daily Check-In. Awareness is a win.',
      targetScreen: targetScreen || 'check-in',
      tag: 'sda-test-reminder',
      icon: '/icons/icon-192.svg',
      badge: '/icons/icon-192.svg',
    });

    await webpush.sendNotification(subscription, payload);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true }));
  } catch (err: any) {
    console.error('Push test delivery failed:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'PUSH_DELIVERY_FAILED',
      message: err.message,
      statusCode: err.statusCode,
    }));
  }
}
