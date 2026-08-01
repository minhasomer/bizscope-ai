# Claude Prompts Archive

Curated record of significant Claude-assisted development sessions. This file captures what was built, what was decided, and any caveats from each session — not the full transcript.

For full exports: Claude.ai → Settings → Privacy → Export data.

---

## Session: Pre-Beta Audit and Cost Accounting (2026-06-18)

**Topics covered:**
- Comprehensive pre-beta audit: plan limits, quota enforcement, anonymous limits, trial eligibility, billing page accuracy
- AI cost accounting implementation: `usage_logs` table design, `within_hard_cap` field, hard budget cap guard
- `report_activity_log` table design for error pattern monitoring
- Regression test suite (`tests/audit-regression.test.ts`) with ~60 checks
- Scoreless UX: removing numeric viability scores from all report surfaces; prompt-level guardrails added

**Key decisions from this session:**
- Fail-open quota design chosen over fail-closed (see `docs/history/MAJOR_DECISIONS.md`)
- `usage_logs` chosen as the authoritative cost record rather than the `usage_tracking` counter table
- Regression tests written as imports of source modules (no network calls) for fast CI

**Caveats:**
- The scoreless UX is enforced at the prompt level, not with post-processing filtering. Gemini may occasionally include numeric scores in prose despite the guardrail. Periodic manual testing is recommended.

---

## Session: Report Verdict / Recommendation Hierarchy UX (2026-06-19)

**Topics covered:**
- Decision framework UX: what "verdict" vs "posture" vs "recommendation" mean in the BizScope report model
- Scoreless enforcement across all report surfaces (PDF, saved reports, report display)
- Assessment legend design ("you are here" framework)
- Prompt guidance updates to keep viability scores out of prose

**Key decisions:**
- Verdict hierarchy: Verdict (binary go/no-go) → Posture (qualitative stance) → Recommendation (specific actions)
- Scoreless display chosen for beta because numeric scores invite over-interpretation without market validation of what the numbers mean

---

## Session: Stripe Integration (2026-07-18)

**Topics covered:**
- Full Stripe checkout → webhook → DB lifecycle design
- `stripe_event_log` idempotency mechanism (begin/complete/fail RPC pattern)
- `PLAN_TO_DB_TIER` mapping (`Pro+` → `ProPlus`)
- `cancel_at` vs `cancel_at_period_end` field handling
- Webhook event handler for each of the 5 Stripe events
- SPA catch-all rewrite exclusion for `/api/*` in `vercel.json`

**Key decisions:**
- Separate `stripe_event_log` table for idempotency instead of relying on Stripe's idempotency key (more observable, easier to debug)
- `PLAN_TO_DB_TIER` map kept in `_shared.ts` as a single source of truth shared across all Stripe API functions

**Caveats:**
- `invoice.payment_succeeded` must not overwrite a subscription that was already cancelled (`subscription.deleted` may arrive before `invoice.payment_succeeded` for the same period). Guard implemented at `271bb16`.

---

## Session: Security Hardening (2026-07-30)

**Topics covered:**
- `protect_profile_columns` BEFORE UPDATE trigger design
- PostgreSQL RLS `WITH CHECK` clause gap analysis
- `saved_reports` UPDATE policy missing `WITH CHECK`

**Key decisions:**
- Trigger approach chosen over adding another RLS policy because RLS policies cannot easily distinguish "update own name" from "update own subscription_tier" — they both match `uid() = id`
- `WITH CHECK` added to saved_reports UPDATE as a defense-in-depth measure

---

## Session: 7-Day Pro Trial (2026-07-30)

**Topics covered:**
- Trial eligibility rules (all 7 server-side conditions)
- `trial_period_days: 7` in Stripe Checkout session creation
- Trial quota: `month_key = 'trial'` in `usage_tracking`
- `has_used_trial` flag in `profiles`; `trial_started_at`/`trial_ends_at` in `subscriptions`
- Fail-safe: `has_used_trial` defaults to `true` on DB read error (prevents double trials during outages)
- `PRO_TRIAL_ENABLED` / `VITE_PRO_TRIAL_ENABLED` feature toggle design (server + client separate)
- Staging lifecycle test: full trial checkout → trialing → active (7-day validation)

**Key decisions:**
- Trial limited to Pro only (not Pro+) to preserve Pro+ as a clear upgrade path
- 5-report trial cap chosen as sufficient to evaluate the product without giving free access to meaningful value
- Trial quota uses `month_key = 'trial'` literal (not monthly bucket) so cap doesn't reset mid-trial at month boundary

---

## Session: Analytics, SEO, and UTM (2026-07-31)

**Topics covered:**
- GA4 Strategy B (manual page_view, `send_page_view: false`)
- Microsoft Clarity masking inventory across all sensitive components
- UTM capture via `sessionStorage` (not `localStorage`) with privacy protections
- GA4 event design: only categorical enum values, no PII
- Deferred analytics events (GA4 Measurement Protocol needed for server-side lifecycle)
- `ANALYTICS_SETUP.md` created as a complementary ops reference
- Search Console HTML meta tag verification

**Key decisions:**
- Strategy B chosen over Strategy A to avoid duplicate page_view events
- `sessionStorage` for UTM (not `localStorage`) because UTM attribution should be session-scoped
- Analytics completely disabled when env vars are absent (safe default for dev and staging without explicit config)

---

## Session: Operations Documentation Suite (2026-07-31)

**Topics covered:**
- Full source audit of all application code, migrations, and tests before writing any documentation
- 17-file documentation suite: 11 operational docs + 6 history files

**Files produced in this session:**
- `docs/ENVIRONMENT_VARIABLES.md`
- `docs/DATABASE_OPERATIONS.md`
- `docs/BILLING_AND_TRIALS.md`
- `docs/DEPLOYMENT_AND_ROLLBACK.md`
- `docs/ANALYTICS_AND_MARKETING.md`
- `docs/INCIDENT_RESPONSE.md`
- `docs/DISASTER_RECOVERY.md`
- `docs/OWNER_OPERATIONS_MANUAL.md`
- `docs/DEVELOPER_RUNBOOK.md`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG_OWNER.md`
- `docs/history/PROJECT_TIMELINE.md`
- `docs/history/MAJOR_DECISIONS.md`
- `docs/history/SECURITY_FIXES.md`
- `docs/history/LAUNCH_HISTORY.md`
- `docs/history/CLAUDE_PROMPTS_ARCHIVE.md`
- `docs/history/CHATGPT_CONTEXT_ARCHIVE.md`

**Constraints enforced:**
- All SQL uses verified table/column names from migrations
- All plan enum values sourced from migration CHECK constraints
- All quota values sourced from `src/config/usageTracking.ts` and `src/config/plans.ts`
- No real customer emails, API keys, or secret values in any file
- Documentation committed to `staging` branch only

---

## Adding to This Archive

When you complete a significant Claude session, add an entry here with:
- Session date
- Topics covered (3-6 bullets)
- Key decisions made
- Any caveats or known limitations of the approach

Do NOT paste full chat transcripts. Curated summaries only.
