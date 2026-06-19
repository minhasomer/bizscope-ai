/**
 * BizScope AI — AI Cost Budget Configuration
 * ═══════════════════════════════════════════
 *
 * Central source of truth for per-plan AI cost budgets, generation limits,
 * and Gemini model IDs.
 * Imported by server.ts to enforce maxOutputTokens, log actual costs, and
 * detect overruns before they become runaway charges.
 *
 * Plan mapping rules (normalizeTierToBudgetPlan — case-insensitive):
 *   admin / Admin / ADMIN           → Enterprise
 *   enterprise                      → Enterprise
 *   betatester / beta_tester / ...  → Pro+
 *   proplus / pro+                  → Pro+
 *   pro                             → Pro
 *   explorer / free / <anything>    → Explorer (safe default)
 *
 * IMPORTANT: Verify actual Gemini pricing before production at:
 *   https://ai.google.dev/gemini-api/docs/pricing
 * The constants below use conservative assumptions to avoid surprise overruns.
 */

// ─── Gemini model IDs ─────────────────────────────────────────────────────────
//
// Verified against @google/genai v1.52.0 / Gemini API v1beta.
// Migration history:
//   gemini-1.5-flash → removed from v1beta (NOT_FOUND)
//   gemini-2.0-flash → removed ("no longer available", NOT_FOUND)
//   gemini-2.5-flash → current stable Flash model; the @google/genai v1.52.0
//                      SDK README quickstart uses this exact ID.
//   gemini-2.5-pro   → current stable Pro model; unchanged.
//
// NOTE: "gemini-3.5-flash" does not exist in Google's model catalogue.
// Google's Flash naming follows 1.5 → 2.0 → 2.5 — there is no 3.x series.
//
// To list all available models for your API key:
//   GET https://generativelanguage.googleapis.com/v1beta/models?key=GEMINI_API_KEY
//
// To update: change GEMINI_MODELS below — AI_BUDGET, MODEL_PRICING, and
// server.ts all derive model IDs from this object automatically.

export const GEMINI_MODELS = {
  /** Flash-tier model — standard reports (fast, cost-efficient).
   *  Confirmed in @google/genai v1.52.0 SDK README quickstart. */
  standard: 'gemini-2.5-flash',
  /** Pro-tier model — Regional Intelligence reports (higher reasoning).
   *  Current stable Pro model; not deprecated as of v1.52.0. */
  regional: 'gemini-2.5-pro',
} as const;

// ─── Model pricing constants ──────────────────────────────────────────────────
// USD per 1,000 tokens — verify current rates at https://ai.google.dev/gemini-api/docs/pricing
// Keys are derived from GEMINI_MODELS so a model rename stays consistent.

export const MODEL_PRICING: Record<string, { inputPer1kTokens: number; outputPer1kTokens: number }> = {
  // gemini-2.5-flash (standard reports) — verified against
  // https://ai.google.dev/gemini-api/docs/pricing (paid tier, 2026-06).
  [GEMINI_MODELS.standard]: {
    inputPer1kTokens:  0.00030,  // $0.30 / 1M input tokens (text/image/video)
    outputPer1kTokens: 0.00250,  // $2.50 / 1M output tokens — thinking tokens are billed at this same output rate
  },
  // gemini-2.5-pro (regional reports) — ≤200k-token-context tier; verified
  // against https://ai.google.dev/gemini-api/docs/pricing (paid tier, 2026-06).
  [GEMINI_MODELS.regional]: {
    inputPer1kTokens:  0.00125,  // $1.25 / 1M input tokens
    outputPer1kTokens: 0.01000,  // $10.00 / 1M output tokens — thinking tokens are billed at this same output rate
  },
};

/**
 * Cost per grounding/search tool call. Verified against
 * https://ai.google.dev/gemini-api/docs/pricing (paid tier, 2026-06):
 * $35 per 1,000 grounded prompts = $0.035/call.
 */
export const GROUNDING_CALL_COST_USD = 0.035;

// ─── Budget shape ─────────────────────────────────────────────────────────────

