import type { IncomingMessage, ServerResponse } from 'http';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import {
  normalizeTierToBudgetPlan,
  getReportBudget,
  estimateCost,
  wouldExceedHardCap,
} from '../src/config/aiBudget.js';
import { checkBlockedCategory, blockedCategoryMessage } from '../src/utils/blockedCategories.js';
import { detectFranchise, findSameBrandCompetitors } from '../src/utils/franchiseDetection.js';
import { validateUSLocation } from '../src/utils/locationValidation.js';

export const maxDuration = 60;

// ─── Response helper ──────────────────────────────────────────────────────────

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

// ─── Schema (mirrors server.ts for structured Gemini output) ─────────────────

enum Type {
  STRING = 'STRING', INTEGER = 'INTEGER', NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN', OBJECT = 'OBJECT', ARRAY = 'ARRAY',
}

const reportSchema = {
  type: Type.OBJECT,
  properties: {
    businessType: { type: Type.STRING },
    location: { type: Type.STRING },
    targetCoordinates: {
      type: Type.OBJECT,
      properties: {
        latitude: { type: Type.NUMBER },
        longitude: { type: Type.NUMBER },
      },
    },
    viabilityScore: { type: Type.INTEGER, description: 'A calculated score from 0 to 100 based on the mandatory formula.' },
    scoreBreakdown: {
      type: Type.OBJECT,
      properties: {
        marketDemand: { type: Type.INTEGER },
        competitionIntensity: { type: Type.INTEGER },
        financialFeasibility: { type: Type.INTEGER },
        riskLevel: { type: Type.INTEGER },
      },
      required: ['marketDemand', 'competitionIntensity', 'financialFeasibility', 'riskLevel'],
    },
    executiveSummary: { type: Type.STRING },
    financialProjections: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING },
        startupCostRange: { type: Type.STRING },
        startupCostBreakdown: { type: Type.STRING },
        startupCostItems: {
          type: Type.ARRAY,
          description: 'Itemized startup cost breakdown. Include all applicable categories with estimated dollar ranges.',
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING, description: 'e.g. "Build-out / Tenant Improvements", "Equipment & Technology", "Working Capital Reserve"' },
              amount: { type: Type.STRING, description: 'Dollar range, e.g. "$80,000–$120,000"' },
              notes: { type: Type.STRING, description: 'Optional one-line clarification' },
            },
            required: ['category', 'amount'],
          },
        },
        startupSpaceContext: {
          type: Type.OBJECT,
          description: 'Physical space details for brick-and-mortar businesses. Omit for home-based or online businesses.',
          properties: {
            sqft: { type: Type.STRING, description: 'e.g. "1,500–2,500 sq ft"' },
            monthlyRent: { type: Type.STRING, description: 'e.g. "$3,500–$5,000/month"' },
            buildOutIntensity: { type: Type.STRING, enum: ['Low', 'Moderate', 'High'], description: 'Low = paint/fixtures; Moderate = partial renovation; High = full build-out' },
          },
        },
        revenueYear1: { type: Type.STRING },
        revenueYear3: { type: Type.STRING },
        breakEvenTime: { type: Type.STRING },
        roiTime: { type: Type.STRING },
        profitMargin: { type: Type.STRING },
        scalability: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] },
        keyStats: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              value: { type: Type.STRING },
            },
            required: ['label', 'value'],
          },
        },
      },
      required: ['summary', 'startupCostRange', 'startupCostBreakdown', 'startupCostItems', 'revenueYear1', 'revenueYear3', 'breakEvenTime', 'roiTime', 'profitMargin', 'scalability', 'keyStats'],
    },
    competitionAnalysis: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING },
        competitors: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              details: { type: Type.STRING },
              address: { type: Type.STRING },
              latitude: { type: Type.NUMBER },
              longitude: { type: Type.NUMBER },
            },
            required: ['name', 'details'],
          },
        },
      },
      required: ['summary', 'competitors'],
    },
    marketTrends: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING },
        trends: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { trend: { type: Type.STRING }, impact: { type: Type.STRING } },
            required: ['trend', 'impact'],
          },
        },
      },
      required: ['summary', 'trends'],
    },
    demographicInsights: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING },
        demographics: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              metric: { type: Type.STRING },
              value: { type: Type.STRING },
              insight: { type: Type.STRING },
            },
            required: ['metric', 'value', 'insight'],
          },
        },
      },
      required: ['summary', 'demographics'],
    },
    riskAssessment: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING },
        risks: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              risk: { type: Type.STRING },
              impact: { type: Type.STRING },
              severity: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] },
              mitigation: { type: Type.STRING },
            },
            required: ['risk', 'impact', 'severity', 'mitigation'],
          },
        },
      },
      required: ['summary', 'risks'],
    },
    successFactors: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING },
        factors: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              factor: { type: Type.STRING },
              description: { type: Type.STRING },
              importance: { type: Type.STRING, enum: ['Critical', 'High', 'Medium'] },
            },
            required: ['factor', 'description', 'importance'],
          },
        },
      },
      required: ['summary', 'factors'],
    },
    recommendation: {
      type: Type.OBJECT,
      properties: {
        decision: { type: Type.STRING },
        reasoning: { type: Type.STRING },
      },
      required: ['decision', 'reasoning'],
    },
    methodology: { type: Type.STRING },
  },
  required: [
    'businessType', 'location', 'viabilityScore', 'scoreBreakdown', 'executiveSummary',
    'financialProjections', 'competitionAnalysis', 'marketTrends',
    'demographicInsights', 'riskAssessment', 'successFactors',
    'recommendation', 'methodology',
  ],
};

