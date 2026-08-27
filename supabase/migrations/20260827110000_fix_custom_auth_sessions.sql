-- Fix custom-auth session storage used by the Next.js HR API.
-- The application stores sessions in public.app_sessions, while HR users live in hr.users.
-- Keep this table independent from Supabase Auth and safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS public.app_sessions (
  session_id text PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  user_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_sessions
  ADD COLUMN IF NOT EXISTS session_id text;
ALTER TABLE public.app_sessions
  ADD COLUMN IF NOT EXISTS token_hash text;
ALTER TABLE public.app_sessions
  ADD COLUMN IF NOT EXISTS user_id text;
ALTER TABLE public.app_sessions
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.app_sessions
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz;
ALTER TABLE public.app_sessions
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
ALTER TABLE public.app_sessions
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_sessions_token_hash
  ON public.app_sessions(token_hash);

CREATE INDEX IF NOT EXISTS idx_app_sessions_user_id
  ON public.app_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_app_sessions_expires_at
  ON public.app_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_app_sessions_active_token
  ON public.app_sessions(token_hash, expires_at)
  WHERE revoked_at IS NULL;

-- Sessions are accessed only by the server with the Supabase service-role key.
ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deny_direct_client_access ON public.app_sessions;
CREATE POLICY deny_direct_client_access
  ON public.app_sessions
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMIT;
