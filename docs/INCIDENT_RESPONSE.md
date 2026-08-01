# Incident Response

Per-scenario response procedures for BizScope AI.

---

## Website Down (All Users)

**Symptoms:** `https://www.bizscope.app/` returns 5xx, timeout, or connection refused. Users cannot reach the site.

**Immediate Containment:**
- Check Vercel status: `https://www.vercel-status.com/`
- Check Supabase status: `https://status.supabase.com/`

**Diagnostic Locations:**
- Vercel Dashboard → Your project → Deployments → active Production deployment → Functions tab → check error rates
- Vercel Dashboard → Your project → Logs (real-time function logs)

**Safe First Actions:**
1. Verify the current Production deployment is healthy (green checkmark in Vercel)
2. If a recent deployment caused it: roll back (see DEPLOYMENT_AND_ROLLBACK.md)
3. If Vercel infrastructure issue: wait for Vercel status update; no action available

**Recovery Verification:** Load `https://www.bizscope.app/` and confirm homepage renders.

---

## Vercel Deployment Failure

**Symptoms:** Push to `main` or `staging` does not produce a healthy deployment. Build fails or deployment errors.

**Diagnostic Locations:**
- Vercel Dashboard → Deployments → failed deployment → Build Logs
- Common causes: TypeScript errors, missing env vars, esbuild failures

**Safe First Actions:**
1. Read the build log error carefully
2. Run `npx tsc --noEmit` and `npm run build` locally to reproduce
3. Fix the error in a new commit to `staging`; do not force-push `main`

**Recovery Verification:** Vercel deployment completes with green status; site is accessible.

---

## Supabase Outage

**Symptoms:** Login fails, reports cannot be saved, subscription status cannot be fetched.

**Diagnostic Locations:**
- Supabase status: `https://status.supabase.com/`
- Vercel function logs for Supabase connection errors

**Immediate Containment:**
- No action available during infrastructure outage
- Report generation may still work for cached reports (via `report_cache` table — but if Supabase is down, even cache lookup fails)
- Analytics and Stripe remain functional

**Recovery Verification:** Test login, profile fetch, and report save after Supabase reports recovery.

---

## Login Failure

**Symptoms:** Users cannot sign in with email/password or Google OAuth.

**Diagnostic Locations:**
- Supabase Dashboard → Authentication → Users — check if user exists and email is confirmed
- Supabase Dashboard → Authentication → Logs — check for auth errors
- Browser console for client-side errors

**Safe First Actions:**
1. Check if `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set correctly in Vercel env (check via Vercel dashboard, not by reading the actual values)
2. Check if the Supabase project's authentication providers are enabled (Google OAuth requires configuration in Supabase Dashboard → Authentication → Providers)
3. If user-specific: confirm their account in Supabase Dashboard → Authentication → Users

**Recovery Verification:** Successful login with test account.

---

## Password Reset Failure / Email Not Received

**Symptoms:** User triggers password reset but does not receive the email.

**Diagnostic Locations:**
- Supabase Dashboard → Authentication → Logs — check if reset email was dispatched
- Supabase Dashboard → Authentication → URL Configuration — verify redirect URL allows the app domain
- Check spam/junk folder (ask user)

**Safe First Actions:**
1. Verify `VITE_APP_URL` is set to `https://www.bizscope.app` in Vercel Production env
2. Check that `https://www.bizscope.app` (or `https://www.bizscope.app/*`) is in Supabase → Authentication → URL Configuration → Allowed Redirect URLs

**Recovery Verification:** Trigger a test password reset from a known account and confirm email delivery.

---

## Email Delivery Failure (Resend)

**Symptoms:** Contact form submissions succeed in the UI but no email is received.

**Diagnostic Locations:**
- Resend Dashboard → Logs — check for failed sends
- Vercel function logs for `/api/contact` errors
- Check that `RESEND_API_KEY` and `CONTACT_TO_EMAIL` are set in Vercel Production env

**Safe First Actions:**
1. Verify env vars in Vercel (do not log the actual values)
2. Check Resend domain verification is complete
3. Check spam/junk folder for `CONTACT_TO_EMAIL` address

**Recovery Verification:** Submit the contact form and verify email receipt.

---

## Gemini Generation Failures (Reports Not Generating)

**Symptoms:** Report generation returns errors. `viability_report_failed` events in GA4 with `error_category: configuration_error` or `api_error`.

**Diagnostic Locations:**
- Vercel function logs for `/api/analyze`, `/api/preview`, `/api/opportunities`
- Error message in logs: `GEMINI_API_KEY` missing → configuration error; quota exceeded → API error

