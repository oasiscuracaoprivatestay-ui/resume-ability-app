/**
 * QStash Request Signature Verification Helper — Phase 41D.3
 *
 * Cryptographically verifies that incoming webhook requests originate from
 * Upstash QStash using official HMAC-SHA256 signing keys.
 */

import { Receiver } from '@upstash/qstash';

export interface VerifyQStashOptions {
  signature?: string | string[];
  body: string;
  url?: string;
}

/**
 * Verifies that a request has a valid Upstash QStash signature.
 * Returns true if valid, false if invalid or signing keys are unconfigured.
 */
export async function verifyQStashSignature(options: VerifyQStashOptions): Promise<boolean> {
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;

  if (!currentKey || !nextKey) {
    return false;
  }

  const signature = Array.isArray(options.signature) ? options.signature[0] : options.signature;
  if (!signature || typeof signature !== 'string' || signature.trim().length === 0) {
    return false;
  }

  try {
    const receiver = new Receiver({
      currentSigningKey: currentKey.trim(),
      nextSigningKey: nextKey.trim(),
    });

    return await receiver.verify({
      signature: signature.trim(),
      body: options.body,
      url: options.url,
    });
  } catch (err) {
    return false;
  }
}
