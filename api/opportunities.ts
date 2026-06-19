import type { IncomingMessage, ServerResponse } from 'http';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import {
  normalizeTierToBudgetPlan,
  getReportBudget,
  wouldExceedHardCap,
  aggregateGeminiUsage,
} from '../src/config/aiBudget.js';
import { checkRegionalQuota, incrementUsageTracking } from '../src/config/usageTracking.js';
import { checkBlockedCategory, blockedCategoryMessage } from '../src/utils/blockedCategories.js';
import { validateUSLocation } from '../src/utils/locationValidation.js';

export const maxDuration = 60;

// ─── Response helper ──────────────────────────────────────────────────────────

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

// ─── Schema ───────────────────────────────────────────────────────────────────

enum Type {
  STRING = 'STRING', INTEGER = 'INTEGER', NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN', OBJECT = 'OBJECT', ARRAY = 'ARRAY',
}

const opportunitySchema = {
  type: Type.OBJECT,
  properties: {
    location: { type: Type.STRING },
    summary: { type: Type.STRING, description: 'A high-level summary of the business climate in this location.' },
    topOpportunities: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          businessType: { type: Type.STRING },
          description: { type: Type.STRING },
          whyItsGood: { type: Type.STRING, description: 'A brief analysis of why this is a strong fit for the locality.' },
          scores: {
            type: Type.OBJECT,
            properties: {
              capEx: { type: Type.INTEGER, description: '1-10 (1 is minimal upfront cost, 10 is high capital requirements)' },
              overhead: { type: Type.INTEGER, description: '1-10 (1 is low monthly expenses, 10 is very high)' },
              laborIntensity: { type: Type.INTEGER, description: '1-10 (1 is easy to manage alone/automated, 10 is heavy staffing needed)' },
              competitionLevel: { type: Type.INTEGER, description: '1-10 (1 is virtually no direct competition, 10 is saturated)' },
              overallPotental: { type: Type.INTEGER, description: 'Deprecated — set equal to estimatedMarketDemand' },
              estimatedMarketDemand: { type: Type.INTEGER, description: '0-100: strength of consumer demand for this category in this specific location (100 = very high unmet demand)' },
              estimatedCompetitionIntensity: { type: Type.INTEGER, description: '0-100: local competitive saturation (100 = fully saturated market, 0 = no competition)' },
              estimatedFinancialFeasibility: { type: Type.INTEGER, description: '0-100: realistic probability of achieving positive unit economics within 18 months given local costs and revenue potential (100 = highly feasible)' },
              estimatedRiskLevel: { type: Type.INTEGER, description: '0-100: overall execution and market risk combining operational complexity, regulatory burden, and demand volatility (100 = very high risk)' },
            },
            required: ['capEx', 'overhead', 'laborIntensity', 'competitionLevel', 'overallPotental', 'estimatedMarketDemand', 'estimatedCompetitionIntensity', 'estimatedFinancialFeasibility', 'estimatedRiskLevel'],
          },
          financials: {
            type: Type.OBJECT,
            properties: {
              estimatedStartupCost: { type: Type.STRING },
              targetMarket: { type: Type.STRING },
              potentialRevenue: { type: Type.STRING },
            },
            required: ['estimatedStartupCost', 'targetMarket', 'potentialRevenue'],
          },
          risks: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '2-3 key risks or challenges for this business in this location',
          },
          customerSegment: { type: Type.STRING, description: 'Specific customer demographic and psychographic description' },
          bestNearbyArea: { type: Type.STRING, description: 'Best nearby ZIP code or neighborhood to launch in' },
        },
        required: ['businessType', 'description', 'whyItsGood', 'scores', 'financials'],
      },
    },
    methodology: { type: Type.STRING },
  },
  required: ['location', 'summary', 'topOpportunities', 'methodology'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, msg: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(msg)), ms);
    promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

function repairTruncatedJSON(s: string): string {
  const closes: string[] = [];
  let inString = false;
  let escaped  = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped)                   { escaped = false; continue; }
    if (ch === '\\' && inString)   { escaped = true;  continue; }
    if (ch === '"')                { inString = !inString; continue; }
    if (inString)                  continue;
    if      (ch === '{')           closes.push('}');
    else if (ch === '[')           closes.push(']');
    else if (ch === '}' || ch === ']') closes.pop();
  }
  if (closes.length === 0 && !inString) return s;
  let repaired = s.trimEnd().replace(/,\s*$/, '').replace(/:\s*$/, ': null');
  // Gemini output can be truncated mid-string-value (e.g. cut off inside a
  // competitor's "address" field) when it hits maxOutputTokens. If the walk
  // above ended still inside a string, close that string first — otherwise
  // every brace/bracket we append below stays inside the unterminated string
  // and JSON.parse still fails.
  if (inString) repaired += '"';
  for (let i = closes.length - 1; i >= 0; i--) repaired += closes[i];
  return repaired;
}

