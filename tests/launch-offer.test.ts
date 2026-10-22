import { describe, expect, it } from "vitest";
import {
  LAUNCH_OFFER_SLOTS,
  firstPaymentAmount,
  isLaunchOfferAvailable,
  launchOfferRemaining,
  setupFeeAmount,
} from "@/lib/stripe-plans";
import { launchOfferText } from "@/lib/offer-terms";

describe("offre de lancement (5 premiers clients)", () => {
  it("seuil = 5", () => expect(LAUNCH_OFFER_SLOTS).toBe(5));
  it("0 payé : 5 places", () => expect(launchOfferRemaining(0)).toBe(5));
  it("4 payés : 1 place", () => expect(launchOfferRemaining(4)).toBe(1));
  it("5 payés : offre terminée", () => expect(isLaunchOfferAvailable(5)).toBe(false));
  it("sans engagement pendant l'offre : 0 € de mise en place", () =>
    expect(setupFeeAmount(false, true)).toBe(0));
  it("Pro sans engagement hors offre : 789 €", () =>
    expect(firstPaymentAmount("pro", false, false)).toBe(78900));
  it("Pro sans engagement pendant l'offre : 299 €", () =>
    expect(firstPaymentAmount("pro", false, true)).toBe(29900));
  it("texte masqué quand plus de place", () => expect(launchOfferText(0)).toBeNull());
  it("texte affiche le compteur", () => expect(launchOfferText(3)).toContain("3 places restantes sur 5"));
});
