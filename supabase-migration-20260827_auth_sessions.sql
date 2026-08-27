-- ELNUBY HR: server-side authentication sessions
-- Run this once in Supabase SQL Editor before deploying the application.
-- The Next.js server uses the service-role key; browser clients do not need
-- direct access to this table.

create table if not exists public.app_sessions (
  session_id text primary key,
  token_hash text not null unique,
  user_id text not null,
  expires_at timestamptz not null,
  last_used_at timestamptz not null default now(),
  revoked_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists app_sessions_token_hash_idx
  on public.app_sessions (token_hash);

create index if not exists app_sessions_user_id_idx
  on public.app_sessions (user_id);

create index if not exists app_sessions_active_idx
  on public.app_sessions (expires_at)
  where revoked_at is null;

alter table public.app_sessions enable row level security;

-- Explicitly deny browser roles. The service-role server bypasses RLS.
drop policy if exists app_sessions_no_browser_access on public.app_sessions;
create policy app_sessions_no_browser_access
  on public.app_sessions
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- Remove expired sessions safely.
delete from public.app_sessions
where expires_at <= now() or revoked_at is not null;
