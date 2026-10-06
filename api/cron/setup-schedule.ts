import type { IncomingMessage, ServerResponse } from 'http';
import { Client } from '@upstash/qstash';

const PRODUCTION_DESTINATION = 'https://resume-ability-app.vercel.app/api/cron/reminders';
const SCHEDULE_CRON = '*/15 * * * *'; // Every 15 minutes

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Support POST or GET with administrative CRON_SECRET authorization
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  // 1. Strict admin authentication via CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers['authorization'];
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'UNAUTHORIZED' }));
    return;
  }

  // 2. Validate QStash token
  const qstashToken = process.env.QSTASH_TOKEN;
  if (!qstashToken) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'QSTASH_TOKEN_NOT_CONFIGURED',
      message: 'Server secret QSTASH_TOKEN is missing.',
    }));
    return;
  }

  try {
    const client = new Client({ token: qstashToken.trim() });

    // 3. Idempotent check: verify if schedule already exists
    const existingSchedules = await client.schedules.list();
    const existing = existingSchedules.find(s => s.destination === PRODUCTION_DESTINATION);

    if (existing) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: true,
        status: 'ALREADY_EXISTS',
        scheduleId: existing.scheduleId,
        cron: existing.cron,
        destination: existing.destination,
      }));
      return;
    }

    // 4. Create single global 15-minute schedule
    const created = await client.schedules.create({
      destination: PRODUCTION_DESTINATION,
      cron: SCHEDULE_CRON,
    });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      success: true,
      status: 'CREATED',
      scheduleId: created.scheduleId,
      cron: SCHEDULE_CRON,
      destination: PRODUCTION_DESTINATION,
    }));
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'QSTASH_SCHEDULE_CREATION_FAILED',
      message: err.message,
    }));
  }
}
