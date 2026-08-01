# Developer Runbook

Practical reference for any developer working on the BizScope AI codebase. Covers local setup, architecture quick-map, common change guides, and known quirks.

---

## Local Development Setup

### Prerequisites

- Node.js LTS (check `package.json` for any engine constraint)
- npm (bundled with Node)
- A Supabase project (staging project credentials)
- A Stripe test-mode account
- A Google AI Studio API key
- Git access to `minhasomer/bizscope-ai`

### Steps

```bash
git clone https://github.com/minhasomer/bizscope-ai.git
cd bizscope-ai
npm install
```

Copy `.env.example` to `.env.local` and fill in all variables:

```bash
cp .env.example .env.local
# Edit .env.local — use STAGING credentials only (never production keys locally)
```

Missing variables that are NOT in `.env.example`:
- `RESEND_API_KEY` — required for contact form (found in `api/contact.ts`; leave blank to disable email locally)
- `CONTACT_TO_EMAIL` — inbox for contact form submissions

Start the Vite dev server:

```bash
npm run dev
```

Vercel serverless functions (`api/*.ts`) are only available via `vercel dev`, not via `npm run dev`. For local API testing:

```bash
npx vercel dev
```

`vercel dev` requires the Vercel CLI and being linked to the project (`vercel link`). If you don't have Vercel access, you can mock API responses directly in the client code for development.

### Running Tests

```bash
npm test
# Expands to: tsx tests/audit-regression.test.ts
```

Tests run without a live Supabase or Stripe connection — they import source modules directly and assert on logic and structure. No network calls.

There is also `tests/analytics.test.ts` — run it separately:

```bash
npx tsx tests/analytics.test.ts
```

### TypeScript Check

```bash
npx tsc --noEmit
```

There are known pre-existing TypeScript errors in `services/authService.ts` and a few other files (from the early codebase). These are tracked but not blocking. New code you write must not introduce additional TS errors.

### Build

```bash
npm run build
# Expands to: vite build
# Output: dist/
```

---

## Project File Map

```
bizscope-ai/
├── api/                        # Vercel serverless functions
│   ├── analyze.ts              # POST /api/analyze — main report generation
│   ├── preview.ts              # POST /api/preview — anonymous single-use preview
│   ├── opportunities.ts        # POST /api/opportunities — market gap explorer
│   ├── contact.ts              # POST /api/contact — contact form (Resend)
│   ├── usage-summary.ts        # GET /api/usage-summary — server usage details
│   └── stripe/
│       ├── _shared.ts          # PRICE_TO_PLAN, PLAN_TO_DB_TIER, verifyAuth, event RPCs
│       ├── [...path].ts        # /api/stripe/* — subscription-status, checkout, portal
│       └── webhook.ts          # POST /api/stripe/webhook
├── src/
│   ├── components/             # All UI components
│   ├── config/
│   │   ├── appConfig.ts        # Feature flags (isDemoMode, betaFullAccess, etc.)
│   │   ├── plans.ts            # PLAN_LIMITS, PLAN_CAPABILITIES, PRICING_CARDS
│   │   └── usageTracking.ts    # TRIAL_REPORT_LIMIT, quota functions
│   └── utils/
│       ├── planUtils.ts        # getEffectivePlan() — THE single source of plan resolution
│       ├── analytics.ts        # GA4 + Clarity init, trackEvent, trackPageView
│       └── attribution.ts      # UTM capture → sessionStorage
├── services/
│   ├── supabaseClient.ts       # Supabase client singleton
│   ├── authService.ts          # Google OAuth, email auth, session management
│   ├── stripeService.ts        # startCheckout, openPortal, getSubscriptionStatus
│   └── usageTrackerService.ts  # localStorage quota + /api/usage-summary
├── supabase/
│   └── migrations/             # All 20 SQL migrations (ordered by timestamp)
├── tests/
│   ├── audit-regression.test.ts   # ~60 regression checks
│   └── analytics.test.ts          # 20 analytics tests
├── docs/                       # This documentation directory
├── public/
│   ├── robots.txt
│   └── sitemap.xml
├── App.tsx                     # SPA root: routing, plan resolution, report execution
├── index.html                  # Entry point, OG tags, canonical URL
├── vite.config.ts              # Build config, VITE_ define block
├── vercel.json                 # outputDirectory: dist; SPA catch-all rewrite
└── .env.example                # Template for all environment variables
```

---

## SPA Routing

BizScope uses `?view=` query parameter routing instead of React Router or path-based routing. There is no navigation library.

**How it works:**
1. `vercel.json` rewrites all non-`/api/` paths to `/index.html`
2. `App.tsx` reads `new URLSearchParams(window.location.search).get('view')` on mount and on `popstate` events
3. The `currentView` state determines which component renders
4. Navigation uses `window.history.pushState()` + `window.dispatchEvent(new PopStateEvent('popstate'))`