export interface ReportBudget {
  /** Gemini model to use for this plan + report type. */
  model: string;
  /** Target cost per call (informational — logged but not blocked on). */
  targetCostUsd: number;
  /**
   * Hard cap in USD.
   * Non-null: reject the call if actual cost exceeds this value (logged as over-cap).
   * null: Enterprise monitored-only — usage is logged but never blocked.
   */
  hardCapUsd: number | null;
  /** Max input tokens per request (guides prompt sizing; not enforced in runtime yet). */
  maxInputTokens: number;
  /** Max output tokens applied to every live Gemini config — prevents unbounded generation. */
  maxOutputTokens: number;
  /** Max malformed-JSON retries. Each retry counts toward the same call's budget. */
  maxRetries: number;
  /**
   * Phase 2 synthesis timeout in milliseconds.
   * Higher tiers get more time — gemini-2.5-flash thinking latency scales with
   * prompt complexity. Enterprise/Admin gets 40 s to handle large grounding payloads.
   */
  synthesisTimeoutMs: number;
}

// ─── Per-plan budget table ────────────────────────────────────────────────────
// Key format: `${plan}:${reportType}` (e.g., 'Pro+:regional')
//
// hardCapUsd values below are INTERIM thresholds pending telemetry — anchored to
// the deterministic worst-case (maxOutputTokens ceilings + grounding + verified
// flash rates), not to observed cost. They are sized so OVER_HARD_CAP fires only
// on a genuine anomaly, never on a normal or retried report.
//
// TODO(cost-accounting): recalibrate hardCapUsd from usage_logs p90 after 1–2
// weeks of production traffic. Query:
//   select report_type,
//          percentile_cont(0.90) within group (order by estimated_cost_usd) as p90
//   from usage_logs where created_at > now() - interval '14 days' group by report_type;
// then set each cap to ~1.5× the observed p90 (or keep the worst-case anchor if higher).

export const AI_BUDGET: Record<string, ReportBudget> = {

  // ── Anonymous preview ─────────────────────────────────────────────────────
  // One free preview per browser (enforced client-side by UsageTrackerService).
  // Lower hard cap than Explorer:standard — anonymous calls are never retried.
  'Anonymous:preview': {
    model:                GEMINI_MODELS.standard,
    targetCostUsd:        0.004,
    hardCapUsd:           0.15,   // interim threshold pending telemetry — preview worst case ~$0.11 (see TODO above)
    maxInputTokens:       8_000,
    maxOutputTokens:      6144,
    maxRetries:           0,
    synthesisTimeoutMs:   25_000,
  },

  // ── Explorer standard ─────────────────────────────────────────────────────
  'Explorer:standard': {
    model:                GEMINI_MODELS.standard,
    targetCostUsd:        0.005,
    hardCapUsd:           0.25,   // interim threshold pending telemetry — Standard-with-retry worst ~$0.20; shared by Standard/MarketGap/Dossier (see TODO above)
    maxInputTokens:       8_000,
    maxOutputTokens:      8192,   // gemini-2.5-flash is a thinking model; tokens consumed by reasoning reduce visible output budget
    maxRetries:           1,
    synthesisTimeoutMs:   25_000,
  },

  // ── Pro standard ──────────────────────────────────────────────────────────
  'Pro:standard': {
    model:                GEMINI_MODELS.standard,
    targetCostUsd:        0.02,
    hardCapUsd:           0.25,   // interim threshold pending telemetry (see TODO above)
    maxInputTokens:       16_000,
    maxOutputTokens:      8192,   // gemini-2.5-flash thinking model — 4096 was insufficient for full ViabilityReport JSON
    maxRetries:           1,
    synthesisTimeoutMs:   30_000,
  },

  // ── Pro+ standard ─────────────────────────────────────────────────────────
  'Pro+:standard': {
    model:                GEMINI_MODELS.standard,
    targetCostUsd:        0.03,
    hardCapUsd:           0.25,   // interim threshold pending telemetry (see TODO above)
    maxInputTokens:       16_000,
    maxOutputTokens:      8192,   // synthesis uses thinkingBudget=0 — 8192 is sufficient for full ViabilityReport JSON
    maxRetries:           1,
    synthesisTimeoutMs:   35_000,
  },

  // ── Pro+ Regional Intelligence ────────────────────────────────────────────
  'Pro+:regional': {
    model:                GEMINI_MODELS.regional,
    targetCostUsd:        0.08,
    hardCapUsd:           0.15,
    maxInputTokens:       24_000,
    maxOutputTokens:      8192,
    maxRetries:           2,
    synthesisTimeoutMs:   35_000,
  },

  // ── Enterprise standard ───────────────────────────────────────────────────
  // No hard cap — AI cost is billed to the enterprise contract.
  'Enterprise:standard': {
    model:                GEMINI_MODELS.standard,
    targetCostUsd:        0.03,
    hardCapUsd:           null,
    maxInputTokens:       32_000,
    maxOutputTokens:      8192,
    maxRetries:           2,
    synthesisTimeoutMs:   40_000,
  },

  // ── Enterprise regional ───────────────────────────────────────────────────
  'Enterprise:regional': {
    model:                GEMINI_MODELS.regional,
    targetCostUsd:        0.10,
    hardCapUsd:           null,
    maxInputTokens:       32_000,
    maxOutputTokens:      8192,
    maxRetries:           2,
    synthesisTimeoutMs:   40_000,
  },
};

