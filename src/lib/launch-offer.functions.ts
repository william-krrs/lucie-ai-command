import { createServerFn } from "@tanstack/react-start";
import { LAUNCH_OFFER_SLOTS, launchOfferRemaining } from "@/lib/stripe-plans";
import { countPaidCustomers } from "@/lib/launch-offer.server";

export type LaunchOfferStatus = { slots: number; remaining: number; active: boolean };

/** Compteur public de l'offre de lancement : lecture seule, aucune donnée personnelle. */
export const getLaunchOfferStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<LaunchOfferStatus> => {
    try {
      const remaining = launchOfferRemaining(await countPaidCustomers());
      return { slots: LAUNCH_OFFER_SLOTS, remaining, active: remaining > 0 };
    } catch (err) {
      console.error("[getLaunchOfferStatus]", err);
      // En cas d'erreur, on n'annonce pas l'offre (le serveur re-vérifie au paiement).
      return { slots: LAUNCH_OFFER_SLOTS, remaining: 0, active: false };
    }
  },
);
