import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 10;

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

const supabaseAdmin = (() => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
})();

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

export default async function handler(
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

  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const days = Math.min(Math.max(parseInt(url.searchParams.get('days') ?? '30', 10), 1), 365);
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
      periodDays: days,
      since,
      totalReports,
      totalCostUsd: parseFloat(totalCost.toFixed(6)),
      overCapCount,
      byPlan,
      byRole,
      recent: recentRes.data ?? [],
    });
  } catch (err: any) {
    console.error('[cost-summary] query error:', err.message);
    return json(res, 500, { error: 'Failed to query usage logs.', code: 'QUERY_ERROR' });
  }
}
