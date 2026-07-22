
CREATE TABLE public.shared_diagnostics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token text NOT NULL UNIQUE,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);
CREATE INDEX shared_diagnostics_token_idx ON public.shared_diagnostics (token);
GRANT ALL ON public.shared_diagnostics TO service_role;
ALTER TABLE public.shared_diagnostics ENABLE ROW LEVEL SECURITY;
-- No policies: access is server-only via service_role.
