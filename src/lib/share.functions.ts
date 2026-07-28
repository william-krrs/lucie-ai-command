import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const snapshotSchema = z.object({
  companyName: z.string().max(200).default(""),
  activity: z.string().max(200).default(""),
  city: z.string().max(200).default(""),
  employees: z.number().int().min(0).max(100000),
  callsPerWeek: z.number().int().min(0).max(100000),
  missedCalls: z.number().int().min(0).max(100000),
  averageBasket: z.number().min(0).max(1000000),
  revenueGoal: z.number().min(0).max(100000000),
  conversionRate: z.number().min(0).max(100),
  channels: z.array(z.string().max(60)).max(20),
  recommendation: z.object({
    score: z.number().int().min(0).max(100),
    tier: z.enum(["excellent", "compatible", "limited", "refuse"]),
    plan: z.enum(["essential", "pro", "premium"]).nullable(),
    priority: z.enum(["high", "medium", "low"]),
    estimatedMonthlyRoi: z.number().min(0),
    justifications: z.array(z.string().max(500)).max(20),
    concerns: z.array(z.string().max(500)).max(20),
    planReason: z.string().max(600),
  }),
  metrics: z.object({
    monthlyReceived: z.number(),
    monthlyMissed: z.number(),
    monthlyLostRevenue: z.number(),
    yearlyLostRevenue: z.number(),
    recoverableOpportunities: z.number(),
    timeSavedHours: z.number(),
  }),
  booking: z
    .object({
      date: z.string().max(40),
      time: z.string().max(10).optional(),
      inviteeName: z.string().max(200).optional(),
    })
    .optional(),
});

export type DiagnosticSnapshot = z.infer<typeof snapshotSchema>;

function randomToken(): string {
  // Short, human-shareable base32 code (Crockford, no ambiguous chars).
  const ALPH = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = new Uint8Array(7);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPH[b % ALPH.length]).join("");
}

export const createSharedDiagnostic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    snapshotSchema
      .extend({ expiresInDays: z.number().int().min(1).max(365).optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { expiresInDays, ...snapshot } = data;
    const token = randomToken();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined;
    const { error } = await context.supabase
      .from("shared_diagnostics")
      .insert({
        token,
        snapshot,
        owner_id: context.userId,
        ...(expiresAt ? { expires_at: expiresAt } : {}),
      });
    if (error) throw new Error(error.message);
    return { token };
  });

export const getSharedDiagnostic = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ token: z.string().min(6).max(128) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("shared_diagnostics")
      .select("snapshot, created_at, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { found: false as const };
    if (new Date(row.expires_at) < new Date()) return { found: false as const, expired: true };
    return {
      found: true as const,
      snapshot: snapshotSchema.parse(row.snapshot),
      createdAt: row.created_at as string,
      expiresAt: row.expires_at as string,
    };
  });