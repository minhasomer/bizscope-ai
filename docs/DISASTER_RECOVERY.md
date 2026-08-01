# Disaster Recovery

Fresh-start recovery plan for BizScope AI. Use this when recovering from a total loss of the hosting environment, credential rotation after a breach, or a complete infrastructure rebuild.

---

## Part 1: Recovery Steps

### Step 1 — Clone the Repository

```bash
git clone https://github.com/minhasomer/bizscope-ai.git
cd bizscope-ai
git checkout staging   # or main for Production recovery
```

The repository contains all application code, migration SQL, and documentation. It does NOT contain environment variables or database rows.

### Step 2 — Install Dependencies

```bash
npm install
```

Requires Node.js. Verify the version in `package.json` engines (if specified) or use Node LTS.

### Step 3 — Restore Required Environment Variables

Reference `docs/ENVIRONMENT_VARIABLES.md` for the complete variable list.

Retrieve values from your secure vault (password manager, 1Password, Bitwarden, or similar). **Never store actual values in git.**

Minimum required for a functional production environment:
- `GEMINI_API_KEY`
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_PRO` + `STRIPE_PRICE_ID_PRO_PLUS`
- `APP_URL` + `VITE_APP_URL`
- `RESEND_API_KEY` + `CONTACT_TO_EMAIL`

### Step 4 — Reconnect to Vercel

1. Go to `https://vercel.com/` → New Project → Import Git Repository
2. Select `minhasomer/bizscope-ai` from GitHub
3. Configure project settings:
   - Framework preset: Vite
   - Build command: `vite build`
   - Output directory: `dist`
4. Add all environment variables (see Step 3) in Vercel → Project → Settings → Environment Variables
5. Assign environment scopes (Production / Preview) appropriately — see `docs/ENVIRONMENT_VARIABLES.md` for which vars belong to which scope

### Step 5 — Reconnect to Supabase

**Option A: Existing project survived** — just update env vars to point to it. Skip to Step 6.

**Option B: Project lost or new project needed:**
1. Create a new Supabase project at `https://app.supabase.com/`
2. Note the project URL and keys (anon + service role)
3. Update all Supabase env vars in Vercel
4. Configure Google OAuth: Supabase Dashboard → Authentication → Providers → Google → add credentials
5. Configure allowed redirect URLs: Supabase Dashboard → Authentication → URL Configuration → add `https://www.bizscope.app` and `https://www.bizscope.app/**`
6. Proceed to Step 6 to run migrations

### Step 6 — Run Migrations in Order

Apply all migration files to the Supabase project via Supabase Dashboard → SQL Editor. Run them in the exact order below (timestamp order):

```
1.  20260604000000_capture_shared_functions.sql
2.  20260604000001_capture_profiles.sql
3.  20260604000002_capture_auth_trigger.sql
4.  20260604000003_capture_reports_legacy.sql
5.  20260604000004_capture_subscriptions.sql
6.  20260605000000_create_saved_reports.sql
7.  20260608000000_create_report_cache.sql
8.  20260618000000_capture_usage_tracking.sql
9.  20260619000000_create_usage_logs.sql
10. 20260619000001_create_report_activity_log.sql
11. 20260619000002_usage_tracking_rpc.sql
12. 20260713000000_capture_extra_indexes.sql
13. 20260713000001_fix_saved_reports_report_type.sql
14. 20260713000002_dedup_profiles_rls.sql
15. 20260718000000_subscriptions_constraints.sql
16. 20260718000001_stripe_event_log.sql
17. 20260719000001_add_cancel_at.sql
18. 20260730000000_protect_profile_sensitive_columns.sql
19. 20260730000001_saved_reports_update_with_check.sql
20. 20260730000002_pro_trial.sql
```

### Step 7 — Verify Migrations

After running all migrations, verify:

```sql
-- All expected tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
-- Expected: profiles, subscriptions, saved_reports, report_cache,
--           usage_tracking, usage_logs, report_activity_log,
--           stripe_event_log, reports (legacy)

-- Protect trigger is active
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_table = 'profiles';
-- Expected: trg_protect_profile_columns, trg_profiles_updated_at

-- Trial columns exist
SELECT column_name FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'has_used_trial';
SELECT column_name FROM information_schema.columns
WHERE table_name = 'subscriptions' AND column_name IN ('trial_started_at', 'trial_ends_at');
```

### Step 8 — Reconnect Stripe

1. Log into `https://dashboard.stripe.com/`
2. If restoring from a breach: rotate API keys (Dashboard → API Keys → Roll)
3. Verify or create Products and Prices for Pro ($29/month) and Pro+ ($59/month)
4. Note the recurring Price IDs (`price_...`) for each plan
5. Update `STRIPE_PRICE_ID_PRO` and `STRIPE_PRICE_ID_PRO_PLUS` in Vercel env
6. Proceed to Step 9 for webhook

### Step 9 — Configure Stripe Webhook

1. Stripe Dashboard → Webhooks → Add endpoint
2. Endpoint URL: `https://www.bizscope.app/api/stripe/webhook`
3. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.payment_succeeded`
4. Copy the Signing Secret (`whsec_...`)
5. Update `STRIPE_WEBHOOK_SECRET` in Vercel env

### Step 10 — Configure Resend

1. Log into `https://resend.com/`
2. Verify sender domain or create a new one
3. Create or retrieve API key
4. Update `RESEND_API_KEY` in Vercel env
5. Confirm `CONTACT_TO_EMAIL` is set to the correct inbox