**Safe First Actions:**
1. Check `GEMINI_API_KEY` is set in Vercel env (the right environment — Production vs Preview)
2. Check Google AI Studio → Usage to confirm quota is not exhausted
3. Check if the Gemini model ID in `api/analyze.ts` is still valid (model IDs can be deprecated)

**Recovery Verification:** Generate a test report on staging; confirm `viability_report_completed` in Vercel logs.

---

## Quota Malfunction (Users Getting Wrong Limits)

**Symptoms:** Users can generate more reports than their plan allows, or are blocked when they shouldn't be.

**Diagnostic Locations:**
- Supabase Dashboard → Table Editor → `usage_tracking` — check `count` for the user's `(user_id, report_type, month_key)`
- Vercel function logs for `/api/analyze` quota check results
- `profiles.subscription_tier` and `profiles.role` for the user

**Safe First Actions:**
1. Verify the user's effective plan (see DATABASE_OPERATIONS.md — "View user plan / role / tier" query)
2. Check `usage_tracking` for the user's current month key (format: `YYYY-MM`)
3. Verify `betaFullAccess` env var is not accidentally set to `true` in Production

**Recovery Verification:** Confirm quota enforcement via a test account with known usage count.

---

## Stripe Checkout Failure

**Symptoms:** Clicking "Get Pro" or "Get Pro+" does not redirect to Stripe, or Stripe returns an error.

**Diagnostic Locations:**
- Vercel function logs for `/api/stripe/create-checkout-session`
- Browser console for network errors
- Stripe Dashboard → Logs → API requests

**Safe First Actions:**
1. Check `STRIPE_SECRET_KEY` is set and is the correct mode (live vs test) for the environment
2. Check `STRIPE_PRICE_ID_PRO` and `STRIPE_PRICE_ID_PRO_PLUS` are set and point to active prices
3. Check `APP_URL` is set correctly (Stripe uses it for success/cancel redirect URLs)

**Recovery Verification:** Complete a test checkout on staging with Stripe test card `4242 4242 4242 4242`.

---

## Webhook Failure (Subscriptions Not Updating After Payment)

**Symptoms:** User pays but their plan does not upgrade; `profiles.subscription_tier` stays `Explorer`.

**Diagnostic Locations:**
- Stripe Dashboard → Webhooks → your endpoint → Recent Deliveries — check for failures
- Supabase Dashboard → Table Editor → `stripe_event_log` — check state (`failed`, `processing`, stuck)
- Vercel function logs for `/api/stripe/webhook`

**Safe First Actions:**
1. Check `STRIPE_WEBHOOK_SECRET` is set correctly in Vercel env (webhook uses the signing secret to verify events)
2. In Stripe Dashboard → Webhooks → your endpoint: click "Resend" on any failed event
3. Check if event is stuck in `processing` state in `stripe_event_log` (processing > 120 seconds → eligible for auto-reclaim on next Stripe retry)

**Recovery Verification:**
- `stripe_event_log` shows the event in `processed` state
- `subscriptions.status = 'active'`
- `profiles.subscription_tier = 'Pro'` or `'ProPlus'`
- User's plan is correct in the UI

---

## Users Receiving Wrong Plan After Payment

**Symptoms:** User paid for Pro+ but has Pro access, or vice versa.

**Diagnostic Locations:**
- Check `subscriptions.plan` vs `profiles.subscription_tier` for the user
- Check `STRIPE_PRICE_ID_PRO` vs `STRIPE_PRICE_ID_PRO_PLUS` — are the correct price IDs set?
- Check `PLAN_TO_DB_TIER` mapping in `api/stripe/_shared.ts` — `'Pro+'` must map to `'ProPlus'`

**Safe First Actions:**
1. Run the "View user plan / role / tier" query in DATABASE_OPERATIONS.md
2. If `profiles.subscription_tier` is wrong, manually correct it via the admin write SQL (service_role key required)
3. Verify Stripe price IDs match the intended plans

**Recovery Verification:** User's plan reflects their actual payment in both the DB and the UI.

---

## Suspected Privilege Escalation

**Symptoms:** A user appears to have a plan or role they should not have (e.g. an Explorer user accessing Pro+ features).

**Diagnostic Locations:**
- `profiles.role` and `profiles.subscription_tier` in Supabase
- `stripe_event_log` for any unexpected webhook events
- Recent `profiles` `updated_at` timestamp vs legitimate webhook deliveries

**Safe First Actions:**
1. Check if the `trg_protect_profile_columns` trigger is in place (it should block client self-escalation)
2. Check if `VITE_BETA_FULL_ACCESS=true` is accidentally set in Production
3. If escalation via DB: compare the `profiles.updated_at` against Stripe webhook timestamps in `stripe_event_log`
4. If confirmed: set role/tier back to correct values using service_role SQL (DATABASE_OPERATIONS.md)

