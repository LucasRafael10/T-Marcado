-- Execute no SQL Editor como administrador, depois de 004_security.sql.
-- A senha é definida separadamente no painel; não colocar senhas neste arquivo.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='tamarcado_app') THEN
  CREATE ROLE tamarcado_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='tamarcado_app' AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls))
 OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='tamarcado_app')) THEN
  RAISE EXCEPTION 'A role tamarcado_app já tem privilégios inesperados. Revise antes de continuar.';
 END IF;
END $$;
-- Remove criação de objetos herdada por todas as roles via PUBLIC neste schema.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO tamarcado_app;
DO $$ BEGIN
 IF NOT has_database_privilege('tamarcado_app',current_database(),'CONNECT') THEN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO tamarcado_app', current_database());
 END IF;
END $$;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['users','sessions','events','access','guests','gifts','password_resets','email_verifications','rate_limits'] LOOP
  IF EXISTS(SELECT 1 FROM pg_class WHERE oid=format('public.%I',tab)::regclass AND relowner=(SELECT oid FROM pg_roles WHERE rolname='tamarcado_app')) THEN
    RAISE EXCEPTION 'A role de execução não deve ser dona de tabelas';
  END IF;
  EXECUTE format('REVOKE ALL ON public.%I FROM tamarcado_app',tab);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO tamarcado_app',tab);
  EXECUTE format('DROP POLICY IF EXISTS tamarcado_runtime ON public.%I',tab);
  EXECUTE format('CREATE POLICY tamarcado_runtime ON public.%I TO tamarcado_app USING (true) WITH CHECK (true)',tab);
 END LOOP;
END $$;
ALTER ROLE tamarcado_app SET search_path = public, pg_catalog;
ALTER ROLE tamarcado_app SET statement_timeout = '15s';
ALTER ROLE tamarcado_app SET idle_in_transaction_session_timeout = '15s';
COMMIT;
