/**
 * BizScope Assistant — In-Memory Rate Limiter
 *
 * Mirrors the pattern used in api/contact.ts.
 * Two independent buckets: one keyed by IP (anonymous users),
 * one keyed by user ID (authenticated users).
 *
 * Resets on cold-start — good enough for a low-traffic beta.
 * Replace with a Redis-backed approach for high-traffic production.
 */

const WINDOW_MS = 60 * 60 * 1000; // 1 hour

const ANON_MAX  = 10;  // requests per IP per hour (anonymous)
const AUTH_MAX  = 40;  // requests per user-ID per hour (authenticated)

interface Bucket { count: number; resetAt: number }

const anonLog: Map<string, Bucket> = new Map();
const authLog: Map<string, Bucket> = new Map();

function check(store: Map<string, Bucket>, key: string, max: number): boolean {
  const now  = Date.now();
  const entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false; // not limited
  }
  if (entry.count >= max) return true; // limited
  entry.count += 1;
  return false;
}

/** Returns true when the anonymous IP has exceeded its quota. */
export function isAnonRateLimited(ip: string): boolean {
  return check(anonLog, ip || 'unknown', ANON_MAX);
}

/** Returns true when the authenticated user has exceeded their quota. */
export function isAuthRateLimited(userId: string): boolean {
  return check(authLog, userId, AUTH_MAX);
}
