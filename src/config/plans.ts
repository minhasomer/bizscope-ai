/**
 * ─────────────────────────────────────────────────────────────────────────────
 * src/config/plans.ts — Centralised Plan & Access Configuration
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Single source of truth for every access-state and plan-related value:
 *   • Access states     (Anonymous visitor → registered Explorer → paid plans)
 *   • Report types      (preview / standard / regional)
 *   • Anonymous limits  (1 preview report, no auth required)
 *   • Usage limits      (standard & regional caps + reset cycles per plan)
 *   • Capability flags  (gating functions in planUtils.ts delegate here)
 *   • Pricing cards     (PricingTiers.tsx reads PRICING_CARDS)
 *   • Comparison table  (PricingTiers.tsx reads COMPARISON_TABLE_ROWS)
 *   • Short descriptions (DevAdminPanel, DemoPlanSwitcher)
 *
 * ── ACCESS STATE OVERVIEW ────────────────────────────────────────────────────
 *
 *  Anonymous Visitor (no auth)
 *    └─ 1 preview report total (persisted to localStorage, no reset)
 *    └─ Viability score, executive summary, basic market snapshot
 *    └─ All premium sections blurred / locked
 *    └─ Lead-gen: nudges to sign up
 *
 *  Explorer — Free Registered (Supabase auth required)
 *    └─ 3 limited standard reports / month
 *    └─ Dashboard access, saved report history
 *    └─ Limited competitor analysis, limited map previews
 *    └─ Premium sections (full financials, PDF, regional) locked
 *
 *  Pro ($29/month)
 *    └─ 20 full standard reports / month
 *    └─ Full financials, risk assessment, competitor maps
 *    └─ PDF export, saved reports, compare reports
 *
 *  Pro+ ($59/month)
 *    └─ 50 standard + 10 Regional Intelligence reports / month
 *    └─ Everything in Pro + nearby ZIP, county/regional analysis,
 *       expansion strategy, advanced demographic overlays
 *
 *  Enterprise (custom pricing)
 *    └─ Negotiated usage — AI cost billed against contract
 *    └─ API access, white-label, team seats
 *
 * ── AI COST REASONING & ARCHITECTURE ────────────────────────────────────────
 *
 *  Report types carry very different inference costs:
 *
 *  preview  (anonymous)  — subset of standard; truncated output, fewer sections.
 *                          Intended for Gemini Flash (lowest cost tier).
 *                          Target cost: ~$0.002–$0.004 / call.
 *                          1 total per anonymous visitor — lead-gen only.
 *
 *  standard (registered) — full viability report: score, financials, risks,
 *                          competitor analysis, market trends, demographics.
 *                          Intended for Gemini Flash (fast, cost-efficient).
 *                          Target cost: ~$0.004–$0.008 / call (8k–20k tokens).
 *                          Limits per plan keep gross margin positive:
 *                            Explorer  : 3/mo  → max ~$0.024/user/mo (free tier)
 *                            Pro       : 20/mo → max ~$0.16/user/mo  (inside $29)
 *                            Pro+      : 50/mo → max ~$0.40/user/mo  (inside $59)
 *
 *  regional (Pro+ only)  — Regional Intelligence: multi-ZIP, county context,
 *                          expansion strategy, demographic overlays.
 *                          Intended for Gemini Pro (higher reasoning required).
 *                          Target cost: ~$0.012–$0.020 / call (10k–20k tokens).
 *                          Quota-gated at 10/mo for Pro+ → max ~$0.20/user/mo.
 *
 *  Future architecture:
 *    - Standard reports  → Gemini Flash  (low latency, low cost)
 *    - Regional reports  → Gemini Pro    (higher reasoning, higher cost)
 *    If Gemini pricing changes, update PLAN_LIMITS here; all consumers adapt.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

// `import type` is erased at runtime — no circular dependency with planUtils.ts.
import type { SubscriptionPlan } from '../utils/planUtils';

// ─── Access states ─────────────────────────────────────────────────────────────

/**
 * The full set of access states in BizScope AI.
 *
 * 'Anonymous'      — visitor with no Supabase session. Gets 1 preview report.
 * SubscriptionPlan — registered user; plan drives feature access and quotas.
 *
 * Derive in the app:
 *   const accessState: AccessState = currentUser === null ? 'Anonymous' : currentPlan;
 */
