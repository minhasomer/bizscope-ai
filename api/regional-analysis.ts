import type { IncomingMessage, ServerResponse } from 'http';
import { extractClientGeo } from '../server/activityGeo.js';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import {
  normalizeTierToBudgetPlan,
  getReportBudget,
} from '../src/config/aiBudget.js';
import { checkRegionalQuota, incrementUsageTracking } from '../src/config/usageTracking.js';
import { resolveSimulatedRequest, getSimRegionalQuota } from './_simAuth.js';

export const maxDuration = 90;

// ─── Response helper ──────────────────────────────────────────────────────────

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

// ─── Timeout helper ───────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, msg: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(msg)), ms);
    promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

// ─── JSON parsing ─────────────────────────────────────────────────────────────

function repairTruncatedJSON(s: string): string {
  const closes: string[] = [];
  let inString = false, escaped = false;
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
  let r = s.trimEnd().replace(/,\s*$/, '').replace(/:\s*$/, ': null');
  if (inString) r += '"';
  for (let i = closes.length - 1; i >= 0; i--) r += closes[i];
  return r;
}

function cleanAndParseJSON(text: string, fallback?: any): any {
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
  console.error('[regional-analysis][cleanAndParseJSON] all parse attempts failed, using fallback');
  if (fallback !== undefined) return fallback;
  throw new Error('malformed_response');
}

// ─── Supabase admin client ────────────────────────────────────────────────────

const supabaseAdmin = (() => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
})();

// ─── Beta full-access flag ────────────────────────────────────────────────────

const _serverBetaFullAccess: boolean = process.env.BETA_FULL_ACCESS === 'true';

// ─── Plan resolution ─────────────────────────────────────────────────────────

function getServerSidePlan(role: string, subscription_tier: string): string {
  const r = (role ?? '').trim().toLowerCase();
  if (r === 'admin') return 'Enterprise';
  if (_serverBetaFullAccess) return 'Pro+';
  if (r === 'betatester' || r === 'beta_tester' || r === 'beta_vip') return 'Pro+';
  return normalizeTierToBudgetPlan(subscription_tier);
}

// ─── Auth + plan resolution ───────────────────────────────────────────────────

async function verifyAndGetPlan(authHeader: string | undefined): Promise<{
  verifiedEmail: string;
  verifiedPlan: string;
  verifiedRole: string;
  verifiedUserId: string | null;
}> {
  const FALLBACK = { verifiedEmail: 'anonymous@bizscope.ai', verifiedPlan: 'Explorer', verifiedRole: '', verifiedUserId: null as string | null };
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!supabaseAdmin || !token) {
    console.log('[regional-analysis diag] auth skipped:', { supabaseAdminPresent: !!supabaseAdmin, tokenPresent: !!token });
    return FALLBACK;
  }
  try {
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return FALLBACK;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, subscription_tier')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return { ...FALLBACK, verifiedEmail: user.email ?? FALLBACK.verifiedEmail, verifiedUserId: user.id };
    }
    const verifiedPlan = getServerSidePlan(profile.role, profile.subscription_tier);
    return {
      verifiedEmail: user.email ?? FALLBACK.verifiedEmail,
      verifiedPlan,
      verifiedRole: profile.role ?? '',
      verifiedUserId: user.id,
    };
  } catch (err: any) {
    console.error('[regional-analysis][verifyAndGetPlan] exception:', err.message);
    return FALLBACK;
  }
}

// ─── Response schema ──────────────────────────────────────────────────────────

const regionalAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    isZipMode:                { type: Type.BOOLEAN },
    nearbyRegions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name:         { type: Type.STRING },
          demographics: { type: Type.STRING },
          competition:  { type: Type.STRING },
          opportunity:  { type: Type.STRING },
          details:      { type: Type.STRING },
        },
        required: ['name', 'demographics', 'competition', 'opportunity', 'details'],
      },
    },
    countyContext:             { type: Type.STRING },
    economicRadius:            { type: Type.STRING },
    competitiveSpillover:      { type: Type.STRING },
    expansionPotential:        { type: Type.STRING },
    regionalRecommendation:    { type: Type.STRING },
    specificObservationTitle:  { type: Type.STRING },
    specificObservationText:   { type: Type.STRING },
  },
  required: [
    'isZipMode', 'nearbyRegions', 'countyContext', 'economicRadius',
    'competitiveSpillover', 'expansionPotential', 'regionalRecommendation',
    'specificObservationTitle', 'specificObservationText',
  ],
};

