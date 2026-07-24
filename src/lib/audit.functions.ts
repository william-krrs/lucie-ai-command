import { createServerFn } from "@tanstack/react-start";

/**
 * Server-only: log a read/consultation of a sensitive row (bookings,
 * preparation_submissions, shared_diagnostics). Call from server functions
 * that expose data to the client.
 */
export const logRead = createServerFn({ method: "POST" })
  .inputValidator((input: { table: string; rowId?: string; context?: Record<string, unknown> }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("log_table_read", {
      _table: data.table,
      ...(data.rowId ? { _row_id: data.rowId } : {}),
      ...(data.context ? { _context: data.context as never } : {}),
    } as never);
    return { ok: true };
  });

/**
 * Admin-only fetch. Reads the audit log via service role. Guard the caller
 * upstream (e.g. via a shared admin token) before invoking.
 */
export const listAuditLog = createServerFn({ method: "POST" })
  .inputValidator((input: { adminToken: string; table?: string; limit?: number }) => input)
  .handler(async ({ data }) => {
    if (!process.env.AUDIT_ADMIN_TOKEN || data.adminToken !== process.env.AUDIT_ADMIN_TOKEN) {
      throw new Error("Forbidden");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("audit_log")
      .select("id, occurred_at, table_name, operation, row_id, actor_user_id, actor_email, request_ip, context")
      .order("occurred_at", { ascending: false })
      .limit(Math.min(data.limit ?? 100, 500));
    if (data.table) q = q.eq("table_name", data.table);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });