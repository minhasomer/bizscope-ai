/**
 * BizScope Assistant — Persistent Daily Limit Enforcement
 *
 * Uses Supabase (service role) and an atomic PostgreSQL RPC to check and
 * increment per-user / per-IP daily usage limits.
 *
 * Fails open on DB errors: a Supabase outage will not block legitimate users,
 * but will log a warning. The per-minute in-memory rate limiter still applies.
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import type { SafeChatUserContext } from './context.js';

// ── Supabase client (server-side, service role only) ──────────────────────────

const supabase = (() => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
})();

// ── Daily limits (env var overrides for operational flexibility) ───────────────

const DAILY_LIMITS: Record<string, number> = {
  anonymous:  parseInt(process.env.CHAT_ANONYMOUS_DAILY_LIMIT  ?? '3',   10),
  Explorer:   parseInt(process.env.CHAT_EXPLORER_DAILY_LIMIT   ?? '10',  10),
  Pro:        parseInt(process.env.CHAT_PRO_DAILY_LIMIT        ?? '30',  10),
  'Pro+':     parseInt(process.env.CHAT_PROPLUS_DAILY_LIMIT    ?? '60',  10),
  Enterprise: parseInt(process.env.CHAT_ENTERPRISE_DAILY_LIMIT ?? '100', 10),
  Admin:      parseInt(process.env.CHAT_ADMIN_DAILY_LIMIT      ?? '250', 10),
};

// ── Identity helpers ──────────────────────────────────────────────────────────

const IP_SALT = process.env.CHAT_IP_SALT ?? 'bizscope-chat-v1';

/** Privacy-preserving identity for anonymous users: SHA-256(ip + salt), first 32 hex chars. */
export function hashIdentity(ip: string): string {
  return crypto.createHash('sha256').update(ip + IP_SALT).digest('hex').slice(0, 32);
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function getIdentity(
  ctx: SafeChatUserContext,
  ip: string,
): { type: 'user' | 'anon'; key: string; userId: string | null } {
  if (ctx.isAuthenticated && ctx.userId) {
    return { type: 'user', key: ctx.userId, userId: ctx.userId };
  }
  return { type: 'anon', key: hashIdentity(ip), userId: null };
}

// ── Daily limit lookup ────────────────────────────────────────────────────────

export function getDailyLimit(ctx: SafeChatUserContext): number {
  if (!ctx.isAuthenticated) return DAILY_LIMITS.anonymous;
  // Admin role gets a higher limit than the Enterprise plan they resolve to
  if (ctx.role === 'Admin') return DAILY_LIMITS.Admin;
  return DAILY_LIMITS[ctx.plan ?? 'Explorer'] ?? DAILY_LIMITS.Explorer;
}

// ── Atomic check + increment ──────────────────────────────────────────────────

export interface DailyLimitResult {
  allowed:   boolean;
  count:     number;  // new count after increment (or current count if blocked)
  limit:     number;
  remaining: number;  // limit - count; 0 when exhausted
}

/**
 * Atomically checks the daily limit and increments if allowed.
 * Call only for requests that are going to reach Gemini (not for blocked intents).
 * Fails open: if Supabase is unreachable, returns allowed=true with a warning.
 */
export async function checkAndIncrementDaily(
  ctx: SafeChatUserContext,
  ip: string,
): Promise<DailyLimitResult> {
  const limit = getDailyLimit(ctx);

  if (!supabase) {
    console.warn('[chat] Supabase not configured — daily limit check skipped');
    return { allowed: true, count: 0, limit, remaining: limit };
  }

  const { type, key, userId } = getIdentity(ctx, ip);
  const today = todayUTC();

  try {
    const { data, error } = await supabase.rpc('chat_check_and_increment', {
      p_identity_type: type,
      p_identity_key:  key,
      p_user_id:       userId,
      p_usage_date:    today,
      p_daily_limit:   limit,
    });

    if (error) {
      console.error('[chat] daily limit RPC error:', error.message);
      return { allowed: true, count: 0, limit, remaining: limit };
    }

    const result = data as { allowed: boolean; count: number };
    const remaining = Math.max(0, limit - result.count);
    return { allowed: result.allowed, count: result.count, limit, remaining };
  } catch (err: any) {
    console.error('[chat] daily limit unexpected error:', err?.message ?? err);
    return { allowed: true, count: 0, limit, remaining: limit };
  }
}

// ── Global kill switch ────────────────────────────────────────────────────────

export interface GlobalUsage {
  totalMessages: number;
  totalCostUsd:  number;
}

/**
 * Reads the sum of all message counts and estimated costs for today.
 * Used to enforce global daily request and cost ceilings.
 * Returns zeros on error (fail open — don't block legitimate traffic on DB error).
 */
export async function getGlobalDailyUsage(): Promise<GlobalUsage> {
  if (!supabase) return { totalMessages: 0, totalCostUsd: 0 };

  try {
    const { data, error } = await supabase
      .from('chat_usage_daily')
      .select('message_count, estimated_cost')
      .eq('usage_date', todayUTC());

    if (error) {
      console.error('[chat] global usage query error:', error.message);
      return { totalMessages: 0, totalCostUsd: 0 };
    }

    const rows = (data ?? []) as Array<{ message_count: number; estimated_cost: number }>;
    return {
      totalMessages: rows.reduce((s, r) => s + (r.message_count ?? 0), 0),
      totalCostUsd:  rows.reduce((s, r) => s + Number(r.estimated_cost ?? 0), 0),
    };
  } catch (err: any) {
    console.error('[chat] global usage unexpected error:', err?.message ?? err);
    return { totalMessages: 0, totalCostUsd: 0 };
  }
}

// ── Cost logging ──────────────────────────────────────────────────────────────

/**
 * Additively updates the token and cost fields for an existing usage row.
 * Call after a successful Gemini response, before returning to the client.
 * Best-effort: errors are logged but do not fail the response.
 */
export async function logChatCost(
  ctx: SafeChatUserContext,
  ip: string,
  inputTokens: number,
  outputTokens: number,
  estimatedCostUsd: number,
): Promise<void> {
  if (!supabase) return;

  const { type, key } = getIdentity(ctx, ip);
  const today = todayUTC();

  try {
    const { error } = await supabase.rpc('chat_log_cost', {
      p_identity_type:  type,
      p_identity_key:   key,
      p_usage_date:     today,
      p_input_tokens:   inputTokens,
      p_output_tokens:  outputTokens,
      p_estimated_cost: estimatedCostUsd,
    });
    if (error) {
      console.error('[chat] cost log RPC error:', error.message);
    }
  } catch (err: any) {
    console.error('[chat] cost log unexpected error:', err?.message ?? err);
  }
}
