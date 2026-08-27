import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin Test Center — server functions.
 *
 * Sécurité :
 * - identité issue exclusivement du bearer token vérifié (requireSupabaseAuth) ;
 * - autorisation vérifiée côté serveur via public.has_role(uid,'admin') AVANT
 *   toute lecture/écriture ; aucun query param, aucun flag client ;
 * - toutes les actions ne portent que sur context.userId (aucun user cible) ;
 * - AUCUNE action ne peut écrire payment_status='paid' : Stripe (webhook) reste
 *   la seule autorité du paiement.
 */

export type AdminInstallationStatus =
  | "not_started"
  | "in_progress"
  | "ready_for_test"
  | "live";

export type AdminJourneyState = {
  demoCompletedAt: string | null;
  paymentStatus: string;
  paidAt: string | null;
  paidPlan: string | null;
  stripeSessionId: string | null;
  installationStatus: AdminInstallationStatus;
  updatedAt: string | null;
} | null;

export type AdminOverview = {
  isAdmin: boolean;
  userId: string;
  email: string | null;
  journeyState: AdminJourneyState;
  configurationSubmitted: boolean;
  bookingsCount: number;
};

export type AdminBookingRow = {
  id: string;
  bookingType: string;
  statusNorm: string;
  meetingAt: string | null;
  meetingTime: string | null;
  timezone: string;
  clientRef: string;
  createdAt: string;
};

type Ctx = { supabase: any; userId: string; claims: Record<string, unknown> };

async function assertAdmin(context: Ctx): Promise<void> {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) {
    console.error("[admin] has_role", error);
    throw new Error("Forbidden");
  }
  if (data !== true) throw new Error("Forbidden");
}

async function readOverview(context: Ctx): Promise<AdminOverview> {
  const [stateRes, prepRes, bookingsRes] = await Promise.all([
    context.supabase
      .from("journey_state")
      .select(
        "demo_completed_at, payment_status, paid_at, paid_plan, stripe_session_id, installation_status, updated_at",
      )
      .eq("user_id", context.userId)
      .maybeSingle(),
    context.supabase
      .from("preparation_submissions")
      .select("id")
      .eq("user_id", context.userId)
      .limit(1),
    context.supabase
      .from("bookings")
      .select("id")
      .eq("user_id", context.userId)
      .limit(50),
  ]);

  const row = stateRes.data;
  return {
    isAdmin: true,
    userId: context.userId,
    email: (context.claims?.["email"] as string | undefined) ?? null,
    journeyState: row
      ? {
          demoCompletedAt: row.demo_completed_at ?? null,
          paymentStatus: row.payment_status,
          paidAt: row.paid_at ?? null,
          paidPlan: row.paid_plan ?? null,
          stripeSessionId: row.stripe_session_id ?? null,
          installationStatus: row.installation_status as AdminInstallationStatus,
          updatedAt: row.updated_at ?? null,
        }
      : null,
    configurationSubmitted: (prepRes.data?.length ?? 0) > 0,
    bookingsCount: bookingsRes.data?.length ?? 0,
  };
}

/** Lecture de l'état courant. Renvoie isAdmin=false au lieu de throw (UX). */
export const adminGetOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminOverview> => {
    const ctx = context as unknown as Ctx;
    const { data } = await ctx.supabase.rpc("has_role", {
      _user_id: ctx.userId,
      _role: "admin",
    });
    if (data !== true) {
      return {
        isAdmin: false,
        userId: ctx.userId,
        email: null,
        journeyState: null,
        configurationSubmitted: false,
        bookingsCount: 0,
      };
    }
    return readOverview(ctx);
  });

