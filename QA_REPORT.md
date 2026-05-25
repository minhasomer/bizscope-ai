# BizScope AI — QA Report

---

## Full MVP QA Pass (Session 4 — 2026-05-22)

### Executive Summary

Completed a structured audit of all major subsystems against the confirmed plan rules:
- Explorer: 3 standard reports/month
- Pro: 20 standard reports/month
- Pro+: 50 standard reports/month + 10 regional/month
- Enterprise: unlimited
- BetaTester → Pro+, Admin → Enterprise, DB `ProPlus` → display `Pro+`

**Build status before patches:** ✅ 0 TypeScript errors (1 pre-existing chunk-size warning, ~1.29 MB)  
**Build status after patches:** ✅ 0 TypeScript errors

3 bugs patched. 4 gaps documented as not-in-scope for minimal-fix pass.

---

### Pass/Fail Matrix

| # | Area | Status | Notes |
|---|---|---|---|
| 1 | Plan limit consistency (UI / client / server) | ✅ PASS | All three layers agree after prior session fixes |
| 2 | Tier normalization (BetaTester, ProPlus, Admin) | ✅ PASS | `normalizeTierToBudgetPlan()` handles all variants |
| 3 | Modal / UI text matches canonical plan limits | ✅ FIXED | BUG-01: stale "1 per day" → "3/month" |
| 4 | Hardcoded developer credentials | ✅ FIXED | BUG-02: dev email replaced in both API fetch paths |
| 5 | Dashboard layout rendering | ✅ FIXED | BUG-03: stats grid was nested inside flex header |
| 6 | Auth flow (email/pw + Google OAuth + demo fallback) | ✅ PASS | No bugs found; 12s safety timeout in place |
| 7 | Demo vs live mode branching | ✅ PASS | `isDemoMode` from `appConfig.ts` is single source of truth |
| 8 | Stripe exposure (server-side only) | ✅ PASS | No `STRIPE_SECRET_KEY` references in frontend files |
| 9 | Gemini key exposure (server-side only) | ✅ PASS | `GEMINI_API_KEY` only in `server.ts`; no frontend leakage |
| 10 | SavedReports comparison variables | ✅ PASS | `reportA/B`, `scoreDiff`, winner flags confirmed scoped correctly |
| 11 | Anonymous preview quota integration | ⚠️ GAP | BUG-04: `canRunAnonymousPreview()` implemented but not wired into report flow |
| 12 | `hasDashboardAccess` flag usage | ⚠️ GAP | BUG-05: flag defined in `plans.ts` but never read anywhere in gating code |
| 13 | `onDeleteReport` prop in SavedReports | ⚠️ GAP | BUG-06: declared in interface, never used — component calls service directly |
| 14 | DevAdminPanel preview writes no real state | ✅ PASS | `previewRole` is local UI state only; `baseUserPlan` never mutated |
| 15 | ReportCacheService cache-hit skips quota | ✅ PASS | `loadedFromCache` guard confirmed in report flow |
| 16 | Server usage DB resets on restart (in-memory) | ⚠️ GAP | BUG-07: documented known limitation; TODO comments in server.ts |

---

### Bugs Found — Detail

#### BUG-01 — Stale limit modal text `[FIXED]`
- **File:** `App.tsx` (~line 748)
- **Severity:** Low (cosmetic / misleading copy)
- **Description:** Upgrade modal shown to Explorer users when quota exceeded read "Explorer/free accounts are restricted to **1 limited study per day**." The real limit is 3 standard reports/month.
- **Fix:** `"1 limited study per day"` → `"3 standard reports/month"`

#### BUG-02 — Hardcoded developer email in live API fetch paths `[FIXED]`
- **File:** `services/geminiService.ts` (~lines 185 and 390)
- **Severity:** Medium (PII exposure — real email sent as fallback identity in all unauthenticated live API calls)
- **Description:** Both `/api/analyze` and `/api/regional-analysis` fetch calls had `|| 'omerminhas@gmail.com'` as the fallback for `x-user-email` header and `userEmail` body field when `localStorage.getItem('bizscope_user_email')` is null.
- **Fix:** Replaced both occurrences with `'anonymous@bizscope.ai'`

#### BUG-03 — Dashboard stats grid rendered inside flex header div `[FIXED]`
- **File:** `App.tsx` (~lines 486–560)
- **Severity:** Medium (broken layout — 4 stat cards appear inline with the title/buttons row)
- **Description:** The `<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">` containing the 4 usage stat cards was nested inside the `flex flex-col sm:flex-row justify-between` header div instead of being a sibling element below it.
- **Fix:** Closed the flex header div before the grid; removed the now-orphaned extra `</div>` that was the old header close.

#### BUG-04 — Anonymous preview quota not wired into report flow `[GAP — not fixed]`
- **File:** `services/usageTrackerService.ts`, `App.tsx`
- **Severity:** Low (anonymous users consume Explorer 3/month quota instead of 1-lifetime preview)
- **Description:** `UsageTrackerService.canRunAnonymousPreview()` and `incrementAnonymousPreviewUsage()` are fully implemented under `bizscope_anonymous_preview_v1` localStorage key, but `handleAnalysisRequest` in App.tsx never calls them. Anonymous users are currently tracked under the standard Explorer quota instead of the dedicated preview limit.
- **Not fixed:** Wiring requires conditional branching in `handleAnalysisRequest` — out of scope for minimal-fix pass.