// ─── Helpers (mirrors server.ts) ──────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, msg: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(msg)), ms);
    promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

/**
 * Walk a JSON string that may be truncated (e.g. hit maxOutputTokens) and
 * close any unclosed braces/brackets so JSON.parse has a chance to succeed.
 * Returns the repaired string — the caller still needs to JSON.parse it.
 */
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
  if (closes.length === 0) return s; // already balanced — nothing to repair
  // Strip trailing comma or dangling colon before closing open structures
  let repaired = s.trimEnd().replace(/,\s*$/, '').replace(/:\s*$/, ': null');
  for (let i = closes.length - 1; i >= 0; i--) repaired += closes[i];
  return repaired;
}

function cleanAndParseJSON(text: string, fallback?: any, context?: string): any {
  let s = text.trim()
    .replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
  // 1. Direct parse (expected fast path for well-formed responses)
  try { return JSON.parse(s); } catch { /* fall through */ }
  // 2. Bracket-extraction: find the outermost { } or [ ] pair
  const oi = s.indexOf('{'), ai = s.indexOf('[');
  let start = -1, end = -1;
  if (oi !== -1 && (ai === -1 || oi < ai)) { start = oi; end = s.lastIndexOf('}'); }
  else if (ai !== -1)                       { start = ai; end = s.lastIndexOf(']'); }
  if (start !== -1 && end > start) {
    try { return JSON.parse(s.substring(start, end + 1)); } catch { /* fall through */ }
  }
  // 3. Truncation repair: close any unclosed braces/brackets (handles MAX_TOKENS cutoff)
  if (start !== -1) {
    try { return JSON.parse(repairTruncatedJSON(s.substring(start))); } catch { /* fall through */ }
  }
  // All attempts failed — log diagnostics before giving up
  console.error('[cleanAndParseJSON] all parse attempts failed:', {
    context:   context ?? 'unknown',
    rawLength: text.length,
    rawPrefix: text.slice(0, 500),
  });
  if (fallback !== undefined) return fallback;
  throw new Error('malformed_response');
}

/**
 * Validates that a report object retrieved from report_cache has the minimum
 * fields required to render correctly. Returns false for truncated/corrupted
 * entries so the caller can treat them as a cache miss and regenerate.
 */
function isCachedReportValid(report: any): boolean {
  return (
    report !== null &&
    typeof report === 'object' &&
    !Array.isArray(report) &&
    typeof report.viabilityScore === 'number' &&
    typeof report.recommendation === 'object' &&
    report.recommendation !== null &&
    typeof report.executiveSummary === 'string'
  );
}

/**
 * Returns how many competitors to request in Phase 1 based on business-type
 * density. Dense categories in major metros can surface 15+ real locations;
 * sparse/niche categories rarely have more than 5 nearby.
 *
 * Returns { target, min } where:
 *   target = what to ask for in the prompt
 *   min    = below this count the disclosure note should appear in the UI
 */
function competitorCountForCategory(businessType: string): { target: number; label: string } {
  const bt = businessType.toLowerCase();

  // Dense: commodity categories with many near-identical operators in any metro
  const dense = [
    'coffee', 'cafe', 'espresso', 'boba', 'bubble tea',
    'fast food', 'burger', 'pizza', 'sandwich', 'sub', 'taco', 'sushi',
    'chinese', 'mexican', 'thai', 'indian', 'italian', 'restaurant',
    'bar', 'brewery', 'pub', 'nightclub', 'lounge',
    'gas station', 'convenience store', 'c-store',
    'gym', 'fitness', 'yoga', 'pilates', 'crossfit',
    'nail salon', 'hair salon', 'barber', 'beauty salon',
    'pharmacy', 'drug store', 'grocery',
    'dry cleaning', 'laundromat', 'laundry',
    'car wash', 'auto detail',
    'dentist', 'dental', 'orthodontist',
    'urgent care', 'medical clinic', 'physical therapy',
    'tutoring', 'learning center',
  ];

  // Sparse: niche or specialty categories with few local operators
  const sparse = [
    'rv repair', 'rv service', 'rv dealer', 'motorhome',
    'boat repair', 'marine', 'aircraft',
    'taxidermy', 'taxidermist',
    'specialty', 'niche', 'artisan', 'bespoke',
    'helicopter', 'skydiving', 'scuba',
    'exotic', 'vintage', 'antique dealer',
    'organ repair', 'piano repair', 'instrument repair',
    'escape room',
  ];

  if (dense.some(k => bt.includes(k))) return { target: 15, label: 'dense' };
  if (sparse.some(k => bt.includes(k))) return { target: 6, label: 'sparse' };
  return { target: 10, label: 'normal' };
}

