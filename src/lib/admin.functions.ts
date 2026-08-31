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
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => installationSchema.parse(input))
  .handler(async ({ data, context }): Promise<AdminOverview> => {
    const ctx = context as unknown as Ctx;
    await assertAdmin(ctx);
    if (data.status === "ready_for_test" || data.status === "live") {
      const current = await readOverview(ctx);
      if (current.journeyState?.paymentStatus !== "paid") {
        throw new Error(
          "Compte non payé : ready_for_test et live sont refusés (Stripe reste la seule autorité).",
        );
      }
    }
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

/* ------------------------------------------------------------------ */
/* Vue Clients (V1 minimale)                                          */
/*                                                                     */
/* Source principale : public.journey_state. Les utilisateurs sans     */
/* journey_state ne sont pas listés (V1 volontairement simple).        */
/* Sécurité : assertAdmin() AVANT tout chargement du client            */
/* service-role ; le targetUserId n'est qu'une cible, jamais une       */
/* preuve d'autorisation.                                              */
/* ------------------------------------------------------------------ */

export type AdminClientBooking = {
  bookingType: string;
  statusNorm: string;
  meetingAt: string | null;
  timezone: string;
} | null;

export type AdminClientRow = {
  userId: string;
  email: string | null;
  name: string | null;
  clientRef: string | null;
  paidPlan: string | null;
  paymentStatus: string;
  paidAt: string | null;
  configurationSubmitted: boolean;
  installationStatus: AdminInstallationStatus;
  demoCompletedAt: string | null;
  r2Booking: AdminClientBooking;
  setupBooking: AdminClientBooking;
  journeyStage: string;
  updatedAt: string | null;
};

const uuidSchema = z.object({ targetUserId: z.string().uuid() });

function stageOf(row: {
  paymentStatus: string;
  configurationSubmitted: boolean;
  installationStatus: string;
  demoCompletedAt: string | null;
  setupBooking: AdminClientBooking;
}): string {
  if (row.installationStatus === "live") return "En service";
  if (row.setupBooking?.statusNorm === "confirmed") return "RDV Test confirmé";
  if (row.installationStatus === "ready_for_test") return "Prêt pour le test";
  if (row.installationStatus === "in_progress") return "Installation en cours";
  if (row.configurationSubmitted) return "Configuration reçue";
  if (row.paymentStatus === "paid") return "Payé, configuration attendue";
  if (row.demoCompletedAt) return "Démo terminée";
  return "Parcours démarré";
}

/** Choisit le RDV le plus pertinent : confirmé prioritaire, sinon le plus récent. */
function pickBooking(rows: any[], type: string): AdminClientBooking {
  const list = rows.filter((b) => b.booking_type === type);
  const chosen = list.find((b) => b.status_norm === "confirmed") ?? list[0] ?? null;
  if (!chosen) return null;
  return {
    bookingType: chosen.booking_type,
    statusNorm: chosen.status_norm,
    meetingAt: chosen.meeting_at ?? null,
    timezone: chosen.timezone ?? "Europe/Paris",
  };
}

/**
 * Source de vérité de la liste Clients : les vrais comptes email Supabase.
 *
 * Un compte sans ligne journey_state reste un client (il vient de s'inscrire) :
 * la liste ne part donc plus de journey_state, elle l'agrège. Les sessions
 * anonymes (héritées) sont exclues. Appelé uniquement après assertAdmin().
 */
async function buildClientRows(userIds?: string[]): Promise<AdminClientRow[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Pagination complète : listUsers() est plafonné par page, on itère jusqu'à
  // épuisement pour ne jamais tronquer silencieusement la liste des clients.
  const perPage = 200;
  const allUsers: any[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data: usersRes, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (usersError) {
      console.error("[admin] list users", usersError);
      throw new Error("Lecture des clients impossible.");
    }
    const batch = usersRes?.users ?? [];
    allUsers.push(...batch);
    if (batch.length < perPage) break;
  }

  let users = allUsers.filter((u: any) => u.is_anonymous !== true && !!u.email);
  if (userIds) users = users.filter((u: any) => userIds.includes(u.id));

  const ids = users.map((u: any) => u.id);
  if (ids.length === 0) return [];

  const [statesRes, bookingsRes, prepRes] = await Promise.all([
    supabaseAdmin
      .from("journey_state")
      .select(
        "user_id, client_ref, demo_completed_at, payment_status, paid_at, paid_plan, installation_status, updated_at",
      )
      .in("user_id", ids),
    supabaseAdmin
      .from("bookings")
      .select("user_id, booking_type, status_norm, meeting_at, timezone, email, name, client_ref, created_at")
      .in("user_id", ids)
      .order("meeting_at", { ascending: false }),
    supabaseAdmin
      .from("preparation_submissions")
      .select("user_id, contact_name, contact_email, created_at")
      .in("user_id", ids)
      .order("created_at", { ascending: false }),
  ]);

  if (statesRes.error) console.error("[admin] clients states", statesRes.error);
  const states = (statesRes.data ?? []) as any[];
  const bookings = (bookingsRes.data ?? []) as any[];
  const preps = (prepRes.data ?? []) as any[];

  const rows = users.map((u: any) => {
    const s = states.find((row) => row.user_id === u.id) ?? null;
    const mine = bookings.filter((b) => b.user_id === u.id);
    const prep = preps.find((p) => p.user_id === u.id) ?? null;
    const anyBooking = mine[0] ?? null;
    const base = {
      paymentStatus: (s?.payment_status as string) ?? "unpaid",
      configurationSubmitted: !!prep,
      installationStatus: (s?.installation_status as AdminInstallationStatus) ?? "not_started",
      demoCompletedAt: (s?.demo_completed_at as string | null) ?? null,
      setupBooking: pickBooking(mine, "setup_test"),
    };
    return {
      userId: u.id,
      // L'email du compte authentifié fait foi ; les autres sources ne servent
      // que de repli d'affichage.
      email: u.email ?? prep?.contact_email ?? anyBooking?.email ?? null,
      name: prep?.contact_name ?? anyBooking?.name ?? null,
      clientRef: s?.client_ref ?? anyBooking?.client_ref ?? null,
      paidPlan: s?.paid_plan ?? null,
      paymentStatus: base.paymentStatus,
      paidAt: s?.paid_at ?? null,
      configurationSubmitted: base.configurationSubmitted,
      installationStatus: base.installationStatus,
      demoCompletedAt: base.demoCompletedAt,
      r2Booking: pickBooking(mine, "r2_demo"),
      setupBooking: base.setupBooking,
      journeyStage: stageOf(base),
      updatedAt: s?.updated_at ?? u.created_at ?? null,
    } satisfies AdminClientRow;
  });

  return rows.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
}


/** Liste des clients (lecture seule). Admin uniquement. */
export const adminListClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminClientRow[]> => {
    const ctx = context as unknown as Ctx;
    await assertAdmin(ctx);
    return buildClientRows();
  });

/** Fiche détaillée d'un client (lecture seule). Admin uniquement. */
export const adminGetClient = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => uuidSchema.parse(input))
  .handler(async ({ data, context }): Promise<AdminClientRow | null> => {
    const ctx = context as unknown as Ctx;
    await assertAdmin(ctx);
    const rows = await buildClientRows([data.targetUserId]);
    return rows[0] ?? null;
  });

