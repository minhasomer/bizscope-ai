-- Usage logs: one row per real Gemini report generated via /api/analyze
-- Run this in the Supabase SQL editor.

create table if not exists public.usage_logs (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        references auth.users(id) on delete set null,
  user_email        text        not null,
  user_role         text        not null,
  plan              text        not null,
  report_type       text        not null default 'standard',
  model             text        not null,
  input_tokens      integer,
  output_tokens     integer,
  grounding_calls   integer     not null default 0,
  estimated_cost_usd numeric(10,6),
  within_hard_cap   boolean     not null default true,
  business_type     text        not null,
  location          text        not null,
  generated_at      timestamptz not null default now()
);

-- Index for Admin cost queries (filtered by date range)
create index if not exists usage_logs_generated_at_idx on public.usage_logs (generated_at desc);
create index if not exists usage_logs_user_id_idx      on public.usage_logs (user_id);

-- Row-level security: only the service role can read/write this table.
-- Normal authenticated users have no access.
alter table public.usage_logs enable row level security;

-- No SELECT/INSERT/UPDATE/DELETE policies for authenticated or anon roles.
-- The server uses the service role key which bypasses RLS entirely.