function getCoordinatesForLocation(loc: string) {
  let h = 0;
  for (let i = 0; i < loc.length; i++) h = loc.charCodeAt(i) + ((h << 5) - h);
  const a = Math.abs(h);
  return { latitude: 26.0 + (a % 220) / 10, longitude: -122.0 + ((a >> 2) % 470) / 10 };
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

// ─── Supabase admin client (lazy singleton) ───────────────────────────────────

const supabaseAdmin = (() => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
})();

// ─── Key-type diagnostic (runs once at cold start, never logs the key) ────────
// Decodes the SUPABASE_SERVICE_ROLE_KEY JWT payload to verify the 'role' claim.
// service_role key → role: 'service_role' (bypasses RLS)
// anon/publishable key → role: 'anon' (subject to RLS → causes 42501)
const _srKeyDiag = (() => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const isJwt     = key.startsWith('eyJ');
  const isSbSecret = key.startsWith('sb_secret');
  let roleClaim: string = isJwt ? 'decode-error' : 'not-a-jwt';
  if (isJwt) {
    try {
      // JWT payload is the second base64url segment
      const b64 = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as Record<string, unknown>;
      roleClaim = typeof payload.role === 'string' ? payload.role : 'missing';
    } catch { /* roleClaim stays 'decode-error' */ }
  }
  return { isJwt, isSbSecret, roleClaim };
})();

// Server-side beta full-access flag. Set BETA_FULL_ACCESS=true in Vercel
// environment variables (NOT VITE_-prefixed — this is never sent to the browser).
// When true, any authenticated user is treated as Pro+ for report generation.
// Admin users are unaffected (they already resolve to Enterprise).
// Set to false or remove the var to revert all users to their stored plan.
const _serverBetaFullAccess: boolean = process.env.BETA_FULL_ACCESS === 'true';

// ── Shared server-side report cache ──────────────────────────────────────────
// Cache key: (business_type, location, report_type, analysis_version).
// plan_tier is excluded from the key so all accounts/plans share the same
// cached report for the same input.

const CACHE_VERSION = 'v1';
const VIABILITY_CACHE_MAX_AGE_DAYS = 90;

function normalizeCacheKey(s: string): string {
  return s.toLowerCase().trim();
}

// ── Startup cost fallback synthesis ──────────────────────────────────────────
// Used when Gemini doesn't return startupCostItems (old cached reports, schema
// miss). Parses the total range and splits it using generic allocation ratios.
// Results are labeled as estimates.
function parseRangeLow(range: string): number | null {
  // Matches patterns like "$800,000", "$800k", "$1M", "$1.2M"
  const m = range.match(/\$?([\d,.]+)\s*([kKmM]?)/);
  if (!m) return null;
  const num = parseFloat(m[1].replace(/,/g, ''));
  const mul = /[kK]/.test(m[2]) ? 1000 : /[mM]/.test(m[2]) ? 1_000_000 : 1;
  return isNaN(num) ? null : num * mul;
}

