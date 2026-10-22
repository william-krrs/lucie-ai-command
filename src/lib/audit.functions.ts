import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TABLES = ["bookings", "preparation_submissions", "shared_diagnostics"] as const;

/**
 * Journalise la consultation d'une ligne sensible. Réservé aux utilisateurs
 * authentifiés (évite le remplissage anonyme du journal d'audit).
 */
export const logRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        table: z.enum(TABLES),
        rowId: z.string().uuid().optional(),
        context: z.record(z.string().max(64), z.union([z.string().max(500), z.number(), z.boolean()])).optional(),
      })
      .parse(input),
  )
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
 * Lecture du journal d'audit, protégée par un jeton admin comparé en temps constant.
 */
export const listAuditLog = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        adminToken: z.string().min(1).max(512),
        table: z.string().max(64).optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const expected = process.env.AUDIT_ADMIN_TOKEN;
    const { timingSafeEqual } = await import("crypto");
    const a = Buffer.from(data.adminToken);
    const b = Buffer.from(expected ?? "");
    if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error("Forbidden");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("audit_log")
      .select("id, occurred_at, table_name, operation, row_id, actor_user_id, actor_email, request_ip, context")
      .order("occurred_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (data.table) q = q.eq("table_name", data.table);
    const { data: rows, error } = await q;
    if (error) throw new Error("Lecture impossible");
    return rows ?? [];
  });
