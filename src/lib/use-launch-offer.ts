import { useQuery } from "@tanstack/react-query";
import { getLaunchOfferStatus, type LaunchOfferStatus } from "@/lib/launch-offer.functions";

const INACTIVE: LaunchOfferStatus = { slots: 5, remaining: 0, active: false };

/** Statut de l'offre de lancement (inactif tant que le serveur n'a pas répondu). */
export function useLaunchOffer(): LaunchOfferStatus {
  const { data } = useQuery({
    queryKey: ["launch-offer-status"],
    queryFn: () => getLaunchOfferStatus(),
    staleTime: 60_000,
  });
  return data ?? INACTIVE;
}