**Current views:** `home` (default), `pricing`, `privacy`, `terms`, `contact`, `billing`, `account`, `saved-reports`, `opportunities`

**To add a new view:**
1. Add the view name to the `currentView` type in `App.tsx`
2. Add a `case` to the view switch/conditional
3. Add the view to `public/sitemap.xml` if it is a public SEO page
4. Add a `trackPageView(newViewName, 'Page Title')` call in the `useEffect([currentView])` hook

---

## Plan Resolution — The Single Source of Truth

`getEffectivePlan()` in `src/utils/planUtils.ts` is the only function that should ever determine a user's plan for feature gating. Never gate features on raw DB values or `session.user.user_metadata` directly.

**Priority order (highest wins):**
1. Demo override (`VITE_DEMO_MODE=true` only)
2. `Admin` role → `Enterprise`
3. `VITE_BETA_FULL_ACCESS=true` + authenticated → `Pro+`
4. `BetaTester` role → `Pro+`
5. `subscription_tier` from DB profile (mapped via `DB_TIER_TO_PLAN`)
6. Default: `Explorer`

The DB value `ProPlus` maps to the UI string `Pro+`. The mapping is bidirectional:
- `PLAN_TO_DB_TIER['Pro+'] === 'ProPlus'`
- `DB_TIER_TO_PLAN['ProPlus'] === 'Pro+'`

**Never write `'Pro+'` to the database directly.** Always go through `PLAN_TO_DB_TIER`.

---

## Quota Enforcement

Quota is enforced server-side in `api/analyze.ts` before each Gemini call.

**Standard quota check (`checkStandardQuota`):**
- Reads from `usage_tracking` table: `(user_id, report_type, month_key = YYYY-MM)`
- Month key is UTC: `new Date().toISOString().slice(0, 7)`
- Limit is `PLAN_LIMITS[effectivePlan]`

**Trial quota check (`checkTrialQuota`):**
- Reads from `usage_tracking` where `month_key = 'trial'`
- Limit is `TRIAL_REPORT_LIMIT = 5`
- Trial quota is only checked when `subscriptions.status = 'trialing'`

**Both functions fail open** on DB error — if Supabase is unreachable, the check passes and the report is generated. This is intentional to prevent DB flakiness from blocking users.

**Quota increment** uses the `increment_usage_tracking` RPC (defined in migration `20260619000002_usage_tracking_rpc.sql`). It is an atomic upsert with `count = count + 1`. The server also writes a row to `usage_logs` after each generation.

---

## Stripe Integration

**Checkout flow:**
1. Client calls `StripeService.startCheckout(plan)` → POST `/api/stripe/create-checkout-session`
2. Server: verifies auth (`verifyAuth`), checks trial eligibility if `PRO_TRIAL_ENABLED`, creates Stripe session, returns `{url}`
3. Client: redirects to `url` (Stripe-hosted page)
4. Stripe: after payment, redirects to `{APP_URL}/?view=billing`
5. Stripe: fires `checkout.session.completed` webhook
6. Webhook: calls `handleCheckoutCompleted` → upserts `subscriptions`, updates `profiles.subscription_tier`, sets `has_used_trial` if trialing

**Key mapping in `api/stripe/_shared.ts`:**

```typescript
const PRICE_TO_PLAN: Record<string, string> = {
  [STRIPE_PRICE_ID_PRO]:      'Pro',
  [STRIPE_PRICE_ID_PRO_PLUS]: 'Pro+',
};

const PLAN_TO_DB_TIER: Record<string, string> = {
  'Pro':  'Pro',
  'Pro+': 'ProPlus',
};
```

**Webhook idempotency:**
- Every event passes through `begin_stripe_event(stripe_event_id, event_type)` RPC
- States: `processing` → `processed` / `failed`
- Events in `processed` state return 200 immediately (no re-processing)
- Events stuck in `processing` for > 120s are eligible for reclaim on Stripe retry

**Adding a new webhook event:**
1. Add the event name to the `switch` in `api/stripe/webhook.ts`
2. Add a handler function
3. Add the event to the Stripe Dashboard webhook configuration

---

## Adding a New API Endpoint

1. Create `api/your-endpoint.ts`
2. Export a default `async function handler(req, res)` (Vercel Node.js runtime)
3. Call `verifyAuth(req, res)` from `api/stripe/_shared.ts` if auth is required
4. Add a `maxDuration` export if the function may take > 10 seconds:
   ```typescript
   export const maxDuration = 60; // seconds
   ```
5. The Vercel SPA rewrite in `vercel.json` already excludes `/api/*` paths — your endpoint is accessible at `/api/your-endpoint` automatically.

