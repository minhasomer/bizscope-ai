import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';
import { normalizeTierToBudgetPlan } from '../src/config/aiBudget.js';
import { getPlanLimits } from '../src/config/plans.js';
import { getCurrentMonthKey } from '../src/config/usageTracking.js';

// ─── Response helper ──────────────────────────────────────────────────────────

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

// ─── Supabase admin client (lazy singleton) ───────────────────────────────────

const supabaseAdmin = (() => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
})();

const _serverBetaFullAccess: boolean = process.env.BETA_FULL_ACCESS === 'true';

function getServerSidePlan(role: string, subscription_tier: string): string {
  const r = (role ?? '').trim().toLowerCase();
  if (r === 'admin') return 'Enterprise';
  if (_serverBetaFullAccess) return 'Pro+';
  if (r === 'betatester' || r === 'beta_tester' || r === 'beta_vip') return 'Pro+';
  return normalizeTierToBudgetPlan(subscription_tier);
}

async function verifyUser(authHeader: string | undefined): Promise<{
  userId: string | null;
  plan: string;
} > {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!supabaseAdmin || !token) return { userId: null, plan: 'Explorer' };

  try {
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return { userId: null, plan: 'Explorer' };

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, subscription_tier')
      .eq('id', user.id)
      .single();
    if (profileError || !profile) return { userId: user.id, plan: 'Explorer' };

    return { userId: user.id, plan: getServerSidePlan(profile.role, profile.subscription_tier) };
  } catch (err: any) {
    console.error('[UsageSummary] verifyUser exception:', err.message);
    return { userId: null, plan: 'Explorer' };
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(
  req: IncomingMessage & { body?: any },
  res: ServerResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  }

  const { userId, plan } = await verifyUser(req.headers['authorization'] as string | undefined);
  if (!userId) {
    return json(res, 401, { error: 'Authentication required.', code: 'UNAUTHENTICATED' });
  }

  const limits = getPlanLimits(plan as any);
  const monthKey = getCurrentMonthKey();

  let standardUsed = 0;
  let dossierUsed = 0;

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('usage_tracking')
      .select('report_type, count')
      .eq('user_id', userId)
      .eq('month_key', monthKey)
      .in('report_type', ['standard', 'opportunity_dossier']);

    if (error) {
      console.error('[UsageSummary] usage_tracking query failed:', error.message ?? error);
    } else {
      for (const row of data ?? []) {
        if (row.report_type === 'standard') standardUsed = row.count ?? 0;
        if (row.report_type === 'opportunity_dossier') dossierUsed = row.count ?? 0;
      }
    }
  }

  return json(res, 200, {
    plan,
    monthKey,
    betaFullAccess: _serverBetaFullAccess,
    standard: {
      used: standardUsed,
      limit: limits.standardReportsPerCycle,
      remaining: limits.standardReportsPerCycle === null
        ? null
        : Math.max(0, limits.standardReportsPerCycle - standardUsed),
    },
    opportunityDossier: {
      used: dossierUsed,
      // No enforced cap yet — visibility only.
      limit: null,
    },
  });
}