// ─── Fallback response ────────────────────────────────────────────────────────

function getRegionalAnalysisFallback(businessType: string, location: string): any {
  const isZip = /\b\d{5}\b/.test(location);
  return {
    isZipMode: isZip,
    targetLocation: location,
    nearbyRegions: [
      {
        name:         isZip ? 'Sector A Gateway' : `${location} North`,
        demographics: 'High Density Area',
        competition:  'Moderate (3 present)',
        opportunity:  '85%',
        details:      'Strong adjacent commuter pathways. Solid potential for extension campaigns.',
      },
      {
        name:         isZip ? 'Sector B Suburban' : `${location} Heights`,
        demographics: 'Increasing Population Growth',
        competition:  'Low (0 competitors)',
        opportunity:  '91%',
        details:      'Substantially underserved in physical offerings. Excellent zone to lock early leases.',
      },
    ],
    countyContext:            'Sustained positive growth indicators. Housing indices suggest steady inflow of high-income households.',
    economicRadius:           'A 10-mile radius captures a commuter network of over 150,000 people daily.',
    competitiveSpillover:     'Underperforming standard chains in adjacent clusters indicate that high-quality services can capture market overflow immediately.',
    expansionPotential:       'Phase 1: Claim search listings and mobile maps. Phase 2: Form partnerships with local real estate complexes.',
    regionalRecommendation:   'Strongly recommended to proceed. Secure highly visible locations early within transit pathways.',
    specificObservationTitle: 'Regional Growth Factors',
    specificObservationText:  'Local traffic and development charts map continuous commercial real estate conversions, which will drive business-to-business and consumer opportunities.',
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(
  req: IncomingMessage & { body?: any },
  res: ServerResponse,
): Promise<void> {
  const geo = extractClientGeo(req);

  // Kill switch
  if (process.env.REAL_REPORTS_ENABLED !== 'true') {
    return json(res, 503, { error: 'This endpoint is not available.', code: 'NOT_AVAILABLE' });
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  }

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

  // Auth gate
  if (!verifiedUserId) {
    return json(res, 401, { error: 'Authentication required.', code: 'UNAUTHENTICATED' });
  }

  // Plan gate — Regional Intelligence is Pro+ and Enterprise only
  if (verifiedPlan !== 'Pro+' && verifiedPlan !== 'Enterprise') {
    console.warn(`[RegionalAnalysis] Rejected — plan="${verifiedPlan}" role="${verifiedRole}" betaFullAccess=${_serverBetaFullAccess}`);
    return json(res, 403, {
      error: 'Regional Intelligence requires a Pro+ or Enterprise plan.',
      code: 'INSUFFICIENT_PLAN',
    });
  }

  console.log(`[RegionalAnalysis] Auth — email=${verifiedEmail} plan=${verifiedPlan} betaFullAccess=${_serverBetaFullAccess}`);
  const requestStartMs = Date.now();

  const body = req.body ?? {};
  const { businessType, location } = body;

  if (!businessType || typeof businessType !== 'string' || !businessType.trim()) {
    return json(res, 400, { error: 'Missing or invalid businessType.', code: 'INVALID_INPUT' });
  }
  if (!location || typeof location !== 'string' || !location.trim()) {
    return json(res, 400, { error: 'Missing or invalid location.', code: 'INVALID_INPUT' });
  }

  // Quota check — after plan gate, before Gemini call
  const quota = _simAuth.simulationActive
    ? getSimRegionalQuota(_simAuth)
    : await checkRegionalQuota(supabaseAdmin, verifiedUserId, verifiedPlan as any, _serverBetaFullAccess);
  if (!quota.allowed) {
    console.warn(`[RegionalAnalysis] Quota exceeded — userId=${verifiedUserId} plan=${verifiedPlan} used=${quota.used} limit=${quota.limit}`);
    return json(res, 429, {
      error: 'Monthly regional report limit reached for your plan.',
      code: 'QUOTA_EXCEEDED',
      used: quota.used,
      limit: quota.limit,
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json(res, 503, { error: 'Gemini API key is not configured.', code: 'MISSING_API_KEY' });
  }

  const normalizedPlan = normalizeTierToBudgetPlan(verifiedPlan);
  const budget         = getReportBudget(normalizedPlan, 'regional');
  const isZip          = /\b\d{5}\b/.test(location.trim());

  const contentPrompt = `Act as a premier consulting analyst. Conduct a Regional Intelligence study for establishing a new '${businessType.trim()}' in regional context: '${location.trim()}'.

Generate a comprehensive analysis object matching the schema. Do not output any wrapping markdown.
${isZip
  ? 'Input is a ZIP code: Include county contexts, compute adjacent ZIPs opportunity values, and compile surrounding-market observations.'
  : 'Input is a City: Include county-level trends, compute surrounding suburbs metrics, and identify regional growth corridors.'
}`;

  const fallbackObj = getRegionalAnalysisFallback(businessType.trim(), location.trim());

  let generation: any = null;
  let incrementOk = false;

  try {
    const ai = new GoogleGenAI({ apiKey });

    generation = await withTimeout(
      ai.models.generateContent({
        model: budget.model,
        contents: contentPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: regionalAnalysisSchema,
          temperature: 0.5,
          maxOutputTokens: budget.maxOutputTokens,
        },
      }),
      55_000,
      'Regional analysis timed out',
    );

    const usage = (generation as any).usageMetadata;
    const costResult = {
      inputTokens:      usage?.promptTokenCount     ?? 0,
      outputTokens:     (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0),
      estimatedCostUsd: 0, // cost tracked via aiBudget in analyze.ts — not available here without import
    };
    console.log(`[AICost] /api/regional-analysis plan=${normalizedPlan} in=${costResult.inputTokens} out=${costResult.outputTokens} model=${budget.model} duration=${Date.now() - requestStartMs}ms`);

    const parsed = cleanAndParseJSON(generation.text || '', fallbackObj);
    parsed.targetLocation = location.trim();

    // Activity log (non-fatal)
    try {
      if (supabaseAdmin) {
        await supabaseAdmin.from('report_activity_log').insert({
          user_id:            verifiedUserId,
          user_email:         verifiedEmail,
          report_type:        'regional',
          business_type:      businessType.trim(),
          location:           location.trim(),
          plan_tier:          verifiedPlan,
          cache_status:       'miss',
          force_regenerate:   false,
          success:            true,
          source:             'regional_intelligence',
          duration_ms:        Date.now() - requestStartMs,
          ai_model:           budget.model,
          input_tokens:       costResult.inputTokens,
          output_tokens:      costResult.outputTokens,
          total_tokens:       costResult.inputTokens + costResult.outputTokens,
          estimated_ai_cost:  costResult.estimatedCostUsd,
          ...geo,
        });
      }
    } catch (logErr: any) {
      console.error('[RegionalAnalysis][ActivityLog] failed:', logErr.message ?? logErr);
    }

    // Increment usage — only after confirmed successful generation
    if (!_simAuth.simulationActive) {
      await incrementUsageTracking(supabaseAdmin, verifiedUserId, 'regional');
    }
    incrementOk = true;

    return json(res, 200, parsed);
  } catch (err: any) {
    const msg: string = err?.message ?? String(err);
    const isTimeout = /timed? ?out/i.test(msg) || msg === 'Request Timeout';

    // Activity log for failure (non-fatal)
    try {
      if (supabaseAdmin) {
        await supabaseAdmin.from('report_activity_log').insert({
          user_id:          verifiedUserId,
          user_email:       verifiedEmail,
          report_type:      'regional',
          business_type:    businessType.trim(),
          location:         location.trim(),
          plan_tier:        verifiedPlan,
          cache_status:     'miss',
          force_regenerate: false,
          success:          false,
          source:           'regional_intelligence',
          duration_ms:      Date.now() - requestStartMs,
          ai_model:         budget.model ?? null,
          input_tokens:     0,
          output_tokens:    0,
          total_tokens:     0,
          estimated_ai_cost: 0,
          metadata:         { error: msg.slice(0, 500) },
          ...geo,
        });
      }
    } catch (logErr: any) {
      console.error('[RegionalAnalysis][ActivityLog] failure log error:', logErr.message ?? logErr);
    }

    console.error('[RegionalAnalysis] generation failed:', { msg, isTimeout, incrementOk });

    if (isTimeout) {
      return json(res, 504, {
        error: 'Regional analysis timed out. Please try again — no report credit was used.',
        code: 'TIMEOUT',
      });
    }
    return json(res, 500, {
      error: 'Regional analysis failed. Please try again.',
      code: 'GENERATION_FAILED',
    });
  }
}
