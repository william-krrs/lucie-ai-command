import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DRAFT_LIMIT = 20;

const saveDraftSchema = z.object({
  plan: z.string().max(50).nullable().optional(),
  form: z.record(z.string(), z.string()),
  filled: z.number().int().min(0).max(1000),
  snapshotAt: z.string().datetime(),
});

export type PreparationDraft = {
  id: string;
  plan: string | null;
  form: Record<string, string>;
  filled: number;
  snapshotAt: string;
};

export const listPreparationDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PreparationDraft[]> => {
    const { data, error } = await context.supabase
      .from("preparation_drafts")
      .select("id, plan, form, filled, snapshot_at")
      .eq("user_id", context.userId)
      .order("snapshot_at", { ascending: false })
      .limit(DRAFT_LIMIT);
    if (error) {
      console.error("[listPreparationDrafts]", error);
      throw new Error("Impossible de charger l'historique.");
    }
    return (data ?? []).map((r) => ({
      id: r.id as string,
      plan: (r.plan as string | null) ?? null,
      form: (r.form as Record<string, string>) ?? {},
      filled: Number(r.filled) || 0,
      snapshotAt: r.snapshot_at as string,
    }));
  });

export const savePreparationDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveDraftSchema.parse(data))
  .handler(async ({ data, context }): Promise<PreparationDraft> => {
    const { data: row, error } = await context.supabase
      .from("preparation_drafts")
      .insert({
        user_id: context.userId,
        plan: data.plan ?? null,
        form: data.form as Record<string, string>,
        filled: data.filled,
        snapshot_at: data.snapshotAt,
      })
      .select("id, plan, form, filled, snapshot_at")
      .single();
    if (error || !row) {
      console.error("[savePreparationDraft]", error);
      throw new Error("Impossible d'enregistrer la sauvegarde.");
    }

    // Trim history: keep the DRAFT_LIMIT most recent snapshots.
    const { data: extras } = await context.supabase
      .from("preparation_drafts")
      .select("id")
      .eq("user_id", context.userId)
      .order("snapshot_at", { ascending: false })
      .range(DRAFT_LIMIT, DRAFT_LIMIT + 200);
    if (extras && extras.length > 0) {
      await context.supabase
        .from("preparation_drafts")
        .delete()
        .in("id", extras.map((e) => e.id as string));
    }

    return {
      id: row.id as string,
      plan: (row.plan as string | null) ?? null,
      form: (row.form as Record<string, string>) ?? {},
      filled: Number(row.filled) || 0,
      snapshotAt: row.snapshot_at as string,
    };
  });

export const clearPreparationDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("preparation_drafts")
      .delete()
      .eq("user_id", context.userId);
    if (error) {
      console.error("[clearPreparationDrafts]", error);
      throw new Error("Impossible d'effacer l'historique.");
    }
    return { ok: true };
  });