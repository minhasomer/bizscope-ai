import type { IncomingMessage, ServerResponse } from 'http';
import { extractClientGeo } from '../server/activityGeo.js';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import {
  normalizeTierToBudgetPlan,
  getReportBudget,
  wouldExceedHardCap,
  aggregateGeminiUsage,
} from '../src/config/aiBudget.js';
import { checkStandardQuota, checkTrialQuota, incrementUsageTracking, incrementTrialUsage, decrementDecisionPassViability, restoreDecisionPassViability } from '../src/config/usageTracking.js';
import { resolveSimulatedRequest, getSimStandardQuota } from './_simAuth.js';
import { checkBlockedCategory, blockedCategoryMessage } from '../src/utils/blockedCategories.js';
import { detectFranchise, findSameBrandCompetitors, getFranchiseDensityTier } from '../src/utils/franchiseDetection.js';
import {
  classifySearchGeography, haversineMiles, classifyTerritoryStatus, classifyTerritoryConfidence,
  classifyTerritoryImpactLevel, classifyBusinessOpportunity, deriveRecommendationV2,
  DEFAULT_SATURATION_THRESHOLD,
} from '../src/utils/franchiseGeography.js';
import { validateUSLocation } from '../src/utils/locationValidation.js';
import { normalizeViabilityReport } from '../src/utils/reportNormalization.js';

export const maxDuration = 90;

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
    executiveSummary: { type: Type.STRING, description: 'Qualitative narrative summary. Do NOT state a numeric viability score in this prose (no "viability score of 68", "62/100", "68 out of 100", "rated 62"). Describe the opportunity in words only; the score is shown elsewhere as a qualitative label.' },
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
        reasoning: { type: Type.STRING, description: 'Plain-language rationale. Do NOT cite a numeric viability score (no "score of 62", "62/100", "68 out of 100"); use qualitative terms only.' },
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
  if (closes.length === 0 && !inString) return s; // already balanced — nothing to repair
  // Strip trailing comma or dangling colon before closing open structures
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

/**
 * Heuristic: count approximate competitor entries in Phase 1 Maps research text.
 * Used to create a structured evidence hint for synthesis so the prompt input
 * is more consistent between runs for the same location.
 * Looks for numbered list items or bullet points — Maps responses typically
 * enumerate competitors this way. Returns 0 if text is the fallback string.
 */
function estimateCompetitorCountFromResearch(text: string): number {
  if (!text || text === 'No competitor data available.') return 0;
  const numbered = (text.match(/^\s*\d+[.)]\s+\S/gm) ?? []).length;
  const bulleted  = (text.match(/^\s*[-•*]\s+\S/gm)   ?? []).length;
  return Math.max(numbered, bulleted);
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

// Consistency-guardrail version tags — persisted into report.generationMeta so two
// runs of the same business/location can be compared to explain output drift.
// Bump PROMPT_VERSION when the synthesis prompt text changes; bump
// MODEL_CONFIG_VERSION when the model, token budgets, temperature, or thinking
// config change.
const PROMPT_VERSION = '2026-09-03';
const MODEL_CONFIG_VERSION = 'flash-synth-t0.2-rubric1';

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
  const geo = extractClientGeo(req);

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
  const { verifiedEmail, verifiedPlan: realPlan, verifiedRole, verifiedUserId: realUserId } = await verifyAndGetPlan(
    req.headers['authorization'] as string | undefined,
  );

  const _simAuth = resolveSimulatedRequest(
    req.headers as Record<string, string | string[] | undefined>,
    realUserId, verifiedRole, realPlan, _serverBetaFullAccess,
  );
  const verifiedPlan   = _simAuth.effectivePlan;
  const verifiedUserId = _simAuth.simulationActive && _simAuth.effectivePersona === 'Anonymous'
    ? null : realUserId;

  // Block unauthenticated requests unconditionally — BETA_FULL_ACCESS never
  // extends to anonymous visitors.
  if (!verifiedUserId) {
    return json(res, 401, {
      error: 'Authentication required for report generation.',
      code: 'UNAUTHENTICATED',
    });
  }
  // Explorer is a paid-free tier: 3 standard reports/month enforced by
  // checkStandardQuota below. No plan-level gate here — quota handles it.
  console.log(`[Analyze] Auth — email=${verifiedEmail} role="${verifiedRole}" plan=${verifiedPlan} betaFullAccess=${_serverBetaFullAccess}`);

  // Detect whether this Pro user is still in their free trial. Trial users get
  // 5 reports total (not monthly), enforced via checkTrialQuota. The subscription
  // status is authoritative — never trust a client-supplied flag.
  let _isTrialing = false;
  if (!_simAuth.simulationActive && verifiedPlan === 'Pro' && supabaseAdmin) {
    try {
      const { data: _subRow } = await supabaseAdmin
        .from('subscriptions')
        .select('status')
        .eq('user_id', verifiedUserId)
        .maybeSingle();
      _isTrialing = _subRow?.status === 'trialing';
    } catch (err: any) {
      console.error('[Analyze] trial status lookup failed, defaulting to non-trial:', err.message);
    }
  }

  const requestStartMs = Date.now();
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
      // Enforce quota on cache hits — a served report consumes a slot regardless of AI cost.
      // Activity log is written AFTER the quota/pass decision so entitlement_source is known.
      const cacheQuota = _simAuth.simulationActive
        ? getSimStandardQuota(_simAuth)
        : _isTrialing
          ? await checkTrialQuota(supabaseAdmin, verifiedUserId)
          : await checkStandardQuota(supabaseAdmin, verifiedUserId, verifiedPlan as any, _serverBetaFullAccess);
      if (!cacheQuota.allowed) {
        // Non-trial users: check purchased report passes before returning 429.
        if (!_simAuth.simulationActive && !_isTrialing) {
          const passId = await decrementDecisionPassViability(supabaseAdmin, verifiedUserId);
          if (passId) {
            console.log(`[Analyze] Cache hit — Decision Pass viability consumed passId=${passId} userId=${verifiedUserId}`);
            // Log after pass confirmed consumed — entitlement_source is now known to be decision_pass.
            console.log('[ActivityLog] attempt analyze cache-hit decision_pass');
            try {
              if (supabaseAdmin) {
                const { error: activityLogErr } = await supabaseAdmin.from('report_activity_log').insert({
                  user_id: verifiedUserId,
                  user_email: verifiedEmail,
                  report_type: 'viability',
                  business_type: businessType,
                  location,
                  normalized_location: normalizeCacheKey(location),
                  plan_tier: verifiedPlan,
                  cache_status: 'hit',
                  force_regenerate: false,
                  success: true,
                  source: 'dashboard',
                  duration_ms: Date.now() - requestStartMs,
                  ai_model: null,
                  input_tokens: 0,
                  output_tokens: 0,
                  total_tokens: 0,
                  estimated_ai_cost: 0,
                  entitlement_source: 'decision_pass',
                  ...geo,
                });
                if (activityLogErr) throw activityLogErr;
                console.log('[ActivityLog] success analyze cache-hit decision_pass');
              }
            } catch (logErr: any) {
              console.error('[ActivityLog] failed analyze cache-hit decision_pass:', logErr.message ?? logErr);
            }
            return json(res, 200, {
              ...normalizeViabilityReport(cacheHit.report),
              _cached:           true,
              _generatedAt:      cacheHit.generatedAt,
              _cacheAgeDays:     cacheHit.cacheAgeDays,
              _freshnessDays:    VIABILITY_CACHE_MAX_AGE_DAYS,
              _isStale:          false,
              _usedDecisionPass: true,
            });
          }
        }
        console.warn(`[Analyze] Quota exceeded (cache hit) — userId=${verifiedUserId} plan=${verifiedPlan} trialing=${_isTrialing} used=${cacheQuota.used} limit=${cacheQuota.limit}`);
        return json(res, 429, {
          error: _isTrialing ? 'Trial report limit reached.' : 'Monthly report limit reached for your plan.',
          code:  _isTrialing ? 'TRIAL_REPORT_LIMIT_REACHED' : 'QUOTA_EXCEEDED',
          used:  cacheQuota.used,
          limit: cacheQuota.limit,
        });
      }
      if (!_simAuth.simulationActive) {
        if (_isTrialing) {
          await incrementTrialUsage(supabaseAdmin, verifiedUserId);
        } else {
          await incrementUsageTracking(supabaseAdmin, verifiedUserId, 'standard');
        }
      }
      // Log after usage increment confirmed — entitlement_source is now known.
      console.log('[ActivityLog] attempt analyze cache-hit');
      try {
        if (supabaseAdmin) {
          const { error: activityLogErr } = await supabaseAdmin.from('report_activity_log').insert({
            user_id: verifiedUserId,
            user_email: verifiedEmail,
            report_type: 'viability',
            business_type: businessType,
            location,
            normalized_location: normalizeCacheKey(location),
            plan_tier: verifiedPlan,
            cache_status: 'hit',
            force_regenerate: false,
            success: true,
            source: 'dashboard',
            duration_ms: Date.now() - requestStartMs,
            ai_model: null,
            input_tokens: 0,
            output_tokens: 0,
            total_tokens: 0,
            estimated_ai_cost: 0,
            entitlement_source: _isTrialing ? 'trial' : 'plan',
            ...geo,
          });
          if (activityLogErr) throw activityLogErr;
          console.log('[ActivityLog] success analyze cache-hit');
        }
      } catch (logErr: any) {
        console.error('[ActivityLog] failed analyze cache-hit:', logErr.message ?? logErr);
      }
      return json(res, 200, {
        ...normalizeViabilityReport(cacheHit.report),
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

  // ── Server-side quota check — standard reports (after cache, before Gemini) ─
  const quota = _simAuth.simulationActive
    ? getSimStandardQuota(_simAuth)
    : _isTrialing
      ? await checkTrialQuota(supabaseAdmin, verifiedUserId)
      : await checkStandardQuota(supabaseAdmin, verifiedUserId, verifiedPlan as any, _serverBetaFullAccess);

  // Hoisted so the catch block can restore the pass if Gemini fails.
  let usedDecisionPassId: string | null = null;

  if (!quota.allowed) {
    // Non-trial users: try a purchased pass before returning 429. The pass is
    // pre-decremented here so it cannot be double-spent by a concurrent request.
    // On Gemini failure the catch block calls restorePurchasedPass to refund it.
    if (!_simAuth.simulationActive && !_isTrialing) {
      const passId = await decrementDecisionPassViability(supabaseAdmin, verifiedUserId);
      if (passId) {
        usedDecisionPassId = passId;
        console.log(`[Analyze] Quota exceeded — using Decision Pass viability passId=${passId} userId=${verifiedUserId}`);
      } else {
        console.warn(`[Analyze] Quota exceeded — userId=${verifiedUserId} plan=${verifiedPlan} used=${quota.used} limit=${quota.limit}`);
        return json(res, 429, {
          error: 'Monthly report limit reached for your plan.',
          code:  'QUOTA_EXCEEDED',
          used:  quota.used,
          limit: quota.limit,
        });
      }
    } else {
      console.warn(`[Analyze] Quota exceeded — userId=${verifiedUserId} plan=${verifiedPlan} trialing=${_isTrialing} used=${quota.used} limit=${quota.limit}`);
      return json(res, 429, {
        error: _isTrialing ? 'Trial report limit reached.' : 'Monthly report limit reached for your plan.',
        code:  _isTrialing ? 'TRIAL_REPORT_LIMIT_REACHED' : 'QUOTA_EXCEEDED',
        used:  quota.used,
        limit: quota.limit,
      });
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json(res, 401, { error: 'Gemini API key is not configured.', code: 'MISSING_API_KEY' });
  }

  // Hoisted so the failure-path catch block (outside the try below) can still
  // report whichever model/usage data was captured before the error occurred.
  let geminiModelUsed: string | null = null;
  let phase1Usage: any = null;
  let phase2Usage: any = null;
  let phase1Grounded = false;  // true once Maps grounding returns — counts the billed grounded prompt even if usageMetadata is null
  let phase2Grounded = false;  // true once Search grounding returns
  const synthesisUsages: any[] = [];  // every Phase-3 attempt incl. MAX_TOKENS retry — all are billed

  try {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
    const normalizedPlan = normalizeTierToBudgetPlan(verifiedPlan);
    const budget = getReportBudget(normalizedPlan, 'standard');
    const model = budget.model;
    geminiModelUsed = model;
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
    // Phase 2 prompt (built up-front so phases 1 & 2 can run concurrently below).
    const phase2Prompt = `Find the latest US Census data for '${location}': specifically Total Population and Median Household Income. Also research market trends and financial benchmarks for opening a '${businessType}' in '${location}'.`;

    // Phases 1 & 2 are INDEPENDENT grounded research calls. Run them concurrently
    // so their latencies overlap — previously sequential, this could burn up to
    // 20s + 20s ≈ 40s of the 90s Vercel budget before synthesis even started.
    // Each phase keeps its own try/catch: a failure or timeout in one must not
    // fail the report or block the other — synthesis still runs on whatever
    // research succeeded (fallback strings remain if both fail).
    //
    // Tightened 20s → 14s: grounding that hasn't returned by 14s rarely yields
    // useful data, and the smaller cap leaves more of the 82s deadline for synthesis.
    const RESEARCH_TIMEOUT_MS = 14_000;
    const runPhase1 = async () => {
      console.log('[analyze diag] phase 1 start:', { phase: 1, model, promptChars: phase1Prompt.length, tool: 'googleMaps' });
      try {
        const mapsConfig: any = { tools: [{ googleMaps: {} }] };
        if (userLocation?.latitude && userLocation?.longitude) {
          mapsConfig.toolConfig = {
            retrievalConfig: { latLng: { latitude: userLocation.latitude, longitude: userLocation.longitude } },
          };
        }
        const mapsRes = await withTimeout(
          ai.models.generateContent({ model, contents: phase1Prompt, config: mapsConfig }),
          RESEARCH_TIMEOUT_MS,
          'competitor research timed out',
        );
        competitionInfo = mapsRes.text || competitionInfo;
        sources.push(...getGroundingSources(mapsRes));
        phase1Usage = (mapsRes as any).usageMetadata ?? null;
        phase1Grounded = true;  // grounded prompt was issued and billed, regardless of usageMetadata
        console.log('[analyze diag] phase 1 success:', { phase: 1, responseChars: competitionInfo.length });
      } catch (err) {
        console.warn('[analyze] phase 1 (Maps) failed:', geminiErrDiag(err));
      }
    };

    const runPhase2 = async () => {
      console.log('[analyze diag] phase 2 start:', { phase: 2, model, promptChars: phase2Prompt.length, tool: 'googleSearch' });
      try {
        const searchRes = await withTimeout(
          ai.models.generateContent({ model, contents: phase2Prompt, config: { tools: [{ googleSearch: {} }] } }),
          RESEARCH_TIMEOUT_MS,
          'census/trends lookup timed out',
        );
        marketInfo = searchRes.text || marketInfo;
        sources.push(...getGroundingSources(searchRes));
        phase2Usage = (searchRes as any).usageMetadata ?? null;
        phase2Grounded = true;  // grounded prompt was issued and billed, regardless of usageMetadata
        console.log('[analyze diag] phase 2 success:', { phase: 2, responseChars: marketInfo.length });
      } catch (err) {
        console.warn('[analyze] phase 2 (Search) failed:', geminiErrDiag(err));
      }
    };

    // allSettled: both phases run to completion. Their internal try/catch already
    // swallow failures, so this never rejects (no unhandled promise rejection).
    await Promise.allSettled([runPhase1(), runPhase2()]);

    // Phase 3: synthesis
    // Structured evidence fingerprint — derived from research without extra AI calls.
    // Gives synthesis a consistent, parseable anchor so the same evidence produces
    // consistent scores regardless of prose phrasing variation in the research text.
    const approxCompetitorCount = estimateCompetitorCountFromResearch(competitionInfo);
    const evidenceSummary = `
**STRUCTURED EVIDENCE SUMMARY (pre-processed from research above — use these facts as anchors when assigning sub-scores):**
- Approximate direct competitors found in Maps research: ${approxCompetitorCount === 0 ? 'none identified' : `~${approxCompetitorCount}`}
- Business category density class: ${competitorCountForCategory(businessType).label} (${competitorCountForCategory(businessType).label === 'dense' ? 'many near-identical operators typical in any metro' : competitorCountForCategory(businessType).label === 'sparse' ? 'few local operators typical even in metros' : 'standard density'})
- Location: '${location}'`.trim();

    const prompt = `
Act as an expert business consultant and financial analyst. Create a detailed business viability report.

**Business Idea:** A new '${businessType}'
**Target Location:** '${location}'

**Competition Analysis (from Google Maps):**
${competitionInfo}

**Market Trends & Demographics (from Google Search):**
${marketInfo}

${evidenceSummary}

Synthesize the data into a comprehensive JSON report. Do not output any wrapping markdown.

**DATA CONSISTENCY RULE:** Use the specific population and median household income figures from the search results above for Demographic Insights. Do not estimate if factual data is present.

**Financial Estimates:** Provide realistic startup cost range, Year 1 and Year 3 revenue, ROI and break-even timelines based on industry averages for this specific business type.

**Strategic Intelligence:** Identify 3-5 risks (Market, Operational, Financial) with severity and mitigation strategies. Identify 3-5 critical success factors.

**Scoring Rules (MANDATORY):**
1. Assign sub-scores (0–100) using the precise definitions below. Do NOT conflate the factors.
   - **Market Demand**: Demand AVAILABLE TO A NEW ENTRANT at this specific location — not just category-level consumer interest or demographic fit. Discount significantly if multiple established competitors already serve apparent demand. A large, affluent population in a category (e.g. boutique fitness) does NOT automatically mean high addressable demand if existing studios already capture that population. Score 60+ only when there is affirmative evidence of unmet demand, underserved segments, or capacity constraints at existing operators.
   - **Competition Intensity** (higher = worse for the new entrant): The full competitive pressure a new entrant faces. Include BOTH direct same-category competitors AND relevant substitute offerings that satisfy the same customer need (e.g. for a Pilates studio: yoga studios, gyms with Pilates classes, personal trainers; for a coffee shop: all nearby cafés plus quick-service chains). Score 65+ when multiple established direct competitors plus meaningful substitutes are present in the trade area. Score 80+ when the area has dense direct competitors, strong substitutes, and/or established chains/franchises that limit differentiation room.
   - **Financial Feasibility**: Likelihood of achieving profitable unit economics at realistic occupancy or utilization rates given startup costs, pricing pressure from incumbents, and customer acquisition difficulty in this competitive environment.
   - **Risk Level** (higher = worse): Overall risk including competitive risk, market-entry risk, and execution risk.
2. Viability Score = (0.30 × Market Demand) + (0.25 × (100 - Competition Intensity)) + (0.25 × Financial Feasibility) + (0.20 × (100 - Risk Level))
3. Classification: 0-39 Not Recommended, 40-69 Caution Advised, 70-100 Recommended. Final recommendation must match score.

**EVIDENCE-BASED SCORING RUBRIC (mandatory — use these anchors to assign sub-scores; the goal is evidence-stable ratings, not arbitrary precision):**

Risk Level (riskLevel — 0 = negligible risk, 100 = catastrophic):
  0–20 (Very Low): Operationally simple business type; minimal regulatory burden; no staffing scarcity; this specific location has stable, documented demand; no material geographic constraints.
  21–40 (Low): One manageable risk factor (e.g. standard licensing, moderate staffing challenge); location has some uncertainty but no severe market-size or execution concern.
  41–60 (Moderate): At least one meaningful unresolved risk — specifically: small population limiting addressable market, OR geographic isolation reducing customer base, OR specialist staffing dependency, OR material demand uncertainty for this location. A small-town or rural location with limited commercial density almost always qualifies for this band or higher.
  61–80 (Elevated): Two or more meaningful unresolved risks in combination (e.g. small population + geographic isolation + licensing complexity + staffing scarcity).
  81–100 (High): Severe compounding risks: very small market + high capital requirements + regulatory burden + demonstrated market failure evidence.

Market Demand (marketDemand — 0 = no demand for new entrant, 100 = exceptional demand):
  0–20 (Very Weak): Declining category nationally or locally; virtually no commercial activity in the specific trade area.
  21–44 (Weak): Very limited commercial density; suppressed or documented weak demand in the immediate area.
  45–64 (Moderate): Some commercial activity in the area; category demand exists but no specific evidence of unmet demand for a new entrant.
  65–79 (Strong): Clear commercial activity; underserved segments identified OR capacity constraints at existing operators documented; evidence supports a new entrant finding customers.
  80–100 (Exceptional): Strong documented unmet demand; area is rapidly growing; whitespace clearly identified with evidence of demand that exceeds current supply.

Competition Intensity (competitionIntensity — 0 = uncontested, 100 = fully saturated):
  0–20 (Very Low): Zero or near-zero direct competitors in the trade area AND no meaningful substitutes. Use only when Maps research returns none or one competitor.
  21–40 (Low): 1–3 direct competitors; limited substitute offerings; clear differentiation room for a new entrant.
  41–60 (Moderate): 4–7 competitors OR 2–3 established players with meaningful substitutes; competitive but not saturated.
  61–80 (High): 8+ direct competitors OR several established chains/franchises plus strong substitute offerings.
  81–100 (Saturated): Dense direct competition plus strong substitutes; near-impossible to differentiate; market is at or beyond capacity.
  IMPORTANT: Use the "Approximate direct competitors found" count from the Structured Evidence Summary above as your primary anchor. Do not diverge from this anchor without specific evidence justifying the divergence.

Financial Feasibility (financialFeasibility — 0 = not feasible, 100 = highly feasible):
  0–20 (Very High Capital): Extremely high capital relative to realistic revenue; unsustainable unit economics.
  21–44 (High Capital): High startup costs, slow ROI, or tight margins; requires high utilization to break even.
  45–64 (Significant Capital): Typical capital for the category; standard industry ROI profile; achievable with proper execution.
  65–79 (Moderate Capital): Low-to-moderate capital requirements; favorable margins or proven ROI for this business type in comparable markets.
  80–100 (Low Capital): Very low capital; fast ROI; strong recurring-revenue model with minimal fixed costs.

Scalability (financialProjections.scalability — Low/Medium/High):
  High: Business model can serve significantly more clients/customers without proportional overhead increase (e.g. route-based or recurring-contract services, SaaS). Commercial cleaning and similar contract-service businesses are typically High.
  Medium: Growth requires roughly proportional cost increases (additional staff, equipment, or space).
  Low: Growth is heavily constrained by physical capacity or specialist labor.

**CRITICAL REASONING PRINCIPLES:**
- High category demand is NOT equivalent to high opportunity for a new entrant. A category can have strong consumer demand while existing supply already satisfies or exceeds it. Assess whether there is actual whitespace, not just category attractiveness.
- Many competitors can validate market demand OR indicate saturation. Determine which interpretation is better supported by the location-specific evidence in the research data above.
- Do NOT reach a favorable conclusion (Recommended) if the competitive evidence shows a dense, mature market with no identifiable differentiation or underserved segment.
- EVIDENCE STABILITY PRINCIPLE: Categorical rating bands (the ranges in the rubric above) should be driven by concrete evidence, not stylistic interpretation. If the evidence for a factor is essentially the same as a prior analysis, the sub-score should remain in the same rubric band. Only cross a band boundary when there is a concrete, identifiable evidence difference (e.g. one more competitor found, documented population constraint identified, specific risk uncovered).

**RECONCILIATION REQUIREMENT (MANDATORY — complete this reasoning before assigning scores):**
Before finalizing scores and the recommendation, explicitly weigh the following:
1. What is the strongest specific evidence FOR this opportunity? (e.g. documented underserved segment, competitor waitlists, geographic gap, unmet price point)
2. What is the strongest specific evidence AGAINST? (e.g. number and concentration of direct competitors, substitute offerings, chain/franchise presence, lack of differentiation)
3. Does the positive evidence demonstrate actual market whitespace, or only that the category is broadly attractive?
4. What assumptions would need to be true for a new entrant to succeed, and are those assumptions supported by the research data?
The executiveSummary and recommendation.reasoning MUST be consistent with this reconciliation. They must not describe an opportunity as favorable while the competitive evidence shows a crowded market without identified whitespace.
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
    //
    // 16k covers the full ViabilityReport JSON for the vast majority of
    // businesses. If the model still hits MAX_TOKENS (e.g. an unusually
    // long competitor list or executive summary), retry once at 24k rather
    // than returning a truncated/repaired report.
    // ── Overall report deadline ──────────────────────────────────────────────
    // Vercel hard-kills the function at maxDuration (90s) with NO chance for our
    // catch/failure-logging to run. Enforce our own deadline a few seconds under
    // that, measured from requestStartMs, so a slow run returns a clean app-level
    // 504 (and records a report_activity_log failure row) BEFORE Vercel kills it.
    // Research (phases 1 & 2) has already consumed part of this budget.
    const OVERALL_DEADLINE_MS = 82_000;
    const remainingMs = () => OVERALL_DEADLINE_MS - (Date.now() - requestStartMs);
    const SYNTHESIS_FLOOR_MS = 8_000;  // min time needed to attempt synthesis at all

    const SYNTHESIS_MAX_TOKENS = 16384;
    const SYNTHESIS_RETRY_MAX_TOKENS = 24576;
    const SYNTHESIS_RESERVE_MS = 3_000;  // headroom left for parse/cache/log within the deadline
    const phase3StartMs = Date.now();

    // If research consumed almost the whole budget, fail cleanly NOW rather than
    // starting a synthesis we can't finish before the Vercel hard-kill.
    if (remainingMs() < SYNTHESIS_FLOOR_MS) {
      throw new Error('Analysis timed out while gathering market data');
    }

    const runSynthesis = (maxOutputTokens: number) => {
      // Give synthesis ALL the time left before the overall deadline — not the
      // smaller per-plan budget. Now that research runs in parallel (≤14s) there
      // is usually ~40s left; the old per-plan cap (25–40s) was throttling
      // synthesis and timing out reports that would otherwise have completed.
      // Bounded by the 82s deadline (minus reserve) so we still return before
      // Vercel's 90s hard-kill. Output volume — and thus cost — stays bounded by
      // maxOutputTokens, so the extra time only lets slow generation finish.
      const attemptMs = Math.max(remainingMs() - SYNTHESIS_RESERVE_MS, 1_000);
      console.log('[analyze diag] phase 3 start:', {
        phase: 3,
        model,
        promptChars: prompt.length,
        maxOutputTokens,
        thinkingBudget: 0,
        attemptMs,
      });
      return withTimeout(
        ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: reportSchema,
            temperature: 0.2,
            maxOutputTokens,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        attemptMs,
        'synthesis timed out',
      );
    };

    let synthesis = await runSynthesis(SYNTHESIS_MAX_TOKENS);
    synthesisUsages.push((synthesis as any).usageMetadata ?? null);
    // Retry on truncation only if the overall deadline still allows another
    // attempt; otherwise fall through to the truncated-JSON repair downstream.
    if (synthesis.candidates?.[0]?.finishReason === 'MAX_TOKENS' && remainingMs() > SYNTHESIS_FLOOR_MS) {
      console.warn(`[analyze] Phase 3 synthesis hit MAX_TOKENS at ${SYNTHESIS_MAX_TOKENS} — retrying at ${SYNTHESIS_RETRY_MAX_TOKENS}.`);
      synthesis = await runSynthesis(SYNTHESIS_RETRY_MAX_TOKENS);
      synthesisUsages.push((synthesis as any).usageMetadata ?? null);  // the truncated first attempt was still billed — count both
    }
    const phase3ElapsedMs = Date.now() - phase3StartMs;

    // Single authoritative cost figure for the whole report: both grounded
    // research phases + every synthesis attempt + grounding. usage_logs and
    // report_activity_log are both written from this one object so they reconcile.
    const groundingCalls = (phase1Grounded ? 1 : 0) + (phase2Grounded ? 1 : 0);
    let cost = aggregateGeminiUsage(model, [phase1Usage, phase2Usage, ...synthesisUsages], groundingCalls);
    const inputTokens = cost.inputTokens;
    const outputTokens = cost.outputTokens; // billed output tokens — candidates + thinking, summed across phases + retry
    console.log(`[AICost] /api/analyze role=${verifiedRole} plan=${normalizedPlan} model=${model} in=${inputTokens} out=${outputTokens} (thinking=${cost.thinkingTokens} grounding=${cost.groundingCalls}) est=$${cost.estimatedCostUsd.toFixed(5)} phase3Ms=${phase3ElapsedMs}`);

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
    let parsed: any;
    try {
      parsed = cleanAndParseJSON(synthesisText, undefined, `${businessType} / ${location}`);
    } catch (parseErr: any) {
      if (parseErr.message === 'malformed_response' && remainingMs() > SYNTHESIS_FLOOR_MS) {
        console.warn('[analyze] Phase 3 malformed response — one controlled retry', {
          finishReason: synthesisFinishReason,
          rawLength:    synthesisText.length,
          rawPrefix:    synthesisText.slice(0, 100),
        });
        synthesis = await runSynthesis(SYNTHESIS_MAX_TOKENS);
        synthesisUsages.push((synthesis as any).usageMetadata ?? null);
        cost = aggregateGeminiUsage(model, [phase1Usage, phase2Usage, ...synthesisUsages], groundingCalls);
        parsed = cleanAndParseJSON(synthesis.text || '', undefined, `${businessType} / ${location} retry`);
      } else {
        throw parseErr;
      }
    }
    // Override AI-echoed businessType with the exact concept the user selected/submitted.
    parsed.businessType = businessType;

    // ── Phase 16: post-synthesis consistency validation ──────────────────────
    // Lightweight contradiction guardrail — catches egregious score/evidence
    // mismatches without overriding nuanced AI reasoning. Only fires when a
    // claimed sub-score contradicts directly observable evidence from the same
    // report (competitor count, severity list). Any correction is logged for
    // transparency and the viability score is recomputed from corrected inputs.
    // Does NOT lower confidence, does NOT add AI calls, does NOT alter prose.
    const _sb = parsed.scoreBreakdown;
    if (_sb && typeof _sb === 'object') {
      const _competitorCount = Array.isArray(parsed.competitionAnalysis?.competitors)
        ? parsed.competitionAnalysis.competitors.length
        : 0;
      const _highRisks = Array.isArray(parsed.riskAssessment?.risks)
        ? parsed.riskAssessment.risks.filter((r: any) => r.severity === 'High').length
        : 0;

      // Contradiction 1: claimed "Very Low" competition but 4+ competitors listed.
      // The rubric says 0–20 = "zero or near-zero direct competitors". 4+ competitors
      // in the array contradicts this. Bump to at least the bottom of the Low band.
      const _ci = typeof _sb.competitionIntensity === 'number' ? _sb.competitionIntensity : 50;
      if (_ci <= 20 && _competitorCount >= 4) {
        const _corrected = Math.max(_ci, 25);
        console.warn(`[Consistency] competitionIntensity ${_ci}→${_corrected}: claimed Very Low but ${_competitorCount} competitors in array`);
        _sb.competitionIntensity = _corrected;
      }

      // Contradiction 2: claimed "Very Low" risk but 2+ High-severity risks enumerated.
      // If the AI identified multiple High-severity risks, riskLevel ≤30 contradicts them.
      // Bump to at least the bottom of the Moderate band (41).
      const _rl = typeof _sb.riskLevel === 'number' ? _sb.riskLevel : 50;
      if (_rl <= 30 && _highRisks >= 2) {
        const _corrected = Math.max(_rl, 42);
        console.warn(`[Consistency] riskLevel ${_rl}→${_corrected}: claimed Very Low but ${_highRisks} High-severity risks enumerated`);
        _sb.riskLevel = _corrected;
      }

      // Recompute viability score if any sub-score was corrected. The formula is
      // the same one stated in the synthesis prompt — keeps scores consistent.
      const _md  = typeof _sb.marketDemand        === 'number' ? _sb.marketDemand        : 50;
      const _ff  = typeof _sb.financialFeasibility === 'number' ? _sb.financialFeasibility : 50;
      const _ciF = typeof _sb.competitionIntensity === 'number' ? _sb.competitionIntensity : 50;
      const _rlF = typeof _sb.riskLevel            === 'number' ? _sb.riskLevel            : 50;
      const _recomputed = Math.round((0.30 * _md) + (0.25 * (100 - _ciF)) + (0.25 * _ff) + (0.20 * (100 - _rlF)));
      if (typeof parsed.viabilityScore === 'number' && _recomputed !== parsed.viabilityScore) {
        console.warn(`[Consistency] viabilityScore recomputed ${parsed.viabilityScore}→${_recomputed} after sub-score correction`);
        parsed.viabilityScore = Math.max(0, Math.min(100, _recomputed));
      }
    }

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
      const { label: densityLabel } = competitorCountForCategory(businessType);
      const localRadiusMiles = densityLabel === 'dense' ? 10 : densityLabel === 'sparse' ? 25 : 15;
      parsed.competitionAnalysis.competitors = parsed.competitionAnalysis.competitors.map(
        (comp: any, i: number) => {
          const hasRealCoords = typeof comp.latitude === 'number' && typeof comp.longitude === 'number';
          let lat: number = comp.latitude;
          let lng: number = comp.longitude;
          if (!hasRealCoords) {
            const offsetLat = (i === 0 ? 0.005 : i === 1 ? -0.004 : 0.003) + Math.sin(i) * 0.001;
            const offsetLng = (i === 0 ? -0.003 : i === 1 ? 0.005 : -0.005) + Math.cos(i) * 0.001;
            lat = parsed.targetCoordinates.latitude + offsetLat;
            lng = parsed.targetCoordinates.longitude + offsetLng;
          }
          const distanceMiles = hasRealCoords
            ? Math.round(haversineMiles(
                parsed.targetCoordinates.latitude, parsed.targetCoordinates.longitude,
                lat, lng,
              ) * 10) / 10
            : null;
          // Only classify as local/regional when we have real, AI-supplied coordinates.
          // Competitors with estimated/offset coordinates get coordinatesVerified:false and
          // are shown in a separate "unverified location" section rather than on the map.
          const coordinatesVerified = hasRealCoords;
          const isLocal = hasRealCoords && distanceMiles !== null && distanceMiles <= localRadiusMiles;
          return { ...comp, latitude: lat, longitude: lng, distanceMiles, coordinatesVerified, isLocal };
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

      // Sprint 11: narrative-based wording, no raw score/point-deduction language.
      const franchiseSummaryPrefix = sameBrandFound
        ? `⚠️ Territory availability concerns identified: existing ${brand} presence detected near this location — territory may already be claimed. See Territory Status below for details. `
        : `⚠️ Franchise verification required: this analysis reflects market conditions only. Final assessment incorporates territory availability considerations — confirm directly with ${brand}'s franchisor before any investment decision. `;

      const normalizeScoreMentions = (text: string): string =>
        text
          .replace(new RegExp(`\\b${originalScore}\\s*/\\s*100\\b`, 'g'), `${finalScore}/100`)
          .replace(new RegExp(`\\b${originalScore}\\s+out\\s+of\\s+100\\b`, 'gi'), `${finalScore} out of 100`)
          .replace(new RegExp(`(viability\\s+score\\s*(?:of|is|at|:)?\\s*)${originalScore}\\b`, 'gi'), `$1${finalScore}`)
          .replace(new RegExp(`(?<![\\w-])(score\\s+of\\s+)${originalScore}\\b`, 'gi'), `$1${finalScore}`);

      // Bug fix: the AI's own executiveSummary sometimes already contains a
      // franchise/territory sentence (the prompt asks it to address territory
      // risk). Strip any such AI-authored sentence before prepending the
      // canonical one below, so the warning doesn't appear twice.
      const TERRITORY_SENTENCE_STOPWORDS = new Set(['the', 'a', 'an', 'and', 'of', 'to', 'that', 'just', 'do']);
      const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const stripAiTerritorySentence = (text: string): string => {
        const distinctiveWords = brand
          .split(/\s+/)
          .filter(w => w.length > 2 && !TERRITORY_SENTENCE_STOPWORDS.has(w.toLowerCase()))
          .slice(0, 2)
          .map(escapeRegExp);
        const normalizedBrand = brand.toLowerCase().replace(/\s+/g, ' ').trim();
        const sentenceSplit = text.split(/(?<=[.!?])\s+/);
        return sentenceSplit
          .filter(sentence => {
            const lower = sentence.toLowerCase();
            const mentionsBrand = distinctiveWords.length > 0
              ? new RegExp(`\\b(${distinctiveWords.join('|')})\\b`, 'i').test(sentence)
              : lower.replace(/\s+/g, ' ').includes(normalizedBrand);
            const mentionsTerritory = /territory|franchise/i.test(lower);
            const mentionsConflict = /nearby|detected|claimed|presence/i.test(lower);
            return !(mentionsBrand && mentionsTerritory && mentionsConflict);
          })
          .join(' ');
      };

      const originalScoreForLogging = originalScore;
      parsed.viabilityScore = finalScore;
      parsed.franchiseScoreAdjustment = {
        originalScore,
        adjustment,
        finalScore,
        reason: sameBrandFound
          ? `Territory verification required: existing ${brand} locations were identified near this market. Territory saturation is a material risk.`
          : `Territory availability cannot be confirmed without direct franchisor disclosure, as required for any ${brand} franchise location.`,
      };
      parsed.recommendation = {
        ...parsed.recommendation,
        decision: cappedDecision,
        reasoning: franchiseReasoning,
      };
      parsed.executiveSummary =
        franchiseSummaryPrefix + normalizeScoreMentions(stripAiTerritorySentence(parsed.executiveSummary ?? ''));
      if (parsed.methodology) parsed.methodology = normalizeScoreMentions(parsed.methodology);

      // ─── Phase 3: geography-aware signals — computed and stored for ───
      // ─── observability only. Does NOT affect adjustment/finalScore/   ───
      // ─── cappedDecision above (Phase 4 scope).                        ───
      const geographyType = classifySearchGeography(location);
      const densityTier = getFranchiseDensityTier(brand);
      let nearestDistanceMiles: number | null = null;
      if (userLocation?.latitude && userLocation?.longitude && sameBrandIndices.length > 0) {
        const distances = sameBrandIndices
          .map(i => competitors[i])
          .filter((c): c is typeof c & { latitude: number; longitude: number } =>
            typeof c?.latitude === 'number' && typeof c?.longitude === 'number')
          .map(c => haversineMiles(userLocation.latitude, userLocation.longitude, c.latitude, c.longitude));
        if (distances.length > 0) nearestDistanceMiles = Math.min(...distances);
      }
      const territoryStatusPreview = classifyTerritoryStatus({ geographyType, nearestDistanceMiles, densityTier, sameBrandFound });
      const territoryConfidence = classifyTerritoryConfidence({ geographyType, nearestDistanceMiles, densityTier, sameBrandFound });

      parsed.franchiseTerritoryCheck = {
        ...parsed.franchiseTerritoryCheck,
        geographyType,
        nearestDistanceMiles,
        densityTier,
        territoryStatusPreview,
        territoryConfidence,
      };

      console.log('[FranchiseGeo]', {
        brand, geographyType, nearestDistanceMiles, densityTier,
        territoryStatusPreview, territoryConfidence,
        currentSameBrandFound: sameBrandFound, currentAdjustment: adjustment,
        currentOriginalScore: originalScoreForLogging, currentFinalScore: finalScore,
        currentCappedDecision: cappedDecision,
      });

      // ─── Phase 4 shadow mode — preview only. ───────────────────────────
      // Computes a parallel recommendation using a saturation-aware
      // territory model and an unpenalized business-opportunity score.
      // Does NOT mutate parsed.viabilityScore or parsed.recommendation —
      // those remain on the existing -15/-8 adjustment logic above. Preview
      // fields are attached for review only; nothing reads them yet.
      const saturationThreshold = DEFAULT_SATURATION_THRESHOLD;
      const saturationFlagTriggered = geographyType === 'zip' && sameBrandIndices.length >= saturationThreshold;

      const territoryStatus = classifyTerritoryStatus({
        geographyType, nearestDistanceMiles, densityTier, sameBrandFound,
        sameBrandCount: sameBrandIndices.length, saturationThreshold,
      });
      const territoryConfidencePreview = classifyTerritoryConfidence({
        geographyType, nearestDistanceMiles, densityTier, sameBrandFound,
        sameBrandCount: sameBrandIndices.length, saturationThreshold,
      });
      const territoryImpactLevel = classifyTerritoryImpactLevel(territoryStatus);
      const businessOpportunityRating = classifyBusinessOpportunity(originalScoreForLogging);
      const recommendationV2Preview = deriveRecommendationV2(businessOpportunityRating, territoryStatus);

      const territoryReason = !sameBrandFound
        ? 'No same-brand locations detected nearby.'
        : densityTier === 'mature_national'
          ? (territoryStatus === '🟢 no_known_conflicts'
            ? `Existing location(s) consistent with normal density for ${brand}.`
            : `${sameBrandIndices.length}+ existing ${brand} locations in this ZIP — density may exceed normal saturation; review cannibalization risk.`)
          : geographyType === 'zip'
            ? `Same-brand location found within this ZIP — territory may already be claimed.`
            : geographyType === 'city'
              ? `Same-brand presence detected in this city; confirm territory directly with ${brand}'s franchisor.`
              : `Same-brand presence detected in the wider area; this is a soft signal, not a confirmed conflict.`;

      const recommendationV2Rationale =
        `${businessOpportunityRating} market opportunity (raw score ${originalScoreForLogging}). ` +
        `Territory: ${territoryStatus.replace(/^[^\s]+\s/, '')} — ${territoryReason}`;

      parsed.franchiseRecommendationV2Preview = {
        businessOpportunityRating,
        territoryStatus,
        territoryConfidence: territoryConfidencePreview,
        territoryImpactLevel,
        territoryReason,
        recommendationV2Preview,
        recommendationV2Rationale,
        saturationThreshold,
        saturationFlagTriggered,
      };

      console.log('[Phase4Shadow]', {
        businessType, location,
        oldRecommendation: cappedDecision,
        recommendationV2Preview,
        match: cappedDecision === recommendationV2Preview,
        businessOpportunityRating,
        territoryStatus,
        territoryConfidence: territoryConfidencePreview,
        territoryImpactLevel,
        sameBrandCount: sameBrandIndices.length,
        saturationThreshold,
        saturationFlagTriggered,
        geographyType,
        densityTier,
        rawScore: originalScoreForLogging,
      });
    }

    parsed.generationMeta = {
      model,
      isLiveGenerated: true,
      estimatedCostUsd: cost.estimatedCostUsd,
      inputTokens,
      outputTokens,
      generatedAt: new Date().toISOString(),
      // Consistency-guardrail tracking — lets a later run be compared to this one.
      promptVersion: PROMPT_VERSION,
      modelConfigVersion: MODEL_CONFIG_VERSION,
      synthesisInputTokenCount: synthesisUsages[0]?.promptTokenCount ?? null,
      grounding: {
        mapsGrounded: phase1Grounded,
        searchGrounded: phase2Grounded,
        groundingCalls: cost.groundingCalls,
      },
      competitorCount: parsed.competitionAnalysis?.competitors?.length ?? null,
      localCompetitorCount: parsed.competitionAnalysis?.competitors?.filter((c: any) => c.isLocal === true).length ?? null,
      sourceCount: sources.length,
    };

    try {
      if (supabaseAdmin) {
        const { error: usageLogError } = await supabaseAdmin.from('usage_logs').insert({
          user_id: verifiedUserId,
          user_email: verifiedEmail,
          user_role: verifiedRole,
          plan: normalizedPlan,
          report_type: 'standard',
          model,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          grounding_calls: cost.groundingCalls,
          estimated_cost_usd: cost.estimatedCostUsd,
          within_hard_cap: withinHardCap,
          business_type: businessType,
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

    console.log('[ActivityLog] attempt analyze success');
    try {
      if (supabaseAdmin) {
        // Same authoritative figure as usage_logs above — guarantees the two tables reconcile.
        const aggregatedUsage = cost;
        const { error: activityLogErr } = await supabaseAdmin.from('report_activity_log').insert({
          user_id: verifiedUserId,
          user_email: verifiedEmail,
          report_type: 'viability',
          business_type: businessType,
          location,
          normalized_location: normalizeCacheKey(location),
          plan_tier: verifiedPlan,
          cache_status: forceRegenerate ? 'regenerated' : (cacheWasStale ? 'regenerated' : 'fresh'),
          force_regenerate: !!forceRegenerate,
          success: true,
          source: 'dashboard',
          duration_ms: Date.now() - requestStartMs,
          ai_model: model,
          input_tokens: aggregatedUsage.inputTokens,
          output_tokens: aggregatedUsage.outputTokens,
          total_tokens: aggregatedUsage.totalTokens,
          estimated_ai_cost: aggregatedUsage.estimatedCostUsd,
          entitlement_source: usedDecisionPassId ? 'decision_pass' : (_isTrialing ? 'trial' : 'plan'),
          ...geo,
        });
        if (activityLogErr) throw activityLogErr;
        console.log('[ActivityLog] success analyze success');
      }
    } catch (logErr: any) {
      console.error('[ActivityLog] failed analyze success:', logErr.message ?? logErr);
    }

    // Quota counter — only fresh, successful, non-cached generations count.
    if (!_simAuth.simulationActive) {
      if (usedDecisionPassId) {
        // Pass was already decremented before the Gemini call; nothing more to do.
        console.log(`[Analyze] Decision Pass viability consumed on success — passId=${usedDecisionPassId}`);
      } else if (_isTrialing) {
        await incrementTrialUsage(supabaseAdmin, verifiedUserId);
      } else {
        await incrementUsageTracking(supabaseAdmin, verifiedUserId, 'standard');
      }
    }

    // Tag stale-refresh so the client knows a fresh report replaced an expired cache entry.
    if (cacheWasStale) parsed._refreshedFromStale = true;
    // Tag Decision Pass usage so the frontend can grant full report access regardless of base plan.
    if (usedDecisionPassId) parsed._usedDecisionPass = true;

    normalizeViabilityReport(parsed);

    // Store in shared server-side cache — all accounts/devices get the same report.
    await setInServerCache(businessType, location, 'standard', verifiedPlan, parsed);

    return json(res, 200, parsed);
  } catch (err: any) {
    // If a purchased pass was pre-decremented but generation failed, restore it
    // so the user does not permanently lose a pass on a server or AI error.
    if (usedDecisionPassId) {
      await restoreDecisionPassViability(supabaseAdmin, usedDecisionPassId);
      console.log(`[Analyze] Decision Pass viability restored after failure — passId=${usedDecisionPassId}`);
    }

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
    else if (msgLower.includes('timeout') || msgLower.includes('timed out')) {
      // Matches both our own deadline/withTimeout messages ("…timed out") and any
      // SDK/socket "timeout" error, so a slow run maps to a clean 504 instead of
      // a generic 502. No report credit is consumed (incrementUsageTracking only
      // runs on the success path).
      httpStatus = 504; resCode = 'TIMEOUT';
      resMessage = 'Analysis timed out while gathering market data. Please try again — no report credit was used.';
    }
    else if (msgLower.includes('malformed_response')) {
      httpStatus = 502; resCode = 'MALFORMED_RESPONSE';
      resMessage = 'The AI returned an unexpected response format. Please try again — this is usually transient.';
      console.error('[analyze] Gemini returned unparseable JSON — no report generated.', { businessType: businessType?.slice(0, 60) });
    }

    console.log('[ActivityLog] attempt analyze failure-path');
    try {
      if (supabaseAdmin) {
        const failGroundingCalls = (phase1Grounded ? 1 : 0) + (phase2Grounded ? 1 : 0);
        const aggregatedUsage = aggregateGeminiUsage(geminiModelUsed ?? 'unknown', [phase1Usage, phase2Usage, ...synthesisUsages], failGroundingCalls);
        const { error: activityLogErr } = await supabaseAdmin.from('report_activity_log').insert({
          user_id: verifiedUserId,
          user_email: verifiedEmail,
          report_type: 'viability',
          business_type: businessType,
          location,
          normalized_location: location ? normalizeCacheKey(location) : null,
          plan_tier: verifiedPlan,
          cache_status: null,
          force_regenerate: !!forceRegenerate,
          success: false,
          error_message: resMessage?.slice(0, 500),
          source: 'dashboard',
          duration_ms: Date.now() - requestStartMs,
          ai_model: geminiModelUsed,
          input_tokens: aggregatedUsage.inputTokens,
          output_tokens: aggregatedUsage.outputTokens,
          total_tokens: aggregatedUsage.totalTokens,
          estimated_ai_cost: aggregatedUsage.estimatedCostUsd,
          entitlement_source: usedDecisionPassId ? 'decision_pass' : (_isTrialing ? 'trial' : 'plan'),
          ...geo,
        });
        if (activityLogErr) throw activityLogErr;
        console.log('[ActivityLog] success analyze failure-path');
      }
    } catch (logErr: any) {
      console.error('[ActivityLog] failed analyze failure-path:', logErr.message ?? logErr);
    }

    return json(res, httpStatus, { error: resMessage, code: resCode });
  }
}