function cleanAndParseJSON(text: string, fallback?: any, context?: string): any {
  let s = text.trim()
    .replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
  try { return JSON.parse(s); } catch { /* fall through */ }
  const oi = s.indexOf('{'), ai = s.indexOf('[');
  let start = -1, end = -1;
  if (oi !== -1 && (ai === -1 || oi < ai)) { start = oi; end = s.lastIndexOf('}'); }
  else if (ai !== -1)                       { start = ai; end = s.lastIndexOf(']'); }
  if (start !== -1 && end > start) {
    try { return JSON.parse(s.substring(start, end + 1)); } catch { /* fall through */ }
  }
  if (start !== -1) {
    try { return JSON.parse(repairTruncatedJSON(s.substring(start))); } catch { /* fall through */ }
  }
  console.error('[cleanAndParseJSON] all parse attempts failed:', {
    context:   context ?? 'unknown',
    rawLength: text.length,
    rawPrefix: text.slice(0, 500),
  });
  if (fallback !== undefined) return fallback;
  throw new Error('malformed_response');
}

function isCachedReportValid(report: any): boolean {
  return (
    report !== null &&
    typeof report === 'object' &&
    !Array.isArray(report) &&
    typeof report.location === 'string' &&
    Array.isArray(report.topOpportunities)
  );
}

function getGroundingSources(response: any): { title: string; uri: string }[] {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  return chunks.flatMap((c: any) => {
    const out = [];
    if (c.web) out.push({ title: c.web.title || 'Web Source', uri: c.web.uri });
    if (c.maps) out.push({ title: c.maps.title || 'Map Source', uri: c.maps.uri });
    return out;
  });
}

function getOpportunityReportFallback(location: string): any {
  return {
    location,
    summary: `Underserved commercial sectors in ${location} present low barriers to entry and strong consumer margins.`,
    topOpportunities: [
      {
        businessType: 'Specialty Wellness Hub',
        description: 'Bespoke health, boutique physical care, or tailored wellness center.',
        whyItsGood: 'High disposable incomes and rising prioritization of mental and physical fitness.',
        scores: { capEx: 6, overhead: 5, laborIntensity: 4, competitionLevel: 3, overallPotental: 80, estimatedMarketDemand: 80, estimatedCompetitionIntensity: 30, estimatedFinancialFeasibility: 68, estimatedRiskLevel: 38 },
        financials: { estimatedStartupCost: '$60,000', targetMarket: 'Active health-minded families', potentialRevenue: '$150,000/Yr' },
      },
      {
        businessType: 'Local Quick-Service Bakery',
        description: 'Premium coffee, organic pastry kitchen, and neighborhood pantry store.',
        whyItsGood: 'Heavy foot traffic pockets lacking independent high-quality food counters.',
        scores: { capEx: 5, overhead: 7, laborIntensity: 5, competitionLevel: 4, overallPotental: 72, estimatedMarketDemand: 72, estimatedCompetitionIntensity: 55, estimatedFinancialFeasibility: 55, estimatedRiskLevel: 52 },
        financials: { estimatedStartupCost: '$85,000', targetMarket: 'Commuters and work-from-home residents', potentialRevenue: '$210,000/Yr' },
      },
    ],
    methodology: 'Local market study compilation based on traditional urban center variables.',
    groundingSources: [{ title: 'National Small Business Development Index', uri: 'https://www.sba.gov' }],
  };
}

// ─── Supabase admin client (lazy singleton) ───────────────────────────────────

const supabaseAdmin = (() => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
})();

// ─── Key-type diagnostic ──────────────────────────────────────────────────────

const _srKeyDiag = (() => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const isJwt      = key.startsWith('eyJ');
  const isSbSecret = key.startsWith('sb_secret');
  let roleClaim: string = isJwt ? 'decode-error' : 'not-a-jwt';
  if (isJwt) {
    try {
      const b64 = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as Record<string, unknown>;
      roleClaim = typeof payload.role === 'string' ? payload.role : 'missing';
    } catch { /* roleClaim stays 'decode-error' */ }
  }
  return { isJwt, isSbSecret, roleClaim };
})();

// Server-side beta full-access flag. Set BETA_FULL_ACCESS=true in Vercel env vars
// (NOT VITE_-prefixed — never sent to browser). When true, any authenticated
// non-Admin user is promoted to Pro+ for plan gating. Admin stays Enterprise.
// Remove or set false to revert to stored-role behaviour post-beta.
const _serverBetaFullAccess: boolean = process.env.BETA_FULL_ACCESS === 'true';

// ── Shared server-side report cache ──────────────────────────────────────────
const CACHE_VERSION = 'v1';
const MARKET_GAP_CACHE_MAX_AGE_DAYS = 45;

function normalizeCacheKey(s: string): string {
  return s.toLowerCase().trim();
}

// Maps full US state names (lowercase) to their 2-letter abbreviations.
// Used to collapse "Gurnee, Illinois" → "gurnee, il" before cache key construction.
const STATE_NAME_TO_ABBREV: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN',
  'mississippi': 'MS', 'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE',
  'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC',
  'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK', 'oregon': 'OR',
  'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA',
  'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
  'district of columbia': 'DC', 'washington dc': 'DC', 'washington d.c.': 'DC',
};

