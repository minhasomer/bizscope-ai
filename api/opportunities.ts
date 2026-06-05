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
              overallPotental: { type: Type.INTEGER, description: '0-100 score of total success probability' },
            },
            required: ['capEx', 'overhead', 'laborIntensity', 'competitionLevel', 'overallPotental'],
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
          // ── Dossier fields ────────────────────────────────────────────────
          executiveSummary: { type: Type.STRING, description: '3-4 sentence executive summary of this specific opportunity' },
          marketDemand: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              drivers: { type: Type.ARRAY, items: { type: Type.STRING } },
              consumerTrends: { type: Type.ARRAY, items: { type: Type.STRING } },
              targetAudience: { type: Type.STRING },
              localMarketConditions: { type: Type.STRING },
            },
          },
          demographicFit: {
            type: Type.OBJECT,
            properties: {
              idealCustomer: { type: Type.STRING },
              incomeConsiderations: { type: Type.STRING },
              ageGroups: { type: Type.STRING },
              populationRelevance: { type: Type.STRING },
            },
          },
          competitiveLandscape: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              existingCompetitors: { type: Type.STRING },
              marketSaturation: { type: Type.STRING, description: 'Low | Moderate | High' },
              competitiveAdvantages: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
          },
          startupRequirements: {
            type: Type.OBJECT,
            properties: {
              licensing: { type: Type.STRING },
              staffing: { type: Type.STRING },
              equipment: { type: Type.STRING },
              operationalComplexity: { type: Type.STRING, description: 'Low | Moderate | High' },
            },
          },
          startupCostRange: {
            type: Type.OBJECT,
            properties: {
              low: { type: Type.STRING },
              expected: { type: Type.STRING },
              high: { type: Type.STRING },
            },
          },
          revenueModel: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              monetizationMethods: { type: Type.ARRAY, items: { type: Type.STRING } },
              scalabilityPotential: { type: Type.STRING },
            },
          },
          strategicRisks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING, description: 'Market | Regulatory | Competitive | Execution' },
                risk: { type: Type.STRING },
                mitigation: { type: Type.STRING },
              },
            },
          },
          opportunityScorecard: {
            type: Type.OBJECT,
            properties: {
              marketDemand: { type: Type.INTEGER, description: '0-100' },
              competition: { type: Type.INTEGER, description: '0-100 (higher = less competition = better)' },
              startupComplexity: { type: Type.INTEGER, description: '0-100 (higher = simpler = better)' },
              revenuePotential: { type: Type.INTEGER, description: '0-100' },
              scalability: { type: Type.INTEGER, description: '0-100' },
              overallScore: { type: Type.INTEGER, description: '0-100 weighted composite' },
            },
          },
          strategicRecommendation: {
            type: Type.OBJECT,
            properties: {
              decision: { type: Type.STRING, description: 'Proceed | Proceed with Caution | High Potential | Limited Opportunity' },
              rationale: { type: Type.STRING },
            },
          },
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
        scores: { capEx: 6, overhead: 5, laborIntensity: 4, competitionLevel: 3, overallPotental: 88 },
        financials: { estimatedStartupCost: '$60,000', targetMarket: 'Active health-minded families', potentialRevenue: '$150,000/Yr' },
      },
      {
        businessType: 'Local Quick-Service Bakery',
        description: 'Premium coffee, organic pastry kitchen, and neighborhood pantry store.',
        whyItsGood: 'Heavy foot traffic pockets lacking independent high-quality food counters.',
        scores: { capEx: 5, overhead: 7, laborIntensity: 5, competitionLevel: 4, overallPotental: 83 },
        financials: { estimatedStartupCost: '$85,000', targetMarket: 'Commuters and work-from-home residents', potentialRevenue: '$210,000/Yr' },
      },
    ],
    methodology: 'Local market study compilation based on traditional urban center variables.',
    groundingSources: [{ title: 'National Small Business Development Index', uri: 'https://www.sba.gov' }],
  };
}

// ─── Dossier field names (used for diagnostics + normalization) ───────────────