export type AccessState = 'Anonymous' | SubscriptionPlan;

// ─── Report types ──────────────────────────────────────────────────────────────

/**
 * The three report types BizScope AI can generate, in ascending cost order.
 *
 *   preview  — anonymous lead-gen report (truncated sections, Gemini Flash)
 *   standard — full viability report for registered users (Gemini Flash)
 *   regional — Regional Intelligence analysis for Pro+ (Gemini Pro)
 */
export type ReportType = 'preview' | 'standard' | 'regional';

// ─── Anonymous limits ──────────────────────────────────────────────────────────

/**
 * Limits for the Anonymous access state (no Supabase session).
 *
 * One preview report total is enough to demonstrate value and convert
 * the visitor to a registered Explorer. The counter never resets — once
 * used, the anonymous visitor must register to generate more reports.
 * This keeps anonymous AI cost at absolute minimum (≈$0.002–$0.004/visitor).
 */
export const ANONYMOUS_LIMITS = {
  /** Total preview reports an anonymous visitor may generate (never resets). */
  previewReports: 1,
  /** Sections visible in a preview report (viability score, executive summary,
   *  basic market snapshot, limited competitor summary). All premium sections
   *  remain blurred — the same locked UI as Explorer but at report level. */
  visibleSections: ['viabilityScore', 'executiveSummary', 'basicMarket', 'limitedCompetitors'] as const,
} as const;

// ─── Plan usage limits ─────────────────────────────────────────────────────────

export interface PlanLimits {
  /**
   * Maximum standard (non-regional) reports per reset cycle.
   * null = unlimited (Enterprise negotiated contract).
   */
  standardReportsPerCycle: number | null;

  /**
   * How often the standard report counter resets.
   * 'none' = no reset needed (Enterprise unlimited — counter never blocks).
   */
  standardResetCycle: 'monthly' | 'none';

  /**
   * Maximum Regional Intelligence analyses per month.
   * null  = unlimited (Enterprise).
   * 0     = feature locked for this plan (Explorer, Pro).
   */
  regionalReportsPerCycle: number | null;

  /** How often the regional counter resets. */
  regionalResetCycle: 'monthly' | 'none';
}

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  // ── Explorer (Free Registered) ───────────────────────────────────────────────
  // 3 standard reports/month. No regional access.
  // At $0.008/report max cost is $0.024/user/month — free tier is sustainable.
  // Standard reports use Gemini Flash for lowest inference cost.
  Explorer: {
    standardReportsPerCycle: 3,
    standardResetCycle:      'monthly',
    regionalReportsPerCycle: 0,         // locked — Regional Intel is Pro+ only
    regionalResetCycle:      'none',
  },

  // ── Pro ($29/month) ──────────────────────────────────────────────────────────
  // 20 standard reports/month. No regional.
  // At $0.008/report max cost is $0.16/user/month — well inside $29 margin.
  // Standard reports use Gemini Flash.
  Pro: {
    standardReportsPerCycle: 20,
    standardResetCycle:      'monthly',
    regionalReportsPerCycle: 0,         // locked — Regional Intel is Pro+ only
    regionalResetCycle:      'none',
  },

  // ── Pro+ ($59/month) ─────────────────────────────────────────────────────────
  // 50 standard + 10 regional/month.
  // Standard (Flash):  50 × $0.008 = $0.40/user/month max
  // Regional (Pro):    10 × $0.020 = $0.20/user/month max
  // Total max AI cost: ~$0.60 — comfortably inside $59 margin.
  'Pro+': {
    standardReportsPerCycle: 50,
    standardResetCycle:      'monthly',
    regionalReportsPerCycle: 10,        // Regional Intelligence: Gemini Pro endpoint
    regionalResetCycle:      'monthly',
  },

  // ── Enterprise (custom pricing) ───────────────────────────────────────────────
  // Unlimited. AI usage is metered and billed back against the enterprise contract.
  // Both standard (Flash) and regional (Pro) quotas are uncapped.
  Enterprise: {
    standardReportsPerCycle: null,      // unlimited
    standardResetCycle:      'none',
    regionalReportsPerCycle: null,      // unlimited
    regionalResetCycle:      'none',
  },
};

// ─── Boolean capability flags ──────────────────────────────────────────────────

/**
 * Per-plan capability flags — the authoritative source.
 * planUtils.ts gating functions (canViewFullFinancials, canExportPdf, etc.)
 * delegate to this record so that adding or changing a plan only requires
 * an entry here.
 *
 * Note: Anonymous capability is handled separately via ANONYMOUS_LIMITS and
 * canGeneratePreviewReport() — anonymous is not a SubscriptionPlan.
 */
export interface PlanCapabilities {
  /** Full financial projections, charts, and cost breakdowns. */
  canViewFullFinancials: boolean;
  /** Regional Intelligence analyses, ZIP comparisons, expansion strategy. */
  canViewRegionalIntelligence: boolean;
  /** PDF dossier export. */
  canExportPdf: boolean;
  /** Save reports to Venture Hub (persistent saved-reports store). */
  canSaveReports: boolean;
  /** Side-by-side report comparison view. */
  canCompareReports: boolean;
  /**
   * Whether the plan can run standard (non-regional) reports.
   * True for all registered plans. Actual quota enforced by UsageTrackerService.
   * Anonymous visitors must use canGeneratePreviewReport() instead.
   */
  canGenerateStandardReport: boolean;
  /**
   * Whether the plan can run Regional Intelligence analyses.
   * False for Explorer and Pro — regional calls use Gemini Pro (higher cost).
   * Actual quota enforced by UsageTrackerService via PLAN_LIMITS.
   */
  canGenerateRegionalReport: boolean;
  /** Dashboard and saved report history access (registered users only). */
  hasDashboardAccess: boolean;
}

export const PLAN_CAPABILITIES: Record<SubscriptionPlan, PlanCapabilities> = {
  // ── Explorer (Free Registered) ───────────────────────────────────────────────
  Explorer: {
    canViewFullFinancials:       false,
    canViewRegionalIntelligence: false,
    canExportPdf:                false,
    canSaveReports:              false, // Explorer cannot save reports or access the Venture Hub dashboard
    canCompareReports:           false,
    canGenerateStandardReport:   true,  // limited to 3/mo by PLAN_LIMITS
    canGenerateRegionalReport:   false,
    hasDashboardAccess:          false, // dashboard is gated behind canSaveReports (Pro+)
  },
  // ── Pro ──────────────────────────────────────────────────────────────────────
  Pro: {
    canViewFullFinancials:       true,
    canViewRegionalIntelligence: false,
    canExportPdf:                true,
    canSaveReports:              true,
    canCompareReports:           true,
    canGenerateStandardReport:   true,  // limited to 20/mo by PLAN_LIMITS (Gemini Flash)
    canGenerateRegionalReport:   false, // Pro+ feature; Gemini Pro cost threshold
    hasDashboardAccess:          true,
  },
  // ── Pro+ ─────────────────────────────────────────────────────────────────────
  'Pro+': {
    canViewFullFinancials:       true,
    canViewRegionalIntelligence: true,
    canExportPdf:                true,
    canSaveReports:              true,
    canCompareReports:           true,
    canGenerateStandardReport:   true,  // limited to 50/mo by PLAN_LIMITS (Gemini Flash)
    canGenerateRegionalReport:   true,  // limited to 10/mo by PLAN_LIMITS (Gemini Pro)
    hasDashboardAccess:          true,
  },
  // ── Enterprise ───────────────────────────────────────────────────────────────
  Enterprise: {
    canViewFullFinancials:       true,
    canViewRegionalIntelligence: true,
    canExportPdf:                true,
    canSaveReports:              true,
    canCompareReports:           true,
    canGenerateStandardReport:   true,  // unlimited (Gemini Flash)
    canGenerateRegionalReport:   true,  // unlimited (Gemini Pro, billed to contract)
    hasDashboardAccess:          true,
  },
};