/** Derniers rendez-vous R2 / setup_test de l'utilisateur admin. */
export const adminListBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminBookingRow[]> => {
    const ctx = context as unknown as Ctx;
    await assertAdmin(ctx);
    const { data, error } = await ctx.supabase
      .from("bookings")
      .select("id, booking_type, status_norm, meeting_at, meeting_time, timezone, client_ref, created_at")
      .eq("user_id", ctx.userId)
      .in("booking_type", ["r2_demo", "setup_test"])
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) {
      console.error("[admin] list bookings", error);
      throw new Error("Lecture des rendez-vous impossible.");
    }
    return (data ?? []).map((b: any) => ({
      id: b.id,
      bookingType: b.booking_type,
      statusNorm: b.status_norm,
      meetingAt: b.meeting_at,
      meetingTime: b.meeting_time,
      timezone: b.timezone,
      clientRef: b.client_ref,
      createdAt: b.created_at,
    }));
  });

async function upsertState(
  userId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: existing, error: readErr } = await supabaseAdmin
    .from("journey_state")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (readErr) {
    console.error("[admin] state read", readErr);
    throw new Error("Lecture de l'état impossible.");
  }
  if (!existing) {
    const { error } = await supabaseAdmin
      .from("journey_state")
      .insert({ user_id: userId, ...patch } as never);
    if (error) {
      console.error("[admin] state insert", error);
      throw new Error("Écriture de l'état impossible.");
    }
    return;
  }
  const { error } = await supabaseAdmin
    .from("journey_state")
    .update(patch as never)
    .eq("user_id", userId);
  if (error) {
    console.error("[admin] state update", error);
    throw new Error("Écriture de l'état impossible.");
  }
}

/** Prépare le tunnel juste avant Stripe : démo terminée, paiement NON payé. */
export const adminPrepareBeforeStripe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminOverview> => {
    const ctx = context as unknown as Ctx;
    await assertAdmin(ctx);
    await upsertState(ctx.userId, {
      demo_completed_at: new Date().toISOString(),
      // Jamais 'paid' : seul le webhook Stripe peut valider un paiement.
      payment_status: "unpaid",
      paid_at: null,
      paid_plan: null,
      stripe_session_id: null,
      installation_status: "not_started",
    });
    return readOverview(ctx);
  });

/** Remet l'utilisateur au tout début du parcours. */
export const adminResetJourney = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminOverview> => {
    const ctx = context as unknown as Ctx;
    await assertAdmin(ctx);
    await upsertState(ctx.userId, {
      demo_completed_at: null,
      payment_status: "unpaid",
      paid_at: null,
      paid_plan: null,
      stripe_session_id: null,
      stripe_customer_id: null,
      installation_status: "not_started",
    });
    return readOverview(ctx);
  });

const installationSchema = z.object({
  status: z.enum(["not_started", "in_progress", "ready_for_test", "live"]),
});

/** Définit installation_status (aucun impact paiement). */
export const adminSetInstallationStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => installationSchema.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<AdminOverview> => {
    const ctx = context as unknown as Ctx;
    await assertAdmin(ctx);
    await upsertState(ctx.userId, { installation_status: data.status });
    return readOverview(ctx);
  });

/** Supprime bookings + corrélations de test de l'utilisateur admin. */
export const adminCleanupTestBookings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({ context }): Promise<{ bookingsDeleted: number; correlationsDeleted: number }> => {
      const ctx = context as unknown as Ctx;
      await assertAdmin(ctx);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: bookings, error: bErr } = await supabaseAdmin
        .from("bookings")
        .delete()
        .eq("user_id", ctx.userId)
        .select("id");
      if (bErr) {
        console.error("[admin] cleanup bookings", bErr);
        throw new Error("Suppression des rendez-vous impossible.");
      }

      const { data: corrs, error: cErr } = await supabaseAdmin
        .from("booking_correlations")
        .delete()
        .eq("user_id", ctx.userId)
        .select("sid");
      if (cErr) {
        console.error("[admin] cleanup correlations", cErr);
        throw new Error("Suppression des corrélations impossible.");
      }

      return {
        bookingsDeleted: bookings?.length ?? 0,
        correlationsDeleted: corrs?.length ?? 0,
      };
    },
  );
