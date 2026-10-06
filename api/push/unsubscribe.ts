import type { IncomingMessage, ServerResponse } from 'http';
import { disablePushReminder, getPushReminderByEndpoint } from '../_store.js';

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

    const { endpoint, installationId } = body || {};

    if (installationId && typeof installationId === 'string') {
      await disablePushReminder(installationId.trim());
    } else if (endpoint && typeof endpoint === 'string') {
      const rec = await getPushReminderByEndpoint(endpoint.trim());
      if (rec) {
        await disablePushReminder(rec.installationId);
      }
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true }));
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'INTERNAL_SERVER_ERROR', message: err.message }));
  }
}
