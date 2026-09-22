BEGIN;
CREATE TABLE IF NOT EXISTS public.password_resets (
 user_id text PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
 token_hash text UNIQUE NOT NULL,
 expires bigint NOT NULL,
 requested_at bigint NOT NULL
);
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.password_resets FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
  REVOKE ALL ON public.password_resets FROM anon;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
  REVOKE ALL ON public.password_resets FROM authenticated;
 END IF;
END $$;
COMMIT;
