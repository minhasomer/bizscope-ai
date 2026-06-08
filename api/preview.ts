import type { IncomingMessage, ServerResponse } from 'http';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import {
  AI_BUDGET,
  estimateCost,
  wouldExceedHardCap,
} from '../src/config/aiBudget.js';
import { checkBlockedCategory, blockedCategoryMessage } from '../src/utils/blockedCategories.js';
import { detectFranchise } from '../src/utils/franchiseDetection.js';
import { validateUSLocation } from '../src/utils/locationValidation.js';

export const maxDuration = 60;

// ─── Response helper ──────────────────────────────────────────────────────────

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

// ─── Schema (same as api/analyze.ts — full schema for compelling preview) ────

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

/** Density-calibrated competitor count — mirrors analyze.ts logic. */
function competitorCountForCategory(businessType: string): { target: number; label: string } {
  const bt = businessType.toLowerCase();
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
  const sparse = [
    'rv repair', 'rv service', 'rv dealer', 'motorhome',
    'boat repair', 'marine', 'aircraft',
    'taxidermy', 'taxidermist',
    'specialty', 'niche', 'artisan', 'bespoke',
    'helicopter', 'skydiving', 'scuba',
    'exotic', 'vintage', 'antique dealer',
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

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(
  req: IncomingMessage & { body?: any },
  res: ServerResponse,
): Promise<void> {
  console.log('[preview] request received:', { method: req.method });

  // ── Kill switches ──────────────────────────────────────────────────────────
  // REAL_REPORTS_ENABLED must be true for any live Gemini calls.
  if (process.env.REAL_REPORTS_ENABLED !== 'true') {
    return json(res, 503, { error: 'This endpoint is not available.', code: 'NOT_AVAILABLE' });
  }
  // ANONYMOUS_PREVIEW_ENABLED can be set to 'false' to disable just anonymous access
  // without affecting authenticated endpoints. Defaults to enabled when absent.
  if (process.env.ANONYMOUS_PREVIEW_ENABLED === 'false') {
    return json(res, 503, { error: 'Anonymous preview is not available.', code: 'NOT_AVAILABLE' });
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  }

  const body = req.body ?? {};
  const { businessType, location, userLocation } = body;

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

  // ── Blocked category guard ─────────────────────────────────────────────────
  const blockedCheck = checkBlockedCategory(businessType);
  if (blockedCheck.matched) {
    return json(res, 422, {
      error: blockedCategoryMessage(blockedCheck.category),
      code: 'BLOCKED_CATEGORY',
      category: blockedCheck.category,
    });
  }

  // ── Global abuse guard ─────────────────────────────────────────────────────
  // Secondary protection: if > 200 anonymous previews have been generated in the
  // last hour globally, return 429. Primary protection is client-side
  // UsageTrackerService (1 per browser, never resets).
  if (supabaseAdmin) {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabaseAdmin
        .from('usage_logs')
        .select('id', { count: 'exact', head: true })
        .eq('report_type', 'preview')
        .gte('created_at', oneHourAgo);
      if (typeof count === 'number' && count >= 200) {
        console.warn('[preview] global rate limit exceeded:', { count });
        return json(res, 429, {
          error: 'Preview service is temporarily busy. Please try again later.',
          code: 'RATE_LIMIT',
        });
      }
    } catch (rateErr: any) {
      // Non-fatal — continue even if the rate-limit check fails
      console.warn('[preview] rate limit check failed (non-fatal):', rateErr.message);
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json(res, 401, { error: 'Gemini API key is not configured.', code: 'MISSING_API_KEY' });
  }

  const budget = AI_BUDGET['Anonymous:preview'];

  try {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
    const model = budget.model;
    console.log('[preview] model selected:', { model, maxOutputTokens: budget.maxOutputTokens });

    let sources: { title: string; uri: string }[] = [];
    let competitionInfo = 'No competitor data available.';
    let marketInfo = 'No trend data available.';

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

    // Phase 1: competitor lookup via Maps grounding
    const franchiseCheck = detectFranchise(businessType);
    const { target: competitorTarget } = competitorCountForCategory(businessType);
    const phase1Prompt = franchiseCheck.isFranchise
      ? `Search for two things near '${location}':
1. Any EXISTING '${businessType}' locations already operating in or within 20 miles of '${location}'. List each with its name and full street address. Label these clearly as "Existing ${businessType} location".
2. The top ${Math.max(competitorTarget - 3, 6)} other direct competitors (different brands) for a new '${businessType}' in '${location}'. For each, provide the business name and full street address.
Return all results combined, existing same-brand locations listed first. Include as many real, verified businesses as you can find — do not truncate the list.`
      : `List up to ${competitorTarget} real, currently operating direct competitors for a new '${businessType}' in or very near '${location}'. For each business provide: the real business name and full street address. Use Google Maps data to find actual businesses — do not use generic placeholder names. Include as many as are genuinely present; if fewer than ${competitorTarget} exist in the area, list all you can find.`;

    try {
      const mapsConfig: any = { tools: [{ googleMaps: {} }] };
      if (userLocation?.latitude && userLocation?.longitude) {
        mapsConfig.toolConfig = {
          retrievalConfig: { latLng: { latitude: userLocation.latitude, longitude: userLocation.longitude } },
        };
      }
      const mapsRes = await withTimeout(
        ai.models.generateContent({ model, contents: phase1Prompt, config: mapsConfig }),
        20000,
        'competitor research timed out',
      );
      competitionInfo = mapsRes.text || competitionInfo;
      sources.push(...getGroundingSources(mapsRes));
    } catch (err) {
      console.warn('[preview] phase 1 (Maps) failed:', geminiErrDiag(err));
    }

    // Phase 2: census + trends via Search grounding
    const phase2Prompt = `Find the latest US Census data for '${location}': specifically Total Population and Median Household Income. Also research market trends and financial benchmarks for opening a '${businessType}' in '${location}'.`;
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
    } catch (err) {
      console.warn('[preview] phase 2 (Search) failed:', geminiErrDiag(err));
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

    const synthesisMaxTokens = Math.min(budget.maxOutputTokens, 8192);
    const phase3StartMs = Date.now();

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
      budget.synthesisTimeoutMs,
      'synthesis timed out',
    );
    const phase3ElapsedMs = Date.now() - phase3StartMs;

    const usage = (synthesis as any).usageMetadata;
    const inputTokens: number | null = usage?.promptTokenCount ?? null;
    const outputTokens: number | null = usage?.candidatesTokenCount ?? null;
    const cost = estimateCost(model, inputTokens ?? 0, outputTokens ?? 0, 2);
    console.log(`[AICost] /api/preview model=${model} in=${inputTokens ?? '?'} out=${outputTokens ?? '?'} est=$${cost.estimatedCostUsd.toFixed(5)} phase3Ms=${phase3ElapsedMs}`);

    const withinHardCap = !wouldExceedHardCap(cost.estimatedCostUsd, budget);
    if (!withinHardCap) {
      console.warn(`[AICost] OVER_HARD_CAP /preview cap=$${budget.hardCapUsd} actual=$${cost.estimatedCostUsd.toFixed(5)}`);
    }

    const parsed = cleanAndParseJSON(synthesis.text || '');
    parsed.groundingSources = sources;
    parsed.isPreview = true;

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

    // Log to usage_logs for cost tracking (non-fatal if insert fails).
    try {
      if (supabaseAdmin) {
        await supabaseAdmin.from('usage_logs').insert({
          user_id: null,
          user_email: 'anonymous@bizscope.ai',
          user_role: 'anonymous',
          plan: 'Anonymous',
          report_type: 'preview',
          model,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          grounding_calls: 2,
          estimated_cost_usd: cost.estimatedCostUsd,
          within_hard_cap: withinHardCap,
          business_type: businessType,
          location,
        });
        console.log(`[UsageLog] /preview logged: cost=$${cost.estimatedCostUsd.toFixed(5)}`);
      }
    } catch (logErr: any) {
      console.error('[UsageLog] /preview insert failed (report still returned):', logErr.message ?? logErr);
    }

    return json(res, 200, parsed);
  } catch (err: any) {
    const errStatus  = err?.status  ?? err?.httpStatus ?? null;
    const errCode    = err?.code    ?? null;
    const errMessage = typeof err?.message === 'string' ? err.message.slice(0, 500) : String(err);
    const errDetails = Array.isArray(err?.errorDetails) ? err.errorDetails : null;
    console.error('[preview] phase 3 error:', { status: errStatus, code: errCode, message: errMessage, errorDetails: errDetails });

    let httpStatus = 502;
    let resCode = 'MODEL_ERROR';
    let resMessage = err.message || 'An unexpected error occurred.';

    const msgLower = errMessage.toLowerCase();
    const isRateLimit =
      errStatus === 429 || errCode === 429 ||
      msgLower.includes('429') || msgLower.includes('rate limit') ||
      msgLower.includes('resource_exhausted') || msgLower.includes('quota');

    if (resMessage.includes('API key'))    { httpStatus = 401; resCode = 'MISSING_API_KEY'; }
    else if (isRateLimit)                  { httpStatus = 429; resCode = 'RATE_LIMIT'; resMessage = 'Gemini rate limit hit. Please try again shortly.'; }
    else if (msgLower.includes('timeout')) { httpStatus = 504; resCode = 'TIMEOUT'; resMessage = 'Analysis timed out. Please try again.'; }
    else if (msgLower.includes('malformed_response')) {
      httpStatus = 502; resCode = 'MALFORMED_RESPONSE';
      console.error('[preview] Gemini returned unparseable JSON — no report generated.');
    }

    return json(res, httpStatus, { error: resMessage, code: resCode });
  }
}
