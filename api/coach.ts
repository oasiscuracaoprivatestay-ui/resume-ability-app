/**
 * Vercel Serverless Function — SDA AI Coach Gateway Endpoint (Phase 36)
 *
 * Route: POST /api/coach
 *
 * Enforces:
 * - Method check (POST only)
 * - Safe body parsing
 * - Server-side secret protection (AI_API_KEY never leaks to client)
 * - Delegation to serverAIGateway
 * - Standard HTTP status codes
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { handleCoachGatewayRequest } from './_coach/serverAIGateway.js';

export default async function handler(
  req: IncomingMessage & { body?: any },
  res: ServerResponse
) {
  // 1. Safe deployment health & configuration diagnostics (GET)
  if (req.method === 'GET') {
    const rawKey = process.env.AI_API_KEY || process.env.AI_PROVIDER_API_KEY;
    const keyConfigured = typeof rawKey === 'string' && rawKey.trim().length > 0;
    const provider = process.env.AI_PROVIDER || 'openai';
    const model = process.env.AI_MODEL || 'gpt-4o-mini';

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.end(JSON.stringify({
      status: 'ok',
      endpoint: '/api/coach',
      provider,
      model,
      keyConfigured,
      diagnostics: {
        provider,
        model,
        providerAvailable: keyConfigured,
        remoteAttempted: false,
        remoteSucceeded: false,
        fallbackUsed: !keyConfigured,
        failureCategory: keyConfigured ? 'NONE' : 'KEY_NOT_CONFIGURED',
      },
    }));
    return;
  }

  // 2. Method guard
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  try {
    // 3. Body parsing
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

    // 4. Delegate to validated gateway logic
    const { status, envelope } = await handleCoachGatewayRequest(body);

    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(envelope));
  } catch (_err) {
    // Generic safe error without leaking internals or keys
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'Internal Server Error',
      fallbackUsed: true,
      diagnostics: {
        provider: process.env.AI_PROVIDER || 'openai',
        model: process.env.AI_MODEL || 'gpt-4o-mini',
        providerAvailable: false,
        remoteAttempted: true,
        remoteSucceeded: false,
        fallbackUsed: true,
        failureCategory: 'NETWORK_ERROR',
      },
    }));
  }
}

