-- ============================================================
-- Migration: create saved_reports table
-- Sprint 6 — Supabase Saved Reports Migration
-- ============================================================
-- Replaces localStorage-only persistence with a Supabase-backed
-- table scoped to the authenticated user. localStorage continues
-- to function as an offline fallback.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.saved_reports (
  -- Primary key: UUID so IDs are safe to expose in client responses
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner — every row belongs to exactly one Supabase Auth user.
  -- CASCADE DELETE ensures rows are cleaned up when a user account
  -- is deleted from auth.users.
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Indexed metadata columns — stored separately so queries can
  -- filter/sort without parsing the full JSONB blob.
  business_type TEXT NOT NULL,
  location      TEXT NOT NULL,
  is_favorite   BOOLEAN NOT NULL DEFAULT FALSE,
  report_type   TEXT NOT NULL DEFAULT 'standard'
                  CHECK (report_type IN ('standard', 'regional')),
  date_saved    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Full ViabilityReport payload. Everything the client needs to
  -- reconstruct the SavedReport object lives here.
  report_data   JSONB NOT NULL,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

-- Fast per-user listing (the most common query pattern)
CREATE INDEX IF NOT EXISTS idx_saved_reports_user_id
  ON public.saved_reports (user_id);

-- Support ORDER BY date_saved DESC per user
CREATE INDEX IF NOT EXISTS idx_saved_reports_user_date
  ON public.saved_reports (user_id, date_saved DESC);

-- Unique constraint: one saved record per (user, businessType, location)
-- so the service-layer duplicate check has a database-level guarantee.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_saved_reports_user_biz_loc
  ON public.saved_reports (user_id, lower(business_type), lower(location));


-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.saved_reports ENABLE ROW LEVEL SECURITY;

-- SELECT: users can only read their own rows
CREATE POLICY "saved_reports_select_own"
  ON public.saved_reports
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: users can only create rows for themselves
CREATE POLICY "saved_reports_insert_own"
  ON public.saved_reports
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: users can only modify their own rows
CREATE POLICY "saved_reports_update_own"
  ON public.saved_reports
  FOR UPDATE
  USING (auth.uid() = user_id);

-- DELETE: users can only delete their own rows
CREATE POLICY "saved_reports_delete_own"
  ON public.saved_reports
  FOR DELETE
  USING (auth.uid() = user_id);
