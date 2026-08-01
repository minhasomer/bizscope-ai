/**
 * api/admin/[...path].ts
 *
 * Admin API router — consolidates all /api/admin/* endpoints into a single
 * serverless function to stay within Vercel's per-deployment function limit.
 *
 * Supported routes (explicit allowlist — unknown paths return 404):
 *
 *   GET  /api/admin/beta-access        → list current BetaTesters
 *   POST /api/admin/beta-access        → grant or revoke a single email
 *                                          body: { email: string, action: 'grant' | 'revoke' }
 *
 *   GET  /api/admin/cost-summary       → AI cost report (optional ?days=N, 1–365)
 *
 * All routes require a valid Admin-role Supabase session token in the
 * Authorization: Bearer <token> header.
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

// maxDuration is the higher of the two original values (beta-access=15, cost-summary=10)
export const maxDuration = 15;

// ─── Shared utilities ─────────────────────────────────────────────────────────

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

// Shared Supabase admin singleton
const supabaseAdmin = (() => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
})();

/**
 * Extracts the admin action name from the request URL.
 * Returns '' for unknown or nested paths (treated as 404).
 * Expects exactly /api/admin/<action> — rejects deeper nesting.
 */
function getAdminSubPath(req: IncomingMessage): string {
  const parsed = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const parts = parsed.pathname.split('/').filter(s => s.length > 0);
  // Expect exactly ['api', 'admin', '<action>'] — reject deeper nesting
  if (parts.length !== 3) return '';
  return parts[2];
}

// ─── Auth: beta-access — returns caller role string ───────────────────────────
//
// Matches the original beta-access.ts getCallerRole() exactly.
// Does NOT have a try/catch so DB errors propagate naturally.

async function getCallerRole(authHeader: string | undefined): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) return null;

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return null;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return profile?.role ?? null;
}

// ─── Auth: cost-summary — returns boolean, swallows errors ────────────────────
//
// Matches the original cost-summary.ts verifyAdminRole() exactly.

async function verifyAdminRole(authHeader: string | undefined): Promise<boolean> {
  if (!supabaseAdmin) return false;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) return false;
  try {
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return false;
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    return !profileError && profile?.role === 'Admin';
  } catch {
    return false;
  }
}

// ─── Sub-handler: beta-access ─────────────────────────────────────────────────
//
// Behaviour is identical to the original api/admin/beta-access.ts.
// Ordering: NOT_CONFIGURED check → auth → method dispatch

async function handleBetaAccess(
  req: IncomingMessage & { body?: any },
  res: ServerResponse,
): Promise<void> {
  if (!supabaseAdmin) {
    return json(res, 503, { error: 'Database not configured.', code: 'NOT_CONFIGURED' });
  }

  const callerRole = await getCallerRole(req.headers['authorization'] as string | undefined);
  if (callerRole !== 'Admin') {
    return json(res, 403, { error: 'Admin access required.', code: 'FORBIDDEN' });
  }

  // GET: list current BetaTesters
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('email, role, subscription_tier, updated_at')
      .eq('role', 'BetaTester')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[BetaAccess] list error:', error.message);
      return json(res, 500, { error: error.message, code: 'DB_ERROR' });
    }
    return json(res, 200, { betaTesters: data ?? [] });
  }

  // POST: grant or revoke a single email
  if (req.method === 'POST') {
    const body = req.body ?? {};
    const email: string = (body.email ?? '').trim().toLowerCase();
    const action: string = body.action ?? '';

    if (!email) {
      return json(res, 400, { error: 'email is required.', code: 'INVALID_INPUT' });
    }
    if (action !== 'grant' && action !== 'revoke') {
      return json(res, 400, { error: 'action must be "grant" or "revoke".', code: 'INVALID_INPUT' });
    }

    const { data: profile, error: findError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role, subscription_tier')
      .ilike('email', email)
      .maybeSingle();

    if (findError) {
      console.error('[BetaAccess] profile lookup error:', findError.message);
      return json(res, 500, { error: findError.message, code: 'DB_ERROR' });
    }
    if (!profile) {
      return json(res, 404, {
        error: `No account found for "${email}". The user must sign up before beta access can be granted.`,
        code: 'USER_NOT_FOUND',
      });
    }

    if (profile.role === 'Admin') {
      return json(res, 409, {
        error: `"${profile.email}" is an Admin — their role cannot be changed via this endpoint.`,
        code: 'PROTECTED_ROLE',
      });
    }

    const newRole = action === 'grant' ? 'BetaTester' : 'Explorer';
    const newTier = action === 'grant' ? 'ProPlus'    : 'Explorer';

    if (profile.role === newRole && profile.subscription_tier === newTier) {
      return json(res, 200, {
        success:           true,
        noChange:          true,
        email:             profile.email,
        role:              profile.role,
        subscription_tier: profile.subscription_tier,
        message:           `"${profile.email}" is already ${newRole}.`,
      });
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        role:              newRole,
        subscription_tier: newTier,
        updated_at:        new Date().toISOString(),
      })
      .eq('id', profile.id);

    if (updateError) {
      console.error('[BetaAccess] update error:', updateError.message);
      return json(res, 500, { error: updateError.message, code: 'DB_ERROR' });
    }

    console.log(`[BetaAccess] ${action}: ${profile.email} → role=${newRole} tier=${newTier}`);
    return json(res, 200, {
      success:           true,
      email:             profile.email,
      role:              newRole,
      subscription_tier: newTier,
    });
  }

  return json(res, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
}