// Collapses equivalent location strings to a single cache key:
//   "Gurnee, Illinois" → "gurnee, il"
//   "Gurnee, IL"       → "gurnee, il"  (already canonical)
//   "Gurnee"           → "gurnee"      (no state → no guess)
//   "Springfield"      → "springfield" (ambiguous → no guess)
//   "60031"            → "60031"
function canonicalizeLocationForCache(raw: string): string {
  const s = raw.trim();
  const commaIdx = s.lastIndexOf(',');
  if (commaIdx !== -1) {
    const before = s.slice(0, commaIdx).trim();
    const after  = s.slice(commaIdx + 1).trim().toLowerCase();
    const abbrev = STATE_NAME_TO_ABBREV[after];
    if (abbrev) return `${before}, ${abbrev}`.toLowerCase();
  }
  return s.toLowerCase();
}

interface CacheHit {
  report:       any;
  isStale:      boolean;
  cacheAgeDays: number;
  generatedAt:  string;
}

async function getFromServerCache(
  businessType: string,
  location: string,
  reportType: string,
  maxAgeDays: number,
): Promise<CacheHit | null> {
  if (!supabaseAdmin) return null;
  try {
    const { data, error } = await supabaseAdmin
      .from('report_cache')
      .select('report, created_at')
      .eq('business_type', normalizeCacheKey(businessType))
      .eq('location',      normalizeCacheKey(location))
      .eq('report_type',   reportType)
      .eq('analysis_version', CACHE_VERSION)
      .single();
    if (error || !data) return null;
    if (!isCachedReportValid(data.report)) {
      console.warn(`[ServerCache] INVALID cached report for ${businessType} / ${location} (${reportType}) — treating as miss to force regeneration`);
      return null;
    }
    const ageMs        = Date.now() - new Date(data.created_at).getTime();
    const cacheAgeDays = Math.floor(ageMs / 86_400_000);
    const isStale      = ageMs > maxAgeDays * 86_400_000;
    if (isStale) {
      console.log(`[ServerCache] STALE — ${businessType} / ${location} (${reportType}, ${cacheAgeDays}d old, max ${maxAgeDays}d)`);
    } else {
      console.log(`[ServerCache] HIT fresh — ${businessType} / ${location} (${reportType}, ${cacheAgeDays}d old)`);
    }
    return { report: data.report, isStale, cacheAgeDays, generatedAt: data.created_at };
  } catch (err) {
    console.warn('[ServerCache] get error (non-fatal):', err);
    return null;
  }
}

async function setInServerCache(
  businessType: string,
  location: string,
  reportType: string,
  planTierMeta: string,
  report: any,
): Promise<void> {
  console.log('[ServerCache] cache write attempt:', {
    hasSupabaseUrl:             !!process.env.SUPABASE_URL,
    hasServiceRoleKey:          !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    usingServiceRoleClientForCache: !!supabaseAdmin,
    keyRoleClaim:               _srKeyDiag.roleClaim,
    businessType,
    location,
    reportType,
  });
  if (!supabaseAdmin) return;
  try {
    const cleanReport = { ...report };
    const CACHE_META_KEYS = ['_cached', '_generatedAt', '_cacheAgeDays', '_freshnessDays', '_isStale', '_refreshedFromStale'];
    for (const key of CACHE_META_KEYS) delete cleanReport[key];
    const { error } = await supabaseAdmin
      .from('report_cache')
      .upsert(
        {
          business_type:    normalizeCacheKey(businessType),
          location:         normalizeCacheKey(location),
          report_type:      reportType,
          analysis_version: CACHE_VERSION,
          plan_tier:        normalizeCacheKey(planTierMeta),
          report:           cleanReport,
          updated_at:       new Date().toISOString(),
        },
        { onConflict: 'business_type,location,report_type,analysis_version' },
      );
    if (error) {
      console.warn('[ServerCache] upsert error (non-fatal):', {
        code:    error.code,
        message: error.message,
        details: (error as any).details,
        hint:    (error as any).hint,
      });
    } else {
      console.log(`[ServerCache] STORED — ${businessType} / ${location} (${reportType})`);
    }
  } catch (err) {
    console.warn('[ServerCache] set error (non-fatal):', err);
  }
}

function getServerSidePlan(role: string, subscription_tier: string): string {
  const r = (role ?? '').trim().toLowerCase();
  if (r === 'admin') return 'Enterprise';
  if (_serverBetaFullAccess) return 'Pro+';
  if (r === 'betatester' || r === 'beta_tester' || r === 'beta_vip') return 'Pro+';
  return normalizeTierToBudgetPlan(subscription_tier);
}