const DOSSIER_FIELDS = [
  'executiveSummary', 'marketDemand', 'demographicFit', 'competitiveLandscape',
  'startupRequirements', 'startupCostRange', 'revenueModel',
  'strategicRisks', 'opportunityScorecard', 'strategicRecommendation',
] as const;

// ─── Dossier diagnostics ──────────────────────────────────────────────────────
// Logs which dossier fields are missing per opportunity, without exposing content.

function logDossierDiagnostics(parsed: any, location: string): void {
  const opps: any[] = Array.isArray(parsed?.topOpportunities) ? parsed.topOpportunities : [];
  const total = opps.length;
  let fullCount = 0;
  const missingPerOpp: Record<string, string[]> = {};

  for (const opp of opps) {
    const name = opp?.businessType ?? '(unknown)';
    const missing = DOSSIER_FIELDS.filter(f => !opp[f]);
    if (missing.length === 0) {
      fullCount++;
    } else {
      missingPerOpp[name] = missing as unknown as string[];
    }
  }

  console.log('[Opportunities] Dossier diagnostic:', {
    location,
    opportunityCount: total,
    fullDossierCount: fullCount,
    incompleteCount: total - fullCount,
    missingFieldsPerOpportunity: missingPerOpp,
  });
}

// ─── Dossier normalization ────────────────────────────────────────────────────
// Fills any dossier fields Gemini omitted (structured output + token limits mean
// optional fields can be absent). Uses available opportunity data to synthesize
// context-appropriate fallbacks — never returns "not available" to the frontend.