const clientInstallSchema = uuidSchema.extend({
  status: z.enum(["not_started", "in_progress", "ready_for_test", "live"]),
});

/**
 * Seule écriture admin sur un autre compte : installation_status.
 * Garde métier : un client non payé ne peut pas être placé en
 * ready_for_test ni live. Aucun champ de paiement n'est jamais écrit.
 */
export const adminSetClientInstallationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => clientInstallSchema.parse(input))
  .handler(async ({ data, context }): Promise<AdminClientRow | null> => {
    const ctx = context as unknown as Ctx;
    await assertAdmin(ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: state, error } = await supabaseAdmin
      .from("journey_state")
      .select("id, payment_status")
      .eq("user_id", data.targetUserId)
      .maybeSingle();
    if (error) {
      console.error("[admin] client state read", error);
      throw new Error("Lecture du client impossible.");
    }
    const requiresPaid = data.status === "ready_for_test" || data.status === "live";

    // Un compte tout juste créé n'a pas encore de ligne journey_state : on la
    // crée avec les défauts verrouillés (unpaid) plutôt que d'échouer.
    if (!state) {
      if (requiresPaid) {
        throw new Error(
          "Client non payé : impossible de passer en ready_for_test ou live. Stripe reste la seule autorité du paiement.",
        );
      }
      const { error: insertError } = await supabaseAdmin
        .from("journey_state")
        .insert({ user_id: data.targetUserId, installation_status: data.status } as never);
      if (insertError) {
        console.error("[admin] client state insert", insertError);
        throw new Error("Écriture du statut d'installation impossible.");
      }
      const created = await buildClientRows([data.targetUserId]);
      return created[0] ?? null;
    }

    if (requiresPaid && state.payment_status !== "paid") {
      throw new Error(
        "Client non payé : impossible de passer en ready_for_test ou live. Stripe reste la seule autorité du paiement.",
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("journey_state")
      .update({ installation_status: data.status } as never)
      .eq("id", state.id);
    if (updateError) {
      console.error("[admin] client installation update", updateError);
      throw new Error("Écriture du statut d'installation impossible.");
    }

    const rows = await buildClientRows([data.targetUserId]);
    return rows[0] ?? null;
  });
