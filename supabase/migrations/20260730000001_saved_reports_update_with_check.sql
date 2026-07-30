-- ============================================================
-- Migration: add explicit WITH CHECK to saved_reports UPDATE policy
-- ============================================================
-- The saved_reports_update_own UPDATE policy has USING but no
-- explicit WITH CHECK. PostgreSQL implicitly applies the USING
-- expression as WITH CHECK when WITH CHECK is absent (so the
-- ownership transfer is already blocked at runtime). However:
--   • pg_policies shows with_check = null, which fails security
--     audits and is invisible in schema dumps.
--   • Relying on implicit fallback behavior is fragile and
--     non-obvious to future reviewers.
--
-- This migration drops and recreates the UPDATE policy with an
-- explicit WITH CHECK clause, making the protection auditable.
-- SELECT, INSERT, and DELETE policies are unchanged.
-- ============================================================

-- Drop the existing UPDATE policy (PostgreSQL does not support
-- ALTER POLICY ... ADD WITH CHECK; a recreate is required).
DROP POLICY IF EXISTS "saved_reports_update_own" ON public.saved_reports;

-- Recreate with both USING and explicit WITH CHECK.
-- USING   → determines which existing rows the user may update (OLD row).
-- WITH CHECK → ensures the NEW row still belongs to the same user.
-- Together they guarantee a user can only update their own rows and
-- cannot change user_id to a different owner.
CREATE POLICY "saved_reports_update_own"
  ON public.saved_reports
  FOR UPDATE
  TO authenticated
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
