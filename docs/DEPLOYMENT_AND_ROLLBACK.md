# Deployment and Rollback

Procedures for staging deployments, production releases, and emergency rollbacks.

---

## Branch Model

| Branch | Environment | URL |
|---|---|---|
| `staging` | Vercel Preview | `https://bizscope-ai-git-staging-omer-minhas-projects.vercel.app` |
| `main` | Production | `https://www.bizscope.app` |

- Every push to `staging` triggers a Vercel Preview deployment automatically.
- Every push to `main` triggers a Vercel Production deployment automatically.
- Feature branches also get Vercel Preview deployments (ephemeral, separate URL).

---

## Deployment Checklist

```
[ ] npm test passes (tsx tests/audit-regression.test.ts)
[ ] npx tsc --noEmit passes (no new TypeScript errors)
[ ] npm run build (vite build) passes
[ ] No real IDs committed (see Secret Scan below)
[ ] Staging smoke test passed (all scenarios in Smoke Test Checklist below)
[ ] DB migrations applied to target environment (if any)
[ ] PR reviewed and approved
[ ] Merge to main
[ ] Verify Vercel Production deployment completes successfully
[ ] Run Production smoke test
[ ] Record deployed commit SHA (from Vercel dashboard or git log)
```

---

## Smoke Test Checklist

Run these on staging before every merge to main. Run subset on Production after deploy.

**Anonymous visitor:**
- [ ] Homepage loads and hero is visible
- [ ] Entering a business idea and location generates a preview report (uses `/api/preview`)
- [ ] Report shows viability score and basic sections; premium sections are locked
- [ ] Second attempt shows signup CTA (anonymous limit enforced)
- [ ] Pricing page loads with correct plan details

**Authentication:**
- [ ] Email/password signup sends verification email
- [ ] Email/password login works for existing account
- [ ] Google OAuth sign-in works (redirects back correctly)
- [ ] Password reset flow works (email sent, password updated)

**Explorer plan:**
- [ ] Generates up to 3 standard reports/month
- [ ] Full financials section is locked/blurred
- [ ] PDF export is locked
- [ ] Save to Venture Hub is locked

**Pro plan (real or complimentary DB grant):**
- [ ] Generates up to 20 standard reports/month
- [ ] Full financials visible
- [ ] PDF export works
- [ ] Save to Venture Hub works
- [ ] Market Gap Explorer is accessible

**Stripe checkout (staging = Stripe test mode):**
- [ ] Clicking "Get Pro" on pricing page opens Stripe Checkout
- [ ] Completing checkout with test card `4242 4242 4242 4242` creates subscription
- [ ] Returning to `/billing` after checkout shows active subscription
- [ ] Plan is upgraded in the UI without sign-out/in

**Trial checkout (if PRO_TRIAL_ENABLED=true):**
- [ ] Eligible users see "Start Free 7-Day Trial" CTA
- [ ] Trial checkout creates trialing subscription
- [ ] Trial quota (5 reports) is enforced

**Stripe Portal:**
- [ ] Active subscriber can open Customer Portal
- [ ] Cancel at period end works

**Contact form:**
- [ ] Submitting contact form sends email (verify in Resend logs)

**Analytics (if enabled):**
- [ ] GA4 DebugView shows page_view events on navigation
- [ ] Clarity session recordings start (without unmasked PII)

---

## Rollback Checklist

```
[ ] Identify the previous good deployment in Vercel dashboard (Deployments tab)
[ ] Click "Redeploy" on the prior deployment (not "Promote to Production" — use Redeploy)
[ ] Wait for the rollback deployment to complete
[ ] Verify the rollback deployment is assigned to the Production domain
[ ] Check the deployed URL shows the expected previous version
[ ] Run abbreviated smoke test (homepage, login, report generation)
[ ] If a DB migration was part of the deployment: assess DB state separately (schema rollback is not automatic — see below)
[ ] Document the incident (what failed, what was rolled back, commit SHA)
[ ] Open a fix branch; do not re-merge the bad commit
```

---

## Migration Workflow

Migrations must be applied **before** the code that depends on them is deployed.

### For a new migration:
1. Write the migration SQL file in `supabase/migrations/` with the correct timestamp prefix
2. Apply to **staging Supabase** first:
   - Via Supabase Dashboard → SQL Editor
   - Or via `supabase db push` (requires Supabase CLI + project link)
3. Deploy the code that uses the new migration to staging
4. Verify on staging
5. Apply to **production Supabase**:
   - Via Supabase Dashboard → SQL Editor on the Production project
6. Deploy code to Production (merge to main)

### Schema rollback limitation:
Vercel's "Redeploy" rolls back application code instantly. It does **not** roll back Supabase schema changes. If a migration added a column or table, that change persists even after a code rollback. Assess whether the old code is compatible with the new schema before rolling back.

---

## Environment Variable Changes

- Changes to `VITE_*` variables require a **new Vercel deployment** (build-time bake-in). The "Redeploy" button in Vercel triggers a new build that picks up the updated env vars.
- Changes to server-side variables (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, etc.) take effect on the next function invocation — no rebuild required. Use "Redeploy" if you want to force-pick-up new env immediately on a warm function.
- Environment variables are scoped per-environment in Vercel (Production / Preview / Development). Changes to Production env do not affect staging Preview deployments and vice versa.

---

## Emergency Disable Switches

### Disable trial promotion (no redeploy needed for server; redeploy needed for client CTA)
1. Set `PRO_TRIAL_ENABLED=false` in Vercel → Env Vars (takes effect on next function call)
2. Set `VITE_PRO_TRIAL_ENABLED=false` → Redeploy to hide client CTA

### Disable analytics (no rebuild for GA4/Clarity if vars are removed, but requires redeploy)
1. Remove `VITE_GA_MEASUREMENT_ID` from Vercel env
2. Remove `VITE_CLARITY_PROJECT_ID` from Vercel env
3. Trigger redeploy

### Disable real reports (revert to demo mode)
1. Set `VITE_DEMO_MODE=true` in Vercel env → Redeploy
   - **Warning:** This disables Gemini AND Stripe in client code. Use only for emergency demo/maintenance mode.

### Disable beta full-access
1. Set `VITE_BETA_FULL_ACCESS=false` or remove it → Redeploy
   - All non-Admin users revert to their stored plan immediately after redeploy (no DB changes needed)

---

## Confirming the Deployed Commit SHA

In Vercel dashboard → Your project → Deployments → click the active Production deployment → see "Git Commit" field.

Or via git:
```bash
git log --oneline main | head -5
```

---

## Staging vs Production Supabase Projects

The staging and production environments connect to **separate Supabase projects**. The `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` / `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` values in Vercel's Production environment differ from the values in the Preview (staging) environment. This prevents staging tests from polluting production data.

Similarly, staging uses Stripe **test mode** (`sk_test_...`) and production uses Stripe **live mode** (`sk_live_...`).

---

## How to Confirm a Stable Alias

After Production deploy, verify:
```
https://www.bizscope.app/
```
Returns HTTP 200 and the current application version. The canonical URL in the `<link rel="canonical">` tag should be `https://www.bizscope.app/`.
