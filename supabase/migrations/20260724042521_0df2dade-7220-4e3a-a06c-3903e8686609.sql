
CREATE TABLE public.preparation_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT,
  form JSONB NOT NULL,
  filled INTEGER NOT NULL DEFAULT 0,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX preparation_drafts_user_at_idx
  ON public.preparation_drafts (user_id, snapshot_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.preparation_drafts TO authenticated;
GRANT ALL ON public.preparation_drafts TO service_role;

ALTER TABLE public.preparation_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prep_drafts owner select" ON public.preparation_drafts
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "prep_drafts owner insert" ON public.preparation_drafts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "prep_drafts owner update" ON public.preparation_drafts
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "prep_drafts owner delete" ON public.preparation_drafts
  FOR DELETE TO authenticated USING (user_id = auth.uid());
