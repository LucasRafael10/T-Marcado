-- Executar uma vez no SQL Editor do Supabase. Não apaga dados existentes.
-- Autenticação própria no servidor Node; estas tabelas NÃO usam Supabase Auth.
BEGIN;
CREATE TABLE IF NOT EXISTS public.users (
 id text PRIMARY KEY, nome text NOT NULL,
 email text UNIQUE NOT NULL CHECK(email=lower(email)), password text NOT NULL,
 role text NOT NULL CHECK(role IN ('noiva','cerimonialista'))
);
CREATE TABLE IF NOT EXISTS public.sessions (
 token text PRIMARY KEY, user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 expires bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON public.sessions(expires);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.sessions(user_id);
CREATE TABLE IF NOT EXISTS public.events (
 id text PRIMARY KEY, owner text NOT NULL REFERENCES public.users(id),
 titulo text NOT NULL, tipo text NOT NULL,
 data text NOT NULL CHECK(data ~ '^\d{4}-\d{2}-\d{2}$'), local text NOT NULL,
 prazo text NOT NULL CHECK(prazo ~ '^\d{4}-\d{2}-\d{2}$'), CHECK(prazo<=data)
);
CREATE INDEX IF NOT EXISTS idx_events_owner ON public.events(owner);
CREATE TABLE IF NOT EXISTS public.access (
 event_id text REFERENCES public.events(id) ON DELETE CASCADE,
 user_id text REFERENCES public.users(id) ON DELETE CASCADE,
 PRIMARY KEY(event_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_access_user ON public.access(user_id);
CREATE TABLE IF NOT EXISTS public.guests (
 id text PRIMARY KEY, event_id text NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
 token text UNIQUE NOT NULL, nome text NOT NULL, telefone text NOT NULL,
 grupo text NOT NULL, limite integer NOT NULL CHECK(limite BETWEEN 1 AND 30),
 status text NOT NULL CHECK(status IN ('pendente','aprovacao','confirmado','recusado')),
 lugares integer NOT NULL DEFAULT 0 CHECK(lugares>=0 AND lugares<=limite),
 restricao text NOT NULL DEFAULT '', criancas integer NOT NULL DEFAULT 0 CHECK(criancas>=0 AND criancas<=lugares),
 recado text NOT NULL DEFAULT '', respondido text NOT NULL DEFAULT '',
 UNIQUE(event_id,telefone), UNIQUE(event_id,id),
 CHECK((status='confirmado' AND lugares>=1) OR (status<>'confirmado' AND lugares=0))
);
CREATE INDEX IF NOT EXISTS idx_guests_event ON public.guests(event_id);
CREATE TABLE IF NOT EXISTS public.gifts (
 id text PRIMARY KEY, event_id text NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
 nome text NOT NULL, valor numeric(12,2) NOT NULL CHECK(valor>=0 AND valor<=1000000),
 guest_id text,
 FOREIGN KEY(event_id,guest_id) REFERENCES public.guests(event_id,id)
);
CREATE INDEX IF NOT EXISTS idx_gifts_event ON public.gifts(event_id);
CREATE INDEX IF NOT EXISTS idx_gifts_guest ON public.gifts(guest_id);
-- Sem políticas públicas: o navegador não pode ler senhas, sessões ou convidados.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.users,public.sessions,public.events,public.access,public.guests,public.gifts FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
  REVOKE ALL ON public.users,public.sessions,public.events,public.access,public.guests,public.gifts FROM anon;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
  REVOKE ALL ON public.users,public.sessions,public.events,public.access,public.guests,public.gifts FROM authenticated;
 END IF;
END $$;
COMMIT;
