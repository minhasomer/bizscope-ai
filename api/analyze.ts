import type { IncomingMessage, ServerResponse } from 'http';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import {
  normalizeTierToBudgetPlan,
  getReportBudget,
  estimateCost,
  wouldExceedHardCap,
} from '../src/config/aiBudget.js';

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
      required: ['summary', 'startupCostRange', 'startupCostBreakdown', 'revenueYear1', 'revenueYear3', 'breakEvenTime', 'roiTime', 'profitMargin', 'scalability', 'keyStats'],
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

function cleanAndParseJSON(text: string, fallback?: any): any {
  let s = text.trim()
    .replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
  try { return JSON.parse(s); } catch { /* fall through */ }
  const oi = s.indexOf('{'), ai = s.indexOf('[');
  let start = -1, end = -1;
  if (oi !== -1 && (ai === -1 || oi < ai)) { start = oi; end = s.lastIndexOf('}'); }
  else if (ai !== -1) { start = ai; end = s.lastIndexOf(']'); }
  if (start !== -1 && end > start) {
    try { return JSON.parse(s.substring(start, end + 1)); } catch { /* fall through */ }
  }
  if (fallback) return fallback;
  throw new Error('malformed_response');
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

function getViabilityReportFallback(businessType: string, location: string): any {
  const cap = businessType.charAt(0).toUpperCase() + businessType.slice(1);
  const coords = getCoordinatesForLocation(location);
  return {
    businessType: cap, location, targetCoordinates: coords,
    viabilityScore: 78,
    scoreBreakdown: { marketDemand: 82, competitionIntensity: 50, financialFeasibility: 75, riskLevel: 35 },
    executiveSummary: `Fallback report for ${cap} in ${location}. Growth indices remain reliable with under-served gaps providing a clear path to customer capture.`,
    financialProjections: {
      summary: 'Viable margin profile.', startupCostRange: '$100,000 - $180,000',
      startupCostBreakdown: 'Fit-out ($65k), equipment ($40k), reserve ($45k), marketing ($30k).',
      revenueYear1: '$280,000', revenueYear3: '$440,000', breakEvenTime: '15 months',
      roiTime: '2.8 years', profitMargin: '17%', scalability: 'Medium',
      keyStats: [
        { label: 'Est. Ticket Price', value: '$12.50' },
        { label: 'Target Conversions/Day', value: '110' },
      ],
    },
    competitionAnalysis: {
      summary: 'Active independent options with a void of specialised brands.',
      competitors: [
        { name: 'Vanguard Enterprises', details: 'Established generic provider.', address: `100 Main St, ${location}`, latitude: coords.latitude + 0.003, longitude: coords.longitude - 0.002 },
        { name: 'Apex Retail Services', details: 'Standardised franchise with strong foot traffic.', address: `250 Highway Corridor, ${location}`, latitude: coords.latitude - 0.004, longitude: coords.longitude + 0.004 },
      ],
    },
    marketTrends: {
      summary: 'Demand leans towards custom experiences and digital integration.',
      trends: [
        { trend: 'Personalised Customer Styling', impact: 'Fosters word-of-mouth referral spikes.' },
        { trend: 'Eco-Conscious Infrastructure', impact: 'Appeals to higher-spending demographics.' },
      ],
    },
    demographicInsights: {
      summary: 'Balanced sector with high commuter ratio and stable income markers.',
      demographics: [
        { metric: 'Active Age Pool (18-49)', value: '48%', insight: 'Primary demographic.' },
        { metric: 'Household Income Cohort', value: 'Above National Median', insight: 'Supports premium pricing.' },
      ],
    },
    riskAssessment: {
      summary: 'General operating risks including lease rates and labour sourcing.',
      risks: [
        { risk: 'Overhead inflation', impact: 'Increased transactions needed to reach profitability.', severity: 'Medium', mitigation: 'Secure long-term flat lease.' },
        { risk: 'Service inconsistency', impact: 'Losing recurring customers.', severity: 'Medium', mitigation: 'Persistent staff workshops.' },
      ],
    },
    successFactors: {
      summary: 'Consistency and premium location positioning outline the path to success.',
      factors: [
        { factor: 'Strategic Micro-Location', description: 'Corner plots with strong pedestrian pathways.', importance: 'Critical' },
        { factor: 'Modern Visual Branding', description: 'Clean logo and digital media engagement.', importance: 'High' },
      ],
    },
    recommendation: { decision: 'Caution Advised', reasoning: 'Careful site mapping and localised marketing required to secure early transaction volume.' },
    methodology: 'Data generated via fallback engine leveraging default localised benchmarks.',
    groundingSources: [
      { title: 'National Industry Benchmarks', uri: 'https://www.census.gov' },
      { title: 'Local Business Registry', uri: 'https://maps.google.com' },
    ],
  };
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

function getServerSidePlan(role: string, subscription_tier: string): string {
  const r = (role ?? '').trim().toLowerCase();
  if (r === 'admin') return 'Enterprise';
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

// ─── Allowed beta roles (Admin + BetaTester hardcoded server-side) ────────────
// Initial deploy uses VITE_BETA_ROLES=Admin on the frontend (only Admin browsers
// reach this endpoint). Expanding to BetaTester requires only a frontend env
// var change — no server code change needed.

const BETA_ROLES = ['Admin', 'BetaTester'];

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
    supabaseAdminInitialized: !!supabaseAdmin,
  });

  // Auth + role gate: only Admin and BetaTester proceed.
  // [3]-[7] are logged inside verifyAndGetPlan at every exit point.
  const { verifiedEmail, verifiedPlan, verifiedRole, verifiedUserId } = await verifyAndGetPlan(
    req.headers['authorization'] as string | undefined,
  );

  if (!BETA_ROLES.includes(verifiedRole)) {
    return json(res, 403, {
      error: 'Real reports are restricted to beta users.',
      code: 'BETA_RESTRICTED',
    });
  }

  const body = req.body ?? {};
  const { businessType, location, userLocation } = body;

  if (!businessType?.trim()) {
    return json(res, 400, { error: 'Missing or invalid businessType.', code: 'INVALID_INPUT' });
  }
  if (!location?.trim()) {
    return json(res, 400, { error: 'Missing or invalid location.', code: 'INVALID_INPUT' });
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

    // Phase 1: competitor lookup via Maps grounding
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
          contents: `List the top 5 direct competitors for a new '${businessType}' in or very near '${location}'. For each, provide the name and address.`,
          config: mapsConfig,
        }),
        20000,
        'competitor research timed out',
      );
      competitionInfo = mapsRes.text || competitionInfo;
      sources.push(...getGroundingSources(mapsRes));
    } catch (err) {
      console.warn('[analyze] Maps phase failed, continuing:', err);
    }

    // Phase 2: census + trends via Search grounding
    try {
      const searchRes = await withTimeout(
        ai.models.generateContent({
          model,
          contents: `Find the latest US Census data for '${location}': specifically Total Population and Median Household Income. Also research market trends and financial benchmarks for opening a '${businessType}' in '${location}'.`,
          config: { tools: [{ googleSearch: {} }] },
        }),
        20000,
        'census/trends lookup timed out',
      );
      marketInfo = searchRes.text || marketInfo;
      sources.push(...getGroundingSources(searchRes));
    } catch (err) {
      console.warn('[analyze] Search phase failed, continuing:', err);
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

Estimate latitude/longitude for '${location}' and each competitor for map visualisation.
    `.trim();

    const fallback = getViabilityReportFallback(businessType, location);
    const synthesis = await withTimeout(
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: reportSchema,
          temperature: 0.4,
          maxOutputTokens: budget.maxOutputTokens,
        },
      }),
      30000,
      'synthesis timed out',
    );

    const usage = (synthesis as any).usageMetadata;
    const inputTokens: number | null = usage?.promptTokenCount ?? null;
    const outputTokens: number | null = usage?.candidatesTokenCount ?? null;
    const cost = estimateCost(model, inputTokens ?? 0, outputTokens ?? 0, 2);
    console.log(`[AICost] /api/analyze role=${verifiedRole} plan=${normalizedPlan} model=${model} in=${inputTokens ?? '?'} out=${outputTokens ?? '?'} est=$${cost.estimatedCostUsd.toFixed(5)}`);

    const withinHardCap = !wouldExceedHardCap(cost.estimatedCostUsd, budget);
    if (!withinHardCap) {
      console.warn(`[AICost] OVER_HARD_CAP role=${verifiedRole} plan=${normalizedPlan} cap=$${budget.hardCapUsd} actual=$${cost.estimatedCostUsd.toFixed(5)}`);
    }

    const parsed = cleanAndParseJSON(synthesis.text || '', fallback);
    parsed.groundingSources = sources.length > 0 ? sources : fallback.groundingSources;

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

    return json(res, 200, parsed);
  } catch (err: any) {
    console.error('[analyze] handler error:', err.message);

    let status = 502;
    let code = 'MODEL_ERROR';
    let message = err.message || 'An unexpected error occurred.';

    if (message.includes('API key')) { status = 401; code = 'MISSING_API_KEY'; }
    else if (message.includes('429') || message.toLowerCase().includes('rate limit')) { status = 429; code = 'RATE_LIMIT'; message = 'Gemini rate limit hit. Please try again shortly.'; }
    else if (message.includes('timeout')) { status = 504; code = 'TIMEOUT'; message = 'Analysis timed out. Please try again.'; }
    else if (message.includes('malformed_response')) { status = 502; code = 'MALFORMED_RESPONSE'; }

    return json(res, status, { error: message, code });
  }
}
