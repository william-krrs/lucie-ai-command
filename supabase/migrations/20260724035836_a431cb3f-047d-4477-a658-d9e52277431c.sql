REVOKE EXECUTE ON FUNCTION public.log_table_read(TEXT, UUID, JSONB) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_table_write() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_table_read(TEXT, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_table_write() TO service_role;