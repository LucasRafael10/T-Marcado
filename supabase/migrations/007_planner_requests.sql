-- Executar no SQL Editor do Supabase após 006_admin_approvals.sql.
-- Pode ser executado novamente. Preserva contas, eventos e acessos existentes.
BEGIN;
CREATE TABLE IF NOT EXISTS public.planner_requests (
 id text PRIMARY KEY,
 event_id text NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
 planner_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),
 requested_at bigint NOT NULL,
 reviewed_at bigint,
 UNIQUE(event_id,planner_id)
);
CREATE INDEX IF NOT EXISTS idx_planner_requests_queue ON public.planner_requests(planner_id,status,requested_at);
ALTER TABLE public.planner_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.planner_requests FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
  REVOKE ALL ON public.planner_requests FROM anon;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
  REVOKE ALL ON public.planner_requests FROM authenticated;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='tamarcado_app') THEN
  REVOKE ALL ON public.planner_requests FROM tamarcado_app;
  GRANT SELECT,INSERT,UPDATE,DELETE ON public.planner_requests TO tamarcado_app;
  DROP POLICY IF EXISTS tamarcado_runtime ON public.planner_requests;
  CREATE POLICY tamarcado_runtime ON public.planner_requests TO tamarcado_app USING (true) WITH CHECK (true);
 END IF;
END $$;
COMMIT;
