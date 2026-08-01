/**
 * BizScope Assistant — Controlled Knowledge Base
 *
 * Single source of truth for what the chatbot knows about BizScope.
 * Loaded at cold-start by api/chat.ts and injected into the system prompt.
 * Server-only — this file must never be imported by client-side code.
 *
 * Maintenance guide:
 *   - Update CURRENT_FEATURES when a feature ships to all users.
 *   - Update PLANNED_FEATURES (or remove entries) as the roadmap changes.
 *   - Pricing/limits are derived from src/config/plans.ts — keep in sync.
 */

// ─── Product overview ─────────────────────────────────────────────────────────

export const PRODUCT_OVERVIEW = `
## What BizScope Is
BizScope AI is a US-focused market research tool that helps entrepreneurs, investors,
and operators evaluate business ideas before committing capital. It uses AI to analyze
market demand, competition, location data, demographics, and financials.

BizScope currently focuses exclusively on US-based business locations and opportunities.
Non-US locations are not supported at this time.

## Two Core Products

### 1. Business Viability Report
Analyzes a specific business idea at a specific US location. A report covers:
- Qualitative viability assessment (see Assessment Tiers below)
- Executive summary
- Financial projections: startup cost range, revenue Year 1 and Year 3, break-even time, profit margin
- Startup cost breakdown by category
- Competition analysis with nearby competitor locations
- Market trends and demand signals
- Demographic insights for the area
- Risk assessment with mitigation strategies
- Actionable next steps / recommended actions
- Grounding sources (web and map data)

### 2. Market Gap Discovery
Identifies potentially underserved business opportunities in a US city or region.
A Market Gap analysis covers:
- Up to 5 ranked business opportunities in the area
- For each opportunity: demand signals, competitive landscape, revenue model, rationale
- Optional: expanded dossier for a single opportunity (Pro and higher)
- Market Gap reports can be saved and compared (Pro and higher)

Regional Intelligence (Pro+ only) adds multi-ZIP, county-level, and expansion strategy analysis.
`.trim();

// ─── Assessment tiers ─────────────────────────────────────────────────────────

export const ASSESSMENT_TIERS = `
## Viability Assessment Tiers
BizScope uses qualitative tiers instead of public numeric scores:

| Assessment               | Meaning                                                        |
|--------------------------|----------------------------------------------------------------|
| Strong Opportunity       | High demand, low competition, favorable location factors       |
| Attractive Market        | Good fundamentals with manageable challenges                   |
| Worth Further Investigation | Viable with notable trade-offs that need closer review      |
| Proceed Carefully        | Significant headwinds; deep due diligence strongly advised     |
| Significant Concerns     | Multiple risk factors; proceed only with specialist knowledge  |
| Not Recommended          | Poor viability signal; risk of loss outweighs opportunity      |

Numeric scores are used internally to compute the tier but are not shown to users.
The assessment label is the authoritative BizScope verdict.

## Recommended Next-Step Language
Reports may include one of these recommendations:
- Proceed with validation
- Continue due diligence
- Do not proceed

## Important Limitation
BizScope assessments are AI-generated research tools intended to support decision-making,
not guarantees of business success. Users should conduct independent due diligence, consult
domain experts, and review local regulations before making any investment or business decision.
`.trim();

// ─── Plans and limits ─────────────────────────────────────────────────────────

