-- Audit log for sensitive tables
CREATE TABLE public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE','SELECT')),
  row_id UUID,
  actor_role TEXT NOT NULL DEFAULT current_user,
  actor_user_id UUID,
  actor_email TEXT,
  request_ip TEXT,
  request_ua TEXT,
  old_data JSONB,
  new_data JSONB,
  context JSONB
);

GRANT SELECT ON public.audit_log TO service_role;
GRANT INSERT ON public.audit_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.audit_log_id_seq TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated: service_role bypasses RLS.
CREATE INDEX audit_log_table_time_idx ON public.audit_log (table_name, occurred_at DESC);
CREATE INDEX audit_log_row_idx ON public.audit_log (row_id);
CREATE INDEX audit_log_actor_idx ON public.audit_log (actor_user_id);

-- Generic trigger function capturing writes
CREATE OR REPLACE FUNCTION public.log_table_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_email TEXT;
  v_ip TEXT;
  v_ua TEXT;
  v_ctx JSONB;
  v_row_id UUID;
BEGIN
  BEGIN
    v_uid := auth.uid();
  EXCEPTION WHEN OTHERS THEN v_uid := NULL; END;

  BEGIN
    v_email := current_setting('request.jwt.claims', true)::jsonb->>'email';
    v_ip := current_setting('request.headers', true)::jsonb->>'x-forwarded-for';
    v_ua := current_setting('request.headers', true)::jsonb->>'user-agent';
    v_ctx := current_setting('audit.context', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  IF TG_OP = 'DELETE' THEN
    v_row_id := (to_jsonb(OLD)->>'id')::uuid;
  ELSE
    v_row_id := (to_jsonb(NEW)->>'id')::uuid;
  END IF;

  INSERT INTO public.audit_log (
    table_name, operation, row_id, actor_user_id, actor_email,
    request_ip, request_ua, old_data, new_data, context
  ) VALUES (
    TG_TABLE_NAME, TG_OP, v_row_id, v_uid, v_email,
    v_ip, v_ua,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    v_ctx
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER audit_bookings
AFTER INSERT OR UPDATE OR DELETE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.log_table_write();

CREATE TRIGGER audit_preparation_submissions
AFTER INSERT OR UPDATE OR DELETE ON public.preparation_submissions
FOR EACH ROW EXECUTE FUNCTION public.log_table_write();

CREATE TRIGGER audit_shared_diagnostics
AFTER INSERT OR UPDATE OR DELETE ON public.shared_diagnostics
FOR EACH ROW EXECUTE FUNCTION public.log_table_write();

-- Server-callable helper to log a SELECT/read access from server functions.
CREATE OR REPLACE FUNCTION public.log_table_read(
  _table TEXT,
  _row_id UUID,
  _context JSONB DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_email TEXT;
  v_ip TEXT;
  v_ua TEXT;
BEGIN
  BEGIN v_uid := auth.uid(); EXCEPTION WHEN OTHERS THEN v_uid := NULL; END;
  BEGIN
    v_email := current_setting('request.jwt.claims', true)::jsonb->>'email';
    v_ip := current_setting('request.headers', true)::jsonb->>'x-forwarded-for';
    v_ua := current_setting('request.headers', true)::jsonb->>'user-agent';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  INSERT INTO public.audit_log (
    table_name, operation, row_id, actor_user_id, actor_email,
    request_ip, request_ua, context
  ) VALUES (_table, 'SELECT', _row_id, v_uid, v_email, v_ip, v_ua, _context);
END;
$$;

REVOKE ALL ON FUNCTION public.log_table_read(TEXT, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_table_read(TEXT, UUID, JSONB) TO service_role;

COMMENT ON TABLE public.audit_log IS 'Journal daudit horodaté des écritures (triggers) et lectures (via log_table_read) sur bookings, preparation_submissions, shared_diagnostics. Accessible service_role uniquement.';