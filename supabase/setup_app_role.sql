-- Run as the database administrator AFTER migrations 001 through 004.
-- Dedicated SERVER role, never granted to anon/authenticated/authenticator.
-- This file contains NO password. Enable LOGIN and set a strong password
-- through your administrator connection, then update DATABASE_URL in Render.
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='tamarcado_app') THEN
    CREATE ROLE tamarcado_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='tamarcado_app'
    AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls))
    OR EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname='tamarcado_app') THEN
    RAISE EXCEPTION 'tamarcado_app já existe com privilégios amplos. Revise o papel antes de continuar.';
  END IF;
END $$;
ALTER ROLE tamarcado_app NOINHERIT;
-- PUBLIC privileges also apply to every login, regardless of NOINHERIT.
-- Existing unrelated writers to this schema need explicit CREATE grants.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO tamarcado_app;
-- Grant CONNECT on your actual production database when enabling LOGIN.
GRANT SELECT,INSERT,UPDATE ON public.users,public.events,public.guests,public.gifts TO tamarcado_app;
GRANT SELECT,INSERT ON public.access TO tamarcado_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.sessions,public.password_resets,public.email_verifications,public.rate_limits TO tamarcado_app;
-- The server needs these rows for authentication and event authorization.
-- These policies are ONLY for its dedicated role. End-user isolation remains
-- enforced in src/auth.mjs; this is not per-end-user RLS.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['users','events','guests','gifts','access','sessions','password_resets','email_verifications','rate_limits'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS tamarcado_server_access ON public.%I',t);
    EXECUTE format('CREATE POLICY tamarcado_server_access ON public.%I TO tamarcado_app USING (true) WITH CHECK (true)',t);
  END LOOP;
END $$;
ALTER ROLE tamarcado_app SET search_path = public, pg_temp;
ALTER ROLE tamarcado_app SET statement_timeout = '15s';
ALTER ROLE tamarcado_app SET idle_in_transaction_session_timeout = '30s';
COMMIT;