export const PLANS_AND_LIMITS = `
## Plans and Report Limits

| Plan       | Standard Reports/Month | Regional Reports/Month | Price       |
|------------|------------------------|------------------------|-------------|
| Explorer   | 3                      | 0 (locked)             | Free        |
| Pro        | 20                     | 0 (locked)             | $29/month   |
| Pro+       | 50                     | 10                     | $59/month   |
| Enterprise | Unlimited              | Unlimited              | Custom      |

### What "Standard" means
A standard report is a full Business Viability Report generated for a specific business
type and US location. Preview reports (anonymous, one per visitor) are a limited subset
and do not count against a registered plan's quota.

### What "Regional" means
Regional Intelligence analyses (Pro+ only) cover multi-ZIP, county-level, and expansion
strategy data using a more powerful AI model. They use a separate monthly counter.

### Reset cycle
Standard and regional report counts reset at the start of each calendar month.
Enterprise users have no hard quota — usage is tracked and billed against their contract.

## Plan Capabilities

| Feature                    | Explorer | Pro | Pro+ | Enterprise |
|----------------------------|----------|-----|------|------------|
| Standard viability reports | 3/mo     | 20/mo | 50/mo | Unlimited |
| Executive summary          | ✓       | ✓   | ✓    | ✓          |
| Full financial projections | ✗       | ✓   | ✓    | ✓          |
| Competitor location map    | ✗       | ✓   | ✓    | ✓          |
| Save reports (Venture Hub) | ✗       | ✓   | ✓    | ✓          |
| PDF export                 | ✗       | ✓   | ✓    | ✓          |
| Compare reports            | ✗       | ✓   | ✓    | ✓          |
| Market Gap opportunities   | Top 2   | All 5 | All 5 + regional | All 5 + regional |
| Regional Intelligence      | ✗       | ✗   | 10/mo | Unlimited |
| Nearby ZIP & county analysis | ✗     | ✗   | ✓    | ✓          |

## Anonymous / Preview Access
Visitors who haven't signed in may generate one free preview report to see a limited
version of the report (executive summary and basic market info). Full sections are locked.
The preview count never resets — once used, the visitor must register.

For exact current pricing, users should visit the Pricing page.
`.trim();

// ─── Saved reports and caching ────────────────────────────────────────────────

export const SAVED_REPORTS = `
## Saved Reports (Venture Hub)
Pro and higher plans can save reports to the Venture Hub dashboard.
- Saved reports persist across sessions.
- Users can view all their saved reports on the Dashboard.
- Pro and higher can compare two saved reports side by side.
- Explorer users cannot save reports or access the Dashboard.

## Report Freshness and Caching
BizScope caches generated reports on the server.

When a recent saved analysis exists for the same business type and location:
- The user may be offered: "View latest saved analysis" or "Refresh with new market research."
- Choosing to view the cached version uses one report quota credit.
- Choosing to refresh generates a new report with current market data and uses one quota credit.

Reports older than 90 days are not served from cache — a fresh report is generated automatically.

## Report Comparison
Pro and higher users can compare two saved reports side by side to see how different
locations, business types, or time periods compare across key metrics.
`.trim();

// ─── Market Gap Discovery ─────────────────────────────────────────────────────

export const MARKET_GAP = `
## Market Gap Discovery
Market Gap Discovery identifies underserved business opportunities in a US city or region.

### What it finds
- Up to 5 ranked business opportunities
- Each with: local demand signals, competitive landscape, revenue model, strategic rationale
- Optional expanded dossier for a single opportunity (Pro and higher)

### Regional Intelligence (Pro+ only)
Adds deeper analysis:
- Multi-ZIP and county-level demand data
- Nearby area comparisons
- Regional expansion strategy
- Demographic and regional intelligence overlays

### Explorer limitation
Explorer users see only the top 2 opportunities from a Market Gap analysis (not all 5).
Pro and higher see all 5 plus the expanded dossier option.

### Saved Market Gap reports
Pro and higher users can save Market Gap results for later review and comparison.
`.trim();

// ─── Billing and subscriptions ────────────────────────────────────────────────

export const BILLING = `
## Billing and Subscriptions
BizScope uses Stripe for subscription billing. All payment processing is handled
securely by Stripe — BizScope never stores card details.

### Managing your subscription
- Upgrade, downgrade, or cancel via Settings > Billing or the Pricing page.
- After upgrading, the new plan's quota takes effect immediately.
- After canceling, the plan remains active until the end of the current billing period.
- Cancellation is processed via the Stripe customer portal.

### Pro 7-Day Free Trial (when available)
When the free trial offer is active, eligible Explorer users may start a 7-day Pro trial.
- Includes up to 5 Pro reports during the trial.
- A valid payment method is required when starting the trial.
- The trial is available once per account and once per payment method.
- After the trial, the subscription converts to the standard Pro monthly rate.
- Former paid subscribers and elevated-role accounts (Admin, BetaTester) are not eligible.

### Enterprise
Enterprise plans are custom-priced and contract-based. Contact sales via the Contact page.

For current pricing and plan details, visit the Pricing page or Settings > Billing.
`.trim();

