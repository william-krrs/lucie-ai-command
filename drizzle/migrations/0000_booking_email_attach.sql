CREATE OR REPLACE FUNCTION public.find_user_id_by_email(_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT uid FROM (
    SELECT u.id AS uid, 1 AS prio, u.created_at AS ts
      FROM auth.users u
     WHERE lower(u.email) = lower(_email) AND u.email_confirmed_at IS NOT NULL
    UNION ALL
    SELECT p.user_id, 2, p.created_at
      FROM public.preparation_submissions p
     WHERE lower(p.contact_email) = lower(_email) AND p.user_id IS NOT NULL
    UNION ALL
    SELECT b.user_id, 3, b.created_at
      FROM public.bookings b
     WHERE lower(b.email) = lower(_email) AND b.user_id IS NOT NULL
  ) c
  ORDER BY prio, ts DESC
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.find_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_user_id_by_email(text) TO service_role;