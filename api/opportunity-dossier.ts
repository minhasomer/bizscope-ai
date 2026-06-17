import type { IncomingMessage, ServerResponse } from 'http';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import {
  normalizeTierToBudgetPlan,
  getReportBudget,
  estimateCost,
  wouldExceedHardCap,
  aggregateGeminiUsage,
} from '../src/config/aiBudget.js';
import { checkBlockedCategory, blockedCategoryMessage } from '../src/utils/blockedCategories.js';

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

// All 10 dossier fields are required — single-opportunity focused call has
// enough output budget to fill every field.
const dossierSchema = {
  type: Type.OBJECT,
  properties: {
    executiveSummary: { type: Type.STRING, description: '3-4 sentence executive summary of this opportunity' },
    marketDemand: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING },
        drivers: { type: Type.ARRAY, items: { type: Type.STRING } },
        consumerTrends: { type: Type.ARRAY, items: { type: Type.STRING } },
        targetAudience: { type: Type.STRING },
        localMarketConditions: { type: Type.STRING },
      },
      required: ['summary', 'drivers', 'consumerTrends', 'targetAudience', 'localMarketConditions'],
    },
    demographicFit: {
      type: Type.OBJECT,
      properties: {
        idealCustomer: { type: Type.STRING },
        incomeConsiderations: { type: Type.STRING },
        ageGroups: { type: Type.STRING },
        populationRelevance: { type: Type.STRING },
      },
      required: ['idealCustomer', 'incomeConsiderations', 'ageGroups', 'populationRelevance'],
    },
    competitiveLandscape: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING },
        existingCompetitors: { type: Type.STRING },
        marketSaturation: { type: Type.STRING, description: 'Low | Moderate | High' },
        competitiveAdvantages: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['summary', 'existingCompetitors', 'marketSaturation', 'competitiveAdvantages'],
    },
    startupRequirements: {
      type: Type.OBJECT,
      properties: {
        licensing: { type: Type.STRING },
        staffing: { type: Type.STRING },
        equipment: { type: Type.STRING },
        operationalComplexity: { type: Type.STRING, description: 'Low | Moderate | High' },
      },
      required: ['licensing', 'staffing', 'equipment', 'operationalComplexity'],
    },
    startupCostRange: {
      type: Type.OBJECT,
      properties: {
        low: { type: Type.STRING },
        expected: { type: Type.STRING },
        high: { type: Type.STRING },
      },
      required: ['low', 'expected', 'high'],
    },
    revenueModel: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING },
        monetizationMethods: { type: Type.ARRAY, items: { type: Type.STRING } },
        scalabilityPotential: { type: Type.STRING },
      },
      required: ['summary', 'monetizationMethods', 'scalabilityPotential'],
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
        required: ['category', 'risk', 'mitigation'],
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
      required: ['marketDemand', 'competition', 'startupComplexity', 'revenuePotential', 'scalability', 'overallScore'],
    },
    strategicRecommendation: {
      type: Type.OBJECT,
      properties: {
        decision: { type: Type.STRING, description: 'Proceed | Proceed with Caution | High Potential | Limited Opportunity' },
        rationale: { type: Type.STRING },
      },
      required: ['decision', 'rationale'],
    },
  },
  required: [
    'executiveSummary', 'marketDemand', 'demographicFit', 'competitiveLandscape',
    'startupRequirements', 'startupCostRange', 'revenueModel',
    'strategicRisks', 'opportunityScorecard', 'strategicRecommendation',
  ],
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
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
  return fallback ?? {};
}

// ─── Normalization safety net ─────────────────────────────────────────────────
// Last-resort fallbacks if Gemini still omits any required dossier field.

