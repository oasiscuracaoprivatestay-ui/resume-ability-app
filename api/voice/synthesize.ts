/**
 * Vercel Serverless Function — SDA Voice Synthesis Endpoint (Phase 38B)
 *
 * Route: POST /api/voice/synthesize
 *
 * Enforces:
 * - Method check (POST only)
 * - Validated Coach text input only
 * - Maximum text length (2000 chars)
 * - Server-side secret protection (AI_API_KEY never leaks to client)
 * - Audio streaming response (audio/mpeg)
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { handleSynthesizeVoice } from '../_coach/voiceGateway.js';

export default async function handler(
  req: IncomingMessage & { body?: any },
  res: ServerResponse
) {
  // 1. Diagnostics health check (GET)
  if (req.method === 'GET') {
    const rawKey = process.env.AI_API_KEY || process.env.AI_PROVIDER_API_KEY;
    const keyConfigured = typeof rawKey === 'string' && rawKey.trim().length > 0;
    const ttsModel = process.env.AI_VOICE_TTS_MODEL || 'gpt-4o-mini-tts';
    const ttsVoice = process.env.AI_VOICE_TTS_VOICE || 'alloy';

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.end(JSON.stringify({
      status: 'ok',
      endpoint: '/api/voice/synthesize',
      keyConfigured,
      ttsModel,
      ttsVoice,
      provider: 'openai',
    }));
    return;
  }

  // 2. Method Guard
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        return;
      }
    } else if (!body) {
      body = await new Promise((resolve) => {
        let raw = '';
        req.on('data', chunk => { raw += chunk; });
        req.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch {
            resolve({});
          }
        });
      });
    }

    const { status, contentType, buffer, errorBody } = await handleSynthesizeVoice(body || {});

    res.statusCode = status;
    res.setHeader('Content-Type', contentType);

    if (buffer) {
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'no-store, no-cache');
      res.end(buffer);
    } else {
      res.end(JSON.stringify(errorBody || {}));
    }
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Internal server error during voice synthesis' }));
  }
}
