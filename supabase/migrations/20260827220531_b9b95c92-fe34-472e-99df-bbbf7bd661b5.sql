CREATE TABLE public.diagnostic_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  diagnostic jsonb NOT NULL,
  metrics jsonb,
  recommendation jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diagnostic_snapshots TO authenticated;
GRANT ALL ON public.diagnostic_snapshots TO service_role;

ALTER TABLE public.diagnostic_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diag_snapshots owner select" ON public.diagnostic_snapshots
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

CREATE POLICY "diag_snapshots owner insert" ON public.diagnostic_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

CREATE POLICY "diag_snapshots owner update" ON public.diagnostic_snapshots
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false)
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER diagnostic_snapshots_set_updated_at
  BEFORE UPDATE ON public.diagnostic_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();