function fmtDollars(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${Math.round(n)}`;
}

function synthesizeStartupCostItems(
  range: string,
): Array<{ category: string; amount: string }> {
  const low = parseRangeLow(range);
  if (!low || low < 5000) return [];

  // Generic allocation ratios summing to 100%
  const slices: Array<{ category: string; pct: number }> = [
    { category: 'Build-out / Tenant Improvements', pct: 0.32 },
    { category: 'Equipment & Technology',           pct: 0.22 },
    { category: 'Working Capital Reserve',          pct: 0.18 },
    { category: 'Lease Deposits & Setup',           pct: 0.10 },
    { category: 'Marketing & Launch',               pct: 0.08 },
    { category: 'Licensing, Legal & Permits',       pct: 0.05 },
    { category: 'Initial Inventory or Supplies',    pct: 0.03 },
    { category: 'Other Startup Costs',              pct: 0.02 },
  ];

  return slices.map(({ category, pct }) => {
    const lo = Math.round(low * pct);
    const hi = Math.round(low * pct * 1.3);
    return { category, amount: `${fmtDollars(lo)}–${fmtDollars(hi)}` };
  });
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
  // Private-beta override: authenticated non-Admin users get Pro+ on the server too.
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

  // [3] Auth header present — no value logged, only presence
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  console.log('[analyze diag] auth header present:', { hasHeader: !!authHeader, tokenParsed: !!token });

  // Key-type check: if roleClaim !== 'service_role' the admin client will run as
  // the anon PostgreSQL role, causing 42501 on every profiles query.
  console.log('[analyze diag] service role key type:', _srKeyDiag);
  if (_srKeyDiag.roleClaim !== 'service_role') {
    console.error(
      '[BetaAuth] WRONG KEY — SUPABASE_SERVICE_ROLE_KEY role claim is',
      JSON.stringify(_srKeyDiag.roleClaim),
      '(expected "service_role"). The anon/publishable key was likely pasted instead.',
      'Every profiles query will fail with 42501 until this is corrected in Vercel.',
    );
  }

  if (!supabaseAdmin) {
    console.log('[analyze diag] getUser result: skipped — supabaseAdmin null');
    console.log('[analyze diag] profile query attempted: skipped — supabaseAdmin null');
    console.log('[analyze diag] profile query result: skipped — supabaseAdmin null');
    console.log('[analyze diag] final verification result:', { verifiedRole: '', verifiedPlan: 'Explorer', verifiedUserIdPresent: false, reason: 'supabaseAdmin null' });
    return FALLBACK;
  }
  if (!token) {
    console.log('[analyze diag] getUser result: skipped — no Bearer token in Authorization header');
    console.log('[analyze diag] profile query attempted: skipped — no token');
    console.log('[analyze diag] profile query result: skipped — no token');
    console.log('[analyze diag] final verification result:', { verifiedRole: '', verifiedPlan: 'Explorer', verifiedUserIdPresent: false, reason: 'no token' });
    return FALLBACK;
  }

  try {
    // [4] getUser result
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    console.log('[analyze diag] getUser result:', {
      userFound:        !!user,
      userId:           user?.id           ?? null,
      userEmail:        user?.email        ?? null,
      authErrorCode:    (userError as any)?.code    ?? null,
      authErrorMessage: (userError as any)?.message ?? null,
    });

    if (userError || !user) {
      console.log('[analyze diag] profile query attempted: skipped — getUser failed');
      console.log('[analyze diag] profile query result: skipped — getUser failed');
      console.log('[analyze diag] final verification result:', { verifiedRole: '', verifiedPlan: 'Explorer', verifiedUserIdPresent: false, reason: 'getUser failed' });
      return FALLBACK;
    }

    // [5] Profile query attempted
    console.log('[analyze diag] profile query attempted:', { queryField: 'id', userId: user.id });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, subscription_tier')
      .eq('id', user.id)
      .single();

    // [6] Profile query result
    console.log('[analyze diag] profile query result:', {
      queryField:          'id',
      profileFound:        !!profile,
      profileErrorCode:    (profileError as any)?.code    ?? null,
      profileErrorMessage: (profileError as any)?.message ?? null,
      returnedRole:        profile?.role                  ?? null,
      returnedTier:        profile?.subscription_tier     ?? null,
    });

    if (profileError || !profile) {
      console.log('[analyze diag] final verification result:', { verifiedRole: '', verifiedPlan: 'Explorer', verifiedUserIdPresent: true, reason: 'profile lookup failed' });
      return { ...FALLBACK, verifiedEmail: user.email ?? FALLBACK.verifiedEmail, verifiedUserId: user.id };
    }

    const verifiedPlan = getServerSidePlan(profile.role, profile.subscription_tier);

    // [7] Final verification result
    console.log('[analyze diag] final verification result:', {
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
    console.log('[analyze diag] final verification result:', { verifiedRole: '', verifiedPlan: 'Explorer', verifiedUserIdPresent: false, reason: `exception: ${err.message}` });
    return FALLBACK;
  }
}

// ─── Plan-based gate constants ────────────────────────────────────────────────
// Gate uses verifiedPlan (resolved by getServerSidePlan) rather than raw role
// strings. This ensures BETA_FULL_ACCESS=true and real paid subscribers both
// pass, while Explorer and unauthenticated requests are rejected consistently.

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(
  req: IncomingMessage & { body?: any },
  res: ServerResponse,
): Promise<void> {
  // [1] Request received — logged before any gate so it always appears
  console.log('[analyze diag] request received:', { method: req.method, hasAuthHeader: !!req.headers['authorization'] });

  // Server-side kill switch — flip REAL_REPORTS_ENABLED=false to disable instantly.
  if (process.env.REAL_REPORTS_ENABLED !== 'true') {
    return json(res, 503, { error: 'This endpoint is not available.', code: 'NOT_AVAILABLE' });
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  }

  // [2] Env check — logged before verifyAndGetPlan so it always appears even if
  //     verifyAndGetPlan exits early. verifiedRole/Plan are logged inside [7].
  console.log('[analyze diag] env check:', {
    hasSupabaseUrl:           !!process.env.SUPABASE_URL,
    hasServiceRoleKey:        !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasRealReportsEnabled:    !!process.env.REAL_REPORTS_ENABLED,
    realReportsEnabledValue:  process.env.REAL_REPORTS_ENABLED,
    hasGeminiApiKey:          !!process.env.GEMINI_API_KEY,
    betaFullAccess:           _serverBetaFullAccess,
    supabaseAdminInitialized: !!supabaseAdmin,
  });

  // Auth + plan gate.
  // [3]-[7] are logged inside verifyAndGetPlan at every exit point.
  const { verifiedEmail, verifiedPlan, verifiedRole, verifiedUserId } = await verifyAndGetPlan(
    req.headers['authorization'] as string | undefined,
  );

  // Block unauthenticated requests unconditionally — BETA_FULL_ACCESS never
  // extends to anonymous visitors.
  if (!verifiedUserId) {
    return json(res, 401, {
      error: 'Authentication required for report generation.',
      code: 'UNAUTHENTICATED',
    });
  }
  // Block Explorer-plan users. When BETA_FULL_ACCESS=true, getServerSidePlan()
  // already resolved the plan to Pro+, so Explorer only appears for users whose
  // stored tier is genuinely Explorer (no active subscription).
  if (verifiedPlan === 'Explorer') {
    console.warn(`[Analyze] Rejected — plan="${verifiedPlan}" role="${verifiedRole}" betaFullAccess=${_serverBetaFullAccess}`);
    return json(res, 403, {
      error: 'Real reports require a Pro or higher plan.',
      code: 'INSUFFICIENT_PLAN',
    });
  }
  console.log(`[Analyze] Auth — email=${verifiedEmail} role="${verifiedRole}" plan=${verifiedPlan} betaFullAccess=${_serverBetaFullAccess}`);

  const body = req.body ?? {};
  const { businessType, location, userLocation, forceRegenerate } = body;

  if (!businessType?.trim()) {
    return json(res, 400, { error: 'Missing or invalid businessType.', code: 'INVALID_INPUT' });
  }
  if (!location?.trim()) {
    return json(res, 400, { error: 'Missing or invalid location.', code: 'INVALID_INPUT' });
  }
  const locationCheck = validateUSLocation(location.trim());
  if (!locationCheck.valid) {
    return json(res, 400, { error: locationCheck.reason, code: 'UNSUPPORTED_LOCATION' });
  }

  // ── Blocked category guard ────────────────────────────────────────────────
  const blockedCheck = checkBlockedCategory(businessType);
  if (blockedCheck.matched) {
    return json(res, 422, {
      error: blockedCategoryMessage(blockedCheck.category),
      code: 'BLOCKED_CATEGORY',
      category: blockedCheck.category,
    });
  }

  // ── Shared cache check — before Gemini so cache hits skip AI and quota ──────
  let cacheWasStale = false;
  if (!forceRegenerate) {
    const cacheHit = await getFromServerCache(businessType, location, 'standard', VIABILITY_CACHE_MAX_AGE_DAYS);
    if (cacheHit && !cacheHit.isStale) {
      console.log(`[Analyze] Cache hit — returning cached report, no Gemini call for ${businessType} / ${location}`);
      return json(res, 200, {
        ...cacheHit.report,
        _cached:        true,
        _generatedAt:   cacheHit.generatedAt,
        _cacheAgeDays:  cacheHit.cacheAgeDays,
        _freshnessDays: VIABILITY_CACHE_MAX_AGE_DAYS,
        _isStale:       false,
      });
    }
    cacheWasStale = !!cacheHit?.isStale;
  } else {
    console.log(`[Analyze] forceRegenerate=true — bypassing cache for ${businessType} / ${location}`);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json(res, 401, { error: 'Gemini API key is not configured.', code: 'MISSING_API_KEY' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
    const normalizedPlan = normalizeTierToBudgetPlan(verifiedPlan);
    const budget = getReportBudget(normalizedPlan, 'standard');
    const model = budget.model;
    console.log('[analyze diag] model selected:', { normalizedPlan, model, maxOutputTokens: budget.maxOutputTokens });
    let sources: { title: string; uri: string }[] = [];
    let competitionInfo = 'No competitor data available.';
    let marketInfo = 'No trend data available.';

    // ── helper: extract safe Gemini error fields for logging ────────────────
    function geminiErrDiag(err: unknown): Record<string, unknown> {
      if (!err || typeof err !== 'object') return { raw: String(err) };
      const e = err as Record<string, unknown>;
      return {
        status:  e['status']  ?? e['httpStatus'] ?? null,
        code:    e['code']    ?? null,
        message: typeof e['message'] === 'string' ? e['message'].slice(0, 300) : null,
        // errorDetails is a Gemini SDK field on quota/rate errors
        errorDetails: Array.isArray(e['errorDetails']) ? e['errorDetails'] : null,
      };
    }

    // Phase 1: competitor lookup via Maps grounding
    const franchiseCheck = detectFranchise(businessType);
    const { target: competitorTarget } = competitorCountForCategory(businessType);
    // Franchise path: existing same-brand locations + cross-brand competitors
    // Non-franchise path: direct competitors only, density-calibrated count
    const phase1Prompt = franchiseCheck.isFranchise
      ? `Search for two things near '${location}':
1. Any EXISTING '${businessType}' locations already operating in or within 20 miles of '${location}'. List each with its name and full street address. Label these clearly as "Existing ${businessType} location".
2. The top ${Math.max(competitorTarget - 3, 6)} other direct competitors (different brands) for a new '${businessType}' in '${location}'. For each, provide the business name and full street address.
Return all results combined, existing same-brand locations listed first. Include as many real, verified businesses as you can find — do not truncate the list.`
      : `List up to ${competitorTarget} real, currently operating direct competitors for a new '${businessType}' in or very near '${location}'. For each business provide: the real business name and full street address. Use Google Maps data to find actual businesses — do not use generic placeholder names. Include as many as are genuinely present; if fewer than ${competitorTarget} exist in the area, list all you can find.`;
    console.log('[analyze diag] phase 1 start:', { phase: 1, model, promptChars: phase1Prompt.length, tool: 'googleMaps' });
    try {
      const mapsConfig: any = { tools: [{ googleMaps: {} }] };
      if (userLocation?.latitude && userLocation?.longitude) {
        mapsConfig.toolConfig = {
          retrievalConfig: { latLng: { latitude: userLocation.latitude, longitude: userLocation.longitude } },
        };
      }
      const mapsRes = await withTimeout(
        ai.models.generateContent({
          model,
          contents: phase1Prompt,
          config: mapsConfig,
        }),
        20000,
        'competitor research timed out',
      );
      competitionInfo = mapsRes.text || competitionInfo;
      sources.push(...getGroundingSources(mapsRes));
      console.log('[analyze diag] phase 1 success:', { phase: 1, responseChars: competitionInfo.length });
    } catch (err) {
      console.warn('[analyze] phase 1 (Maps) failed:', geminiErrDiag(err));
    }

    // Phase 2: census + trends via Search grounding
    const phase2Prompt = `Find the latest US Census data for '${location}': specifically Total Population and Median Household Income. Also research market trends and financial benchmarks for opening a '${businessType}' in '${location}'.`;
    console.log('[analyze diag] phase 2 start:', { phase: 2, model, promptChars: phase2Prompt.length, tool: 'googleSearch' });
    try {
      const searchRes = await withTimeout(
        ai.models.generateContent({
          model,
          contents: phase2Prompt,
          config: { tools: [{ googleSearch: {} }] },
        }),
        20000,
        'census/trends lookup timed out',
      );
      marketInfo = searchRes.text || marketInfo;
      sources.push(...getGroundingSources(searchRes));
      console.log('[analyze diag] phase 2 success:', { phase: 2, responseChars: marketInfo.length });
    } catch (err) {
      console.warn('[analyze] phase 2 (Search) failed:', geminiErrDiag(err));
    }

    // Phase 3: synthesis
    const prompt = `
Act as an expert business consultant and financial analyst. Create a detailed business viability report.

**Business Idea:** A new '${businessType}'
**Target Location:** '${location}'

**Competition Analysis (from Google Maps):**
${competitionInfo}

**Market Trends & Demographics (from Google Search):**
${marketInfo}

Synthesize the data into a comprehensive JSON report. Do not output any wrapping markdown.

**DATA CONSISTENCY RULE:** Use the specific population and median household income figures from the search results above for Demographic Insights. Do not estimate if factual data is present.

**Financial Estimates:** Provide realistic startup cost range, Year 1 and Year 3 revenue, ROI and break-even timelines based on industry averages for this specific business type.

**Strategic Intelligence:** Identify 3-5 risks (Market, Operational, Financial) with severity and mitigation strategies. Identify 3-5 critical success factors.

**Scoring Rules (MANDATORY):**
1. Assign sub-scores (0-100): Market Demand, Competition Intensity (higher = more competition), Financial Feasibility, Risk Level (higher = more risk).
2. Viability Score = (0.30 × Market Demand) + (0.25 × (100 - Competition Intensity)) + (0.25 × Financial Feasibility) + (0.20 × (100 - Risk Level))
3. Classification: 0-39 Not Recommended, 40-69 Caution Advised, 70-100 Recommended. Final recommendation must match score.
${franchiseCheck.isFranchise ? `
**FRANCHISE REQUIREMENT (MANDATORY):**
'${businessType}' is a franchise brand. You MUST include the following in both the executiveSummary and recommendation.reasoning:
- State explicitly that this viability analysis reflects market conditions only.
- State that opening a ${businessType} franchise requires direct approval from the franchisor.
- State that territory availability and protected radius must be verified with ${businessType}'s franchise development team before any investment decision.
- If any existing ${businessType} locations were found in the competition data above, name them and note they may indicate either strong demand or territory saturation.
- The recommendation.decision should be at most "Caution Advised" if existing same-brand locations were found nearby, since territory overlap is a real risk.` : ''}

**COMPETITOR LIST RULE (MANDATORY):**
Include ALL competitors found in the Competition Analysis above in the competitionAnalysis.competitors array — do not truncate or summarise. For each competitor, populate: name (real business name), details (1-sentence description), address (full street address if available), latitude, longitude. If coordinates are not in the research data, estimate realistic lat/lng near '${location}' — spread pins realistically across the area, not clustered at one point.
    `.trim();

    // Phase 3 uses thinkingBudget=0 to disable the thinking step.
    // gemini-2.5-flash is a thinking model — without this, the model spends
    // 60–90 s on internal reasoning before emitting a single output token,
    // which exceeds Vercel's function timeout. Phase 3 is pure JSON assembly
    // (the research was done in phases 1 & 2), so thinking adds no value here.
    const synthesisMaxTokens = Math.min(budget.maxOutputTokens, 8192);
    const synthesisTimeoutMs = budget.synthesisTimeoutMs;
    const phase3StartMs = Date.now();
    console.log('[analyze diag] phase 3 start:', {
      phase: 3,
      model,
      promptChars: prompt.length,
      maxOutputTokens: synthesisMaxTokens,
      thinkingBudget: 0,
      synthesisTimeoutMs,
    });
    const synthesis = await withTimeout(
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: reportSchema,
          temperature: 0.4,
          maxOutputTokens: synthesisMaxTokens,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      synthesisTimeoutMs,
      'synthesis timed out',
    );
    const phase3ElapsedMs = Date.now() - phase3StartMs;

    const usage = (synthesis as any).usageMetadata;
    const inputTokens: number | null = usage?.promptTokenCount ?? null;
    const outputTokens: number | null = usage?.candidatesTokenCount ?? null;
    const cost = estimateCost(model, inputTokens ?? 0, outputTokens ?? 0, 2);
    console.log(`[AICost] /api/analyze role=${verifiedRole} plan=${normalizedPlan} model=${model} in=${inputTokens ?? '?'} out=${outputTokens ?? '?'} est=$${cost.estimatedCostUsd.toFixed(5)} phase3Ms=${phase3ElapsedMs}`);

    const withinHardCap = !wouldExceedHardCap(cost.estimatedCostUsd, budget);
    if (!withinHardCap) {
      console.warn(`[AICost] OVER_HARD_CAP role=${verifiedRole} plan=${normalizedPlan} cap=$${budget.hardCapUsd} actual=$${cost.estimatedCostUsd.toFixed(5)}`);
    }

    const synthesisFinishReason = synthesis.candidates?.[0]?.finishReason ?? 'unknown';
    const synthesisText = synthesis.text || '';
    console.log('[analyze] Phase 3 synthesis result:', {
      finishReason: synthesisFinishReason,
      rawLength:    synthesisText.length,
      rawPrefix:    synthesisText.slice(0, 200),
    });
    const parsed = cleanAndParseJSON(synthesisText, undefined, `${businessType} / ${location}`);
    parsed.groundingSources = sources;

    // Ensure startupCostItems is populated — synthesize from total range if Gemini omitted it.
    if (!Array.isArray(parsed.financialProjections?.startupCostItems) ||
        parsed.financialProjections.startupCostItems.length === 0) {
      const range: string = parsed.financialProjections?.startupCostRange ?? '';
      const synth = synthesizeStartupCostItems(range);
      if (synth.length > 0 && parsed.financialProjections) {
        parsed.financialProjections.startupCostItems = synth;
      }
    }

    if (!parsed.targetCoordinates) {
      parsed.targetCoordinates = getCoordinatesForLocation(location);
    }

    if (Array.isArray(parsed.competitionAnalysis?.competitors)) {
      parsed.competitionAnalysis.competitors = parsed.competitionAnalysis.competitors.map(
        (comp: any, i: number) => {
          if (typeof comp.latitude !== 'number' || typeof comp.longitude !== 'number') {
            const offsetLat = (i === 0 ? 0.005 : i === 1 ? -0.004 : 0.003) + Math.sin(i) * 0.001;
            const offsetLng = (i === 0 ? -0.003 : i === 1 ? 0.005 : -0.005) + Math.cos(i) * 0.001;
            return {
              ...comp,
              latitude: parsed.targetCoordinates.latitude + offsetLat,
              longitude: parsed.targetCoordinates.longitude + offsetLng,
            };
          }
          return comp;
        },
      );
    }

    // Apply franchise score adjustment — mirrors geminiService.ts.
    // Must run after competitors are populated so findSameBrandCompetitors has data.
    if (franchiseCheck.isFranchise && franchiseCheck.brandName) {
      const competitors = parsed.competitionAnalysis?.competitors ?? [];
      const sameBrandIndices = findSameBrandCompetitors(franchiseCheck.brandName, competitors);
      const sameBrandFound = sameBrandIndices.length > 0;

      parsed.franchiseTerritoryCheck = {
        brandName: franchiseCheck.brandName,
        sameBrandIndices,
        sameBrandCount: sameBrandIndices.length,
        existingPresenceDetected: true,
        sameBrandFoundInSearch: sameBrandFound,
      };

      const brand = franchiseCheck.brandName;
      const originalScore: number = parsed.viabilityScore;
      const adjustment = sameBrandFound ? -15 : -8;
      const finalScore = Math.max(0, Math.round(originalScore + adjustment));

      const rawDecision: string =
        finalScore >= 76 ? 'Recommended' :
        finalScore >= 51 ? 'Caution Advised' :
        'Not Recommended';

      const cappedDecision =
        sameBrandFound
          ? (rawDecision === 'Recommended' ? 'Caution Advised' : rawDecision)
          : (rawDecision === 'Recommended' ? 'Verification Required' : rawDecision);

      const franchiseReasoning = sameBrandFound
        ? `This market shows viable demand for ${brand}, but existing same-brand locations have been identified nearby. Franchise territory agreements may already restrict or prohibit a new unit at this location — this is a contractual risk the viability score cannot fully reflect. Confirm territory availability with ${brand}'s franchise development team before proceeding.`
        : `Market conditions for ${brand} in this area are favorable, but franchise territory availability has not been confirmed. ${brand} assigns protected territories and pending agreements may already restrict this location. This analysis reflects general market viability only — franchisor approval is a required prerequisite, not an assumption.`;

      const franchiseSummaryPrefix = sameBrandFound
        ? `⚠️ Franchise territory conflict risk: existing ${brand} presence detected near this location — territory may already be claimed. Final viability score adjusted to ${finalScore}/100 (${adjustment} points for territory risk). `
        : `⚠️ Franchise verification required: this analysis reflects market conditions only. ${brand} territory availability must be confirmed directly with the franchisor before any investment decision. Final viability score adjusted to ${finalScore}/100 (${adjustment} points for unverified territory). `;

      const normalizeScoreMentions = (text: string): string =>
        text
          .replace(new RegExp(`\\b${originalScore}\\s*/\\s*100\\b`, 'g'), `${finalScore}/100`)
          .replace(new RegExp(`\\b${originalScore}\\s+out\\s+of\\s+100\\b`, 'gi'), `${finalScore} out of 100`)
          .replace(new RegExp(`(viability\\s+score\\s*(?:of|is|at|:)?\\s*)${originalScore}\\b`, 'gi'), `$1${finalScore}`)
          .replace(new RegExp(`(?<![\\w-])(score\\s+of\\s+)${originalScore}\\b`, 'gi'), `$1${finalScore}`);

      parsed.viabilityScore = finalScore;
      parsed.franchiseScoreAdjustment = {
        originalScore,
        adjustment,
        finalScore,
        reason: sameBrandFound
          ? `Score reduced by ${Math.abs(adjustment)} points: existing ${brand} locations detected near this market. Territory saturation is a material risk.`
          : `Score reduced by ${Math.abs(adjustment)} points: ${brand} is a franchise brand. Territory availability cannot be confirmed without direct franchisor disclosure.`,
      };
      parsed.recommendation = {
        ...parsed.recommendation,
        decision: cappedDecision,
        reasoning: franchiseReasoning,
      };
      parsed.executiveSummary = franchiseSummaryPrefix + normalizeScoreMentions(parsed.executiveSummary ?? '');
      if (parsed.methodology) parsed.methodology = normalizeScoreMentions(parsed.methodology);
    }

    parsed.generationMeta = {
      model,
      isLiveGenerated: true,
      estimatedCostUsd: cost.estimatedCostUsd,
      inputTokens,
      outputTokens,
      generatedAt: new Date().toISOString(),
    };

    try {
      if (supabaseAdmin) {
        await supabaseAdmin.from('usage_logs').insert({
          user_id: verifiedUserId,
          user_email: verifiedEmail,
          user_role: verifiedRole,
          plan: normalizedPlan,
          report_type: 'standard',
          model,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          grounding_calls: 2,
          estimated_cost_usd: cost.estimatedCostUsd,
          within_hard_cap: withinHardCap,
          business_type: businessType,
          location,
        });
        console.log(`[UsageLog] Logged: ${verifiedEmail} plan=${normalizedPlan} cost=$${cost.estimatedCostUsd.toFixed(5)}`);
      }
    } catch (logErr: any) {
      console.error('[UsageLog] Insert failed (report still returned):', logErr.message ?? logErr);
    }

    // Tag stale-refresh so the client knows a fresh report replaced an expired cache entry.
    if (cacheWasStale) parsed._refreshedFromStale = true;

    // Store in shared server-side cache — all accounts/devices get the same report.
    await setInServerCache(businessType, location, 'standard', verifiedPlan, parsed);

    return json(res, 200, parsed);
  } catch (err: any) {
    // Log the full structured Gemini error so we can distinguish:
    //   RESOURCE_EXHAUSTED / 429 → free-tier quota (RPM / TPM / RPD)
    //   NOT_FOUND            → wrong model ID
    //   INVALID_ARGUMENT     → bad request / schema mismatch
    //   UNAVAILABLE          → transient Gemini outage
    const errStatus  = err?.status  ?? err?.httpStatus ?? null;
    const errCode    = err?.code    ?? null;
    const errMessage = typeof err?.message === 'string' ? err.message.slice(0, 500) : String(err);
    const errDetails = Array.isArray(err?.errorDetails) ? err.errorDetails : null;
    console.error('[analyze] phase 3 error:', { status: errStatus, code: errCode, message: errMessage, errorDetails: errDetails });

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

    if (resMessage.includes('API key'))  { httpStatus = 401; resCode = 'MISSING_API_KEY'; }
    else if (isRateLimit)                { httpStatus = 429; resCode = 'RATE_LIMIT'; resMessage = 'Gemini rate limit hit. Please try again shortly.'; }
    else if (msgLower.includes('timeout')) { httpStatus = 504; resCode = 'TIMEOUT'; resMessage = 'Analysis timed out. Please try again.'; }
    else if (msgLower.includes('malformed_response')) {
      httpStatus = 502; resCode = 'MALFORMED_RESPONSE';
      resMessage = 'The AI returned an unexpected response format. Please try again — this is usually transient.';
      console.error('[analyze] Gemini returned unparseable JSON — no report generated.', { businessType: businessType?.slice(0, 60) });
    }

    return json(res, httpStatus, { error: resMessage, code: resCode });
  }
}