// ─── Sub-handler: cost-summary ────────────────────────────────────────────────
//
// Behaviour is identical to the original api/admin/cost-summary.ts.
// Ordering: method guard → auth → NOT_CONFIGURED → query

async function handleCostSummary(
  req: IncomingMessage & { body?: any },
  res: ServerResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  }

  const isAdmin = await verifyAdminRole(req.headers['authorization'] as string | undefined);
  if (!isAdmin) {
    return json(res, 403, { error: 'Admin access required.', code: 'FORBIDDEN' });
  }

  if (!supabaseAdmin) {
    return json(res, 503, { error: 'Database not configured.', code: 'DB_UNAVAILABLE' });
  }

  const parsed = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const days = Math.min(Math.max(parseInt(parsed.searchParams.get('days') ?? '30', 10), 1), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const [totalsRes, recentRes] = await Promise.all([
      supabaseAdmin
        .from('usage_logs')
        .select('plan, user_role, estimated_cost_usd, within_hard_cap')
        .gte('generated_at', since),
      supabaseAdmin
        .from('usage_logs')
        .select('user_email, user_role, plan, model, business_type, location, estimated_cost_usd, within_hard_cap, generated_at')
        .gte('generated_at', since)
        .order('generated_at', { ascending: false })
        .limit(20),
    ]);

    if (totalsRes.error) throw totalsRes.error;
    if (recentRes.error) throw recentRes.error;

    const rows = totalsRes.data ?? [];
    const totalCost = rows.reduce((sum, r) => sum + (r.estimated_cost_usd ?? 0), 0);
    const totalReports = rows.length;
    const overCapCount = rows.filter(r => !r.within_hard_cap).length;

    const byPlan: Record<string, { reports: number; cost: number }> = {};
    const byRole: Record<string, { reports: number; cost: number }> = {};
    for (const r of rows) {
      const p = r.plan ?? 'Unknown';
      const rl = r.user_role ?? 'Unknown';
      byPlan[p] ??= { reports: 0, cost: 0 };
      byPlan[p].reports++;
      byPlan[p].cost += r.estimated_cost_usd ?? 0;
      byRole[rl] ??= { reports: 0, cost: 0 };
      byRole[rl].reports++;
      byRole[rl].cost += r.estimated_cost_usd ?? 0;
    }

    return json(res, 200, {
      periodDays:   days,
      since,
      totalReports,
      totalCostUsd: parseFloat(totalCost.toFixed(6)),
      overCapCount,
      byPlan,
      byRole,
      recent:       recentRes.data ?? [],
    });
  } catch (err: any) {
    console.error('[cost-summary] query error:', err.message);
    return json(res, 500, { error: 'Failed to query usage logs.', code: 'QUERY_ERROR' });
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(
  req: IncomingMessage & { body?: any },
  res: ServerResponse,
): Promise<void> {
  const subPath = getAdminSubPath(req);

  switch (subPath) {
    case 'beta-access':  return handleBetaAccess(req, res);
    case 'cost-summary': return handleCostSummary(req, res);
    default:             return json(res, 404, { error: 'Not found.', code: 'NOT_FOUND' });
  }
}
