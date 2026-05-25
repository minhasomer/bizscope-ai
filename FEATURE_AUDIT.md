# BizScope AI — Feature Truth Audit

**Date:** 2026-05-22  
**Scope:** Every feature advertised on the pricing page, all four plans  
**Method:** Source trace — pricing config → capability flags → UI rendering → service layer → server endpoints

---

## Summary Verdict

| Plan | Status |
|---|---|
| Explorer | Mostly accurate. One item misleading (Dashboard = mock seed, not real history) |
| Pro | Mostly accurate. Two items overstated ("dynamic charts" = 1 SVG chart; "interactive maps" = SVG dot-plot) |
| Pro+ | Mixed. Core regional AI works. "Advanced demographic overlays" is text data, not a visual overlay |
| Enterprise | **Critical gaps.** 5 of 7 advertised features are placeholders only |

**Immediate launch risk:** Enterprise features are almost entirely unimplemented. Selling at custom/enterprise pricing on these promises is misleading.

---

## Complete Feature Audit Table

| Feature | Advertised Tier | Actual Status | Evidence | Risk | Recommendation |
|---|---|---|---|---|---|
| 3 standard reports/month | Explorer | ✅ FULLY IMPLEMENTED | `PLAN_LIMITS.Explorer.standardReportsPerCycle=3`; client `UsageTrackerService` + server `checkServerLimit` both enforce | None | Keep as-is |
| Viability score & basic breakdowns | Explorer | ✅ FULLY IMPLEMENTED | `ScoreCircle` + `scoreBreakdown` rendered unconditionally in `ReportDisplay.tsx` | None | Keep as-is |
| Executive Summary | Explorer | ✅ FULLY IMPLEMENTED | `report.executiveSummary` rendered with no plan gate | None | Keep as-is |
| Basic startup cost range | Explorer | ✅ FULLY IMPLEMENTED | `financialProjections.startupCostRange` rendered at `ReportDisplay.tsx:831` BEFORE the Pro-locked section — Explorer sees it unblurred | None | Keep as-is |
| Basic market trends snapshot | Explorer | ✅ FULLY IMPLEMENTED | `marketTrends` section rendered outside any `LockedSection`; visible for all plans | None | Keep as-is |
| Limited competitor analysis (list) | Explorer | ✅ FULLY IMPLEMENTED | "Competitor Audit Ledger" list at `ReportDisplay.tsx:1024` is outside any `LockedSection` — all plans see the text list | None | Keep as-is |
| Dashboard & report history | Explorer | ⚠️ PARTIALLY IMPLEMENTED | Dashboard is accessible (`hasDashboardAccess=true`). BUT `canSaveReports=false` for Explorer — they cannot save reports. History is always the localStorage mock seed from `mockSavedReports.js`, never their own reports | Medium | Relabel to "Dashboard access (view-only)" or add in-app note that saving requires Pro |
| Full financials & dynamic charts | Pro | ⚠️ PARTIALLY IMPLEMENTED | Financial projections (revenue, break-even, margin, ROI) are real AI data. One SVG bezier revenue chart exists (`RevenueChart` component, `ReportDisplay.tsx:137`). No other charts. Year 1/3 data is estimated by the AI, not from real sources | Low | Relabel to "Full financials & revenue projections" — drop "dynamic charts" (implies richer chartset) |
| Actionable risk & mitigation guides | Pro | ✅ FULLY IMPLEMENTED | `riskAssessment.risks[]` with severity, impact, mitigation per risk; AI-generated per report | None | Keep as-is |
| Interactive competitor maps | Pro | ⚠️ PARTIALLY IMPLEMENTED | `CompetitorMap.tsx` renders an SVG dot-plot on a CSS grid background — NOT a real map service (no tiles, no zoom/pan). Hover labels only. Coordinates are AI-guessed; fallback "no coordinates" state appears when AI omits them | Medium | Relabel to "Competitor location map" — drop "interactive". Add tooltip: "Locations are AI-estimated" |
| Save reports to Venture Hub | Pro | ✅ FULLY IMPLEMENTED | `SavedReportsService` saves to localStorage; `canSaveReports` gate enforced at UI and service layer. Reports persist across sessions on the same device | Low (localStorage = device-only, not cloud) | Keep as-is for MVP. Add "device-stored" caveat in UX before cloud sync ships |
| Professional PDF exports | Pro | ✅ FULLY IMPLEMENTED | `pdfService.ts` uses jsPDF to produce a real multi-page PDF (cover, executive summary, demographics, financials, risks, competitors, regional intel). Gated by `canExportPdf`. Downloads as `.pdf` file | None | Keep as-is |
| Compare reports side-by-side | Pro | ✅ FULLY IMPLEMENTED | Full comparison modal in `SavedReports.tsx` — select 2 saved reports, shows viability score diff, winner badge, attribute comparison grid. Gated by `canCompareReports` | None | Keep as-is |
| Top 5 market opportunities | Pro | ✅ FULLY IMPLEMENTED | `OpportunityExplorer` component calls `/api/opportunities`. Explorer sees 2, Pro/Pro+/Enterprise see 5. Real Gemini call in live mode | None | Keep as-is |
| 50 standard reports/month | Pro+ | ✅ FULLY IMPLEMENTED | Both layers enforce; `PLAN_LIMITS['Pro+'].standardReportsPerCycle=50` | None | Keep as-is |
| 10 Regional Intelligence/month | Pro+ | ✅ FULLY IMPLEMENTED | `PLAN_LIMITS['Pro+'].regionalReportsPerCycle=10`; client and server both enforce; quota displayed in dashboard | None | Keep as-is |
| Regional Intelligence module | Pro+ | ✅ FULLY IMPLEMENTED | `/api/regional-analysis` calls Gemini Pro (higher-tier model); returns real `RegionalIntelligenceData`; auto-loads in `ReportDisplay.tsx` for Pro+; cached via `ReportCacheService` | None | Keep as-is |
| Nearby ZIP & county analysis | Pro+ | ⚠️ PARTIALLY IMPLEMENTED | Regional API returns `nearbyRegions[]` with ZIP or suburb data and `countyContext`. In live mode, Gemini generates real location-specific data. In demo mode, a hardcoded mock dataset of NYC/Irvine/generic ZIPs is used (`geminiService.ts:279–360`). No real Census or data-feed integration | Low | Keep as-is for MVP. Add "AI-estimated" disclosure |
| Regional expansion roadmap | Pro+ | ⚠️ PARTIALLY IMPLEMENTED | `expansionPotential` field contains a 3-phase textual timeline (Months 1-3, 4-6, 7-12). Rendered as a text block. No visual roadmap/timeline component | Low | Relabel to "Regional expansion strategy" — drop "roadmap" (implies visual/interactive) |
| Advanced demographic overlays | Pro+ | ⚠️ MISLEADING | "Overlays" strongly implies geographic heatmaps or choropleth overlays on a map. What exists: `demographicInsights` (text metric cards, same as Explorer) + income benchmarks in the regional nearby-regions table. No visual map overlay of any kind. Demographics are also visible to ALL plans, not Pro+ exclusive | High | Relabel to "Advanced demographic & market insights" — drop "overlays". Or separate Pro+ demographic data from Explorer's if distinction is desired |
| Dedicated specialist consulting | Pro+ | ✅ CORRECTLY EXCLUDED | Shows `included: false` on pricing card | None | Keep as-is |
| Negotiated usage (standard + regional) | Enterprise | ✅ FUNCTIONALLY CORRECT | `PLAN_LIMITS.Enterprise.*=null` (unlimited); server never blocks Enterprise tier. No billing-back mechanism exists yet (no metered billing API) | Low | Keep language — "negotiated" implies contract terms which is accurate |
| API programmatic integrations | Enterprise | ❌ NOT IMPLEMENTED | Server exposes `/api/analyze`, `/api/regional-analysis`, `/api/opportunities`, but: no API key authentication, no API key management UI, no developer documentation, no external auth tokens. Headers are honor-based (`x-plan-tier`). No programmable integration surface exists | **Critical** | Mark "Coming Soon" or remove from pricing card until API access is built |
| White-label (PDF branding) | Enterprise | ✅ PARTIALLY IMPLEMENTED | PDF export modal has white-label mode: custom advisory firm name, client name, remove watermark, accent color. Works end-to-end. Gated to Enterprise (`pdfService.ts:55`, `ReportDisplay.tsx:1587`) | None | Keep as-is |
| White-label (portal/dashboard) | Enterprise | ❌ NOT IMPLEMENTED | No custom-branded portal, no subdomain routing, no brand theming for the web app itself — only the PDF | High | Clarify in pricing: "White-label PDF exports" not "white-label platform" |
| Team seats | Enterprise | ❌ NOT IMPLEMENTED | No team management UI, no multi-user workspace, no invitation flow, no seat limits or tracking — anywhere in the codebase | **Critical** | Mark "Coming Soon" or remove from pricing card |
| Tailored consulting & direct access | Enterprise | ❌ NOT IMPLEMENTED | Enterprise CTA ("Contact Sales") navigates to the pricing page. No booking form, no dedicated support portal, no email routing, no Calendly integration | High | Acceptable as a sales-contact promise if copy reads "included in your contract" — add an email/Calendly link |
| Custom national market data feeds | Enterprise | ❌ NOT IMPLEMENTED | All data is Gemini AI-generated. No Census API, no market data provider (Nielsen, Dun & Bradstreet, etc.) integrations exist | **Critical** | Mark "Coming Soon" or remove — this is a substantial engineering effort |
| Dedicated customer success manager | Enterprise | ❌ NOT IMPLEMENTED | No CSM assignment, no support ticketing, no dedicated Slack channel, no email routing | High | Acceptable as a contractual promise. Reword: "Dedicated success support (arranged per contract)" |
| Custom SLA & secure data tunnels | Enterprise | ❌ NOT IMPLEMENTED | No SLA enforcement infrastructure, no dedicated compute, no VPN or data-tunnel integration | High | Acceptable as contractual. Reword: "SLA & security terms negotiated per contract" |

