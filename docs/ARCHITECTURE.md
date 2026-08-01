# Architecture

System overview and data flow diagrams for BizScope AI. All diagrams use Mermaid syntax (rendered on GitHub, GitLab, and most Markdown viewers).

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite 6 | SPA, `?view=` routing |
| Hosting | Vercel | Static SPA + serverless functions |
| Database | Supabase (PostgreSQL) | Profiles, subscriptions, reports, quotas |
| Auth | Supabase Auth | Google OAuth + email/password |
| Payments | Stripe | Subscriptions, checkout, portal |
| AI | Google Gemini (via `@google/genai`) | Report generation |
| Email | Resend | Contact form transactional email |
| Analytics | GA4 + Microsoft Clarity | Product analytics + session recording |

---

## Diagram 1: System Components

```mermaid
graph TB
    Browser["Browser\n(React 19 SPA)"]
    Vercel["Vercel\n(Static + Serverless)"]
    Supabase["Supabase\n(PostgreSQL + Auth)"]
    Stripe["Stripe\n(Subscriptions)"]
    Gemini["Google Gemini\n(AI Generation)"]
    Resend["Resend\n(Email)"]
    GA4["GA4 + Clarity\n(Analytics)"]

    Browser -->|"HTTPS (static files)"| Vercel
    Browser -->|"POST /api/*"| Vercel
    Browser -->|"Auth, DB queries (anon key)"| Supabase
    Browser -->|"Events"| GA4

    Vercel -->|"SQL (service_role key)"| Supabase
    Vercel -->|"REST API (secret key)"| Stripe
    Vercel -->|"generateContent()"| Gemini
    Vercel -->|"emails.send()"| Resend

    Stripe -->|"Webhook events\nPOST /api/stripe/webhook"| Vercel
```

---

## Diagram 2: Authentication Flow

```mermaid
sequenceDiagram
    actor User
    participant App as React App
    participant Supabase as Supabase Auth
    participant Google as Google OAuth

    User->>App: Click "Sign In with Google"
    App->>Supabase: signInWithOAuth({ provider: 'google' })
    Supabase->>Google: Redirect to Google consent screen
    Google->>User: Show consent screen
    User->>Google: Approve
    Google->>Supabase: Auth code
    Supabase->>App: Redirect to APP_URL with session token
    App->>Supabase: getSession()
    Supabase-->>App: Session (access_token, user)
    App->>Supabase: SELECT * FROM profiles WHERE id = user.id
    Supabase-->>App: Profile (role, subscription_tier, has_used_trial)
    App->>App: getEffectivePlan(profile, session) → currentPlan
    App->>User: Render dashboard with correct plan features
```

The `profiles` row is auto-created by the `on_auth_user_created` trigger on `auth.users` INSERT (migration `20260604000002_capture_auth_trigger.sql`).

---

## Diagram 3: Report Generation Flow

```mermaid
sequenceDiagram
    actor User
    participant App as React App (client)
    participant API as /api/analyze (Vercel fn)
    participant Supabase as Supabase DB
    participant Cache as report_cache
    participant Gemini as Google Gemini

    User->>App: Submit business idea + location
    App->>App: Check client-side quota (localStorage)
    App->>API: POST /api/analyze\n{ businessIdea, location, reportType }
    API->>API: verifyAuth() — validate JWT from Authorization header
    API->>Supabase: SELECT profile (role, subscription_tier)
    Supabase-->>API: Profile
    API->>API: getEffectivePlan(profile) → plan
    API->>Supabase: checkStandardQuota(userId, plan)\n+ checkTrialQuota if trialing
    Supabase-->>API: { allowed: true/false, count }

    alt Quota exceeded
        API-->>App: 429 { error: 'quota_exceeded' }
        App->>User: Show upgrade CTA
    else Cache hit
        API->>Cache: SELECT report WHERE business_type+location+report_type+analysis_version match
        Cache-->>API: Cached report
        API->>Supabase: increment_usage_tracking() RPC
        API->>Supabase: INSERT usage_logs (cache_status=hit)
        API-->>App: 200 { report, source: cache }
    else Generate new
        API->>Gemini: generateContent(prompt)
        Gemini-->>API: Report JSON
        API->>Cache: INSERT INTO report_cache
        API->>Supabase: increment_usage_tracking() RPC
        API->>Supabase: INSERT usage_logs (cache_status=miss)
        API-->>App: 200 { report, source: generated }
        App->>User: Render report
    end
```