---

## Authentication

**Google OAuth:** `authService.signInWithOAuth({ provider: 'google' })` — delegates to Supabase Auth. Redirect URL must be listed in Supabase → Authentication → URL Configuration.

**Email/password:** standard Supabase auth.

**Session:** `supabase.auth.getSession()` returns the active session. Profile data (role, subscription_tier) is loaded separately from `profiles` via `authService.getUserProfile()`.

**Mock session (dev mode):** `authService` can return a session from `sessionStorage['mock-session']` for local dev without a live Supabase project. Check `authService.ts` for exact implementation.

**`protect_profile_columns` trigger:** This Supabase BEFORE UPDATE trigger (migration `20260730000000_protect_profile_sensitive_columns.sql`) blocks clients from updating `role`, `subscription_tier`, `has_used_trial`, or `email` on the `profiles` table when the session is the anon key. Updates to these fields require the `service_role` key (i.e. a serverless function, not a client call). This is a critical security constraint.

---

## Report Cache

`report_cache` stores Gemini responses keyed by a hash of the input. If a cache hit is found, the Gemini call is skipped entirely (cost and latency win).

- `cache_key`: SHA-256 hash of the normalized input (business description + location + plan parameters)
- `hits`: incremented on each cache hit
- `expires_at`: TTL for cache validity
- Cache reads happen in the API functions before calling Gemini

Do not truncate or clear the cache table carelessly — it directly reduces Gemini API costs.

---

## Known Pre-Existing TypeScript Errors

These existed before the current sprint and are tracked but not blocking:
- `services/authService.ts`: several `any` types and implicit `unknown` returns from Supabase
- Some Supabase query responses typed as `any` in older service files

Do not introduce new errors. Run `npx tsc --noEmit` before every commit.

---

## Testing Approach

`tests/audit-regression.test.ts` is a structural test file, not a unit test suite in the traditional sense. It verifies:
- Plan limit constants match expected values (caught regressions when constants were accidentally changed)
- Trial eligibility logic: all 7 conditions
- Quota enforcement: checkStandardQuota, checkTrialQuota behavior
- `getEffectivePlan()` priority order
- `PLAN_TO_DB_TIER` mapping correctness
- Analytics event shapes
- Feature flag defaults

**Adding a test:** append a new assertion block at the bottom of `audit-regression.test.ts`. Use the same pattern: `assert(condition, message)` or `assertEqual(actual, expected, message)`.

**No E2E tests exist.** The smoke test checklists in `docs/DEPLOYMENT_AND_ROLLBACK.md` are manual.

---

## Useful One-Liners

```bash
# Check for any hardcoded real secrets (quick scan)
grep -rn "sk_live_\|whsec_\|supabase\.co" --include="*.ts" --include="*.tsx" docs/ src/ api/ services/

# Find all analytics events
grep -rn "trackEvent\|trackPageView" --include="*.ts" --include="*.tsx" src/ api/

# List all ?view= routes referenced in the codebase
grep -rn "view=" --include="*.ts" --include="*.tsx" src/ | grep -v "node_modules"

# Count migration files
ls supabase/migrations/ | wc -l
```

---

## Common Pitfalls

**"Why isn't my env var showing up?"**
- `VITE_*` vars are baked at build time. Changing them in Vercel requires a new deployment (push a commit or use "Redeploy").
- Server-side vars (no `VITE_` prefix) take effect on the next function invocation without a rebuild.
- `VITE_DEMO_MODE` defaults to `'false'` in `vite.config.ts` if absent — this is safe. Other `VITE_*` vars default to `undefined` / empty string.

**"My DB write was rejected (violates check constraint)"**
- You probably wrote `'Pro+'` to `profiles.subscription_tier`. The DB enum is `'ProPlus'`. Use `PLAN_TO_DB_TIER` or verified SQL from `docs/DATABASE_OPERATIONS.md`.

**"The protect_profile_columns trigger is blocking my migration"**
- The trigger fires on BEFORE UPDATE for the `profiles` table. If your migration needs to update protected columns, it must run with `service_role` credentials or temporarily drop/recreate the trigger. Document this in the migration if you do it.

**"Trial is being offered to users who already paid"**
- Rule 5 of trial eligibility checks `subscriptions.plan NOT IN ('Pro', 'Pro+')`. If a user canceled and then subscriptions were deleted from the DB, this check passes incorrectly. Consider whether to keep cancelled subscription rows.

**"Report cache is serving stale data"**
- Check `expires_at` in `report_cache`. If the TTL is too long or expires_at is null, cache rows never expire. Use a targeted `DELETE FROM report_cache WHERE cache_key = '...'` to invalidate specific entries.