**Escalation:** If you cannot explain how the escalation occurred, treat as a security incident. Rotate `SUPABASE_SERVICE_ROLE_KEY` and review Supabase audit logs.

**Recovery Verification:** Confirm the protect_profile_columns trigger is active; confirm no user can set own role via API.

---

## Exposed Secret (API Key Committed or Leaked)

**Symptoms:** A real API key, secret key, or service role key appears in a git commit, log file, public URL, or external report.

**Immediate Containment (within minutes):**
1. **Revoke / rotate the exposed key immediately** — do not wait to assess impact:
   - Supabase service role key: Supabase Dashboard → Project Settings → API → Regenerate key
   - Stripe secret key: Stripe Dashboard → API Keys → Roll key
   - Gemini API key: Google AI Studio → revoke and generate new
   - Resend API key: Resend Dashboard → API Keys → delete and create new
2. Update the new key in Vercel env vars
3. If in git history: remove from history (requires `git filter-repo` or GitHub "Remove sensitive data" tool) — do this after revoking, not before
4. Verify no unauthorized activity occurred during the window of exposure (check Stripe Dashboard → Logs, Supabase audit logs)

**Escalation:** If any unauthorized charge, data access, or subscription change is detected, treat as a data breach.

**Recovery Verification:** New keys working, old keys revoked, git history clean.

---

## Suspicious Usage Spike

**Symptoms:** Unusual spike in `usage_logs` records, high Gemini API costs, unusual traffic in GA4.

**Diagnostic Locations:**
- Supabase → Table Editor → `usage_logs` → sort by `generated_at DESC`
- `report_activity_log` for error patterns
- GA4 Real-time report for traffic anomalies

**Safe First Actions:**
1. Check if a specific user or IP is generating an unusual number of reports
2. Check `within_hard_cap` field in `usage_logs` — if `false`, the hard cap budget guard was exceeded
3. If a specific user is abusing: set `profiles.subscription_tier = 'Explorer'` and `profiles.role = 'Explorer'` via service_role SQL to enforce quota
4. Check if the anonymous preview endpoint (`/api/preview`) is being abused (no auth required)

**Recovery Verification:** Usage returns to normal levels; suspicious account downgraded.

---

## Analytics Outage (GA4 or Clarity Stops Reporting)

**Symptoms:** GA4 Real-time shows no events; Clarity shows no recordings.

**Diagnostic Locations:**
- Browser DevTools → Network tab → check for `googletagmanager.com` requests (GA4) and `clarity.ms` requests
- Vercel env vars: confirm `VITE_GA_MEASUREMENT_ID` and `VITE_CLARITY_PROJECT_ID` are present
- Browser ad blockers may silently block analytics scripts

**Safe First Actions:**
1. Test in a browser with ad blockers disabled
2. Confirm the env vars are set in Vercel Production and a recent deployment was triggered
3. GA4 can have 24-48 hour data delays — check "Real-time" reports, not standard reports

**Recovery Verification:** GA4 Real-time shows a `page_view` within 30 seconds of site visit.

---

## Accidental Live Stripe Charge During Testing

**Symptoms:** A real credit card was charged during testing on staging or locally.

**Immediate Containment:**
1. Issue a refund immediately in Stripe Dashboard → Customers → [customer] → [charge] → Refund
2. Verify the staging/local environment is using the **test mode** Stripe key (`sk_test_...`), not the live key (`sk_live_...`)
3. Check Vercel Preview environment variables — `STRIPE_SECRET_KEY` for Preview should be `sk_test_...`

**Recovery Verification:** Refund processed; staging env uses test mode key only.

---

## Database Migration Failure

**Symptoms:** A migration applied to staging or Production causes errors; tables may be in an inconsistent state.

**Diagnostic Locations:**
- Supabase Dashboard → SQL Editor — check the error message from the failed migration
- Look at the migration file for idempotency (`IF NOT EXISTS`, `DO $$...$$`)

**Safe First Actions:**
1. Do not apply further migrations until the failure is resolved
2. Read the migration file to understand what partial changes may have occurred
3. If the migration is idempotent (all `IF NOT EXISTS` guards): fix the underlying issue and re-run
4. If the migration is not idempotent: assess which statements succeeded and craft a repair script

**Escalation:** If a migration corrupted data (e.g. wrong DROP or UPDATE with no WHERE clause), treat as a data incident. Restore from Supabase's automatic backups.

**Recovery Verification:** Run the verification SELECT queries from the migration file's PREFLIGHT section; confirm all constraints and indexes are in place.
