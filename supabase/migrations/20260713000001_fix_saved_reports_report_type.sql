-- ============================================================
-- Migration: fix saved_reports report_type CHECK constraint
-- ============================================================
-- The original constraint in 20260605000000 only allows
-- 'standard' and 'regional'. Market gap reports use
-- report_type = 'market_gap', which violates the constraint
-- and causes silent fallback to localStorage on every save.
-- This migration drops the old constraint and replaces it.
-- ============================================================

DO $$
DECLARE
  v_constraint text;
BEGIN
  SELECT conname INTO v_constraint
  FROM pg_constraint
  WHERE conrelid = 'public.saved_reports'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%report_type%';

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.saved_reports DROP CONSTRAINT %I', v_constraint);
  END IF;
END $$;

ALTER TABLE public.saved_reports
  ADD CONSTRAINT saved_reports_report_type_check
  CHECK (report_type IN ('standard', 'regional', 'market_gap'));
