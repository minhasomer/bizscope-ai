-- ============================================================
-- Migration: usage_tracking atomic-increment RPC + grants
-- ============================================================
-- Versions the previously-loose supabase/usage_tracking_rpc.sql.
-- Provides the atomic increment_usage_tracking() RPC used by all
-- generation endpoints for quota counting.
--
-- ASSUMES public.usage_tracking already exists (it does in the live
-- DB; it is not defined in source control). This migration does NOT
-- create it — creating it blind would be guessing at its schema.
-- For a fresh database, create usage_tracking before running this.
--
-- Idempotent: the unique constraint is added only if absent;
-- CREATE OR REPLACE FUNCTION and GRANTs are inherently repeatable.
-- ============================================================

-- 1. One row per (user, report_type, month) so the RPC can upsert atomically.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'usage_tracking_user_report_month_key'
  ) THEN
    ALTER TABLE public.usage_tracking
      ADD CONSTRAINT usage_tracking_user_report_month_key UNIQUE (user_id, report_type, month_key);
  END IF;
END $$;

-- 2. Atomic increment RPC — avoids read-then-write races under concurrency.
CREATE OR REPLACE FUNCTION public.increment_usage_tracking(
  p_user_id uuid,
  p_report_type text,
  p_month_key text
) RETURNS public.usage_tracking
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.usage_tracking;
BEGIN
  INSERT INTO public.usage_tracking (user_id, report_type, usage_date, month_key, count)
  VALUES (p_user_id, p_report_type, CURRENT_DATE, p_month_key, 1)
  ON CONFLICT (user_id, report_type, month_key)
  DO UPDATE SET count = public.usage_tracking.count + 1, updated_at = now()
  RETURNING * INTO result;
  RETURN result;
END;
$$;

-- 3. Grants — service_role needs explicit table + sequence + function grants,
--    or every insert/select/RPC call silently fails with "permission denied".
GRANT SELECT, INSERT, UPDATE ON TABLE public.usage_tracking TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_usage_tracking(uuid, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