---

## Critical Findings

### 1 — Enterprise card is mostly vaporware for current MVP state

Of the 7 Enterprise features advertised:
- **3 work** (unlimited usage, PDF white-label, consulting/CSM/SLA as contract promises)
- **4 are fully unimplemented**: API access, team seats, custom data feeds, portal white-label

Selling Enterprise at custom pricing against these bullets creates legal and reputational risk if a prospect signs expecting these features to exist today.

**Recommended action:** Revise the Enterprise card to promise what contracts deliver (support, SLAs, unlimited usage) and move API access + team seats + custom data feeds to a "roadmap" section or "coming soon" badge.

### 2 — "Advanced demographic overlays" is the most misleading label on the pricing page

"Overlays" in a SaaS product implies geographic visualization (heatmaps, choropleth maps overlaid on a real map). What's implemented is a text table of AI-generated demographic metrics (median income, density, age brackets) — which is also visible to Explorer users with no plan gate. Pro+ gets additional income benchmarks in the regional table. No visual overlay exists.

**Recommended action:** Relabel to "Demographic & regional market insights."

### 3 — "Interactive competitor maps" overstates the implementation

The map is an SVG dot-plot on a CSS grid background, not a tile-based map. Hover labels exist but no zoom, pan, or click-through. Coordinates are AI-guessed and often absent (triggering a "coordinates unavailable" fallback). "Interactive" misleads users expecting Google Maps quality.

