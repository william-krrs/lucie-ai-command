import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useBooking } from "@/lib/booking-store";
import { BOOKING_TYPES } from "@/lib/booking-types";
import { forgetNext } from "@/lib/auth-account";
import { markDiagnosticLoggedOut } from "@/lib/lucie-store";

/**
 * Déconnexion propre.
 *
 * Supprime UNIQUEMENT ce qui appartient au compte :
 * - cache UX des rendez-vous (`lucie:booking:v3`) ;
 * - cache React Query (état serveur en mémoire).
 *
 * Ne touche JAMAIS :
 * - le diagnostic local (`lucie:diagnostic:v1`) ;
 * - les Simulations commerciales ni `lucie:booking:clientRef`.
 */
export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  const { clearBookingFor } = useBooking();

  return useCallback(async () => {
    await queryClient.cancelQueries();
    for (const type of BOOKING_TYPES) clearBookingFor(type);
    queryClient.clear();
    forgetNext();
    await supabase.auth.signOut();
    await navigate({ to: "/", replace: true });
    await router.invalidate();
  }, [clearBookingFor, navigate, queryClient, router]);
}
