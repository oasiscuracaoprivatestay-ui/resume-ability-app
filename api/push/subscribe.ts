import type { IncomingMessage, ServerResponse } from 'http';
import { saveSubscription } from '../_store';

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
      // Parse raw stream if not auto-parsed
      body = await new Promise((resolve) => {
        let raw = '';
        req.on('data', chunk => { raw += chunk; });
        req.on('end', () => {
          try { resolve(JSON.parse(raw)); } catch { resolve({}); }
        });
      });
    }

    const { subscription, settings, timezone } = body || {};

    if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'INVALID_SUBSCRIPTION_SHAPE' }));
      return;
    }

    saveSubscription({
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      settings,
      timezone: timezone || 'UTC',
      createdAt: Date.now(),
    });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true }));
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'INTERNAL_SERVER_ERROR', message: err.message }));
  }
}