---

## Diagram 4: Stripe Subscription Lifecycle

```mermaid
sequenceDiagram
    actor User
    participant App as React App
    participant API as /api/stripe/* (Vercel fn)
    participant Stripe as Stripe
    participant Webhook as /api/stripe/webhook (Vercel fn)
    participant Supabase as Supabase DB

    User->>App: Click "Get Pro"
    App->>API: POST /api/stripe/create-checkout-session\n{ plan: 'Pro' }
    API->>API: verifyAuth() + check trial eligibility
    API->>Stripe: stripe.checkout.sessions.create()\n(with trial_period_days=7 if eligible)
    Stripe-->>API: { url: 'https://checkout.stripe.com/...' }
    API-->>App: { url }
    App->>Stripe: Redirect browser to checkout URL

    User->>Stripe: Enter payment details + confirm
    Stripe->>App: Redirect to APP_URL/?view=billing

    Stripe->>Webhook: POST checkout.session.completed
    Webhook->>Supabase: begin_stripe_event() RPC — claim event
    Webhook->>Stripe: Retrieve subscription details
    Webhook->>Supabase: UPSERT subscriptions (status, plan, period dates)
    Webhook->>Supabase: UPDATE profiles SET subscription_tier = 'Pro' (or 'ProPlus')
    Note over Webhook,Supabase: If trialing: also SET has_used_trial = true
    Webhook->>Supabase: complete_stripe_event() RPC

    App->>API: GET /api/stripe/subscription-status
    API->>Supabase: SELECT subscriptions + profiles
    Supabase-->>API: Active subscription data
    API-->>App: { status: 'active', plan: 'Pro' }
    App->>User: Show updated plan + features
```

---

## Diagram 5: Plan Entitlement Resolution

```mermaid
flowchart TD
    Start([User requests plan]) --> Demo{VITE_DEMO_MODE?}
    Demo -->|true| DemoPlan[Return demo plan override]
    Demo -->|false| AdminCheck{profiles.role = 'Admin'?}
    AdminCheck -->|yes| Enterprise[Return 'Enterprise']
    AdminCheck -->|no| BetaFull{VITE_BETA_FULL_ACCESS=true\nAND authenticated?}
    BetaFull -->|yes| ProPlus1[Return 'Pro+']
    BetaFull -->|no| BetaTester{profiles.role = 'BetaTester'?}
    BetaTester -->|yes| ProPlus2[Return 'Pro+']
    BetaTester -->|no| DBTier{profiles.subscription_tier?}
    DBTier -->|Pro| ReturnPro[Return 'Pro']
    DBTier -->|ProPlus| ReturnProPlus[Return 'Pro+']
    DBTier -->|Enterprise| ReturnEnt[Return 'Enterprise']
    DBTier -->|Explorer or null| ReturnExplorer[Return 'Explorer']
```

This logic lives entirely in `src/utils/planUtils.ts → getEffectivePlan()`. All feature gates call this function — never the raw DB tier directly.

---

## Diagram 6: Quota Enforcement (Server-Side)

```mermaid
flowchart TD
    Request([POST /api/analyze]) --> Auth[verifyAuth\nJWT validation]
    Auth -->|fail| Auth401[Return 401]
    Auth -->|pass| Profile[Fetch profile\nrole + subscription_tier]
    Profile --> Plan[getEffectivePlan\ncurrentPlan]

    Plan --> TrialCheck{subscriptions.status\n= 'trialing'?}
    TrialCheck -->|yes| TrialQuota[checkTrialQuota\nusage_tracking WHERE month_key='trial']
    TrialCheck -->|no| StdQuota[checkStandardQuota\nusage_tracking WHERE month_key=YYYY-MM]

    TrialQuota -->|count >= 5| Block429Trial[Return 429 quota_exceeded]
    TrialQuota -->|under limit| CacheCheck
    StdQuota -->|count >= PLAN_LIMITS| Block429Std[Return 429 quota_exceeded]
    StdQuota -->|under limit| CacheCheck

    CacheCheck{Cache hit?} -->|yes| ReturnCached[Return cached report\nincrement_usage_tracking\nINSERT usage_logs cache_status=hit]
    CacheCheck -->|no| Gemini[Call Google Gemini\ngenerateContent]
    Gemini -->|success| ReturnNew[Return new report\nINSERT report_cache\nincrement_usage_tracking\nINSERT usage_logs cache_status=miss]
    Gemini -->|error| Return500[Return 500 api_error]
```

