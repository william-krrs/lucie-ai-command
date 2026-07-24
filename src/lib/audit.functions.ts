import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
      _row_id: data.rowId ?? null,
      _context: data.context ?? null,
    });
    return { ok: true };
  });

/**
 * Admin-only: fetch the latest audit-log entries. Requires the caller to
 * hold the `admin` role in the user_roles table.
 */
export const listAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { table?: string; limit?: number } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

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