// ─── Pricing card configuration ───────────────────────────────────────────────

/**
 * Icon identifiers — React icon components are mapped in PricingTiers.tsx
 * so that this file stays free of React/JSX imports.
 */
export type PlanIconKey = 'shield' | 'zap' | 'sparkles' | 'building';

/** Color accent used for card borders, top bars, and badge colours. */
export type PlanAccent = 'blue' | 'purple' | null;

export interface PlanCardFeature {
  name: string;
  included: boolean;
}

export interface PricingCardConfig {
  id: SubscriptionPlan;
  name: string;
  /** Displayed price string, e.g. '$29' or 'Custom'. */
  price: string;
  /** Period suffix displayed after price, e.g. '/month'. Empty for Enterprise. */
  period: string;
  badge: string;
  /** Tagline shown below the plan name on the pricing card. */
  description: string;
  /**
   * One-line summary used by DevAdminPanel role buttons and DemoPlanSwitcher.
   * Keep under ~40 characters.
   */
  shortDescription: string;
  accent: PlanAccent;
  iconKey: PlanIconKey;
  /** Feature bullet list displayed on the pricing card. */
  features: PlanCardFeature[];
  /** CTA button label. */
  cta: string;
  /** Tailwind class string for the CTA button. */
  ctaClass: string;
}

export const PRICING_CARDS: PricingCardConfig[] = [
  {
    id:               'Explorer',
    name:             'Explorer',
    price:            '$0',
    period:           'forever',
    badge:            'Free',
    description:      'Sign up free. Get 3 reports/month to validate your idea.',
    shortDescription: 'Free · 3 reports/month',
    accent:           null,
    iconKey:          'shield',
    features: [
      { name: '3 standard reports/month',             included: true  },
      { name: 'Viability score & basic breakdowns',   included: true  },
      { name: 'Executive Summary',                    included: true  },
      { name: 'Basic startup cost range',             included: true  },
      { name: 'Basic market trends snapshot',         included: true  },
      { name: 'Limited competitor analysis',          included: true  },
      { name: 'Full financial projections',            included: false },
      { name: 'Competitor location map',             included: false },
      { name: 'Regional intelligence',                included: false },
      { name: 'PDF export & report saving',           included: false },
    ],
    cta:     'Sign Up Free',
    ctaClass: 'bg-white text-gray-800 border border-gray-200 hover:bg-gray-50 hover:border-gray-300',
  },
  {
    id:               'Pro',
    name:             'Pro',
    price:            '$29',
    period:           '/month',
    badge:            'Most Popular',
    description:      'For active founders researching concrete launch paths.',
    shortDescription: '20 reports/mo · PDF · Saved reports',
    accent:           'blue',
    iconKey:          'zap',
    features: [
      { name: '20 standard reports/month',            included: true  },
      { name: 'All Explorer features included',       included: true  },
      { name: 'Full financial projections & charts',  included: true  },
      { name: 'Actionable risk & mitigation guides',  included: true  },
      { name: 'Competitor location map',              included: true  },
      { name: 'Save reports to Venture Hub',          included: true  },
      { name: 'Professional PDF exports',             included: true  },
      { name: 'Compare reports side-by-side',         included: true  },
      { name: 'Top 5 market opportunities',           included: true  },
      { name: 'Regional intelligence modules',        included: false },
      { name: 'Nearby ZIP comparisons',               included: false },
      { name: 'Local expansion strategic plans',      included: false },
    ],
    cta:     'Upgrade to Pro',
    ctaClass: 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200',
  },
  {
    id:               'Pro+',
    name:             'Pro+',
    price:            '$59',
    period:           '/month',
    badge:            'Regional Intelligence',
    description:      'Ideal for multi-unit ventures & regional market analysis.',
    shortDescription: '50 reports/mo · 10 regional/mo',
    accent:           'purple',
    iconKey:          'sparkles',
    features: [
      { name: '50 standard reports/month',            included: true  },
      { name: '10 Regional Intelligence/month',       included: true  },
      { name: 'Everything in Pro',                    included: true  },
      { name: 'Regional Intelligence module',         included: true  },
      { name: 'Nearby ZIP & county analysis',         included: true  },
      { name: 'Regional expansion strategy',           included: true  },
      { name: 'Demographic & regional intelligence',  included: true  },
      { name: 'Dedicated specialist consulting',      included: false },
    ],
    cta:     'Upgrade to Pro+',
    ctaClass: 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg shadow-purple-200/60',
  },
  {
    id:               'Enterprise',
    name:             'Enterprise',
    price:            'Custom',
    period:           '',
    badge:            'Bespoke',
    description:      'Custom AI analysis at scale, with bespoke integrations and dedicated support.',
    shortDescription: 'Negotiated usage · Custom integrations · Priority support',
    accent:           null,
    iconKey:          'building',
    features: [
      { name: 'Negotiated usage (standard + regional)', included: true  },
      { name: 'Enterprise API access (available on request)',  included: true  },
      { name: 'White-label reporting & team features (on request)',       included: true  },
      { name: 'Tailored onboarding & consulting',        included: true  },
      { name: 'Custom data & reporting (per contract)',  included: true  },
      { name: 'Dedicated success contact & support',    included: true  },
      { name: 'Custom SLA & compliance terms',          included: true  },
    ],
    cta:     'Contact Sales',
    ctaClass: 'bg-gray-900 text-white hover:bg-black',
  },
];

