/**
 * BizScope Assistant — In-Memory Per-Minute Rate Limiter
 *
 * Provides burst protection (5 requests / 60 s per identity).
 * Intentionally in-memory: the 60-second window is short enough that
 * serverless cold-starts are not a meaningful bypass vector.
 *
 * Daily limits (the real enforcement boundary) are in dailyLimit.ts
 * backed by Supabase and persist across instances and redeployments.
 */

const WINDOW_MS = 60 * 1000; // 1 minute
const PM_MAX    = parseInt(process.env.CHAT_PER_MINUTE_LIMIT ?? '5', 10);

interface Bucket { count: number; resetAt: number }

const anonLog: Map<string, Bucket> = new Map();
const authLog: Map<string, Bucket> = new Map();

function check(store: Map<string, Bucket>, key: string): boolean {
  const now   = Date.now();
  const entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false; // not limited
  }
  if (entry.count >= PM_MAX) return true; // limited
  entry.count += 1;
  return false;
}

/** Returns true when the anonymous IP has exceeded the per-minute quota. */
export function isAnonRateLimited(ip: string): boolean {
  return check(anonLog, ip || 'unknown');
}

/** Returns true when the authenticated user has exceeded the per-minute quota. */
export function isAuthRateLimited(userId: string): boolean {
  return check(authLog, userId);
}