// ─── Tier normalization ───────────────────────────────────────────────────────

/**
 * Maps a raw tier string (request header, DB column, or body param) to the
 * canonical plan key used in AI_BUDGET and checkServerLimit.
 *
 * Case-insensitive. Handles all documented variants:
 *   admin / Admin / ADMIN                           → Enterprise
 *   enterprise                                      → Enterprise
 *   betatester / beta_tester / beta tester          → Pro+
 *   proplus / pro+                                  → Pro+
 *   pro                                             → Pro
 *   explorer / free                                 → Explorer
 *   null / empty / unknown                          → Explorer (safe default)
 */
export function normalizeTierToBudgetPlan(rawTier: string): string {
  const t = (rawTier ?? '').trim().toLowerCase();
  switch (t) {
    case 'admin':
    case 'enterprise':
      return 'Enterprise';
    case 'betatester':
    case 'beta_tester':
    case 'beta tester':
      return 'Pro+';
    case 'proplus':
    case 'pro+':
      return 'Pro+';
    case 'pro':
      return 'Pro';
    case 'explorer':
    case 'free':
      return 'Explorer';
    default:
      return 'Explorer';
  }
}

// ─── Budget lookup ────────────────────────────────────────────────────────────

/**
 * Returns the budget for the given plan and report type.
 * Falls back to 'Explorer:standard' if the key is not in the table
 * (should only happen in tests or unexpected plan strings).
 */
export function getReportBudget(plan: string, reportType: 'standard' | 'regional'): ReportBudget {
  return AI_BUDGET[`${plan}:${reportType}`] ?? AI_BUDGET['Explorer:standard'];
}

// ─── Cost estimation ──────────────────────────────────────────────────────────

export interface CostEstimate {
  estimatedCostUsd: number;
  inputTokens: number;
  /** Billed output tokens — candidatesTokenCount + thinkingTokens (Google bills thinking at the output rate). */
  outputTokens: number;
  groundingCalls: number;
}

/**
 * Estimates the USD cost of a single Gemini generation call.
 *
 * Rates verified against https://ai.google.dev/gemini-api/docs/pricing
 * (paid tier, 2026-06) — re-verify periodically, Google updates pricing
 * without notice.
 *
 * @param model          Gemini model ID (must match a key in MODEL_PRICING).
 * @param inputTokens    Input token count from usageMetadata.promptTokenCount.
 * @param outputTokens   Output token count from usageMetadata.candidatesTokenCount.
 * @param groundingCalls Number of grounding/search tool calls in this request.
 * @param thinkingTokens Thinking-token count from usageMetadata.thoughtsTokenCount.
 *                       Google bills these at the same rate as output tokens, so
 *                       they're folded into the returned `outputTokens` total.
 */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  groundingCalls = 0,
  thinkingTokens = 0,
): CostEstimate {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING[GEMINI_MODELS.standard];
  const billedOutputTokens = outputTokens + thinkingTokens;
  const estimatedCostUsd =
    (inputTokens        / 1000) * pricing.inputPer1kTokens  +
    (billedOutputTokens / 1000) * pricing.outputPer1kTokens +
    groundingCalls * GROUNDING_CALL_COST_USD;

  return { estimatedCostUsd, inputTokens, outputTokens: billedOutputTokens, groundingCalls };
}

