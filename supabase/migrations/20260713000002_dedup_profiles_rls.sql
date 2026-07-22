-- ============================================================
-- Migration: remove duplicate RLS policies on profiles
-- ============================================================
-- Production has two sets of identical policies on profiles:
--   {public}        — "Users can view/insert/update own profile"
--   {authenticated} — profiles_select/insert/update_own
-- The {public} set is drift from an earlier manual creation.
-- The {authenticated} set (created by 20260604000001) is
-- canonical. This migration drops the duplicates.
-- ============================================================

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
