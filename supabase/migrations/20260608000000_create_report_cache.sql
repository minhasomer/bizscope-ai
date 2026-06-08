-- ============================================================
-- Migration: create report_cache table
-- Phase 1 — Shared server-side report cache
-- ============================================================
-- Stores generated Gemini reports keyed by (business_type,
-- location, report_type, plan_tier, analysis_version).
-- Accessed exclusively via the Supabase service-role key from
-- the Express backend. No authenticated-user access is granted.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.report_cache (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_type     TEXT        NOT NULL,
  location          TEXT        NOT NULL,
  report_type       TEXT        NOT NULL,
  plan_tier         TEXT        NOT NULL,
  analysis_version  TEXT        NOT NULL DEFAULT 'v1',
  report            JSONB       NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT report_cache_unique_key
    UNIQUE (business_type, location, report_type, plan_tier, analysis_version)
);

-- Fast lookup by the four key dimensions
CREATE INDEX IF NOT EXISTS idx_report_cache_lookup
  ON public.report_cache (business_type, location, report_type, plan_tier, analysis_version);

-- Support pruning old entries by age
CREATE INDEX IF NOT EXISTS idx_report_cache_created_at
  ON public.report_cache (created_at);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- RLS is enabled but NO authenticated-user policies are created.
-- Only the service-role key (used by the Express backend) bypasses RLS.
-- Authenticated clients (anon key) will be denied all access.

ALTER TABLE public.report_cache ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT/UPDATE/DELETE policies for authenticated users.
-- Service-role key bypasses RLS by design — that is intentional and correct.