**Fail-open design:** if `checkStandardQuota` or `checkTrialQuota` throws a DB exception, the check returns `{ allowed: true }`. The report is generated. This prevents DB downtime from blocking users. The risk is a small number of extra reports during outages.

---

## Database Schema Relationships

```mermaid
erDiagram
    profiles {
        uuid id PK
        text email
        text full_name
        text avatar_url
        text role
        text subscription_tier
        bool has_used_trial
        timestamptz created_at
        timestamptz updated_at
    }

    subscriptions {
        uuid id PK
        uuid user_id FK
        text stripe_customer_id
        text stripe_subscription_id
        text plan
        text status
        timestamptz trial_started_at
        timestamptz trial_ends_at
        timestamptz cancel_at
        timestamptz current_period_start
        timestamptz current_period_end
        timestamptz created_at
        timestamptz updated_at
    }

    saved_reports {
        uuid id PK
        uuid user_id FK
        text report_type
        text business_type
        text location
        jsonb report_data
        timestamptz created_at
    }

    usage_tracking {
        uuid id PK
        uuid user_id FK
        text report_type
        text month_key
        int count
        timestamptz updated_at
    }

    usage_logs {
        uuid id PK
        uuid user_id FK
        text report_type
        timestamptz generated_at
        bool within_hard_cap
        text plan
    }

    stripe_event_log {
        text event_id PK
        text event_type
        text state
        integer attempt_count
        timestamptz last_attempted_at
        timestamptz processed_at
        text last_error
        timestamptz created_at
    }

    report_cache {
        uuid id PK
        text business_type
        text location
        text report_type
        text analysis_version
        text plan_tier
        jsonb report
        timestamptz created_at
        timestamptz updated_at
    }

    profiles ||--o{ subscriptions : "user_id"
    profiles ||--o{ saved_reports : "user_id"
    profiles ||--o{ usage_tracking : "user_id"
    profiles ||--o{ usage_logs : "user_id"
```

---

## Key Design Decisions

**`?view=` routing instead of React Router:** The SPA was built without a routing library to reduce bundle size and avoid router configuration complexity for a relatively small number of views. The SPA catch-all rewrite in `vercel.json` handles direct URL access.

**Fail-open quota:** Both `checkStandardQuota` and `checkTrialQuota` return `{ allowed: true }` on DB error. The alternative (fail-closed) would block users during database outages. Given the low monetary cost of a few extra Gemini API calls versus the user experience cost of blocking, fail-open was chosen.

**Client-side `localStorage` quota shadow:** `usageTrackerService.ts` maintains a localStorage copy of usage for instant UI feedback (so the UI can disable the "Generate" button immediately without waiting for a server round-trip). This is supplementary — the server is authoritative. Discrepancies are corrected when `/api/usage-summary` is fetched.

**`ProPlus` vs `Pro+` mapping:** Postgres `CHECK` constraints require identifiers without special characters. The DB enum uses `ProPlus`; the UI and Stripe display `Pro+`. The mapping lives in `PLAN_TO_DB_TIER` and `DB_TIER_TO_PLAN` in `src/utils/planUtils.ts` and `api/stripe/_shared.ts`. All code must go through these maps.

**Webhook idempotency via `stripe_event_log`:** Stripe may deliver the same webhook event multiple times (at-least-once delivery). The `begin_stripe_event` RPC uses a PRIMARY KEY constraint on `event_id` to ensure only one handler claims each event. Subsequent deliveries of the same event ID return `processed` immediately.

**`protect_profile_columns` trigger:** Prevents authenticated users from escalating their own `role` or `subscription_tier` via the anon key client. The trigger inspects the session's JWT role and blocks writes to sensitive columns unless the session is `service_role`.

---

## Security Boundaries

| Boundary | Enforcement |
|---|---|
| Client → Supabase (anon) | RLS policies on all tables; `protect_profile_columns` trigger |
| Client → Vercel API functions | `verifyAuth()` validates Supabase JWT before any privileged operation |
| Stripe → Vercel webhook | `stripe.webhooks.constructEvent()` verifies HMAC signature using `STRIPE_WEBHOOK_SECRET` |
| Vercel → Supabase writes | `SUPABASE_SERVICE_ROLE_KEY` used only in serverless functions (never exposed to client) |
| Gemini API | `GEMINI_API_KEY` is a server-only env var (no `VITE_` prefix) |
