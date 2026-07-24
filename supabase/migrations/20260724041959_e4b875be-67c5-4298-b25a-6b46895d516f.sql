
-- 1. Add owner columns (default to auth.uid() so inserts stamp automatically)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();

ALTER TABLE public.preparation_submissions
  ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();

ALTER TABLE public.shared_diagnostics
  ADD COLUMN IF NOT EXISTS owner_id uuid DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS bookings_user_id_idx ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS preparation_submissions_user_id_idx ON public.preparation_submissions(user_id);
CREATE INDEX IF NOT EXISTS shared_diagnostics_owner_id_idx ON public.shared_diagnostics(owner_id);

-- 2. Grants: authenticated (incl. anonymous) can act on their own rows,
--    service_role keeps full access for server tasks. anon gets nothing.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.preparation_submissions TO authenticated;
GRANT ALL ON public.preparation_submissions TO service_role;

GRANT SELECT, INSERT ON public.shared_diagnostics TO authenticated;
GRANT ALL ON public.shared_diagnostics TO service_role;

-- 3. Drop any pre-existing policies (idempotent reset) on these tables
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('bookings','preparation_submissions','shared_diagnostics')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- 4. Policies

-- bookings: only the owner (authenticated user) sees / manages their booking
CREATE POLICY "bookings owner select"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "bookings owner insert"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "bookings owner update"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "bookings owner delete"
  ON public.bookings FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- preparation_submissions: same shape
CREATE POLICY "preparation owner select"
  ON public.preparation_submissions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "preparation owner insert"
  ON public.preparation_submissions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "preparation owner update"
  ON public.preparation_submissions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "preparation owner delete"
  ON public.preparation_submissions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- shared_diagnostics: creator owns write, public read stays through server
-- functions (service_role). Owners can re-read their own shares from the client.
CREATE POLICY "shared_diag owner select"
  ON public.shared_diagnostics FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "shared_diag owner insert"
  ON public.shared_diagnostics FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());