async function verifyAndGetPlan(authHeader: string | undefined): Promise<{
  verifiedEmail: string;
  verifiedPlan: string;
  verifiedRole: string;
  verifiedUserId: string | null;
}> {
  const FALLBACK = { verifiedEmail: 'anonymous@bizscope.ai', verifiedPlan: 'Explorer', verifiedRole: '', verifiedUserId: null as string | null };

  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  console.log('[opportunities diag] auth header present:', { hasHeader: !!authHeader, tokenParsed: !!token });

  console.log('[opportunities diag] service role key type:', _srKeyDiag);
  if (_srKeyDiag.roleClaim !== 'service_role') {
    console.error(
      '[BetaAuth] WRONG KEY — SUPABASE_SERVICE_ROLE_KEY role claim is',
      JSON.stringify(_srKeyDiag.roleClaim),
      '(expected "service_role"). The anon/publishable key was likely pasted instead.',
      'Every profiles query will fail with 42501 until this is corrected in Vercel.',
    );
  }

  if (!supabaseAdmin) {
    console.log('[opportunities diag] getUser result: skipped — supabaseAdmin null');
    console.log('[opportunities diag] profile query attempted: skipped — supabaseAdmin null');
    console.log('[opportunities diag] profile query result: skipped — supabaseAdmin null');
    console.log('[opportunities diag] final verification result:', { verifiedRole: '', verifiedPlan: 'Explorer', verifiedUserIdPresent: false, reason: 'supabaseAdmin null' });
    return FALLBACK;
  }
  if (!token) {
    console.log('[opportunities diag] getUser result: skipped — no Bearer token in Authorization header');
    console.log('[opportunities diag] profile query attempted: skipped — no token');
    console.log('[opportunities diag] profile query result: skipped — no token');
    console.log('[opportunities diag] final verification result:', { verifiedRole: '', verifiedPlan: 'Explorer', verifiedUserIdPresent: false, reason: 'no token' });
    return FALLBACK;
  }

  try {
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    console.log('[opportunities diag] getUser result:', {
      userFound:        !!user,
      userId:           user?.id           ?? null,
      userEmail:        user?.email        ?? null,
      authErrorCode:    (userError as any)?.code    ?? null,
      authErrorMessage: (userError as any)?.message ?? null,
    });

    if (userError || !user) {
      console.log('[opportunities diag] profile query attempted: skipped — getUser failed');
      console.log('[opportunities diag] profile query result: skipped — getUser failed');
      console.log('[opportunities diag] final verification result:', { verifiedRole: '', verifiedPlan: 'Explorer', verifiedUserIdPresent: false, reason: 'getUser failed' });
      return FALLBACK;
    }

    console.log('[opportunities diag] profile query attempted:', { queryField: 'id', userId: user.id });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, subscription_tier')
      .eq('id', user.id)
      .single();

    console.log('[opportunities diag] profile query result:', {
      queryField:          'id',
      profileFound:        !!profile,
      profileErrorCode:    (profileError as any)?.code    ?? null,
      profileErrorMessage: (profileError as any)?.message ?? null,
      returnedRole:        profile?.role                  ?? null,
      returnedTier:        profile?.subscription_tier     ?? null,
    });

    if (profileError || !profile) {
      console.log('[opportunities diag] final verification result:', { verifiedRole: '', verifiedPlan: 'Explorer', verifiedUserIdPresent: true, reason: 'profile lookup failed' });
      return { ...FALLBACK, verifiedEmail: user.email ?? FALLBACK.verifiedEmail, verifiedUserId: user.id };
    }

    const verifiedPlan = getServerSidePlan(profile.role, profile.subscription_tier);

    console.log('[opportunities diag] final verification result:', {
      verifiedRole:          profile.role ?? '',
      verifiedPlan,
      verifiedUserIdPresent: true,
      reason:                'success',
    });

    return {
      verifiedEmail: user.email ?? FALLBACK.verifiedEmail,
      verifiedPlan,
      verifiedRole: profile.role ?? '',
      verifiedUserId: user.id,
    };
  } catch (err: any) {
    console.error('[BetaAuth] verifyAndGetPlan exception:', err.message);
    console.log('[opportunities diag] final verification result:', { verifiedRole: '', verifiedPlan: 'Explorer', verifiedUserIdPresent: false, reason: `exception: ${err.message}` });
    return FALLBACK;
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(
  req: IncomingMessage & { body?: any },
  res: ServerResponse,
): Promise<void> {
  console.log('[opportunities diag] request received:', { method: req.method, hasAuthHeader: !!req.headers['authorization'] });

  // Server-side kill switch — flip REAL_REPORTS_ENABLED=false to disable instantly.
  if (process.env.REAL_REPORTS_ENABLED !== 'true') {
    return json(res, 503, { error: 'This endpoint is not available.', code: 'NOT_AVAILABLE' });
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  }

  console.log('[opportunities diag] env check:', {
    hasSupabaseUrl:          !!process.env.SUPABASE_URL,
    hasServiceRoleKey:       !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasRealReportsEnabled:   !!process.env.REAL_REPORTS_ENABLED,
    realReportsEnabledValue: process.env.REAL_REPORTS_ENABLED,
    hasGeminiApiKey:         !!process.env.GEMINI_API_KEY,
    supabaseAdminInitialized: !!supabaseAdmin,
    betaFullAccess:          _serverBetaFullAccess,
  });

  const { verifiedEmail, verifiedPlan, verifiedRole, verifiedUserId } = await verifyAndGetPlan(
    req.headers['authorization'] as string | undefined,
  );

  // Gate: must be authenticated and have an upgraded plan.
  // When BETA_FULL_ACCESS=true, getServerSidePlan() already promotes any
  // authenticated non-Admin user to Pro+, so this check passes transparently.
  // Unauthenticated users always fall back to verifiedUserId=null / plan=Explorer.
  if (!verifiedUserId || verifiedPlan === 'Explorer') {
    console.warn(`[Opportunities] Rejected — userId=${verifiedUserId ?? 'null'} plan="${verifiedPlan}" role="${verifiedRole}" betaFullAccess=${_serverBetaFullAccess}`);
    return json(res, 403, {
      error: 'Market Gap analysis with real AI requires a Pro or higher plan.',
      code: 'INSUFFICIENT_PLAN',
    });
  }

  const requestStartMs = Date.now();
  const body = req.body ?? {};
  const { location, forceRegenerate } = body;

  if (!location?.trim()) {
    return json(res, 400, { error: 'Missing or invalid location.', code: 'INVALID_INPUT' });
  }
  const locationCheck = validateUSLocation(location.trim());
  if (!locationCheck.valid) {
    return json(res, 400, { error: locationCheck.reason, code: 'UNSUPPORTED_LOCATION' });
  }

  // Canonical form used for all cache operations — collapses full state names to
  // abbreviations so "Gurnee, IL" and "Gurnee, Illinois" share one cache entry.
  const canonLocation = canonicalizeLocationForCache(location.trim());
  console.log(`[MarketGapCache] rawLocation="${location.trim()}" canonicalLocation="${canonLocation}"`);

  // ── Shared cache check — before Gemini so cache hits skip AI entirely ────
  let cacheWasStale = false;
  if (!forceRegenerate) {
    const cacheHit = await getFromServerCache('market_gaps', canonLocation, 'opportunities', MARKET_GAP_CACHE_MAX_AGE_DAYS);
    if (cacheHit && !cacheHit.isStale) {
      console.log(`[MarketGapCache] HIT — ${canonLocation}`);
      console.log('[ActivityLog] attempt opportunities cache-hit');
      try {
        if (supabaseAdmin) {
          const topNames = Array.isArray((cacheHit.report as any)?.topOpportunities)
            ? (cacheHit.report as any).topOpportunities.slice(0, 5).map((o: any) => o.businessType).filter(Boolean)
            : [];
          const { error: activityLogErr } = await supabaseAdmin.from('report_activity_log').insert({
            user_id: verifiedUserId,
            user_email: verifiedEmail,
            report_type: 'market_gap',
            business_type: 'market_gaps',
            location: location.trim(),
            normalized_location: canonLocation,
            plan_tier: verifiedPlan,
            cache_status: 'hit',
            force_regenerate: false,
            success: true,
            source: 'market_gap_card',
            duration_ms: Date.now() - requestStartMs,
            metadata: { topOpportunityNames: topNames },
            ai_model: null,
            input_tokens: 0,
            output_tokens: 0,
            total_tokens: 0,
            estimated_ai_cost: 0,
          });
          if (activityLogErr) throw activityLogErr;
          console.log('[ActivityLog] success opportunities cache-hit');
        }
      } catch (logErr: any) {
        console.error('[ActivityLog] failed opportunities cache-hit:', logErr.message ?? logErr);
      }
      return json(res, 200, {
        ...cacheHit.report,
        _cached:        true,
        _generatedAt:   cacheHit.generatedAt,
        _cacheAgeDays:  cacheHit.cacheAgeDays,
        _freshnessDays: MARKET_GAP_CACHE_MAX_AGE_DAYS,
        _isStale:       false,
      });
    }
    console.log(`[MarketGapCache] MISS — ${canonLocation}${cacheHit?.isStale ? ' (stale)' : ''}`);
    cacheWasStale = !!cacheHit?.isStale;
  } else {
    console.log(`[MarketGapCache] BYPASS (forceRegenerate) — ${canonLocation}`);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json(res, 401, { error: 'Gemini API key is not configured.', code: 'MISSING_API_KEY' });
  }

  // ── Server-side quota check — standard reports (after cache, before Gemini) ─
  const quota = await checkRegionalQuota(supabaseAdmin, verifiedUserId, verifiedPlan as any, _serverBetaFullAccess);
  if (!quota.allowed) {
    console.warn(`[Opportunities] Quota exceeded — userId=${verifiedUserId} plan=${verifiedPlan} used=${quota.used} limit=${quota.limit}`);
    return json(res, 429, {
      error: 'Monthly report limit reached for your plan.',
      code: 'QUOTA_EXCEEDED',
      used: quota.used,
      limit: quota.limit,
    });
  }

  // Hoisted so the failure-path catch block (outside the try below) can still
  // report whichever model/usage data was captured before the error occurred.
  let geminiModelUsed: string | null = null;
  let phase1Usage: any = null;
  let phase2Usage: any = null;
  let phase1Grounded = false;  // true once the Search-grounding call returns — counts the billed grounded prompt even if usageMetadata is null

  try {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
    const normalizedPlan = normalizeTierToBudgetPlan(verifiedPlan);
    const budget = getReportBudget(normalizedPlan, 'standard');
    const model = budget.model;
    geminiModelUsed = model;
    console.log('[opportunities diag] model selected:', { normalizedPlan, model, maxOutputTokens: 8192 });

    let sources: { title: string; uri: string }[] = [];
    let marketData = 'No local market insights found.';

    function geminiErrDiag(err: unknown): Record<string, unknown> {
      if (!err || typeof err !== 'object') return { raw: String(err) };
      const e = err as Record<string, unknown>;
      return {
        status:  e['status']  ?? e['httpStatus'] ?? null,
        code:    e['code']    ?? null,
        message: typeof e['message'] === 'string' ? e['message'].slice(0, 300) : null,
        errorDetails: Array.isArray(e['errorDetails']) ? e['errorDetails'] : null,
      };
    }

    // Phase 1: Market landscape via Search grounding
    const phase1Prompt = `Research the business landscape and local economy of '${location}'. Find specific, factual information about:
1. Economic profile: dominant industries, major employers, primary employment sectors, and key economic drivers
2. Market character: is this primarily a residential suburb, college town, tourism destination, retirement community, industrial/logistics hub, agricultural region, or professional-services center? Note multiple if they apply.
3. Demographic profile: income levels, age distribution, household composition, and any notable population trends (growth, migration, aging, student population)
4. Underserved gaps: specific business categories — including B2B services, industrial support, and consumer services — where local supply clearly lags demand
5. Location-specific factors: major employers by name, dominant workforce skills, infrastructure, climate, major development projects, and cultural or economic identity
6. Any recent economic shifts, facility openings or closures, demographic changes, or emerging workforce needs creating new business opportunities`;
    console.log('[opportunities diag] phase 1 start:', { phase: 1, model, promptChars: phase1Prompt.length, tool: 'googleSearch' });
    try {
      const searchRes = await withTimeout(
        ai.models.generateContent({
          model,
          contents: phase1Prompt,
          config: { tools: [{ googleSearch: {} }] },
        }),
        20000,
        'opportunities location research timed out',
      );
      marketData = searchRes.text || marketData;
      sources.push(...getGroundingSources(searchRes));
      phase1Usage = (searchRes as any).usageMetadata ?? null;
      phase1Grounded = true;  // grounded prompt was issued and billed, regardless of usageMetadata
      console.log('[opportunities diag] phase 1 success:', { phase: 1, responseChars: marketData.length });
    } catch (err) {
      console.warn('[opportunities] phase 1 (Search) failed:', geminiErrDiag(err));
    }

    // Phase 2: Synthesis — compact summaries only (full dossier generated on demand)
    const phase2Prompt = `
Act as a strategic market analyst. Identify the TOP 3-5 business opportunities in '${location}' with the strongest evidence of unmet local demand and realistic financial viability.

**Location Context:** '${location}'
**Local Research Data:**
${marketData}

**Selection criteria — apply in this priority order:**
1. Local market need: credible evidence that demand for this category exists and current supply fails to meet it
2. Competitive whitespace: limited or weak existing competition for this specific offering in this market
3. Economic viability: realistic path to positive unit economics within 18-24 months given local costs and revenue potential

**Sector scope — evaluate ALL sectors relevant to this economy, not just consumer services:**
- Consumer services and retail (food, personal care, entertainment)
- Healthcare, senior services, and home health
- Childcare and education
- Home services and property maintenance
- B2B services and professional services
- Logistics, warehousing, and supply-chain support
- Industrial services, equipment rental, and trade support
- Workforce development, staffing, and training
- Hospitality, tourism, and visitor services
- Technology services and digital support
- Real estate and property services
Let the local research data determine which sectors are most relevant. If the economy is industrial, industrial-support opportunities may rank higher than consumer services. If it is a tourism market, visitor-economy businesses may dominate. Follow the evidence.

**LOCATION DNA — mandatory for every recommendation:**
Reference specific, verifiable characteristics of '${location}': named industries, major employers, dominant demographic groups, geographic features, or confirmed economic conditions. A person who knows this location well should immediately recognize why each opportunity belongs HERE and not in a generic US city.

**SPECIFICITY:**
- businessType: Name the specific concept, niche, and customer served. GOOD: "Fleet Maintenance Dispatch Software for Regional Carriers", "Senior In-Home Occupational Therapy", "Halal Meal Prep Delivery". BAD: "Tech Company", "Health Services", "Restaurant".
- whyItsGood: Cite specific local factors — named employers, industries, demographic data, or infrastructure conditions.
- bestNearbyArea: Name a real neighborhood, corridor, district, or ZIP code within or near '${location}'.

**CAPITAL RANGE:** Include a mix of startup cost tiers — some low-capital entries ($5k–$50k) and some requiring moderate investment ($50k–$300k) where the market justifies it.

**Operational Scoring (1-10):**
- CapEx: 1 (Very cheap to start, <$5k) to 10 (Massive investment, >$500k).
- Overhead: 1 (Home-based/Digital) to 10 (High rent, utility, and maintenance).
- Labor Intensity: 1 (Solopreneur/Automated) to 10 (Large staff required).
- Competition Level: 1 (No direct local competitors) to 10 (Market saturated).

**Viability Sub-Scores (0-100):**
- estimatedMarketDemand: Strength of unmet demand for this category in this specific location. Score relative to local evidence — an industrial-market B2B service with clear demand from named employers should score 80+ even if consumer visibility is low.
- estimatedCompetitionIntensity: Local competitive saturation. 0 = no competition. 100 = fully saturated.
- estimatedFinancialFeasibility: Probability of positive unit economics within 18 months given local costs, pricing power, and revenue potential. 80+ = highly feasible.
- estimatedRiskLevel: Combined execution and market risk. 0 = very low risk. 80+ = high risk.
- Set overallPotental equal to estimatedMarketDemand.

**Content restrictions:** No firearms, tobacco, vaping, alcohol retail, cannabis, adult entertainment, or gambling.

Generate output in JSON adhering to the opportunity schema. No wrapping markdown.
    `.trim();

    // Market Gap synthesis covers multiple opportunities per report — fixed
    // 16k budget regardless of plan tier (see Viability synthesis for the
    // equivalent 16k/24k-retry budget).
    const MARKET_GAP_SYNTHESIS_MAX_TOKENS = 16384;
    console.log('[opportunities diag] phase 2 start:', { phase: 2, model, promptChars: phase2Prompt.length, maxOutputTokens: MARKET_GAP_SYNTHESIS_MAX_TOKENS, synthesisTimeoutMs: budget.synthesisTimeoutMs });
    const phase2StartMs = Date.now();
    const synthesis = await withTimeout(
      ai.models.generateContent({
        model,
        contents: phase2Prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: opportunitySchema,
          temperature: 0.6,
          maxOutputTokens: MARKET_GAP_SYNTHESIS_MAX_TOKENS,
          thinkingConfig: { thinkingBudget: 0 },  // disable thinking — pure JSON assembly, no reasoning needed
        },
      }),
      budget.synthesisTimeoutMs,
      'opportunities synthesis timed out',
    );
    const phase2ElapsedMs = Date.now() - phase2StartMs;

    phase2Usage = (synthesis as any).usageMetadata ?? null;
    // Single authoritative cost figure: Phase 1 (Search grounding) + Phase 2
    // (synthesis) + grounding. usage_logs and report_activity_log both consume
    // this so they reconcile.
    const groundingCalls = phase1Grounded ? 1 : 0;
    const cost = aggregateGeminiUsage(model, [phase1Usage, phase2Usage], groundingCalls);
    const inputTokens = cost.inputTokens;
    const outputTokens = cost.outputTokens; // billed output tokens — candidates + thinking, across phases
    console.log(`[AICost] /api/opportunities role=${verifiedRole} plan=${normalizedPlan} model=${model} in=${inputTokens} out=${outputTokens} (thinking=${cost.thinkingTokens} grounding=${cost.groundingCalls}) est=$${cost.estimatedCostUsd.toFixed(5)}`);

    const withinHardCap = !wouldExceedHardCap(cost.estimatedCostUsd, budget);
    if (!withinHardCap) {
      console.warn(`[AICost] OVER_HARD_CAP role=${verifiedRole} plan=${normalizedPlan} cap=$${budget.hardCapUsd} actual=$${cost.estimatedCostUsd.toFixed(5)}`);
    }

    const rawText = synthesis.text;
    const finishReason = (synthesis as any).candidates?.[0]?.finishReason ?? 'NO_CANDIDATES';
    const candidateCount = (synthesis as any).candidates?.length ?? 0;
    console.log('[opportunities diag] phase 2 result:', {
      finishReason,
      candidateCount,
      textDefined: rawText !== undefined,
      textLength: rawText?.length ?? 0,
      billedOutputTokens: outputTokens,
      phase2ElapsedMs,
    });

    const parsed = cleanAndParseJSON(rawText || '', undefined, location);
    parsed.groundingSources = sources;
    parsed.location = location;

    parsed.generationMeta = {
      model,
      isLiveGenerated: true,
      estimatedCostUsd: cost.estimatedCostUsd,
      inputTokens,
      outputTokens,
      generatedAt: new Date().toISOString(),
    };

    console.log(`[Opportunities] Success — model=${model} opportunityCount=${parsed.topOpportunities?.length ?? 0} groundingSources=${parsed.groundingSources?.length ?? 0}`);

    try {
      if (supabaseAdmin) {
        const { error: usageLogError } = await supabaseAdmin.from('usage_logs').insert({
          user_id: verifiedUserId,
          user_email: verifiedEmail,
          user_role: verifiedRole,
          plan: normalizedPlan,
          report_type: 'opportunities',
          model,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          grounding_calls: cost.groundingCalls,
          estimated_cost_usd: cost.estimatedCostUsd,
          within_hard_cap: withinHardCap,
          business_type: 'market_gaps',
          location,
        });
        if (usageLogError) {
          console.error('[UsageLog] insert failed:', usageLogError);
        } else {
          console.log(`[UsageLog] Logged: ${verifiedEmail} plan=${normalizedPlan} cost=$${cost.estimatedCostUsd.toFixed(5)}`);
        }
      }
    } catch (logErr: any) {
      console.error('[UsageLog] Insert failed (report still returned):', logErr.message ?? logErr);
    }

    console.log('[ActivityLog] attempt opportunities success');
    try {
      if (supabaseAdmin) {
        const topNames = Array.isArray(parsed?.topOpportunities)
          ? parsed.topOpportunities.slice(0, 5).map((o: any) => o.businessType).filter(Boolean)
          : [];
        const aggregatedUsage = cost;  // same authoritative figure as usage_logs above — reconciles
        const { error: activityLogErr } = await supabaseAdmin.from('report_activity_log').insert({
          user_id: verifiedUserId,
          user_email: verifiedEmail,
          report_type: 'market_gap',
          business_type: 'market_gaps',
          location: location.trim(),
          normalized_location: canonLocation,
          plan_tier: verifiedPlan,
          cache_status: forceRegenerate ? 'regenerated' : (cacheWasStale ? 'regenerated' : 'fresh'),
          force_regenerate: !!forceRegenerate,
          success: true,
          source: 'market_gap_card',
          duration_ms: Date.now() - requestStartMs,
          metadata: { topOpportunityNames: topNames },
          ai_model: model,
          input_tokens: aggregatedUsage.inputTokens,
          output_tokens: aggregatedUsage.outputTokens,
          total_tokens: aggregatedUsage.totalTokens,
          estimated_ai_cost: aggregatedUsage.estimatedCostUsd,
        });
        if (activityLogErr) throw activityLogErr;
        console.log('[ActivityLog] success opportunities success');
      }
    } catch (logErr: any) {
      console.error('[ActivityLog] failed opportunities success:', logErr.message ?? logErr);
    }

    // Quota counter — only fresh, successful, non-cached generations count.
    await incrementUsageTracking(supabaseAdmin, verifiedUserId, 'regional');

    // Tag stale-refresh so the client knows a fresh report replaced an expired cache entry.
    if (cacheWasStale) parsed._refreshedFromStale = true;

    // Store in shared server-side cache — all accounts/devices get the same opportunities.
    await setInServerCache('market_gaps', canonLocation, 'opportunities', verifiedPlan, parsed);

    return json(res, 200, parsed);
  } catch (err: any) {
    const errStatus  = err?.status  ?? err?.httpStatus ?? null;
    const errCode    = err?.code    ?? null;
    const errMessage = typeof err?.message === 'string' ? err.message.slice(0, 500) : String(err);
    const errDetails = Array.isArray(err?.errorDetails) ? err.errorDetails : null;
    console.error('[opportunities] phase 2 error:', { status: errStatus, code: errCode, message: errMessage, errorDetails: errDetails });

    let httpStatus = 502;
    let resCode = 'MODEL_ERROR';
    let resMessage = err.message || 'An unexpected error occurred.';

    const msgLower = errMessage.toLowerCase();
    const isRateLimit =
      errStatus === 429 ||
      errCode === 429 ||
      msgLower.includes('429') ||
      msgLower.includes('rate limit') ||
      msgLower.includes('resource_exhausted') ||
      msgLower.includes('quota');

    if (resMessage.includes('API key'))        { httpStatus = 401; resCode = 'MISSING_API_KEY'; }
    else if (isRateLimit)                       { httpStatus = 429; resCode = 'RATE_LIMIT'; resMessage = 'Gemini rate limit hit. Please try again shortly.'; }
    else if (msgLower.includes('timeout'))      { httpStatus = 504; resCode = 'TIMEOUT'; resMessage = 'Analysis timed out. Please try again.'; }
    else if (msgLower.includes('malformed_response')) {
      httpStatus = 502; resCode = 'MALFORMED_RESPONSE';
      resMessage = 'The AI returned an unexpected response format. Please try again — this is usually transient.';
      console.error('[opportunities] Gemini returned unparseable JSON — no opportunities generated.', { location: location?.slice(0, 60) });
    }

    console.log('[ActivityLog] attempt opportunities failure-path');
    try {
      if (supabaseAdmin) {
        const failGroundingCalls = phase1Grounded ? 1 : 0;
        const aggregatedUsage = aggregateGeminiUsage(geminiModelUsed ?? 'unknown', [phase1Usage, phase2Usage], failGroundingCalls);
        const { error: activityLogErr } = await supabaseAdmin.from('report_activity_log').insert({
          user_id: verifiedUserId,
          user_email: verifiedEmail,
          report_type: 'market_gap',
          business_type: 'market_gaps',
          location: location ? location.trim() : null,
          normalized_location: location ? canonicalizeLocationForCache(location.trim()) : null,
          plan_tier: verifiedPlan,
          cache_status: null,
          force_regenerate: !!forceRegenerate,
          success: false,
          error_message: resMessage?.slice(0, 500),
          source: 'market_gap_card',
          duration_ms: Date.now() - requestStartMs,
          ai_model: geminiModelUsed,
          input_tokens: aggregatedUsage.inputTokens,
          output_tokens: aggregatedUsage.outputTokens,
          total_tokens: aggregatedUsage.totalTokens,
          estimated_ai_cost: aggregatedUsage.estimatedCostUsd,
        });
        if (activityLogErr) throw activityLogErr;
        console.log('[ActivityLog] success opportunities failure-path');
      }
    } catch (logErr: any) {
      console.error('[ActivityLog] failed opportunities failure-path:', logErr.message ?? logErr);
    }

    return json(res, httpStatus, { error: resMessage, code: resCode });
  }
}