**Recommended action:** Relabel to "Competitor location map" and add an in-report note: "Approximate AI-estimated positions."

### 4 — Explorer "Dashboard & report history" misleads on first use

Explorer users reach the dashboard and see the mock-seeded reports from `mockSavedReports.js`. They cannot save their own reports (`canSaveReports=false`). The pricing card implies they'll accumulate a personal history. In practice the history never changes unless they upgrade.

**Recommended action:** Add a callout inside the Explorer dashboard view: "Save your reports by upgrading to Pro." Or explicitly label the pricing feature as "Dashboard access" without "report history."

---

## Demo Mode vs Live Mode Coverage

| Feature | Demo Mode | Live Mode |
|---|---|---|
| Standard reports | Mock AI response from `geminiService.ts` | Real Gemini Flash via `/api/analyze` |
| Regional intelligence | Hardcoded mock data (`generateMockRegionalData`) | Real Gemini Pro via `/api/regional-analysis` |
| Opportunity Explorer | Mock Gemini response from `geminiService.ts` | Real Gemini via `/api/opportunities` |
| PDF export | Real (uses jsPDF client-side, no server needed) | Real |
| Save/compare reports | Real (localStorage) | Real (localStorage) |
| Competitor map | Real SVG render (uses AI coords from mock data) | Real SVG render (uses AI coords from live data) |
| Stripe billing | No-op / mock | Real Stripe checkout + portal |
| Enterprise features | Showcase UI only | Same — not implemented |