// ─── Comparison table ─────────────────────────────────────────────────────────

export interface ComparisonTableRow {
  label: string;
  /**
   * One value per plan in column order: Explorer, Pro, Pro+, Enterprise.
   * boolean → rendered as ✓ / ✗ icon.
   * string  → rendered as-is (e.g. '3/mo', '20/mo').
   */
  values: [string | boolean, string | boolean, string | boolean, string | boolean];
}

/**
 * Full capability comparison table shown at the bottom of the pricing page.
 * Column order must match PRICING_CARDS: Explorer, Pro, Pro+, Enterprise.
 *
 * Standard and Regional Intelligence rows are deliberately separated so users
 * can see exactly which Gemini tier backs each report type.
 */
export const COMPARISON_TABLE_ROWS: ComparisonTableRow[] = [
  // ── Standard reports (Gemini Flash) ──────────────────────────────────────────
  {
    label:  'Standard Reports / Month',
    values: ['3/mo', '20/mo', '50/mo', 'Unlimited'],
  },
  {
    label:  'Viability Scores & Executive Summary',
    values: [true, true, true, true],
  },
  {
    label:  'Full Financial Projections & Analysis',
    values: [false, true, true, true],
  },
  {
    label:  'Competitor Location Map',
    values: [false, true, true, true],
  },
  {
    label:  'Save Reports & PDF Export',
    values: [false, true, true, true],
  },
  {
    label:  'Compare Reports Side-by-Side',
    values: [false, true, true, true],
  },
  {
    label:  'Market Gap Opportunities',
    values: ['Top 2', 'All 5', 'All 5 + regional', 'All 5 + regional'],
  },
  // ── Regional Intelligence (Gemini Pro) ───────────────────────────────────────
  {
    label:  'Regional Intelligence Reports / Month',
    // String values expose the actual quota instead of a bare ✓
    values: [false, false, '10/mo', 'Unlimited'],
  },
  {
    label:  'Nearby ZIP & County Analysis',
    values: [false, false, true, true],
  },
  {
    label:  'Regional Expansion Strategy',
    values: [false, false, true, true],
  },
  {
    label:  'Demographic & Regional Intelligence',
    values: [false, false, true, true],
  },
  // ── Enterprise-only ───────────────────────────────────────────────────────────
  {
    label:  'Enterprise Integrations & White-Label',
    values: [false, false, false, true],
  },
  {
    label:  'Priority Support & Success',
    values: [false, false, false, true],
  },
];

// ─── Helper functions ─────────────────────────────────────────────────────────

