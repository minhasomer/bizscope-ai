-- ============================================================
-- Migration: version the report_activity_log table
-- ============================================================
-- report_activity_log records one row per report attempt (success
-- and failure) across all four generation endpoints. It mirrors the
-- authoritative cost figure (estimated_ai_cost) computed alongside
-- usage_logs so the two tables reconcile.
--
-- This table previously existed ONLY as a hand-created table in the
-- live database with no CREATE in source control. This migration
-- brings it under version control. It is IDEMPOTENT and NON-DESTRUCTIVE:
--   - CREATE TABLE IF NOT EXISTS only fires on a fresh database;
--   - ADD COLUMN IF NOT EXISTS only adds genuinely missing columns;
--   - no column is dropped, retyped, or have data altered.
--
-- Schema reconstructed from the insert payloads across api/analyze.ts,
-- api/preview.ts, api/opportunities.ts, api/opportunity-dossier.ts.
--
-- Accessed exclusively via the Supabase service-role key.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.report_activity_log (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID,
  user_email          TEXT,
  report_type         TEXT        NOT NULL,
  business_type       TEXT,
  location            TEXT,
  normalized_location TEXT,
  plan_tier           TEXT,
  cache_status        TEXT,
  force_regenerate    BOOLEAN     DEFAULT FALSE,
  success             BOOLEAN     NOT NULL DEFAULT TRUE,
  error_message       TEXT,
  source              TEXT,
  duration_ms         INTEGER,
  metadata            JSONB,
  ai_model            TEXT,
  input_tokens        INTEGER,
  output_tokens       INTEGER,
  total_tokens        INTEGER,
  estimated_ai_cost   NUMERIC(10,6),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reconcile a pre-existing live table that may predate the
-- cost-accounting columns. (No-ops where the column already exists.)
ALTER TABLE public.report_activity_log ADD COLUMN IF NOT EXISTS ai_model          TEXT;
ALTER TABLE public.report_activity_log ADD COLUMN IF NOT EXISTS input_tokens      INTEGER;
ALTER TABLE public.report_activity_log ADD COLUMN IF NOT EXISTS output_tokens     INTEGER;
ALTER TABLE public.report_activity_log ADD COLUMN IF NOT EXISTS total_tokens      INTEGER;
ALTER TABLE public.report_activity_log ADD COLUMN IF NOT EXISTS estimated_ai_cost NUMERIC(10,6);
ALTER TABLE public.report_activity_log ADD COLUMN IF NOT EXISTS metadata          JSONB;

CREATE INDEX IF NOT EXISTS report_activity_log_created_at_idx ON public.report_activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS report_activity_log_report_type_idx ON public.report_activity_log (report_type);

ALTER TABLE public.report_activity_log ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON TABLE public.report_activity_log TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

NOTIFY pgrst, 'reload schema';