/**
 * Returns true if the estimated cost would exceed the budget's hard cap.
 * Always returns false when hardCapUsd is null (Enterprise — monitored only).
 */
export function wouldExceedHardCap(estimatedCostUsd: number, budget: ReportBudget): boolean {
  if (budget.hardCapUsd === null) return false;
  return estimatedCostUsd > budget.hardCapUsd;
}

// ─── Multi-call usage aggregation ─────────────────────────────────────────────

export interface AggregatedUsage {
  inputTokens: number;
  /** Billed output tokens — candidatesTokenCount + thoughtsTokenCount summed across all calls. */
  outputTokens: number;
  /** Thinking-token subset of outputTokens — exposed for observability ([AICost] logs); not a separate cost line. */
  thinkingTokens: number;
  totalTokens: number;
  /** Grounding/search calls billed across the whole report. */
  groundingCalls: number;
  estimatedCostUsd: number;
}

interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  /** Thinking-token count — billed at the output rate. Present on thinking-model calls that don't disable thinkingBudget. */
  thoughtsTokenCount?: number;
}

/**
 * Sums promptTokenCount/candidatesTokenCount/thoughtsTokenCount/totalTokenCount
 * across multiple Gemini generateContent responses from the same report (e.g.
 * research + synthesis calls), and estimates the combined token cost.
 *
 * outputTokens in the returned AggregatedUsage is the *billed* output total —
 * candidatesTokenCount + thoughtsTokenCount — since Google bills thinking
 * tokens at the output rate (see estimateCost).
 *
 * Per call, totalTokenCount falls back to promptTokenCount + candidatesTokenCount
 * + thoughtsTokenCount if the SDK omitted it. Null/undefined entries (e.g. a
 * research phase that failed before producing a response) are skipped.
 *
 * This is the single authoritative report-cost calculator: every persisted
 * cost figure (usage_logs.estimated_cost_usd and
 * report_activity_log.estimated_ai_cost) must come from this one result so the
 * two tables reconcile. Pass EVERY billable call's usage — all grounded
 * research phases, the synthesis call, and any MAX_TOKENS retry attempt — plus
 * the count of grounded calls actually issued (each grounded prompt is billed
 * at GROUNDING_CALL_COST_USD regardless of token count).
 */
export function aggregateGeminiUsage(
  model: string,
  usages: Array<GeminiUsageMetadata | null | undefined>,
  groundingCalls = 0,
): AggregatedUsage {
  let inputTokens = 0;
  let outputTokens = 0;
  let thinkingTokens = 0;
  let totalTokens = 0;

  for (const usage of usages) {
    if (!usage) continue;
    const inTok = usage.promptTokenCount ?? 0;
    const candidateTok = usage.candidatesTokenCount ?? 0;
    const thinkingTok = usage.thoughtsTokenCount ?? 0;
    inputTokens += inTok;
    outputTokens += candidateTok + thinkingTok;
    thinkingTokens += thinkingTok;
    totalTokens += usage.totalTokenCount ?? (inTok + candidateTok + thinkingTok);
  }

  // outputTokens already folds in thinking, so pass thinkingTokens=0 here to
  // avoid double-counting; grounding is priced per call.
  const { estimatedCostUsd } = estimateCost(model, inputTokens, outputTokens, groundingCalls, 0);
  return { inputTokens, outputTokens, thinkingTokens, totalTokens, groundingCalls, estimatedCostUsd };
}