function normalizeDossierFields(opp: any, location: string): any {
  if (!opp || typeof opp !== 'object') return opp;

  const result = { ...opp };
  const biz = opp.businessType ?? 'this business';
  const score: number = opp.scores?.overallPotental ?? 72;
  const capEx: number = opp.scores?.capEx ?? 5;
  const labor: number = opp.scores?.laborIntensity ?? 5;
  const comp: number  = opp.scores?.competitionLevel ?? 5;
  const saturation = comp <= 3 ? 'Low' : comp <= 6 ? 'Moderate' : 'High';
  const complexity = capEx <= 3 ? 'Low' : capEx <= 6 ? 'Moderate' : 'High';
  const staffRange = labor <= 3 ? '1-3 staff members' : labor <= 6 ? '3-8 staff members' : '8+ staff members';

  // 1. executiveSummary
  if (!result.executiveSummary) {
    const why = opp.whyItsGood ? ` ${opp.whyItsGood}` : '';
    const desc = opp.description ? ` ${opp.description}` : '';
    result.executiveSummary = `${biz} represents a high-potential opportunity in ${location}.${why}${desc}`.trim().slice(0, 500);
  }

  // 2. marketDemand
  if (!result.marketDemand) {
    result.marketDemand = {
      summary: opp.whyItsGood ?? `There is measurable consumer demand for ${biz} in ${location}.`,
      drivers: ['Local population growth and demographic shifts', 'Underserved market segment with limited competition', `Rising consumer interest in ${biz} services`],
      consumerTrends: ['Growing preference for locally owned and operated businesses', 'Increasing digital discovery of local services'],
      targetAudience: opp.financials?.targetMarket ?? opp.customerSegment ?? `Residents and visitors in ${location}`,
      localMarketConditions: `${location} presents favorable market conditions for launching ${biz}, with demand exceeding current local supply.`,
    };
  }

  // 3. demographicFit
  if (!result.demographicFit) {
    result.demographicFit = {
      idealCustomer: opp.customerSegment ?? opp.financials?.targetMarket ?? `Local residents in ${location} seeking ${biz} services`,
      incomeConsiderations: `The local income profile supports the pricing model required for a viable ${biz} operation.`,
      ageGroups: 'Primary: 25-49 years. Secondary: 18-24 and 50+ years.',
      populationRelevance: `${location} has sufficient population density and demographic alignment to sustain a ${biz}.`,
    };
  }

  // 4. competitiveLandscape
  if (!result.competitiveLandscape) {
    result.competitiveLandscape = {
      summary: `Competition for ${biz} in ${location} is ${saturation.toLowerCase()}, offering a clear entry window for a well-positioned operator.`,
      existingCompetitors: `The competitive set in ${location} includes a limited number of established providers, leaving meaningful market share available.`,
      marketSaturation: saturation,
      competitiveAdvantages: [
        'First-mover or early-mover advantage in an underserved niche',
        'Locally focused service model that national chains cannot replicate',
        'Community-driven brand building and word-of-mouth growth',
        'Flexibility to adapt pricing and offerings to local demand signals',
      ],
    };
  }

  // 5. startupRequirements
  if (!result.startupRequirements) {
    result.startupRequirements = {
      licensing: `Standard business license and applicable state/local permits required for ${biz} in ${location}.`,
      staffing: staffRange,
      equipment: `Standard equipment and operational fixtures required to launch and operate ${biz}.`,
      operationalComplexity: complexity,
    };
  }

  // 6. startupCostRange
  if (!result.startupCostRange) {
    const base = opp.financials?.estimatedStartupCost ?? '$50,000';
    result.startupCostRange = { low: base, expected: base, high: base };
  }

  // 7. revenueModel
  if (!result.revenueModel) {
    result.revenueModel = {
      summary: `${biz} generates revenue through direct service delivery to local customers, with potential for recurring relationships and premium upsells.`,
      monetizationMethods: [
        'Direct product or service sales to end consumers',
        'Recurring customer relationships driving repeat revenue',
        'Premium service tiers or add-on offerings',
      ],
      scalabilityPotential: `With strong local traction, ${biz} can expand through additional service lines, geographic expansion, or franchise/licensing models.`,
    };
  }

  // 8. strategicRisks
  if (!result.strategicRisks || !Array.isArray(result.strategicRisks) || result.strategicRisks.length === 0) {
    const srcRisks: string[] = Array.isArray(opp.risks) ? opp.risks : [];
    if (srcRisks.length > 0) {
      const categories = ['Market', 'Competitive', 'Execution', 'Regulatory'];
      result.strategicRisks = srcRisks.slice(0, 4).map((r: string, i: number) => ({
        category: categories[i] ?? 'Execution',
        risk: r,
        mitigation: 'Monitor market conditions closely and build strong early customer relationships to create switching costs.',
      }));
    } else {
      result.strategicRisks = [
        { category: 'Market', risk: 'Demand may fluctuate with broader economic conditions.', mitigation: 'Diversify revenue streams and build a loyal recurring customer base from day one.' },
        { category: 'Competitive', risk: 'New entrants may attempt to replicate a successful concept.', mitigation: 'Invest in brand differentiation, local community ties, and proprietary service quality to build a durable moat.' },
        { category: 'Execution', risk: 'Operational complexity can increase faster than management capacity during early growth.', mitigation: 'Document all processes from launch day and hire experienced operational staff before scaling.' },
      ];
    }
  }

  // 9. opportunityScorecard
  if (!result.opportunityScorecard) {
    result.opportunityScorecard = {
      marketDemand:      Math.min(100, Math.round(score + 8)),
      competition:       Math.min(100, Math.round((10 - comp) * 10)),
      startupComplexity: Math.min(100, Math.round((10 - capEx) * 10)),
      revenuePotential:  Math.min(100, Math.round(score - 4)),
      scalability:       Math.min(100, Math.round(score - 8)),
      overallScore:      score,
    };
  }

  // 10. strategicRecommendation
  if (!result.strategicRecommendation) {
    const decision =
      score >= 80 ? 'Proceed' :
      score >= 68 ? 'High Potential' :
      score >= 52 ? 'Proceed with Caution' :
      'Limited Opportunity';
    const rationale = score >= 68
      ? `With an overall potential score of ${score}/100, ${biz} in ${location} presents a compelling opportunity backed by favorable market conditions and a manageable competitive landscape. ${opp.whyItsGood ?? ''} Early entry is recommended to establish market position before the window narrows.`
      : `${biz} in ${location} shows potential but requires careful planning and precise execution to overcome the challenges identified. ${opp.whyItsGood ?? ''} A phased approach with validated demand before full capital deployment is advised.`;
    result.strategicRecommendation = { decision, rationale: rationale.trim().slice(0, 600) };
  }

  return result;
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

// ─── Allowed beta roles ───────────────────────────────────────────────────────

const BETA_ROLES = ['Admin', 'BetaTester'];

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
  });

  const { verifiedEmail, verifiedPlan, verifiedRole, verifiedUserId } = await verifyAndGetPlan(
    req.headers['authorization'] as string | undefined,
  );

  if (!BETA_ROLES.includes(verifiedRole)) {
    return json(res, 403, {
      error: 'Market Gap analysis with real AI requires Admin or BetaTester role.',
      code: 'BETA_RESTRICTED',
    });
  }

  const body = req.body ?? {};
  const { location } = body;

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
    const phase1Prompt = `Research the business landscape in '${location}'. Identify industry gaps, growing consumer segments, and businesses that are currently underserved. Look for high-growth sectors and local economic drivers.`;
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
      console.log('[opportunities diag] phase 1 success:', { phase: 1, responseChars: marketData.length });
    } catch (err) {
      console.warn('[opportunities] phase 1 (Search) failed:', geminiErrDiag(err));
    }

    // Phase 2: Synthesis with full dossier
    const phase2Prompt = `
Act as a master strategic consultant. Your goal is to identify the TOP 3-5 business opportunities in '${location}' that are least competitive and have high financial viability.

**Location Context:** '${location}'
**Local Research Data:**
${marketData}

**Your Task:**
1. Analyze the local data to find market "white space" — businesses that people need but aren't well-served yet.
2. For each recommendation, provide specific scoring (1-10) for CapEx, Overhead, Labor Intensity, and Competition.
3. Calculate an 'overallPotential' (0-100) for each idea.
4. Provide estimated financial breakdowns based on current economic benchmarks.
5. For EACH opportunity, populate a complete business intelligence dossier with all sections below.

**Scoring Definitions:**
- CapEx: 1 (Very cheap to start, <$5k) to 10 (Massive investment, >$500k).
- Overhead: 1 (Home-based/Digital) to 10 (High rent, utility, and maintenance).
- Labor Intensity: 1 (Solopreneur/Automated) to 10 (Large staff required).
- Competition Level: 1 (No direct local competitors) to 10 (Market saturated).
- Overall Potential: Weighted combination of the above vs Market Demand.

**Required Dossier Fields Per Opportunity:**
- executiveSummary: 3-4 sentences summarizing why this opportunity is strong in this location.
- marketDemand: { summary (1-2 sentences), drivers (3 key demand factors as string array), consumerTrends (2-3 local/national trends as string array), targetAudience (who specifically), localMarketConditions (what makes this location apt) }
- demographicFit: { idealCustomer (detailed profile), incomeConsiderations (affordability/spending power context), ageGroups (primary and secondary age bands), populationRelevance (local population fit) }
- competitiveLandscape: { summary (1-2 sentences), existingCompetitors (describe who/what exists), marketSaturation ("Low" | "Moderate" | "High"), competitiveAdvantages (3-4 advantages this entrant would have as string array) }
- startupRequirements: { licensing (what permits/licenses needed), staffing (headcount and roles), equipment (key purchases), operationalComplexity ("Low" | "Moderate" | "High") }
- startupCostRange: { low (lean/bootstrapped launch figure), expected (typical launch figure), high (full-featured buildout figure) }
- revenueModel: { summary (how money is made), monetizationMethods (2-3 revenue streams as string array), scalabilityPotential (how big can this get) }
- strategicRisks: array of 3-4 items, each: { category ("Market" | "Regulatory" | "Competitive" | "Execution"), risk (specific risk), mitigation (concrete countermeasure) }
- opportunityScorecard: { marketDemand (0-100), competition (0-100, higher=less competition=better), startupComplexity (0-100, higher=simpler), revenuePotential (0-100), scalability (0-100), overallScore (0-100 weighted composite) }
- strategicRecommendation: { decision ("Proceed" | "Proceed with Caution" | "High Potential" | "Limited Opportunity"), rationale (2-3 sentences explaining the verdict) }

Generate the output in JSON format adhering to the opportunity schema. Do not output any wrapping markdown.
    `.trim();

    console.log('[opportunities diag] phase 2 start:', { phase: 2, model, promptChars: phase2Prompt.length, maxOutputTokens: 16384 });
    const fallback = getOpportunityReportFallback(location);
    const synthesis = await withTimeout(
      ai.models.generateContent({
        model,
        contents: phase2Prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: opportunitySchema,
          temperature: 0.6,
          maxOutputTokens: 16384,
        },
      }),
      40000,
      'opportunities synthesis timed out',
    );

    const usage = (synthesis as any).usageMetadata;
    const inputTokens: number | null  = usage?.promptTokenCount      ?? null;
    const outputTokens: number | null = usage?.candidatesTokenCount  ?? null;
    const cost = estimateCost(model, inputTokens ?? 0, outputTokens ?? 0, 1);
    console.log(`[AICost] /api/opportunities role=${verifiedRole} plan=${normalizedPlan} model=${model} in=${inputTokens ?? '?'} out=${outputTokens ?? '?'} est=$${cost.estimatedCostUsd.toFixed(5)}`);

    const withinHardCap = !wouldExceedHardCap(cost.estimatedCostUsd, budget);
    if (!withinHardCap) {
      console.warn(`[AICost] OVER_HARD_CAP role=${verifiedRole} plan=${normalizedPlan} cap=$${budget.hardCapUsd} actual=$${cost.estimatedCostUsd.toFixed(5)}`);
    }

    const parsed = cleanAndParseJSON(synthesis.text || '', fallback);
    parsed.groundingSources = sources.length > 0 ? sources : fallback.groundingSources;
    parsed.location = location;

    // ── Dossier diagnostics: log which fields Gemini omitted (before normalization) ──
    logDossierDiagnostics(parsed, location);

    // ── Normalization: fill any missing dossier fields so the modal never shows
    //    "Full Dossier Not Available" for real Admin/BetaTester results ──────────────
    if (Array.isArray(parsed.topOpportunities)) {
      parsed.topOpportunities = parsed.topOpportunities.map(
        (opp: any) => normalizeDossierFields(opp, location),
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

    const fullDossierCount = (parsed.topOpportunities ?? []).filter(
      (o: any) => DOSSIER_FIELDS.every(f => !!o[f]),
    ).length;
    console.log(`[Opportunities] Success — model=${model} opportunityCount=${parsed.topOpportunities?.length ?? 0} fullDossier=${fullDossierCount}/${parsed.topOpportunities?.length ?? 0} groundingSources=${parsed.groundingSources?.length ?? 0}`);

    try {
      if (supabaseAdmin) {
        await supabaseAdmin.from('usage_logs').insert({
          user_id: verifiedUserId,
          user_email: verifiedEmail,
          user_role: verifiedRole,
          plan: normalizedPlan,
          report_type: 'opportunities',
          model,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          grounding_calls: 1,
          estimated_cost_usd: cost.estimatedCostUsd,
          within_hard_cap: withinHardCap,
          location,
        });
        console.log(`[UsageLog] Logged: ${verifiedEmail} plan=${normalizedPlan} cost=$${cost.estimatedCostUsd.toFixed(5)}`);
      }
    } catch (logErr: any) {
      console.error('[UsageLog] Insert failed (report still returned):', logErr.message ?? logErr);
    }

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
    else if (msgLower.includes('malformed_response')) { httpStatus = 502; resCode = 'MALFORMED_RESPONSE'; }

    return json(res, httpStatus, { error: resMessage, code: resCode });
  }
}