---

## Recommended Pricing Copy Changes

| Current wording | Suggested wording | Reason |
|---|---|---|
| "Full financials & dynamic charts" (Pro) | "Full financial projections & charts" | Removes implication of a multi-chart dashboard |
| "Interactive competitor maps" (Pro) | "Competitor location map" | SVG dot-plot, not a tile-based interactive map |
| "Advanced demographic overlays" (Pro+) | "Demographic & regional market insights" | No visual overlay exists; misleading to map-overlay expectation |
| "Regional expansion roadmap" (Pro+) | "Regional expansion strategy" | Textual 3-phase plan, not a visual roadmap |
| "Dashboard & report history" (Explorer) | "Dashboard access" | Explorer has no real history (cannot save) |
| "API programmatic integrations" (Enterprise) | "API access (coming soon)" | Not implemented; critical gap |
| "White-label & team seats" (Enterprise) | "White-label PDF exports · Team seats coming soon" | White-label works for PDF; team seats = 0% |
| "Custom national market data feeds" (Enterprise) | "Custom data & integrations (per contract)" | AI-generated only; no feed integration exists |

---

## Build & Runtime Status

`npm run build` passes with 0 TypeScript errors.  
All gating functions (`canExportPdf`, `canSaveReports`, `canCompareReports`, `canViewFullFinancials`, `canViewRegionalIntelligence`) are correctly implemented and enforced in both UI and server layers.  
No features bypass plan gates in the current implementation.

---

*Initial audit produced 2026-05-22. Pricing Truth Alignment pass applied 2026-05-22 — see below.*

---

## Pricing Truth Alignment — Wording Changes Applied (2026-05-22)

### `src/config/plans.ts` — PRICING_CARDS

| Location | Old wording | New wording |
|---|---|---|
| Explorer feature | "Dashboard & report history" | "Dashboard access" |
| Explorer excluded | "Full financials & charts" | "Full financial projections" |
| Explorer excluded | "Interactive competitor maps" | "Competitor location map" |
| Pro feature (new) | *(not present)* | "All Explorer features included" |
| Pro feature | "Full financials & dynamic charts" | "Full financial projections & charts" |
| Pro feature | "Interactive competitor maps" | "Competitor location map" |
| Pro+ feature | "Regional expansion roadmap" | "Regional expansion strategy" |
| Pro+ feature | "Advanced demographic overlays" | "Demographic & regional intelligence" |
| Enterprise description | "Dedicated enterprise dashboards, API access, and custom datasets." | "Custom AI analysis at scale, with bespoke integrations and dedicated support." |
| Enterprise shortDescription | "Unlimited · API access · White-label" | "Negotiated usage · Custom integrations · Priority support" |
| Enterprise feature | "API programmatic integrations" | "API & integration access (early access)" |
| Enterprise feature | "White-label & team seats" | "White-label reports & team access" |
| Enterprise feature | "Tailored consulting & direct access" | "Tailored onboarding & consulting" |
| Enterprise feature | "Custom national market data feeds" | "Custom data & reporting (per contract)" |
| Enterprise feature | "Dedicated customer success manager" | "Dedicated success contact & support" |
| Enterprise feature | "Custom SLA & secure data tunnels" | "Custom SLA & compliance terms" |

### `src/config/plans.ts` — COMPARISON_TABLE_ROWS

| Old label | New label |
|---|---|
| "Full Financial Charts & Projections" | "Full Financial Projections & Analysis" |
| "Interactive Competitor Map" | "Competitor Location Map" |
| "Advanced Demographic Overlays" | "Demographic & Regional Intelligence" |
| "API Access & White-Label" | "Enterprise Integrations & White-Label" |
| "Dedicated Enterprise Support" | "Priority Support & Success" |

