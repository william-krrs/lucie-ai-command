import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Sauvegarde serveur du diagnostic client (règle V1 : 1 compte = 1 parcours).
 *
 * Sécurité :
 * - authentification obligatoire (requireSupabaseAuth) ;
 * - la ligne est toujours indexée par context.userId, jamais par une entrée
 *   client ; aucun user cible n'est accepté ;
 * - RLS propriétaire côté base (les sessions anonymes sont exclues).
 */

export type DiagnosticSnapshotDTO = {
  diagnostic: Record<string, unknown>;
  metrics: Record<string, unknown> | null;
  recommendation: Record<string, unknown> | null;
  updatedAt: string;
} | null;

type Ctx = { supabase: any; userId: string };

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Lecture de la sauvegarde du compte connecté (null si aucune). */
export const getDiagnosticSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DiagnosticSnapshotDTO> => {
    const { supabase, userId } = context as unknown as Ctx;
    const { data, error } = await supabase
      .from("diagnostic_snapshots")
      .select("diagnostic, metrics, recommendation, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.error("[diagnostic-snapshot] read", error);
      return null;
    }
    if (!data) return null;
    return {
      diagnostic: asObject(data.diagnostic) ?? {},
      metrics: asObject(data.metrics),
      recommendation: asObject(data.recommendation),
      updatedAt: data.updated_at,
    };
  });

/** Enregistre (upsert) la sauvegarde du compte connecté. */
export const saveDiagnosticSnapshot = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const obj = asObject(input);
    const diagnostic = asObject(obj?.["diagnostic"]);
    if (!diagnostic) throw new Error("Diagnostic invalide.");
    return {
      diagnostic,
      metrics: asObject(obj?.["metrics"]),
      recommendation: asObject(obj?.["recommendation"]),
    };
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ ok: true; updatedAt: string }> => {
    const { supabase, userId } = context as unknown as Ctx;
    const { data: row, error } = await supabase
      .from("diagnostic_snapshots")
      .upsert(
        {
          user_id: userId,
          diagnostic: data.diagnostic,
          metrics: data.metrics,
          recommendation: data.recommendation,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select("updated_at")
      .maybeSingle();
    if (error) {
      console.error("[diagnostic-snapshot] save", error);
      throw new Error("Sauvegarde du diagnostic impossible.");
    }
    return { ok: true, updatedAt: row?.updated_at ?? new Date().toISOString() };
  });
