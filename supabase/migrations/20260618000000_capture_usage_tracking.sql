-- ============================================================
-- Migration: usage_tracking table
-- ============================================================
-- Captures the usage_tracking table created directly in
-- production. Must run before 20260619000002, which adds the
-- UNIQUE constraint and increment_usage_tracking() RPC that
-- assume this table exists.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.usage_tracking (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_type text,
  usage_date  date NOT NULL DEFAULT CURRENT_DATE,
  month_key   text,
  count       integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_tracking FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'usage_tracking' AND policyname = 'usage_tracking: select own'
  ) THEN
    CREATE POLICY "usage_tracking: select own" ON public.usage_tracking
      FOR SELECT TO public USING (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_usage_updated_at ON public.usage_tracking;
CREATE TRIGGER trg_usage_updated_at
  BEFORE UPDATE ON public.usage_tracking
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
