-- Additive migration: keyed hash of the client IP for anonymous previews,
-- used by api/preview.ts to limit previews per IP per day. Raw IPs are never stored.
ALTER TABLE public.usage_logs
  ADD COLUMN IF NOT EXISTS ip_hash TEXT;

CREATE INDEX IF NOT EXISTS usage_logs_preview_ip_hash_idx
  ON public.usage_logs (ip_hash, generated_at)
  WHERE report_type = 'preview';
