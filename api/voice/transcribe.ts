/**
 * Vercel Serverless Function — SDA Voice Transcription Endpoint (Phase 38B)
 *
 * Route: POST /api/voice/transcribe
 *
 * Enforces:
 * - Method check (POST only)
 * - Safe payload extraction (JSON with audioBase64 or raw binary stream)
 * - Audio size limit (10 MB max)
 * - Supported MIME type validation
 * - Server-side secret protection (AI_API_KEY never leaks to client)
 * - Normalized transcript output
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { handleTranscribeVoice } from '../_coach/voiceGateway.js';

export default async function handler(
  req: IncomingMessage & { body?: any },
  res: ServerResponse
) {
  // 1. Diagnostics health check (GET)
  if (req.method === 'GET') {
    const rawKey = process.env.AI_API_KEY || process.env.AI_PROVIDER_API_KEY;
    const keyConfigured = typeof rawKey === 'string' && rawKey.trim().length > 0;
    const sttModel = process.env.AI_VOICE_STT_MODEL || 'gpt-4o-transcribe';

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.end(JSON.stringify({
      status: 'ok',
      endpoint: '/api/voice/transcribe',
      keyConfigured,
      sttModel,
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
    const contentType = req.headers['content-type'] || '';
    let payload: any = {};
    let rawAudioBuffer: Buffer | undefined;

    if (contentType.includes('application/json')) {
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
      payload = body;
    } else {
      // Raw binary audio stream
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        req.on('data', chunk => chunks.push(Buffer.from(chunk)));
        req.on('end', () => resolve());
        req.on('error', err => reject(err));
      });
      rawAudioBuffer = Buffer.concat(chunks);
      payload = {
        mimeType: contentType,
        language: req.headers['x-voice-language'] as any,
      };
    }

    const { status, body } = await handleTranscribeVoice(payload, rawAudioBuffer);

    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Internal server error during voice transcription' }));
  }
}
