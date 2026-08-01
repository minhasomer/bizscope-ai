# BizScope Assistant — Operational Procedures

## Kill-Switch and Rollback

### Important: Vercel environment-variable changes require redeployment

**Environment variable changes do NOT affect the currently running production deployment.**
A change to a Vercel environment variable only takes effect after a new deployment is created
and promoted to Production. Any procedure that omits the redeployment step is incorrect.

---

### Fastest safe shutdown (server-side only)

1. In Vercel, set `BIZSCOPE_CHAT_ENABLED=false` for the **Production** environment.
2. Redeploy the current production code (Vercel dashboard → Deployments → Redeploy, or `vercel deploy --prod`).
3. Wait for the deployment to complete and become active.
4. Verify: `curl https://www.bizscope.app/api/chat` returns `503 CHAT_DISABLED`.

This leaves the UI button visible but all chat requests blocked server-side.

---

### Hide the UI button

After completing the server-side shutdown above:

5. Set `VITE_BIZSCOPE_CHAT_ENABLED=false` for the **Production** environment.
6. Redeploy Production again (requires a new deployment — the bundle is rebuilt).
7. Verify the floating chatbot button is absent from the page.

---

### Full rollback to prior stable deployment

Roll back to prior stable deployment `bizscope-1dg0gjsxb` via:

```
vercel rollback bizscope-1dg0gjsxb --scope=<team>
```

Or in the Vercel dashboard: Deployments → select `bizscope-1dg0gjsxb` → Promote to Production.

The `chat_usage_daily` table and its two RPCs (`chat_check_and_increment`, `chat_log_cost`) are
additive and do not affect any pre-chatbot functionality. Leave them in place unless a separate
database-removal decision is made.

---

## Global Usage Ceilings

Production ceilings as of 2026-08-01. Both ceiling values are enforced in `api/chat.ts` and
read from Vercel Production environment variables.

| Ceiling | Value | Env var |
|---|---|---|
| Daily request ceiling | 500 requests | `CHAT_GLOBAL_DAILY_REQUEST_LIMIT` |
| Daily estimated cost ceiling | $3.00 | `CHAT_GLOBAL_DAILY_COST_LIMIT_USD` |

When either ceiling is reached, `/api/chat` returns `503 GLOBAL_LIMIT_REACHED` for all users
until UTC midnight resets the `chat_usage_daily` counters.

To change a ceiling: update the env var in Vercel, then redeploy. The change does not take
effect until the new deployment is active.

---

## Per-User Daily Limits

| User type | Limit | Env var |
|---|---|---|
| Anonymous | 3 | `CHAT_ANONYMOUS_DAILY_LIMIT` |
| Explorer | 10 | `CHAT_EXPLORER_DAILY_LIMIT` |
| Pro | 30 | `CHAT_PRO_DAILY_LIMIT` |
| Pro+ / BetaTester | 60 | `CHAT_PROPLUS_DAILY_LIMIT` |
| Enterprise | 100 | `CHAT_ENTERPRISE_DAILY_LIMIT` |
| Admin | 250 | `CHAT_ADMIN_DAILY_LIMIT` |

---

## Monitoring

Admin users can view aggregate chatbot metrics from the Admin Panel → Chat Metrics section,
or by calling `GET /api/admin/cost-summary` with a valid Admin session token.

The response includes a `chat` object:

```json
{
  "chat": {
    "today": {
      "messages": 120,
      "blockedRequests": 15,
      "anonymous":     { "messages": 80, "blocked": 10 },
      "authenticated": { "messages": 40, "blocked": 5 },
      "inputTokens": 45000,
      "outputTokens": 18000,
      "estimatedCostUsd": 0.42,
      "globalRequestsUsed": 120,
      "globalRequestLimit": 500,
      "globalCostUsedUsd": 0.42,
      "globalCostLimitUsd": 3.0
    },
    "monthToDate": {
      "messages": 450,
      "estimatedCostUsd": 1.80
    }
  }
}
```

Identity keys (SHA-256 hashes), user IDs, raw IPs, and message contents are never returned.
Report AI costs (`totalCostUsd`) and chatbot AI costs (`chat.today.estimatedCostUsd`) are
labeled separately and never combined in the same field.

---

## Database Objects

All chatbot database objects are in Supabase project `mihnhslmxhsztvmeqmur` (Production).

| Object | Type | Notes |
|---|---|---|
| `public.chat_usage_daily` | Table | Per-identity daily usage; RLS deny-all; service_role only |
| `public.chat_check_and_increment` | RPC | Atomic limit check + increment; SECURITY DEFINER |
| `public.chat_log_cost` | RPC | Additive cost update; SECURITY DEFINER |

Both RPCs have `EXECUTE` revoked from `PUBLIC` and `anon`/`authenticated` roles.
Only `service_role` (used by `api/chat.ts` server-side) may call them.
