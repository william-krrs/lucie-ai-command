import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PaymentStatus = "unpaid" | "paid" | "refunded";
export type InstallationStatus = "not_started" | "in_progress" | "ready_for_test" | "live";

export type JourneyStateDTO = {
  /** ISO date de fin de démonstration (null = démonstration non terminée). */
  demoCompletedAt: string | null;
  paymentStatus: PaymentStatus;
  installationStatus: InstallationStatus;
  /** true si un RDV Démo (r2_demo) est confirmé côté base. */
  demoBookingConfirmed: boolean;
  /** Statut normalisé du dernier RDV Démo connu côté serveur. */
  demoBookingStatusNorm: "pending" | "confirmed" | "cancelled" | "rescheduled" | "completed" | "no_show" | null;
  /** meeting_at (ISO/timestamptz) du RDV Démo confirmé, sinon null. */
  demoMeetingAt: string | null;
  /** Ouverture temporelle : meeting_at - 15 min (ISO), sinon null. */
  demoUnlockAt: string | null;
  /** true si une configuration (preparation_submissions) a été soumise. */
  configurationSubmitted: boolean;
};

/** Fenêtre d'ouverture avant le rendez-vous (ms). */
export const DEMO_UNLOCK_LEAD_MS = 15 * 60 * 1000;

const EMPTY: JourneyStateDTO = {
  demoCompletedAt: null,
  paymentStatus: "unpaid",
  installationStatus: "not_started",
  demoBookingConfirmed: false,
  demoBookingStatusNorm: null,
  demoMeetingAt: null,
  demoUnlockAt: null,
  configurationSubmitted: false,
};


/**
 * Source de vérité serveur du parcours. Toutes les permissions client
 * (useJourneyAccess) dérivent exclusivement de ces valeurs.
 */
export const getJourneyState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<JourneyStateDTO> => {
    const { supabase, userId } = context;

    const [stateRes, confirmedBookingRes, latestBookingRes, prepRes] = await Promise.all([
      supabase
        .from("journey_state")
        .select("demo_completed_at, payment_status, installation_status")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("bookings")
        .select("id, meeting_at")
        .eq("user_id", userId)
        .eq("booking_type", "r2_demo")
        .eq("status_norm", "confirmed")
        .order("meeting_at", { ascending: true })
        .limit(1),
      supabase
        .from("bookings")
        .select("status_norm")
        .eq("user_id", userId)
        .eq("booking_type", "r2_demo")
        .order("updated_at", { ascending: false })
        .limit(1),
      supabase.from("preparation_submissions").select("id").eq("user_id", userId).limit(1),
    ]);

    if (stateRes.error) console.error("[getJourneyState] state", stateRes.error);
    if (confirmedBookingRes.error) console.error("[getJourneyState] confirmed booking", confirmedBookingRes.error);
    if (latestBookingRes.error) console.error("[getJourneyState] latest booking", latestBookingRes.error);
    if (prepRes.error) console.error("[getJourneyState] prep", prepRes.error);

    const row = stateRes.data;
    // meeting_at est un timestamptz : la comparaison se fait en UTC côté serveur.
    const confirmedBooking = confirmedBookingRes.data?.[0] ?? null;
    const bookingStatus = confirmedBooking
      ? "confirmed"
      : latestBookingRes.data?.[0]?.status_norm ?? null;
    const meetingAtRaw = confirmedBooking?.meeting_at ?? null;
    const meetingAt = meetingAtRaw ? new Date(meetingAtRaw) : null;
    const unlockAt = meetingAt ? new Date(meetingAt.getTime() - DEMO_UNLOCK_LEAD_MS) : null;

    return {
      ...EMPTY,
      demoCompletedAt: row?.demo_completed_at ?? null,
      paymentStatus: (row?.payment_status as PaymentStatus | undefined) ?? "unpaid",
      installationStatus:
        (row?.installation_status as InstallationStatus | undefined) ?? "not_started",
      // Confirmé ET fenêtre temporelle atteinte (meeting_at - 15 min <= now).
      demoBookingConfirmed: !!unlockAt && unlockAt.getTime() <= Date.now(),
      demoBookingStatusNorm: bookingStatus,
      demoMeetingAt: meetingAt ? meetingAt.toISOString() : null,
      demoUnlockAt: unlockAt ? unlockAt.toISOString() : null,
      configurationSubmitted: (prepRes.data?.length ?? 0) > 0,
    };

  });

/**
 * Marque UNIQUEMENT la démonstration de l'utilisateur authentifié comme
 * terminée. Sécurité :
 * - authentification obligatoire (requireSupabaseAuth) ;
 * - aucune entrée client : l'utilisateur cible est toujours context.userId ;
 * - pré-requis vérifié côté serveur : un booking r2_demo confirmé doit exister ;
 * - le seul champ écrit est demo_completed_at (jamais payment_status,
 *   installation_status, ni les champs Stripe).
 */
export const completeDemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true; demoCompletedAt: string }> => {
    const { supabase, userId } = context;

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id")
      .eq("user_id", userId)
      .eq("booking_type", "r2_demo")
      .eq("status_norm", "confirmed")
      .limit(1);
    if (bookingError) {
      console.error("[completeDemo] booking lookup", bookingError);
      throw new Error("Impossible de vérifier votre rendez-vous de démonstration.");
    }
    if (!booking || booking.length === 0) {
      throw new Error("Aucune démonstration confirmée n'est associée à votre compte.");
    }

    const now = new Date().toISOString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("journey_state")
      .select("id, demo_completed_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (existingError) {
      console.error("[completeDemo] state lookup", existingError);
      throw new Error("Impossible de lire votre parcours.");
    }

    if (!existing) {
      // Ligne créée avec les défauts verrouillés : unpaid / not_started.
      const { error } = await supabaseAdmin
        .from("journey_state")
        .insert({ user_id: userId, demo_completed_at: now });
      if (error) {
        console.error("[completeDemo] insert", error);
        throw new Error("Impossible d'enregistrer la fin de démonstration.");
      }
      return { ok: true, demoCompletedAt: now };
    }

    if (existing.demo_completed_at) {
      return { ok: true, demoCompletedAt: existing.demo_completed_at };
    }

    // Écriture strictement limitée à demo_completed_at.
    const { error } = await supabaseAdmin
      .from("journey_state")
      .update({ demo_completed_at: now })
      .eq("user_id", userId)
      .is("demo_completed_at", null);
    if (error) {
      console.error("[completeDemo] update", error);
      throw new Error("Impossible d'enregistrer la fin de démonstration.");
    }
    return { ok: true, demoCompletedAt: now };
  });