### Step 11 — Configure Gemini

1. Log into `https://aistudio.google.com/`
2. Create or retrieve API key
3. Update `GEMINI_API_KEY` in Vercel env (server-side only — never in a `VITE_` variable)

### Step 12 — Configure GA4

1. Log into `https://analytics.google.com/`
2. Locate your GA4 property or create a new one
3. Copy the Measurement ID (`G-XXXXXXXXXX`)
4. Update `VITE_GA_MEASUREMENT_ID` in Vercel Production env
5. Disable Enhanced Measurement in GA4 → Admin → Data Streams → Web Stream Details

### Step 13 — Configure Clarity

1. Log into `https://clarity.microsoft.com/`
2. Locate or create your project
3. Copy the Project ID
4. Update `VITE_CLARITY_PROJECT_ID` in Vercel Production env

### Step 14 — Verify Search Console

The HTML meta tag verification for Google Search Console is already embedded in `index.html`. After deployment, Google Search Console should recognize the verification automatically. If the property is lost:

1. Go to `https://search.google.com/search-console/`
2. Add property: `https://www.bizscope.app/`
3. Choose HTML tag verification
4. The meta tag is already in `index.html` — just verify the property in the Search Console UI
5. Submit the sitemap: `https://www.bizscope.app/sitemap.xml`

[UNVERIFIED — check `index.html` for the current Search Console meta tag content]

### Step 15 — Build and Deploy Staging

```bash
git push origin staging
```

Vercel auto-deploys. Wait for the deployment to complete.

### Step 16 — Run Staging Smoke Tests

See `docs/DEPLOYMENT_AND_ROLLBACK.md` for the full Smoke Test Checklist. At minimum:
- [ ] Homepage loads
- [ ] Login works
- [ ] Report generation works (test Stripe test card if testing checkout)
- [ ] Stripe webhook verified (create a test subscription and confirm DB update)

### Step 17 — Deploy Production

```bash
git checkout main
git merge staging
git push origin main
```

Vercel auto-deploys. Run the Production smoke test after the deployment completes.

---

## Part 2: External Systems Backup Checklist

The git repository does NOT back up the following. These require separate backup procedures.

| System | What to Back Up | How | Recommended Cadence |
|---|---|---|---|
| GitHub repository | The repository itself | GitHub has its own backup. Enable GitHub → Settings → Danger Zone → "Archive this repository" if needed. Consider a local bare clone. | N/A (GitHub handles) |
| Supabase database rows | `profiles`, `subscriptions`, `saved_reports`, `usage_logs`, etc. | Supabase Dashboard → Project Settings → Database → Backups (automatic daily PITR for paid plans). Also export via Supabase CLI: `supabase db dump` | Automatic (Supabase); verify backup schedule |
| Supabase auth users | `auth.users` table | Included in Supabase database backup. Can also export via Admin API. | With database backup |
| Vercel environment variables | All env var names and values | Copy to secure vault manually (Vercel does not export env vars). | After every env var change |
| Stripe products, prices, customers, subscriptions | Entire Stripe data | Stripe Dashboard → Data Management → Export. Alternatively, Stripe stores all this durably. | Monthly or after major changes |
| Resend sender configuration | Sending domain, API keys | Document sender domain and DNS records in secure vault | After configuration changes |
| Domain and DNS configuration | DNS records, registrar login | Document in secure vault; ensure registrar 2FA is enabled | After DNS changes |
| GA4 property settings | Property ID, data stream ID, event config | Screenshot or document GA4 property settings | After major GA4 changes |
| Clarity project settings | Project ID, masking config | Document in secure vault | After configuration changes |
| Google Search Console | Property ownership verification | The meta tag in `index.html` re-verifies on redeploy; document the verification meta tag value in the vault | N/A (in code) |

---

## Part 3: AI Conversation and Project-Context Backup

AI conversations containing implementation decisions, debugging sessions, and architectural reasoning are valuable project context that is NOT stored in git.

### Claude (Claude.ai)
- Settings → Privacy → Export data → Download ZIP → Store securely outside git

### ChatGPT (OpenAI)
- Settings → Data Controls → Export data → Download ZIP → Store securely outside git

### Curated history files

The `docs/history/` directory contains curated project context files intended for long-term reference. Do NOT paste entire chat histories into git — only curated summaries:

| File | Contents |
|---|---|
| `docs/history/PROJECT_TIMELINE.md` | Key milestones with dates |
| `docs/history/MAJOR_DECISIONS.md` | Non-obvious architectural decisions |
| `docs/history/SECURITY_FIXES.md` | Security-related changes |
| `docs/history/LAUNCH_HISTORY.md` | Commercial launch milestones |
| `docs/history/CLAUDE_PROMPTS_ARCHIVE.md` | Curated summaries of Claude-assisted sessions |
| `docs/history/CHATGPT_CONTEXT_ARCHIVE.md` | Curated summaries of ChatGPT-assisted sessions |
