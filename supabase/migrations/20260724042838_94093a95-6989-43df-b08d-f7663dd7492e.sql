
-- Tighten shared_diagnostics: exclude anonymous auth sessions
DROP POLICY IF EXISTS "shared_diag owner select" ON public.shared_diagnostics;
DROP POLICY IF EXISTS "shared_diag owner insert" ON public.shared_diagnostics;

CREATE POLICY "shared_diag owner select"
  ON public.shared_diagnostics
  FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

CREATE POLICY "shared_diag owner insert"
  ON public.shared_diagnostics
  FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

-- audit_log: add explicit service_role-only policies so intent is clear.
-- No client role can read or write; only server-side service_role.
CREATE POLICY "audit_log service_role all"
  ON public.audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