#### BUG-05 — `hasDashboardAccess` flag defined but never used `[GAP — not fixed]`
- **File:** `src/config/plans.ts`
- **Severity:** Low (dead config flag — no runtime bug)
- **Description:** `PLAN_CAPABILITIES.Explorer.hasDashboardAccess = true` is defined but no gating code reads it. Explorer dashboard access is currently controlled by `!canSaveReports(userPlan)` (which returns false for Explorer), meaning the flag and the gate are decoupled. May be intentional UX; leaving as-is.
- **Not fixed:** Requires understanding intended Explorer dashboard behavior before gating on this flag.

#### BUG-06 — `onDeleteReport` prop declared in SavedReports interface but unused `[GAP — not fixed]`
- **File:** `components/SavedReports.tsx`
- **Severity:** Very Low (dead interface member — no runtime bug)
- **Description:** `Props` interface declares `onDeleteReport?: (id: string) => void` but the component calls `SavedReportsService.deleteReport(id)` directly and never invokes the prop.
- **Not fixed:** Removing the prop could break callers; resolving requires checking all call sites. Not a runtime bug.

#### BUG-07 — Server usage DB is in-memory only `[GAP — pre-existing known limitation]`
- **File:** `server.ts`
- **Severity:** Medium (server restart resets all quota counters — limits don't survive restarts)
- **Description:** `serverUsageDb` Map in `server.ts` holds all per-user quota state in memory. A restart grants every user a fresh quota window regardless of actual usage that billing period.
- **Not fixed:** Requires Supabase persistence layer — out of scope. TODO comments already present in server.ts.

---

### Patches Applied This Session

#### Patch 1 — App.tsx stale modal text

```diff
- Explorer/free accounts are restricted to <strong>1 limited study per day</strong>.
+ Explorer accounts are limited to <strong>3 standard reports/month</strong>.
```

#### Patch 2 — geminiService.ts hardcoded email (2 occurrences)

```diff
# /api/analyze fetch (~line 185):
- 'x-user-email': localStorage.getItem('bizscope_user_email') || 'omerminhas@gmail.com'
+ 'x-user-email': localStorage.getItem('bizscope_user_email') || 'anonymous@bizscope.ai'
- userEmail: localStorage.getItem('bizscope_user_email') || 'omerminhas@gmail.com'
+ userEmail: localStorage.getItem('bizscope_user_email') || 'anonymous@bizscope.ai'

# /api/regional-analysis fetch (~line 390):
- 'x-user-email': localStorage.getItem('bizscope_user_email') || 'omerminhas@gmail.com'
+ 'x-user-email': localStorage.getItem('bizscope_user_email') || 'anonymous@bizscope.ai'
- userEmail: localStorage.getItem('bizscope_user_email') || 'omerminhas@gmail.com'
+ userEmail: localStorage.getItem('bizscope_user_email') || 'anonymous@bizscope.ai'
```

#### Patch 3 — App.tsx dashboard layout

```diff
- <div className="mb-10 text-center sm:text-left flex flex-col sm:flex-row justify-between items-center gap-4">
-   <div>{/* title */}</div>
-   <div className="flex gap-3">{/* buttons */}</div>
-   {/* grid was INCORRECTLY inside the flex header */}
-   <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
-     {/* 4 stats cards */}
-   </div>
- </div>

+ <div className="mb-6 text-center sm:text-left flex flex-col sm:flex-row justify-between items-center gap-4">
+   <div>{/* title */}</div>
+   <div className="flex gap-3">{/* buttons */}</div>
+ </div>
+ <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
+   {/* 4 stats cards — now a sibling of the header, not a child */}
+ </div>
```

---

### Security Checklist

| Check | Result |
|---|---|
| `STRIPE_SECRET_KEY` not referenced in any frontend file | ✅ Confirmed |
| `GEMINI_API_KEY` not referenced in any frontend file | ✅ Confirmed |
| `VITE_SUPABASE_ANON_KEY` — safe to expose (publishable key) | ✅ Confirmed |
| No hardcoded real user credentials in frontend | ✅ Fixed (Patch 2) |
| Supabase RLS: users can't update their own `role` or `subscription_tier` | ✅ Pre-existing WITH CHECK policy |
| `signInAsDemo()` throws if Supabase is active | ✅ Confirmed |
| Mock sessions stored in `sessionStorage`, not `localStorage` | ✅ Confirmed (no ghost sessions) |

---

### Demo vs Live Mode Branch Coverage

| Behavior | Demo mode (`VITE_DEMO_MODE=true`) | Live mode |
|---|---|---|
| AI reports | Mock JSON from `geminiService.ts` | Real Gemini API via `/api/analyze` |
| Regional reports | Mock data | Real Gemini API via `/api/regional-analysis` |
| Stripe checkout | No-op / mock | Real Stripe checkout session |
| Supabase auth | Real if env vars present | Real |
| Google OAuth | Real (always) | Real |
| Usage quota tracking | Client-side `usageTrackerService.ts` | Client + server `checkServerLimit` |
| DevAdminPanel visible | Always (all users) | Admin role only |
| Demo Mode banner | Shown | Hidden |

---

### Remaining Known Gaps

| Gap | Severity | Status |
|---|---|---|
| Anonymous preview quota not wired into report flow (BUG-04) | Low | Open — needs conditional in `handleAnalysisRequest` |
| `hasDashboardAccess` flag never read by gating code (BUG-05) | Low | Open — clarify intended Explorer dashboard behavior |
| `onDeleteReport` prop dead in `SavedReports.tsx` (BUG-06) | Very Low | Open — not a runtime bug |
| Server usage DB resets on restart (BUG-07) | Medium | Open — needs Supabase persistence layer |
| `hardCapUsd` computed but not used to pre-block calls | Low | Open — requires token pre-estimation |
| Gemini model IDs need live verification via models list endpoint | Medium | Open — set to `gemini-1.5-flash`/`gemini-1.5-pro`; verify before production |
| MODEL_PRICING constants are conservative estimates | Medium | Open — verify at ai.google.dev/gemini-api/docs/pricing |
| No IP-rate-limiting for anonymous preview reports | Low | Open — add before public launch |

---

### Manual Verification Checklist

#### Post-patch smoke tests

- [ ] Run `npm run dev`; open Dashboard; confirm 4 stat cards render in a 2×2 grid below the title row (not inline with it)
- [ ] As Explorer user: run 3 reports; attempt 4th; confirm modal reads "3 standard reports/month" (not "1 per day")
- [ ] As Explorer user: confirm upgrade modal does NOT contain "omerminhas@gmail.com" anywhere
- [ ] Open browser DevTools Network tab; trigger a live report; confirm `x-user-email` header is NOT `omerminhas@gmail.com` when not logged in

#### Quota enforcement

| Test | Setup | Expected |
|---|---|---|
| Explorer month limit | 4 POST `/api/analyze` with `x-plan-tier: Explorer` | 4th → 429 "monthly limit of 3 standard reports" |
| Pro month limit | 21 requests with `x-plan-tier: Pro` | 21st → 429 |
| Pro+ standard limit | 51 requests with `x-plan-tier: Pro+` | 51st → 429 "monthly limit of 50 standard reports" |
| Pro+ regional limit | 11 requests with `x-plan-tier: Pro+` to `/api/regional-analysis` | 11th → 429 |
| Enterprise unlimited | Any count with `x-plan-tier: Enterprise` | Never 429 |
| BetaTester = Pro+ | `x-plan-tier: BetaTester` | Treated as Pro+: limit 50 |
| Admin = Enterprise | `x-plan-tier: Admin` on `/api/regional-analysis` | Treated as Enterprise: unlimited |
| ProPlus = Pro+ | `x-plan-tier: ProPlus` | Same as Pro+ |

#### UI pricing display

| Page | Check |
|---|---|
| Pricing page | Explorer card: "3 standard reports/month" |
| Pricing page | Pro card: "20 standard reports/month" |
| Pricing page | Pro+ card: "50 standard reports/month" + "10 Regional Intelligence/month" |
| Pricing page | Comparison table rows match above numbers |
| Hero / Account Settings | Usage meter shows correct limit for current plan |

---

## Prior Session Fixes (Sessions 1–3)

### Session 3 — Model ID centralization + case-insensitive normalization

**Model IDs centralized (`aiBudget.ts`):**
- `GEMINI_MODELS.standard = 'gemini-1.5-flash'` / `GEMINI_MODELS.regional = 'gemini-1.5-pro'`
- `MODEL_PRICING` and all `AI_BUDGET.model` fields use `GEMINI_MODELS` computed properties
- `server.ts` `/api/analyze` and `/api/opportunities` `cheaperModel` set from `GEMINI_MODELS.standard`

**`normalizeTierToBudgetPlan` made case-insensitive:**
- Lowercases input before matching; added `beta_tester`, `beta tester`, `free` variants

### Session 2 — `checkServerLimit` quota numbers

- Explorer: 1/day (24h reset) → 3/month (30-day reset)
- Pro+: 20/month shared with Pro → 50/month own branch
- Normalization: manual if-chain → `normalizeTierToBudgetPlan()`
- Error messages updated to remove "daily", show correct counts

### Session 1 — AI cost budget system

- `src/config/aiBudget.ts` created: `AI_BUDGET`, `MODEL_PRICING`, `normalizeTierToBudgetPlan()`, `getReportBudget()`, `estimateCost()`, `wouldExceedHardCap()`
- All 3 Gemini endpoints now set `maxOutputTokens` from budget (never unbounded)
- `[AICost]` log line per live call with token counts and estimated USD

---

*Build status: `npm run build` passes with 0 new errors as of this report (2026-05-22).*
