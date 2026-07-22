ALTER TABLE public.preparation_submissions
  ADD COLUMN IF NOT EXISTS compatibility_score integer,
  ADD COLUMN IF NOT EXISTS compatibility_tier text,
  ADD COLUMN IF NOT EXISTS recommended_plan text,
  ADD COLUMN IF NOT EXISTS priority text;