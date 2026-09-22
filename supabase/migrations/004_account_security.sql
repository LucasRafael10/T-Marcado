BEGIN;
-- Existing accounts must also prove ownership; no existing data is removed.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS public.email_verifications (
  user_id text PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash text UNIQUE NOT NULL,
  expires bigint NOT NULL,
  requested_at bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS public.rate_limits (
  bucket text PRIMARY KEY,
  hits integer NOT NULL CHECK(hits > 0),
  expires_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_expiry ON public.rate_limits(expires_at);
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_verifications, public.rate_limits FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON public.email_verifications, public.rate_limits FROM anon;
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON public.email_verifications, public.rate_limits FROM authenticated;
  END IF;
END $$;
COMMIT;
