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
  // gemini-2.5-flash (standard reports) — similar pricing to 2.0-flash
  [GEMINI_MODELS.standard]: {
    inputPer1kTokens:  0.00010,  // ~$0.10 / 1M input tokens (non-thinking)
    outputPer1kTokens: 0.00040,  // ~$0.40 / 1M output tokens (non-thinking)
  },
  // gemini-2.5-pro (regional reports)
  [GEMINI_MODELS.regional]: {
    inputPer1kTokens:  0.00125,  // ~$1.25 / 1M input tokens
    outputPer1kTokens: 0.01000,  // ~$10.00 / 1M output tokens
  },
};

/** Cost per grounding/search tool call — placeholder, verify before production. */
export const GROUNDING_CALL_COST_USD = 0.0035;

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

export const AI_BUDGET: Record<string, ReportBudget> = {

  // ── Explorer standard ─────────────────────────────────────────────────────
  'Explorer:standard': {
    model:                GEMINI_MODELS.standard,
    targetCostUsd:        0.005,
    hardCapUsd:           0.02,
    maxInputTokens:       8_000,
    maxOutputTokens:      8192,   // gemini-2.5-flash is a thinking model; tokens consumed by reasoning reduce visible output budget
    maxRetries:           1,
    synthesisTimeoutMs:   25_000,
  },

  // ── Pro standard ──────────────────────────────────────────────────────────
  'Pro:standard': {
    model:                GEMINI_MODELS.standard,
    targetCostUsd:        0.02,
    hardCapUsd:           0.05,
    maxInputTokens:       16_000,
    maxOutputTokens:      8192,   // gemini-2.5-flash thinking model — 4096 was insufficient for full ViabilityReport JSON
    maxRetries:           1,
    synthesisTimeoutMs:   30_000,
  },

  // ── Pro+ standard ─────────────────────────────────────────────────────────
  'Pro+:standard': {
    model:                GEMINI_MODELS.standard,
    targetCostUsd:        0.03,
    hardCapUsd:           0.05,
    maxInputTokens:       16_000,
    maxOutputTokens:      16384,  // gemini-2.5-flash thinking model — raised to prevent mid-JSON truncation
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
  outputTokens: number;
  groundingCalls: number;
}

/**
 * Estimates the USD cost of a single Gemini generation call.
 *
 * IMPORTANT: These rates are conservative placeholders.
 * Verify actual Gemini pricing before production:
 *   https://ai.google.dev/gemini-api/docs/pricing
 *
 * @param model          Gemini model ID (must match a key in MODEL_PRICING).
 * @param inputTokens    Input token count from usageMetadata.promptTokenCount.
 * @param outputTokens   Output token count from usageMetadata.candidatesTokenCount.
 * @param groundingCalls Number of grounding/search tool calls in this request.
 */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  groundingCalls = 0,
): CostEstimate {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING[GEMINI_MODELS.standard];
  const estimatedCostUsd =
    (inputTokens  / 1000) * pricing.inputPer1kTokens  +
    (outputTokens / 1000) * pricing.outputPer1kTokens +
    groundingCalls * GROUNDING_CALL_COST_USD;

  return { estimatedCostUsd, inputTokens, outputTokens, groundingCalls };
}

/**
 * Returns true if the estimated cost would exceed the budget's hard cap.
 * Always returns false when hardCapUsd is null (Enterprise — monitored only).
 */
export function wouldExceedHardCap(estimatedCostUsd: number, budget: ReportBudget): boolean {
  if (budget.hardCapUsd === null) return false;
  return estimatedCostUsd > budget.hardCapUsd;
}
