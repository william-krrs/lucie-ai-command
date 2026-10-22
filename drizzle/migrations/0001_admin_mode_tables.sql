CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_user_id uuid,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_audit_log service all" ON public.admin_audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX admin_audit_log_target_idx ON public.admin_audit_log (target_user_id, created_at DESC);

CREATE TABLE public.admin_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  name text,
  company text,
  email text,
  phone text,
  trade text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_clients TO service_role;
ALTER TABLE public.admin_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_clients service all" ON public.admin_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER admin_clients_updated_at BEFORE UPDATE ON public.admin_clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.client_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_key text NOT NULL,
  body text NOT NULL,
  author_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.client_notes TO service_role;
ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client_notes service all" ON public.client_notes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX client_notes_key_idx ON public.client_notes (client_key, created_at DESC);

CREATE TABLE public.journey_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  page text NOT NULL CHECK (page IN ('demonstration','offers','configuration','installation','setup_test')),
  unlocked boolean NOT NULL DEFAULT true,
  by_admin uuid NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, page)
);
GRANT SELECT ON public.journey_overrides TO authenticated;
GRANT ALL ON public.journey_overrides TO service_role;
ALTER TABLE public.journey_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "journey_overrides own select" ON public.journey_overrides FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "journey_overrides service all" ON public.journey_overrides FOR ALL TO service_role USING (true) WITH CHECK (true);