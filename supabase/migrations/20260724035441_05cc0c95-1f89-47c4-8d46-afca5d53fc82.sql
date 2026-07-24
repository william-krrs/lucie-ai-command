-- Lock down bookings, preparation_submissions, shared_diagnostics to service_role only.
-- All app access goes through server functions that use the service-role client (supabaseAdmin).
-- No anon/authenticated grants exist on these tables, so removing the permissive policy and
-- explicitly revoking any public grants ensures the Data API cannot reach them.

-- 1. Remove the always-true INSERT policy on preparation_submissions (submissions now flow
--    through a server function using service-role, so the anon policy is no longer needed).
DROP POLICY IF EXISTS "Anyone can submit a preparation questionnaire" ON public.preparation_submissions;

-- 2. Belt-and-suspenders: revoke any implicit public-role privileges.
REVOKE ALL ON public.bookings FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.preparation_submissions FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.shared_diagnostics FROM anon, authenticated, PUBLIC;

-- 3. Ensure the service role (used by server functions) retains full access.
GRANT ALL ON public.bookings TO service_role;
GRANT ALL ON public.preparation_submissions TO service_role;
GRANT ALL ON public.shared_diagnostics TO service_role;

-- 4. Document intent so future audits are unambiguous.
COMMENT ON TABLE public.bookings IS
  'Server-only. Accessed exclusively via server functions using the service-role client. No RLS policies granted to anon/authenticated by design.';
COMMENT ON TABLE public.preparation_submissions IS
  'Server-only. Submissions are inserted through a server function using the service-role client. No RLS policies granted to anon/authenticated by design.';
COMMENT ON TABLE public.shared_diagnostics IS
  'Server-only. Token-based public snapshots are fetched exclusively via server functions using the service-role client, which validates the token before returning data. No RLS policies granted to anon/authenticated by design.';