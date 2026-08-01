# Major Architectural Decisions

Non-obvious decisions made during development. Captures the reasoning so future contributors don't re-litigate settled questions.

---

## 1. `?view=` Query Parameter Routing (Not React Router)

**Decision:** Use `window.location.search` query parameters (`?view=pricing`) for SPA navigation instead of React Router or path-based routing.

**Why:**
- Eliminates a dependency (React Router v6+ has a non-trivial API surface)
- Vercel's SPA catch-all rewrite (`/((?!api/).*)` → `/index.html`) handles all paths correctly
- `history.pushState` + `popstate` event listener is sufficient for Back button support
- All views are listed in `sitemap.xml` with their `?view=` URLs — search engines handle query-param URLs without issues

**Trade-off accepted:** Navigation logic is manual (no `<Link>` components). This is fine for a small, stable view set.

---

## 2. `ProPlus` DB Enum vs `Pro+` UI String

**Decision:** The PostgreSQL `CHECK` constraint uses `ProPlus` (no special characters); the UI and Stripe display `Pro+`. An explicit mapping layer translates between them.

**Why:** PostgreSQL identifiers and enum CHECK constraint values support alphanumeric and underscore only for clean SQL syntax. `Pro+` in a CHECK constraint is syntactically valid but error-prone in dynamic SQL.

**Implementation:** `PLAN_TO_DB_TIER` and `DB_TIER_TO_PLAN` maps in `src/utils/planUtils.ts` and `api/stripe/_shared.ts`. All code must go through these maps.

**Critical gotcha:** Writing `'Pro+'` directly to `profiles.subscription_tier` in the DB violates the CHECK constraint and raises an error. Always use `PLAN_TO_DB_TIER['Pro+']` → `'ProPlus'`.

---

## 3. Fail-Open Quota Enforcement

**Decision:** `checkStandardQuota` and `checkTrialQuota` return `{ allowed: true }` when the Supabase query throws an exception (network error, DB unavailability).

**Why:** During a Supabase outage, fail-closed would silently block all users from generating reports (no error visible, just "limit reached"). This is a worse UX outcome than allowing a few extra Gemini calls during a brief outage.

**Risk accepted:** In a prolonged DB outage, users could run slightly over their plan quota. The cost of a few extra Gemini calls is much lower than the cost of blocking paying users.

**Mitigation:** The `usage_logs.within_hard_cap` field tracks budget separately. Hard-cap breaches are queryable for review.

---

## 4. Client-Side `localStorage` Quota Shadow

**Decision:** `usageTrackerService.ts` maintains a local copy of usage counts in `localStorage`, separate from the Supabase `usage_tracking` table.

**Why:** Instant UI feedback without a server round-trip. The "Generate" button can be disabled or the quota warning shown immediately on page load without waiting for a Supabase query.

**Authoritative source:** The server (`/api/analyze` via `checkStandardQuota`) is always authoritative. The `localStorage` copy is only for UI state. `/api/usage-summary` syncs the server value back to the client periodically.

---

## 5. Webhook Idempotency via `stripe_event_log`

**Decision:** Every Stripe webhook event is claimed via a `begin_stripe_event` RPC that upserts into `stripe_event_log` with a PRIMARY KEY constraint on `event_id`. Events in `processed` state return 200 immediately without re-running.

**Why:** Stripe guarantees at-least-once webhook delivery. Without idempotency, a retry of `checkout.session.completed` could double-upgrade a user's profile or double-set `has_used_trial`.

**Stuck event handling:** Events stuck in `processing` for > 120 seconds are eligible for reclaim on the next Stripe retry. This handles hung Vercel function invocations.

---

## 6. `protect_profile_columns` BEFORE UPDATE Trigger

**Decision:** A Supabase trigger blocks updates to `role`, `subscription_tier`, `has_used_trial`, and `email` on `profiles` when the JWT role is `authenticated` (anon key). These columns can only be changed by the `service_role` key (i.e. a serverless function).

**Why:** Without this trigger, any authenticated user could call `supabase.from('profiles').update({ subscription_tier: 'Enterprise' })` on their own row. The RLS policy allowed authenticated users to update their own profile (for legitimate fields like `full_name`), but it couldn't easily distinguish "update your name" from "escalate your plan."

**Commit:** `85661cd`

---

## 7. GA4 Strategy B (Manual `send_page_view: false`)

**Decision:** GA4 is initialized with `send_page_view: false`. All `page_view` events are fired manually from `App.tsx`'s `useEffect([currentView])`.

**Why:** Enhanced Measurement's automatic page_view fires once on initial load for any URL. SPA navigation does not trigger additional auto page_views. Strategy B fires exactly one `page_view` per view — including initial load, forward navigation, and browser Back — with no duplicates.

**Why not Strategy A (Enhanced Measurement + SPA extension):** The GA4 SPA history-based page_view would double-fire on `pushState` events in some configurations, leading to double-counted page views.

---

## 8. Trial Quota Uses `month_key = 'trial'` (Not Monthly Bucket)

**Decision:** The trial report cap (5 reports) is stored in `usage_tracking` with `month_key = 'trial'` instead of a `YYYY-MM` monthly key.

**Why:** Trial reports should not count toward the regular monthly quota, and the cap should persist for the entire trial period (not reset on the 1st of a new month mid-trial). Using a literal `'trial'` key creates a separate, permanent counter that never expires or resets.

**Risk:** If `has_used_trial` is reset for a second trial, the `'trial'` usage_tracking row must also be reset. See `docs/OWNER_OPERATIONS_MANUAL.md → Allow a Second Trial`.

---

## 9. Demo Mode Defaults to `false` in `vite.config.ts`

**Decision:** `vite.config.ts` has `VITE_DEMO_MODE: JSON.stringify(process.env.VITE_DEMO_MODE ?? 'false')`. The double-guard ensures that if the env var is absent, the built bundle contains the string `'false'`, not `undefined`.

**Why:** If `VITE_DEMO_MODE` were `undefined` at build time, the client would see `undefined`, and `isDemoMode = VITE_DEMO_MODE === 'true'` would incorrectly be `false` only because of a type check quirk. The default `'false'` makes the intent explicit and prevents accidental demo mode from a stale build.

---

## 10. Separate Supabase Projects for Staging and Production

**Decision:** Staging and Production use separate Supabase projects (separate URLs, separate credentials).

**Why:** Shared Supabase projects mean staging migrations could corrupt production data. Separate projects give clean isolation — staging schema changes don't affect production users.

**Implication:** Migrations must be applied to both projects manually. There is no automated migration sync.