### `components/ReportDisplay.tsx`

| Location | Old wording | New wording |
|---|---|---|
| Section header (visible all plans) | "Dynamic competitor spatial hotspot map" | "Competitor location & market analysis" |
| Competition section subhead | "Interactive Saturation Plotting Zone" | "Competitor Density Analysis" |
| Competition section body | "Plotting physical locations...Switch to Pro to interact dynamically." | "Plotting estimated competitor positions...Upgrade to Pro to unlock the full map." |
| Map modal lock header | "Interactive Saturation Mapping Locked" | "Competitor Map — Upgrade to Pro" |
| Map modal lock body | references "floating switcher corner control" | neutral upgrade copy |
| Map modal upgrade button | "Upgrade Sandbox" | "View Plans" |
| Locked section CTA button | "Unlock Now in Sandbox" | "Upgrade to Unlock" |
| Regional quota exhausted body | "unlimited access" | "expanded regional access" |
| Regional quota exhausted button | "Upgrade to Enterprise for Unlimited Access" | "Upgrade to Enterprise for Expanded Access" |
| Upgrade gate modal (PDF) | "Hot-swap sandbox subscription in seconds to compile PDFs." | "PDF export is available on Pro and above. Upgrade your plan to download polished advisory reports." |
| Upgrade gate modal (save) | "requires a Pro upgrade parameter" | "requires a Pro plan or above" |
| Upgrade gate modal button | "Switch to Pro (Sandbox Upgrade)" | "Upgrade to Pro" |
| White-label locked description | "Upgrade sandbox status to Enterprise in the switcher" | "Upgrade to Enterprise to unlock white-label PDF exports" |
| Niche sentiment banner | "Premium Active Sandbox: Simulation online and visible because Pro properties are active." | "Pro Data Module Active" |

### `components/SavedReports.tsx`

| Location | Old wording | New wording |
|---|---|---|
| Floating compare tray label | "Comparative Workspace Sandbox" | "Compare Reports" |
| Compare upgrade modal demo tip | Always visible "Sandbox Demo Active" box | Now `isDemoMode`-gated — only shown in demo mode |

### `components/BillingPage.tsx`

| Location | Old wording | New wording |
|---|---|---|
| Enterprise CTA description | "Custom data feeds, SLAs, and dedicated support." | "Custom SLAs, integrations, and dedicated support." |

### `services/pdfService.ts`

| Location | Old wording | New wording |
|---|---|---|
| PDF financials locked section | References "sandbox tools" and "switch plan using sandbox" | Neutral: "Upgrade your subscription to include these sections in future exports." |
| PDF regional locked section | References "floating switcher corner control" | Neutral: "Upgrade your subscription to include regional data in future exports." |

---

## Remaining Implementation Gaps Still Visible in UI

| Feature advertised | Where visible | Gap |
|---|---|---|
| "API & integration access (early access)" | Enterprise pricing card | No API exists; "early access" label softens but doesn't eliminate the implication |
| "White-label reports & team access" | Enterprise pricing card | Team access has 0% implementation; white-label is PDF-only |
| "Custom data & reporting (per contract)" | Enterprise pricing card | All data is Gemini AI-generated; no data provider integrations |
| "Niche Buyer Sentiment Analysis" section | Report view (Pro+) | Hardcoded mock data (92/100, 14.8% YoY) presented as real intelligence to paying users — not flagged as estimated |
| "Competitor location map" | Pro report view | SVG dot-plot; coordinates are AI-estimated and often absent (fallback message shown) |
| "Demographic & regional intelligence" | Pro+ pricing card | AI-generated text data; no visual overlays or real data feeds |
| Dashboard access (Explorer) | Explorer dashboard | Shows mock-seeded reports only; Explorer cannot save real reports |

## Features Recommended to Hide Before Launch

| Feature | Reason |
|---|---|
| "API & integration access (early access)" | Implies a working API. No API exists. Consider removing from card until built. |
| "White-label reports & team access" | "Team access" = 0% implemented. Split into two bullets or remove team access until built. |
| Niche Buyer Sentiment section (in reports) | Shows hardcoded mock data to Pro paying users with no disclaimer. Remove or label as "Beta estimates". |
