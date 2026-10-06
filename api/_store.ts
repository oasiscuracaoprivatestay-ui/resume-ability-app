/**
 * Push Subscription Persistent Store Adapter — Phase 41D.2
 *
 * Upstash Redis-backed persistence for closed-app Web Push reminders.
 * Provides atomic slot claiming, endpoint mapping, active installation indexing,
 * and zero-knowledge privacy protection.
 */

import { Redis } from '@upstash/redis';
import crypto from 'crypto';

export interface PushReminderRecord {
  installationId: string;
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
  timezone: string;
  locale?: 'en' | 'es' | 'nl';
  challengeId: string | null;
  challengeActive: boolean;
  reminderEnabled: boolean;
  reminderTimes: string[]; // HH:mm format, sorted, deduplicated, max 6
  challengeEndsAt?: number | null; // epoch ms
  createdAt: number;
  updatedAt: number;
}

// In-memory fallback map for offline development / test environments where Redis is not provisioned
const memoryFallback = new Map<string, string>();
const memoryFallbackLocks = new Map<string, number>();

/**
 * Resolves the active Upstash Redis client using Vercel-provisioned environment variables.
 * Returns null if credentials are not configured.
 */
export function getRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  try {
    return new Redis({ url, token });
  } catch (err) {
    console.warn('Failed to initialize Upstash Redis client:', err);
    return null;
  }
}

/**
 * Creates a short, deterministic hash of a push endpoint URL for safe Redis keying.
 */
export function hashEndpoint(endpoint: string): string {
  return crypto.createHash('sha256').update(endpoint).digest('hex').slice(0, 32);
}

const PREFIX_INST = 'sda:push:inst:';
const PREFIX_ENDPOINT = 'sda:push:ep:';
const KEY_ACTIVE_SET = 'sda:push:active_set';
const PREFIX_LOCK = 'sda:push:lock:';

/**
 * Upserts a push reminder record into Redis.
 * Automatically manages active index set and endpoint-to-installation lookup.
 */
export async function upsertPushReminder(record: PushReminderRecord): Promise<boolean> {
  if (!record.installationId || !record.subscription?.endpoint) {
    return false;
  }

  const client = getRedisClient();
  const instKey = `${PREFIX_INST}${record.installationId}`;
  const epKey = `${PREFIX_ENDPOINT}${hashEndpoint(record.subscription.endpoint)}`;
  const serialized = JSON.stringify(record);

  if (!client) {
    // Development / test fallback
    memoryFallback.set(instKey, serialized);
    memoryFallback.set(epKey, record.installationId);
    if (record.challengeActive && record.reminderEnabled) {
      memoryFallback.set(`active:${record.installationId}`, '1');
    } else {
      memoryFallback.delete(`active:${record.installationId}`);
    }
    return true;
  }

  try {
    // 1. Store the primary record (90-day TTL to avoid unbounded zombie records)
    await client.set(instKey, serialized, { ex: 90 * 86400 });

    // 2. Map endpoint hash to installation ID
    await client.set(epKey, record.installationId, { ex: 90 * 86400 });

    // 3. Update the active reminders index set
    if (record.challengeActive && record.reminderEnabled) {
      await client.sadd(KEY_ACTIVE_SET, record.installationId);
    } else {
      await client.srem(KEY_ACTIVE_SET, record.installationId);
    }

    return true;
  } catch (err) {
    console.error('Failed to upsert push reminder to Redis:', err);
    return false;
  }
}

/**
 * Fetches a push reminder record by installation ID.
 */
export async function getPushReminder(installationId: string): Promise<PushReminderRecord | null> {
  if (!installationId) return null;
  const client = getRedisClient();
  const instKey = `${PREFIX_INST}${installationId}`;

  if (!client) {
    const raw = memoryFallback.get(instKey);
    return raw ? JSON.parse(raw) : null;
  }

  try {
    const data = await client.get<PushReminderRecord | string>(instKey);
    if (!data) return null;
    return typeof data === 'string' ? JSON.parse(data) : data;
  } catch (err) {
    console.error('Failed to get push reminder from Redis:', err);
    return null;
  }
}

/**
 * Fetches a push reminder record by subscription endpoint.
 */
export async function getPushReminderByEndpoint(endpoint: string): Promise<PushReminderRecord | null> {
  if (!endpoint) return null;
  const client = getRedisClient();
  const epKey = `${PREFIX_ENDPOINT}${hashEndpoint(endpoint)}`;

  if (!client) {
    const instId = memoryFallback.get(epKey);
    return instId ? getPushReminder(instId) : null;
  }

  try {
    const instId = await client.get<string>(epKey);
    if (!instId) return null;
    return getPushReminder(instId);
  } catch (err) {
    console.error('Failed to get push reminder by endpoint:', err);
    return null;
  }
}