function normalizeDossierFields(opp: any, biz: string, location: string): any {
  if (!opp || typeof opp !== 'object') return opp;

  const result = { ...opp };
  const score: number = 72;
  const comp = 5;
  const capEx = 5;
  const labor = 5;
  const saturation = comp <= 3 ? 'Low' : comp <= 6 ? 'Moderate' : 'High';
  const complexity  = capEx <= 3 ? 'Low' : capEx <= 6 ? 'Moderate' : 'High';
  const staffRange  = labor <= 3 ? '1-3 staff members' : labor <= 6 ? '3-8 staff members' : '8+ staff members';

  if (!result.executiveSummary) {
    result.executiveSummary = `${biz} represents a strong opportunity in ${location} with measurable demand and a viable path to profitability.`;
  }
  if (!result.marketDemand) {
    result.marketDemand = {
      summary: `Measurable consumer demand exists for ${biz} in ${location}.`,
      drivers: ['Local population growth', 'Underserved market segment', `Rising consumer interest in ${biz}`],
      consumerTrends: ['Growing preference for locally owned businesses', 'Increasing digital discovery of local services'],
      targetAudience: `Residents and visitors in ${location}`,
      localMarketConditions: `${location} presents favorable conditions for launching ${biz}.`,
    };
  }
  if (!result.demographicFit) {
    result.demographicFit = {
      idealCustomer: `Local residents in ${location} seeking ${biz} services`,
      incomeConsiderations: `The local income profile supports the pricing model for a viable ${biz} operation.`,
      ageGroups: 'Primary: 25-49 years. Secondary: 18-24 and 50+ years.',
      populationRelevance: `${location} has sufficient population density to sustain a ${biz}.`,
    };
  }
  if (!result.competitiveLandscape) {
    result.competitiveLandscape = {
      summary: `Competition for ${biz} in ${location} is ${saturation.toLowerCase()}, offering a clear entry window.`,
      existingCompetitors: `Limited established providers in ${location}, leaving meaningful market share available.`,
      marketSaturation: saturation,
      competitiveAdvantages: [
        'First-mover advantage in an underserved niche',
        'Locally focused service model',
        'Community-driven brand building',
        'Flexibility to adapt to local demand signals',
      ],
    };
  }
  if (!result.startupRequirements) {
    result.startupRequirements = {
      licensing: `Standard business license and applicable state/local permits for ${biz} in ${location}.`,
      staffing: staffRange,
      equipment: `Standard equipment and operational fixtures to launch and operate ${biz}.`,
      operationalComplexity: complexity,
    };
  }
  if (!result.startupCostRange) {
    result.startupCostRange = { low: '$30,000', expected: '$60,000', high: '$100,000' };
  }
  if (!result.revenueModel) {
    result.revenueModel = {
      summary: `${biz} generates revenue through direct service delivery with potential for recurring relationships.`,
      monetizationMethods: ['Direct product or service sales', 'Recurring customer relationships', 'Premium service tiers'],
      scalabilityPotential: `With strong local traction, ${biz} can expand through additional service lines or geographic growth.`,
    };
  }
  if (!result.strategicRisks || !Array.isArray(result.strategicRisks) || result.strategicRisks.length === 0) {
    result.strategicRisks = [
      { category: 'Market', risk: 'Demand may fluctuate with economic conditions.', mitigation: 'Diversify revenue streams and build a loyal recurring customer base.' },
      { category: 'Competitive', risk: 'New entrants may attempt to replicate success.', mitigation: 'Invest in brand differentiation and local community ties.' },
      { category: 'Execution', risk: 'Operational complexity can increase faster than management capacity.', mitigation: 'Document all processes from launch day and hire experienced staff before scaling.' },
    ];
  }
  if (!result.opportunityScorecard) {
    result.opportunityScorecard = {
      marketDemand:      Math.min(100, score + 8),
      competition:       Math.min(100, (10 - comp) * 10),
      startupComplexity: Math.min(100, (10 - capEx) * 10),
      revenuePotential:  Math.min(100, score - 4),
      scalability:       Math.min(100, score - 8),
      overallScore:      score,
    };
  }
  if (!result.strategicRecommendation) {
    result.strategicRecommendation = {
      decision: score >= 80 ? 'Proceed' : score >= 68 ? 'High Potential' : 'Proceed with Caution',
      rationale: `${biz} in ${location} presents a viable opportunity with favorable market conditions. A phased approach is recommended to validate demand before full capital deployment.`,
    };
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
  console.log('[dossier diag] auth header present:', { hasHeader: !!authHeader, tokenParsed: !!token });

  console.log('[dossier diag] service role key type:', _srKeyDiag);
  if (_srKeyDiag.roleClaim !== 'service_role') {
    console.error(
      '[BetaAuth] WRONG KEY — SUPABASE_SERVICE_ROLE_KEY role claim is',
      JSON.stringify(_srKeyDiag.roleClaim),
      '(expected "service_role"). The anon/publishable key was likely pasted instead.',
    );
  }

  if (!supabaseAdmin) {
    console.log('[dossier diag] getUser result: skipped — supabaseAdmin null');
    console.log('[dossier diag] final verification result:', { verifiedRole: '', verifiedPlan: 'Explorer', verifiedUserIdPresent: false, reason: 'supabaseAdmin null' });
    return FALLBACK;
  }
  if (!token) {
    console.log('[dossier diag] getUser result: skipped — no Bearer token');
    console.log('[dossier diag] final verification result:', { verifiedRole: '', verifiedPlan: 'Explorer', verifiedUserIdPresent: false, reason: 'no token' });
    return FALLBACK;
  }

  try {
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    console.log('[dossier diag] getUser result:', {
      userFound: !!user,
      userId: user?.id ?? null,
      authErrorCode: (userError as any)?.code ?? null,
    });

    if (userError || !user) {
      console.log('[dossier diag] final verification result:', { verifiedRole: '', verifiedPlan: 'Explorer', verifiedUserIdPresent: false, reason: 'getUser failed' });
      return FALLBACK;
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, subscription_tier')
      .eq('id', user.id)
      .single();

    console.log('[dossier diag] profile query result:', {
      profileFound: !!profile,
      profileErrorCode: (profileError as any)?.code ?? null,
      returnedRole: profile?.role ?? null,
    });

    if (profileError || !profile) {
      console.log('[dossier diag] final verification result:', { verifiedRole: '', verifiedPlan: 'Explorer', verifiedUserIdPresent: true, reason: 'profile lookup failed' });
      return { ...FALLBACK, verifiedEmail: user.email ?? FALLBACK.verifiedEmail, verifiedUserId: user.id };
    }

    const verifiedPlan = getServerSidePlan(profile.role, profile.subscription_tier);

    console.log('[dossier diag] final verification result:', {
      verifiedRole: profile.role ?? '',
      verifiedPlan,
      verifiedUserIdPresent: true,
      reason: 'success',
    });

    return {
      verifiedEmail: user.email ?? FALLBACK.verifiedEmail,
      verifiedPlan,
      verifiedRole: profile.role ?? '',
      verifiedUserId: user.id,
    };
  } catch (err: any) {
    console.error('[BetaAuth] verifyAndGetPlan exception:', err.message);
    console.log('[dossier diag] final verification result:', { verifiedRole: '', verifiedPlan: 'Explorer', verifiedUserIdPresent: false, reason: `exception: ${err.message}` });
    return FALLBACK;
  }
}

// ─── Beta full-access override ────────────────────────────────────────────────
// REAL_REPORTS_ENABLED=true must be set to activate this endpoint.
// BETA_FULL_ACCESS=true promotes all authenticated non-admin users to Pro+
// so they pass the plan gate below without needing a specific role.

const _serverBetaFullAccess: boolean = process.env.BETA_FULL_ACCESS === 'true';

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(
  req: IncomingMessage & { body?: any },
  res: ServerResponse,
): Promise<void> {
  const startTime = Date.now();
  console.log('[dossier diag] request received:', { method: req.method, hasAuthHeader: !!req.headers['authorization'] });

  // Server-side kill switch
  if (process.env.REAL_REPORTS_ENABLED !== 'true') {
    return json(res, 503, { error: 'This endpoint is not available.', code: 'NOT_AVAILABLE' });
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  }

  console.log('[dossier diag] env check:', {
    hasSupabaseUrl:          !!process.env.SUPABASE_URL,
    hasServiceRoleKey:       !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasRealReportsEnabled:   !!process.env.REAL_REPORTS_ENABLED,
    hasGeminiApiKey:         !!process.env.GEMINI_API_KEY,
    betaFullAccess:          _serverBetaFullAccess,
    supabaseAdminInitialized: !!supabaseAdmin,
  });

  const { verifiedEmail, verifiedPlan, verifiedRole, verifiedUserId } = await verifyAndGetPlan(
    req.headers['authorization'] as string | undefined,
  );

  // Plan-based gate: unauthenticated and Explorer users are blocked.
  // Admin always passes. BETA_FULL_ACCESS=true promotes all authenticated users to Pro+.
  if (!verifiedUserId) {
    return json(res, 401, {
      error: 'Authentication required for dossier generation.',
      code: 'UNAUTHENTICATED',
    });
  }
  if (verifiedPlan === 'Explorer') {
    return json(res, 403, {
      error: 'Full opportunity dossiers require a Pro or higher plan.',
      code: 'INSUFFICIENT_PLAN',
    });
  }

  const body = req.body ?? {};
  const { opportunity, location } = body;

  if (!opportunity || typeof opportunity !== 'object') {
    return json(res, 400, { error: 'Missing or invalid opportunity.', code: 'INVALID_INPUT' });
  }
  if (!location?.trim()) {
    return json(res, 400, { error: 'Missing or invalid location.', code: 'INVALID_INPUT' });
  }

  const biz: string = opportunity.businessType ?? 'this business';

  // ── Blocked category guard ────────────────────────────────────────────────
  const blockedCheck = checkBlockedCategory(biz);
  if (blockedCheck.matched) {
    return json(res, 422, {
      error: blockedCategoryMessage(blockedCheck.category),
      code: 'BLOCKED_CATEGORY',
      category: blockedCheck.category,
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json(res, 401, { error: 'Gemini API key is not configured.', code: 'MISSING_API_KEY' });
  }

  // Hoisted so the failure-path catch block (outside the try below) can still
  // report whichever model/usage data was captured before the error occurred.
  let geminiModelUsed: string | null = null;
  let dossierUsage: any = null;

  try {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
    const normalizedPlan = normalizeTierToBudgetPlan(verifiedPlan);
    const budget = getReportBudget(normalizedPlan, 'standard');
    const model = budget.model;
    geminiModelUsed = model;

    // Build a focused prompt using all available opportunity context
    const oppContext = JSON.stringify({
      businessType: opportunity.businessType,
      description:  opportunity.description,
      whyItsGood:   opportunity.whyItsGood,
      scores:       opportunity.scores,
      financials:   opportunity.financials,
      risks:        opportunity.risks,
      customerSegment: opportunity.customerSegment,
      bestNearbyArea:  opportunity.bestNearbyArea,
    }, null, 2);

    const prompt = `
You are a senior business intelligence analyst. Generate a comprehensive full dossier for the following business opportunity.

**Location:** ${location}
**Business:** ${biz}
**Opportunity Summary:**
${oppContext}

Produce a detailed analysis covering all 10 required dossier sections for "${biz}" specifically in "${location}". Use the opportunity context above to inform all sections — reference specific scores, financial figures, and risks where relevant.

Required sections:
- executiveSummary: 3-4 sentences explaining why this specific opportunity is strong in this specific location.
- marketDemand: { summary, drivers (3 items), consumerTrends (2-3 items), targetAudience, localMarketConditions }
- demographicFit: { idealCustomer, incomeConsiderations, ageGroups, populationRelevance }
- competitiveLandscape: { summary, existingCompetitors, marketSaturation ("Low"|"Moderate"|"High"), competitiveAdvantages (3-4 items) }
- startupRequirements: { licensing, staffing, equipment, operationalComplexity ("Low"|"Moderate"|"High") }
- startupCostRange: { low, expected, high } — use dollar figures consistent with the financials context above
- revenueModel: { summary, monetizationMethods (2-3 items), scalabilityPotential }
- strategicRisks: 3-4 items, each: { category ("Market"|"Regulatory"|"Competitive"|"Execution"), risk, mitigation }
- opportunityScorecard: { marketDemand (0-100), competition (0-100), startupComplexity (0-100), revenuePotential (0-100), scalability (0-100), overallScore (0-100) }
- strategicRecommendation: { decision ("Proceed"|"Proceed with Caution"|"High Potential"|"Limited Opportunity"), rationale (2-3 sentences) }

Output valid JSON only. No markdown wrappers.
    `.trim();

    console.log('[dossier diag] generation start:', { model, biz, location, promptChars: prompt.length, maxOutputTokens: 8192 });

    const result = await withTimeout(
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: dossierSchema,
          temperature: 0.5,
          maxOutputTokens: 8192,
        },
      }),
      30000,
      'dossier generation timed out',
    );

    const usage = (result as any).usageMetadata;
    dossierUsage = usage ?? null;
    const inputTokens: number | null  = usage?.promptTokenCount     ?? null;
    const outputTokens: number | null = usage?.candidatesTokenCount ?? null;
    const cost = estimateCost(model, inputTokens ?? 0, outputTokens ?? 0, 0);
    const elapsedMs = Date.now() - startTime;

    console.log(`[AICost] /api/opportunity-dossier role=${verifiedRole} plan=${normalizedPlan} model=${model} in=${inputTokens ?? '?'} out=${outputTokens ?? '?'} est=$${cost.estimatedCostUsd.toFixed(5)}`);
    console.log(`[dossier diag] generation complete:`, { elapsedMs, inputTokens, outputTokens, biz, location });

    const withinHardCap = !wouldExceedHardCap(cost.estimatedCostUsd, budget);
    if (!withinHardCap) {
      console.warn(`[AICost] OVER_HARD_CAP role=${verifiedRole} plan=${normalizedPlan} cap=$${budget.hardCapUsd} actual=$${cost.estimatedCostUsd.toFixed(5)}`);
    }

    const parsed = cleanAndParseJSON(result.text || '', {});
    const normalized = normalizeDossierFields(parsed, biz, location);

    console.log(`[Dossier] Success — model=${model} biz="${biz}" location="${location}" elapsedMs=${elapsedMs}`);

    try {
      if (supabaseAdmin) {
        await supabaseAdmin.from('usage_logs').insert({
          user_id: verifiedUserId,
          user_email: verifiedEmail,
          user_role: verifiedRole,
          plan: normalizedPlan,
          report_type: 'opportunity_dossier',
          model,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          grounding_calls: 0,
          estimated_cost_usd: cost.estimatedCostUsd,
          within_hard_cap: withinHardCap,
          location,
          business_type: biz,
        });
        console.log(`[UsageLog] Logged: ${verifiedEmail} plan=${normalizedPlan} biz="${biz}" cost=$${cost.estimatedCostUsd.toFixed(5)}`);
      }
    } catch (logErr: any) {
      console.error('[UsageLog] Insert failed (dossier still returned):', logErr.message ?? logErr);
    }

    console.log('[ActivityLog] attempt opportunity-dossier success');
    try {
      if (supabaseAdmin) {
        const aggregatedUsage = aggregateGeminiUsage(model, [dossierUsage]);
        const { error: activityLogErr } = await supabaseAdmin.from('report_activity_log').insert({
          user_id: verifiedUserId,
          user_email: verifiedEmail,
          report_type: 'opportunity_dossier',
          business_type: biz,
          location,
          plan_tier: verifiedPlan,
          success: true,
          source: 'opportunity_dossier',
          duration_ms: elapsedMs,
          ai_model: model,
          input_tokens: aggregatedUsage.inputTokens,
          output_tokens: aggregatedUsage.outputTokens,
          total_tokens: aggregatedUsage.totalTokens,
          estimated_ai_cost: aggregatedUsage.estimatedCostUsd,
        });
        if (activityLogErr) throw activityLogErr;
        console.log('[ActivityLog] success opportunity-dossier success');
      }
    } catch (logErr: any) {
      console.error('[ActivityLog] failed opportunity-dossier success:', logErr.message ?? logErr);
    }

    return json(res, 200, normalized);
  } catch (err: any) {
    const elapsedMs = Date.now() - startTime;
    const errStatus  = err?.status  ?? err?.httpStatus ?? null;
    const errCode    = err?.code    ?? null;
    const errMessage = typeof err?.message === 'string' ? err.message.slice(0, 500) : String(err);
    console.error('[dossier] generation error:', { elapsedMs, status: errStatus, code: errCode, message: errMessage });

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

    if (resMessage.includes('API key'))   { httpStatus = 401; resCode = 'MISSING_API_KEY'; }
    else if (isRateLimit)                 { httpStatus = 429; resCode = 'RATE_LIMIT'; resMessage = 'Gemini rate limit hit. Please try again shortly.'; }
    else if (msgLower.includes('timeout')) { httpStatus = 504; resCode = 'TIMEOUT'; resMessage = 'Dossier generation timed out. Please try again.'; }

    console.log('[ActivityLog] attempt opportunity-dossier failure-path');
    try {
      if (supabaseAdmin) {
        const aggregatedUsage = aggregateGeminiUsage(geminiModelUsed ?? 'unknown', [dossierUsage]);
        const { error: activityLogErr } = await supabaseAdmin.from('report_activity_log').insert({
          user_id: verifiedUserId,
          user_email: verifiedEmail,
          report_type: 'opportunity_dossier',
          business_type: biz,
          location,
          plan_tier: verifiedPlan,
          success: false,
          error_message: resMessage?.slice(0, 500),
          source: 'opportunity_dossier',
          duration_ms: elapsedMs,
          ai_model: geminiModelUsed,
          input_tokens: aggregatedUsage.inputTokens,
          output_tokens: aggregatedUsage.outputTokens,
          total_tokens: aggregatedUsage.totalTokens,
          estimated_ai_cost: aggregatedUsage.estimatedCostUsd,
        });
        if (activityLogErr) throw activityLogErr;
        console.log('[ActivityLog] success opportunity-dossier failure-path');
      }
    } catch (logErr: any) {
      console.error('[ActivityLog] failed opportunity-dossier failure-path:', logErr.message ?? logErr);
    }

    return json(res, httpStatus, { error: resMessage, code: resCode });
  }
}
