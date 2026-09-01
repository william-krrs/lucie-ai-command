import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useBooking } from "@/lib/booking-store";
import { REQUIRE_ACCOUNT, UNLOCK_ALL_PAGES } from "@/lib/config";
import {
  completeDemo as completeDemoFn,
  getJourneyState,
  type JourneyStateDTO,
} from "@/lib/journey-state.functions";

export type JourneyAccess = {
  /** État serveur (null tant qu'il n'est pas chargé). */
  state: JourneyStateDTO | null;
  loading: boolean;
  /** RDV Démo r2_demo confirmé ET meeting_at - 15 min <= maintenant. */
  canViewDemonstration: boolean;
  /** meeting_at du RDV Démo confirmé (ISO), sinon null. */
  demoMeetingAt: string | null;
  /** Statut du dernier RDV Démo lu depuis le serveur. */
  demoBookingStatusNorm: JourneyStateDTO["demoBookingStatusNorm"];
  /** Instant d'ouverture de la démonstration (meeting_at - 15 min, ISO). */
  demoUnlockAt: string | null;
  /** journey_state.demo_completed_at IS NOT NULL. */
  canViewOffers: boolean;
  /** journey_state.payment_status === 'paid'. */
  canConfigure: boolean;
  /** Une preparation_submission existe pour l'utilisateur. */
  canViewInstallation: boolean;
  /** journey_state.installation_status === 'ready_for_test'. */
  canBookSetupTest: boolean;
  /** Statut serveur du RDV Test & paramétrage. */
  setupBookingStatusNorm: JourneyStateDTO["setupBookingStatusNorm"];
  /** meeting_at (ISO) du RDV Test confirmé côté serveur. */
  setupMeetingAt: string | null;
  /** Aperçu interne : UNLOCK_ALL_PAGES uniquement. */
  bypass: boolean;
  refresh: () => Promise<void>;
  completeDemo: () => Promise<void>;
};

const FALLBACK: JourneyStateDTO = {
  demoCompletedAt: null,
  paymentStatus: "unpaid",
  installationStatus: "not_started",
  demoBookingConfirmed: false,
  demoBookingStatusNorm: null,
  demoMeetingAt: null,
  demoUnlockAt: null,
  configurationSubmitted: false,
  setupBookingStatusNorm: null,
  setupMeetingAt: null,
};

const JourneyCtx = createContext<JourneyAccess | null>(null);

export const JOURNEY_QUERY_KEY = ["journey-state"] as const;

export function JourneyAccessProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { clearBookingFor } = useBooking();
  const [bypass, setBypass] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setBypass(UNLOCK_ALL_PAGES);
    let cancelled = false;
    // Une session anonyme n'est jamais un compte client : quand
    // REQUIRE_ACCOUNT est actif, seul un compte email porte un parcours.
    const isJourneyIdentity = (session: { user?: { is_anonymous?: boolean; email?: string | null } } | null) => {
      if (!session?.user) return false;
      if (!REQUIRE_ACCOUNT) return true;
      return session.user.is_anonymous !== true && !!session.user.email;
    };
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setAuthed(isJourneyIdentity(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(isJourneyIdentity(session));
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const fetchState = useServerFn(getJourneyState);
  const runCompleteDemo = useServerFn(completeDemoFn);

  const { data, isLoading } = useQuery({
    queryKey: JOURNEY_QUERY_KEY,
    queryFn: () => fetchState(),
    enabled: authed,
    staleTime: 15_000,
  });

  // Toute écriture serveur sur un rendez-vous force une nouvelle lecture de la
  // source de vérité. Cela couvre notamment les confirmations et annulations
  // reçues pendant que l'utilisateur garde l'application ouverte.
  useEffect(() => {
    if (!authed) return;
    const channel = supabase
      .channel("journey:r2-booking-state")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => {
          void queryClient.invalidateQueries({ queryKey: JOURNEY_QUERY_KEY });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [authed, queryClient]);

  // localStorage n'est qu'un cache UX : un statut annulé côté serveur gagne
  // toujours, après hydratation comme après chaque refetch/realtime.
  useEffect(() => {
    if (data?.demoBookingStatusNorm === "cancelled") {
      clearBookingFor("r2_demo");
    }
  }, [clearBookingFor, data?.demoBookingStatusNorm]);

  // Réévalue la fenêtre H-15 sans rechargement manuel.
  const unlockAt = data?.demoUnlockAt ?? null;
  useEffect(() => {
    if (!unlockAt) return;
    const target = new Date(unlockAt).getTime();
    if (Number.isNaN(target) || target <= Date.now()) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [unlockAt]);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: JOURNEY_QUERY_KEY });
  }, [queryClient]);

  const completeDemo = useCallback(async () => {
    await runCompleteDemo();
    await queryClient.invalidateQueries({ queryKey: JOURNEY_QUERY_KEY });
  }, [queryClient, runCompleteDemo]);

  const value = useMemo<JourneyAccess>(() => {
    const s = data ?? null;
    const effective = s ?? FALLBACK;
    return {
      state: s,
      loading: authed && isLoading,
      canViewDemonstration:
        bypass ||
        effective.demoBookingConfirmed ||
        (effective.demoUnlockAt !== null && new Date(effective.demoUnlockAt).getTime() <= now),
      demoMeetingAt: effective.demoMeetingAt,
      demoBookingStatusNorm: effective.demoBookingStatusNorm,
      demoUnlockAt: effective.demoUnlockAt,
      canViewOffers: bypass || effective.demoCompletedAt !== null,
      canConfigure: bypass || effective.paymentStatus === "paid",
      canViewInstallation: bypass || effective.configurationSubmitted,
      canBookSetupTest: bypass || effective.installationStatus === "ready_for_test",
      setupBookingStatusNorm: effective.setupBookingStatusNorm,
      setupMeetingAt: effective.setupMeetingAt,
      bypass,
      refresh,
      completeDemo,
    };
  }, [data, isLoading, authed, bypass, now, refresh, completeDemo]);

  return <JourneyCtx.Provider value={value}>{children}</JourneyCtx.Provider>;
}

export function useJourneyAccess(): JourneyAccess {
  const ctx = useContext(JourneyCtx);
  if (!ctx) throw new Error("useJourneyAccess must be used within JourneyAccessProvider");
  return ctx;
}