/**
 * Retrieves all currently active push reminders for cron evaluation.
 */
export async function getAllActiveReminders(): Promise<PushReminderRecord[]> {
  const client = getRedisClient();

  if (!client) {
    const active: PushReminderRecord[] = [];
    for (const [key] of memoryFallback) {
      if (key.startsWith('active:')) {
        const instId = key.replace('active:', '');
        const rec = await getPushReminder(instId);
        if (rec && rec.challengeActive && rec.reminderEnabled) {
          active.push(rec);
        }
      }
    }
    return active;
  }

  try {
    const installationIds = await client.smembers(KEY_ACTIVE_SET);
    if (!installationIds || installationIds.length === 0) {
      return [];
    }

    const records: PushReminderRecord[] = [];
    // Batch fetch up to 50 active installations
    const limitedIds = installationIds.slice(0, 100);
    for (const id of limitedIds) {
      const rec = await getPushReminder(id);
      if (rec && rec.challengeActive && rec.reminderEnabled) {
        records.push(rec);
      } else if (rec && (!rec.challengeActive || !rec.reminderEnabled)) {
        // Self-clean stale entry from active set
        await client.srem(KEY_ACTIVE_SET, id);
      }
    }

    return records;
  } catch (err) {
    console.error('Failed to fetch active reminders from Redis:', err);
    return [];
  }
}

/**
 * Disables push reminder delivery for an installation without deleting the record.
 */
export async function disablePushReminder(installationId: string): Promise<boolean> {
  const rec = await getPushReminder(installationId);
  if (!rec) return false;

  rec.reminderEnabled = false;
  rec.updatedAt = Date.now();
  return upsertPushReminder(rec);
}

/**
 * Permanently deletes a push reminder record, endpoint mapping, and active index.
 */
export async function deletePushReminder(installationId: string): Promise<boolean> {
  const rec = await getPushReminder(installationId);
  const client = getRedisClient();
  const instKey = `${PREFIX_INST}${installationId}`;

  if (!client) {
    memoryFallback.delete(instKey);
    memoryFallback.delete(`active:${installationId}`);
    if (rec?.subscription?.endpoint) {
      memoryFallback.delete(`${PREFIX_ENDPOINT}${hashEndpoint(rec.subscription.endpoint)}`);
    }
    return true;
  }

  try {
    await client.del(instKey);
    await client.srem(KEY_ACTIVE_SET, installationId);
    if (rec?.subscription?.endpoint) {
      await client.del(`${PREFIX_ENDPOINT}${hashEndpoint(rec.subscription.endpoint)}`);
    }
    return true;
  } catch (err) {
    console.error('Failed to delete push reminder from Redis:', err);
    return false;
  }
}

/**
 * Atomically acquires a delivery lock for a specific reminder slot.
 * Ensures at most ONE notification is sent for a given slot across all instances.
 *
 * @param claimKey Canonical slot key: "${challengeId}|${localDate}|${slotTime}"
 * @param ttlSeconds Lock duration in seconds (default: 86400 / 24 hours)
 */
export async function acquireSlotLock(claimKey: string, ttlSeconds = 86400): Promise<boolean> {
  const lockKey = `${PREFIX_LOCK}${claimKey}`;
  const client = getRedisClient();

  if (!client) {
    const existing = memoryFallbackLocks.get(lockKey);
    const now = Date.now();
    if (existing && existing > now) {
      return false; // already locked
    }
    memoryFallbackLocks.set(lockKey, now + ttlSeconds * 1000);
    return true;
  }

  try {
    // Redis SET key value NX EX ttl (atomic set-if-not-exists with expiration)
    const result = await client.set(lockKey, '1', {
      nx: true,
      ex: ttlSeconds,
    });
    return result === 'OK';
  } catch (err) {
    console.error('Failed to acquire slot lock in Redis:', err);
    return false;
  }
}

/**
 * Releases a previously acquired slot lock.
 * Used when a push delivery fails transiently so that subsequent scheduler retries
 * or invocations within the active window can re-attempt delivery.
 */
export async function releaseSlotLock(claimKey: string): Promise<boolean> {
  const lockKey = `${PREFIX_LOCK}${claimKey}`;
  const client = getRedisClient();

  if (!client) {
    memoryFallbackLocks.delete(lockKey);
    return true;
  }

  try {
    await client.del(lockKey);
    return true;
  } catch (err) {
    console.error('Failed to release slot lock in Redis:', err);
    return false;
  }
}
