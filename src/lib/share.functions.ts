import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
});

export type DiagnosticSnapshot = z.infer<typeof snapshotSchema>;

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const createSharedDiagnostic = createServerFn({ method: "POST" })
  .inputValidator((input) => snapshotSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = randomToken();
    const { error } = await supabaseAdmin
      .from("shared_diagnostics")
      .insert({ token, snapshot: data });
    if (error) throw new Error(error.message);
    return { token };
  });

export const getSharedDiagnostic = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ token: z.string().min(16).max(128) }).parse(input))
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