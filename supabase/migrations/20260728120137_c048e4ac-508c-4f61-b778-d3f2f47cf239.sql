-- Remove client-facing owner policies on preparation_submissions.
-- All access now flows through server functions using service_role (supabaseAdmin),
-- so no policy for anon/authenticated roles is needed and anonymous JWT users
-- cannot reach the table directly.
DROP POLICY IF EXISTS "preparation owner select" ON public.preparation_submissions;
DROP POLICY IF EXISTS "preparation owner insert" ON public.preparation_submissions;
DROP POLICY IF EXISTS "preparation owner update" ON public.preparation_submissions;
DROP POLICY IF EXISTS "preparation owner delete" ON public.preparation_submissions;

REVOKE ALL ON public.preparation_submissions FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.preparation_submissions TO service_role;

COMMENT ON TABLE public.preparation_submissions IS
  'Configurations personnalisées. Accès restreint à service_role : lectures/écritures uniquement via server functions authentifiées.';