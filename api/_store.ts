/**
 * Push Subscription Store Adapter for Vercel Serverless Functions
 *
 * In-memory / module-scoped registry for serverless instances.
 * On production deployments requiring persistent multi-instance cross-session storage,
 * this adapter can be backed by Vercel KV, Upstash Redis, or Supabase.
 */

export interface StoredSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  settings?: {
    frequency?: string;
    activeStart?: string;
    activeEnd?: string;
    dailyTimes?: string[];
    randomize?: boolean;
    showWhy?: boolean;
  };
  timezone?: string;
  createdAt: number;
  lastDeliveredAt?: number;
}

// Module-level map of active subscriptions (keyed by endpoint)
const subscriptionRegistry = new Map<string, StoredSubscription>();

export function saveSubscription(sub: StoredSubscription): void {
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return;
  subscriptionRegistry.set(sub.endpoint, sub);
}

export function removeSubscription(endpoint: string): boolean {
  return subscriptionRegistry.delete(endpoint);
}

export function getSubscription(endpoint: string): StoredSubscription | undefined {
  return subscriptionRegistry.get(endpoint);
}

export function getAllSubscriptions(): StoredSubscription[] {
  return Array.from(subscriptionRegistry.values());
}
