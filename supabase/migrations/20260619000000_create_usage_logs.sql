-- ============================================================
-- Migration: create usage_logs table (canonical AI cost ledger)
-- ============================================================
-- One row per real Gemini report generated via /api/analyze,
-- /api/preview, /api/opportunities, /api/opportunity-dossier.
-- This is the canonical cost source of truth; report_activity_log
-- mirrors estimated_ai_cost from the same computed figure.
--
-- Previously this lived as a loose supabase/usage_logs.sql that was
-- never applied as a migration AND carried no service_role grants —
-- so inserts failed silently ("relation does not exist" or
-- "permission denied"). This migration is idempotent and adds the
-- grants this project established are mandatory (see
-- usage_tracking_rpc migration).
--
-- Accessed exclusively via the Supabase service-role key. No
-- authenticated-user access is granted.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.usage_logs (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email         TEXT        NOT NULL,
  user_role          TEXT        NOT NULL,
  plan               TEXT        NOT NULL,
  report_type        TEXT        NOT NULL DEFAULT 'standard',
  model              TEXT        NOT NULL,
  input_tokens       INTEGER,
  output_tokens      INTEGER,
  grounding_calls    INTEGER     NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(10,6),
  within_hard_cap    BOOLEAN     NOT NULL DEFAULT TRUE,
  business_type      TEXT        NOT NULL,
  location           TEXT        NOT NULL,
  generated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Repair a pre-existing/stale table that predates later columns.
-- (No-ops when the column already exists. Table has 0 rows in the
-- environments observed, so NOT-NULL adds are safe.)
ALTER TABLE public.usage_logs ADD COLUMN IF NOT EXISTS report_type        TEXT        NOT NULL DEFAULT 'standard';
ALTER TABLE public.usage_logs ADD COLUMN IF NOT EXISTS grounding_calls    INTEGER     NOT NULL DEFAULT 0;
ALTER TABLE public.usage_logs ADD COLUMN IF NOT EXISTS within_hard_cap    BOOLEAN     NOT NULL DEFAULT TRUE;
ALTER TABLE public.usage_logs ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(10,6);
ALTER TABLE public.usage_logs ADD COLUMN IF NOT EXISTS input_tokens       INTEGER;
ALTER TABLE public.usage_logs ADD COLUMN IF NOT EXISTS output_tokens      INTEGER;

CREATE INDEX IF NOT EXISTS usage_logs_generated_at_idx ON public.usage_logs (generated_at DESC);
CREATE INDEX IF NOT EXISTS usage_logs_user_id_idx      ON public.usage_logs (user_id);

-- RLS on; no authenticated/anon policies. Service role bypasses RLS.
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

-- Table-level privileges are SEPARATE from RLS. Without these explicit
-- grants the service role gets "permission denied" on insert (the bug
-- that left this table empty). Mirrors the report_activity_log /
-- usage_tracking fix established earlier in this project.
GRANT SELECT, INSERT, UPDATE ON TABLE public.usage_logs TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

NOTIFY pgrst, 'reload schema';