// ─── Authentication and accounts ─────────────────────────────────────────────

export const AUTH_AND_ACCOUNTS = `
## Authentication
BizScope uses Supabase for authentication. Supported methods:
- Email and password
- Google OAuth (sign in with Google)

New accounts start on the Explorer (free) plan.

## Account Roles
Users may have one of these roles in addition to their subscription plan:
- Admin: Internal BizScope team with full access and developer tools.
- BetaTester: Beta program participants with elevated access during the beta phase.
- Explorer / Pro / ProPlus: Standard roles that mirror the subscription tier.

Beta program roles may grant access to features beyond the user's paid plan
while the beta is active. These role-based elevations are not a permanent subscription.

## Privacy and Data
BizScope handles user data according to its Privacy Policy. Key points:
- BizScope AI generates reports using the Google Gemini API. Report content is sent to Google.
- Users should not enter personal health, financial, or sensitive third-party information.
- Chat conversations with the BizScope Assistant may be processed by Google Gemini.
- Report data is stored in Supabase (US region) on behalf of the user.
- For full details, see the Privacy Policy (linked in the app footer).
`.trim();

// ─── Navigation and features ──────────────────────────────────────────────────

export const NAVIGATION = `
## Key Pages and Navigation

| Page         | What it does                                              |
|--------------|-----------------------------------------------------------|
| Home         | Run a Business Viability Report or anonymous preview      |
| Market Gap   | Run a Market Gap Discovery analysis                       |
| Dashboard    | View saved reports (Pro and higher)                       |
| Pricing      | Compare plans, upgrade, start trial (when available)      |
| Settings     | Account info, password, TOS acceptance                    |
| Billing      | Manage subscription, payment method, cancel               |
| Contact      | Send a message to the BizScope team                       |
| Privacy      | Privacy Policy                                            |
| Terms        | Terms of Service                                          |

## Restricted Business Categories
BizScope does not support analysis for businesses in these categories:
- Firearms and weapons
- Tobacco and nicotine products
- Vaping and e-cigarettes
- Alcohol (cannabis, spirits, etc.)
- Cannabis and THC products
- Adult entertainment
- Gambling
`.trim();

// ─── What BizScope cannot do ─────────────────────────────────────────────────

export const LIMITATIONS = `
## What BizScope Can and Cannot Do

### BizScope can:
- Analyze a business idea at a specific US location using AI
- Identify potentially underserved market opportunities in a US city
- Show competitor locations on a map (Pro and higher)
- Provide startup cost estimates, revenue projections, and break-even time frames
- Save and compare reports across sessions (Pro and higher)
- Export reports as PDF (Pro and higher)

### BizScope cannot:
- Guarantee business success or investment returns
- Provide legal, tax, or professional financial advice
- Support non-US locations (US-only at this time)
- Perform real-time transaction monitoring or live market feeds
- Access proprietary or paid data sources (uses publicly available signals)
- Make purchases, subscriptions, or bookings on behalf of users
- Delete or modify a user's saved reports through this assistant
- Access another user's account or report data

## The BizScope Assistant specifically cannot:
- Upgrade, downgrade, or cancel subscriptions
- Generate or refresh reports
- Add, delete, or modify saved reports
- Access report details beyond basic metadata
- View or change payment information
- Perform any account action — it is information-only
`.trim();

// ─── Assembled knowledge for the system prompt ────────────────────────────────

export function getBizScopeKnowledge(): string {
  return [
    PRODUCT_OVERVIEW,
    ASSESSMENT_TIERS,
    PLANS_AND_LIMITS,
    SAVED_REPORTS,
    MARKET_GAP,
    BILLING,
    AUTH_AND_ACCOUNTS,
    NAVIGATION,
    LIMITATIONS,
  ].join('\n\n---\n\n');
}
