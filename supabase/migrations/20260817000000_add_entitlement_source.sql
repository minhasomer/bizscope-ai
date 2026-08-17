-- Additive migration: add entitlement_source to report_activity_log
-- Values: 'plan' | 'trial' | 'decision_pass'
ALTER TABLE public.report_activity_log
  ADD COLUMN IF NOT EXISTS entitlement_source TEXT;