/**
 * Derives the full access state from the user's resolved plan.
 * Pass null for unauthenticated visitors to get 'Anonymous'.
 *
 * Usage:
 *   const accessState = getAccessState(currentUser === null ? null : currentPlan);
 */
export function getAccessState(plan: SubscriptionPlan | null): AccessState {
  return plan === null ? 'Anonymous' : plan;
}

/**
 * Returns the usage limits for a registered plan.
 * UsageTrackerService reads this instead of hardcoding per-plan numbers.
 */
export function getPlanLimits(plan: SubscriptionPlan): PlanLimits {
  return PLAN_LIMITS[plan];
}

/**
 * Returns the pricing card feature list for a given plan.
 * Useful for upgrade-nudge modals, account settings, onboarding flows.
 */
export function getPlanFeatures(plan: SubscriptionPlan): PlanCardFeature[] {
  return PRICING_CARDS.find(c => c.id === plan)?.features ?? [];
}

// ── Preview (anonymous) gating ───────────────────────────────────────────────

/**
 * Whether an anonymous visitor may still generate a preview report.
 *
 * Pass the count of previews already generated (from UsageTrackerService).
 * The limit (ANONYMOUS_LIMITS.previewReports = 1) never resets — once used,
 * the visitor must register to run more reports.
 *
 * Preview reports are a sub-set of standard reports, backed by Gemini Flash
 * with fewer output sections. They are the lowest-cost Gemini call (~$0.002).
 */
export function canGeneratePreviewReport(previewReportsUsed: number): boolean {
  return previewReportsUsed < ANONYMOUS_LIMITS.previewReports;
}

// ── Standard report gating ───────────────────────────────────────────────────

/**
 * Whether the plan is permitted to run standard (non-regional) reports.
 *
 * Always true for registered plans — every registered plan can run at least
 * one standard report per cycle. Actual quota is enforced separately by
 * UsageTrackerService. Anonymous visitors must use canGeneratePreviewReport().
 *
 * Standard reports target Gemini Flash (low latency, ~$0.004–$0.008/call).
 */
export function canGenerateStandardReport(plan: SubscriptionPlan): boolean {
  return PLAN_CAPABILITIES[plan].canGenerateStandardReport;
}

/**
 * Returns how many standard reports remain in the current cycle.
 * null = unlimited (Enterprise).
 *
 * Pass the `standardUsed` value from UsageTrackerService.getDetails().
 * This is a pure calculation — it does not read localStorage.
 */
export function getRemainingStandardReports(
  plan: SubscriptionPlan,
  used: number,
): number | null {
  const { standardReportsPerCycle } = PLAN_LIMITS[plan];
  if (standardReportsPerCycle === null) return null;
  return Math.max(0, standardReportsPerCycle - used);
}

// ── Regional Intelligence gating ─────────────────────────────────────────────

/**
 * Whether the plan is permitted to run Regional Intelligence analyses.
 *
 * Returns false for Explorer and Pro — regional analyses use Gemini Pro
 * (higher reasoning required for county-level economic correlation) and cost
 * ~$0.012–$0.020/call, which is only economically viable at Pro+ pricing.
 * Actual quota enforced separately by UsageTrackerService.
 */
export function canGenerateRegionalReport(plan: SubscriptionPlan): boolean {
  return PLAN_CAPABILITIES[plan].canGenerateRegionalReport;
}

/**
 * Returns how many Regional Intelligence analyses remain in the current month.
 * null = unlimited (Enterprise). 0 = feature locked (Explorer, Pro).
 *
 * Pass the `regionalUsed` value from UsageTrackerService.getDetails().
 * This is a pure calculation — it does not read localStorage.
 */
export function getRemainingRegionalReports(
  plan: SubscriptionPlan,
  used: number,
): number | null {
  const { regionalReportsPerCycle } = PLAN_LIMITS[plan];
  if (regionalReportsPerCycle === null) return null; // unlimited
  if (regionalReportsPerCycle === 0)    return 0;    // locked
  return Math.max(0, regionalReportsPerCycle - used);
}
