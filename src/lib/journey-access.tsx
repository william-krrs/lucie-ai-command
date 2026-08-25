import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { readAdminMode } from "@/lib/admin-mode";
import { UNLOCK_ALL_PAGES } from "@/lib/config";
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
  /** Aperçu interne (?admin=lucie) ou UNLOCK_ALL_PAGES. */
  bypass: boolean;
  refresh: () => Promise<void>;
  completeDemo: () => Promise<void>;
};

const FALLBACK: JourneyStateDTO = {
  demoCompletedAt: null,
  paymentStatus: "unpaid",
  installationStatus: "not_started",
  demoBookingConfirmed: false,
  demoMeetingAt: null,
  demoUnlockAt: null,
  configurationSubmitted: false,
};

const JourneyCtx = createContext<JourneyAccess | null>(null);

export const JOURNEY_QUERY_KEY = ["journey-state"] as const;

export function JourneyAccessProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [bypass, setBypass] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setBypass(UNLOCK_ALL_PAGES || readAdminMode());
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setAuthed(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session);
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
      demoUnlockAt: effective.demoUnlockAt,
      canViewOffers: bypass || effective.demoCompletedAt !== null,
      canConfigure: bypass || effective.paymentStatus === "paid",
      canViewInstallation: bypass || effective.configurationSubmitted,
      canBookSetupTest: bypass || effective.installationStatus === "ready_for_test",
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
