/**
 * api/admin/beta-access.ts
 *
 * Admin-only endpoint to grant or revoke BetaTester access.
 * Every request must carry a valid Admin-role Supabase session token.
 * The service role key is used server-side — never exposed to the client.
 *
 *   GET  /api/admin/beta-access          → list current BetaTesters
 *   POST /api/admin/beta-access          → grant or revoke a single email
 *        body: { email: string, action: 'grant' | 'revoke' }
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 15;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

// ─── Supabase admin client ────────────────────────────────────────────────────

const supabaseAdmin = (() => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
})();

// ─── Auth guard ───────────────────────────────────────────────────────────────

/**
 * Verifies the Bearer token and returns the caller's role from the profiles
 * table. Returns null if the token is missing, invalid, or the profile lookup
 * fails. This is a full DB round-trip — Admin cannot be spoofed client-side.
 */
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

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(
  req: IncomingMessage & { body?: any },
  res: ServerResponse,
): Promise<void> {
  // Dependency check
  if (!supabaseAdmin) {
    return json(res, 503, { error: 'Database not configured.', code: 'NOT_CONFIGURED' });
  }

  // Admin-only: verify caller role server-side
  const callerRole = await getCallerRole(req.headers['authorization'] as string | undefined);
  if (callerRole !== 'Admin') {
    return json(res, 403, { error: 'Admin access required.', code: 'FORBIDDEN' });
  }

  // ── GET: list current BetaTesters ─────────────────────────────────────────
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

  // ── POST: grant or revoke a single email ──────────────────────────────────
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

    // Confirm the account exists (user must have signed up already)
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

    // Prevent accidentally demoting an Admin
    if (profile.role === 'Admin') {
      return json(res, 409, {
        error: `"${profile.email}" is an Admin — their role cannot be changed via this endpoint.`,
        code: 'PROTECTED_ROLE',
      });
    }

    const newRole = action === 'grant' ? 'BetaTester' : 'Explorer';
    const newTier = action === 'grant' ? 'ProPlus'    : 'Explorer';

    // No-op if already in desired state
    if (profile.role === newRole && profile.subscription_tier === newTier) {
      return json(res, 200, {
        success: true,
        noChange: true,
        email: profile.email,
        role: profile.role,
        subscription_tier: profile.subscription_tier,
        message: `"${profile.email}" is already ${newRole}.`,
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
      success: true,
      email: profile.email,
      role: newRole,
      subscription_tier: newTier,
    });
  }

  return json(res, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
}
