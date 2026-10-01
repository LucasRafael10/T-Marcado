-- Executar como administrador após 005_runtime_role.sql, antes de ativar modo manual.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='account_status') THEN
  ALTER TABLE public.users ADD COLUMN account_status text NOT NULL DEFAULT 'pending' CHECK(account_status IN ('pending','approved','rejected'));
  -- Preserva o acesso das contas que já haviam confirmado seu e-mail.
  UPDATE public.users SET account_status='approved' WHERE email_verified=true;
 END IF;
END $$;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at bigint NOT NULL DEFAULT ((extract(epoch from clock_timestamp())*1000)::bigint);
CREATE TABLE IF NOT EXISTS public.admin_sessions (
 token_hash text PRIMARY KEY, admin_email text NOT NULL, credential_version text NOT NULL,
 expires bigint NOT NULL, created_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expiry ON public.admin_sessions(expires);
CREATE TABLE IF NOT EXISTS public.manual_access_requests (
 id text PRIMARY KEY, user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('password_reset','activation')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','completed')),
 requested_at bigint NOT NULL, reviewed_at bigint, reviewed_by text,
 token_hash text UNIQUE, expires bigint, completed_at bigint
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_pending_manual_request ON public.manual_access_requests(user_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS idx_manual_requests_queue ON public.manual_access_requests(status,requested_at);
CREATE TABLE IF NOT EXISTS public.admin_audit (
 id text PRIMARY KEY, actor text NOT NULL, action text NOT NULL, target_id text,
 note text NOT NULL DEFAULT '', created_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit(created_at);
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['admin_sessions','manual_access_requests','admin_audit'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC',tab);
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE format('REVOKE ALL ON public.%I FROM anon',tab); END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE format('REVOKE ALL ON public.%I FROM authenticated',tab); END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='tamarcado_app') THEN
   EXECUTE format('REVOKE ALL ON public.%I FROM tamarcado_app',tab);
   IF tab='admin_audit' THEN
    EXECUTE format('GRANT SELECT,INSERT ON public.%I TO tamarcado_app',tab);
   ELSE
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO tamarcado_app',tab);
   END IF;
   EXECUTE format('DROP POLICY IF EXISTS tamarcado_runtime ON public.%I',tab);
   EXECUTE format('CREATE POLICY tamarcado_runtime ON public.%I TO tamarcado_app USING (true) WITH CHECK (true)',tab);
  END IF;
 END LOOP;
END $$;
COMMIT;
