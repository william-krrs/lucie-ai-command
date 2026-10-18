import { describe, expect, it } from "vitest";
import { canCheckoutPlan, canOpenOffers } from "@/lib/self-serve";

describe("paiement sans RDV démo", () => {
  it("Essentiel payable sans démo", () => expect(canCheckoutPlan("essential", false)).toBe(true));
  it("Pro payable sans démo", () => expect(canCheckoutPlan("pro", false)).toBe(true));
  it("Premium exige la démo", () => expect(canCheckoutPlan("premium", false)).toBe(false));
  it("Premium payable après démo", () => expect(canCheckoutPlan("premium", true)).toBe(true));
  it("Offres ouvertes si Pro recommandé", () => expect(canOpenOffers("pro", false)).toBe(true));
  it("Offres ouvertes même si Premium recommandé, sans démo", () =>
    expect(canOpenOffers("premium", false)).toBe(true));
  it("Offres ouvertes même sans recommandation, sans démo", () =>
    expect(canOpenOffers(null, false)).toBe(true));
});

import { needsDemo } from "@/lib/self-serve";
describe("Premium et décideurs", () => {
  it("Premium décideur seul : pas de RDV", () => expect(needsDemo("premium", false)).toBe(false));
  it("Premium à plusieurs : RDV obligatoire", () => expect(needsDemo("premium", true)).toBe(true));
  it("Premium seul payable sans démo", () => expect(canCheckoutPlan("premium", false, false)).toBe(true));
  it("Premium à plusieurs non payable sans démo", () => expect(canCheckoutPlan("premium", false, true)).toBe(false));
  it("Pro à plusieurs : pas de RDV", () => expect(needsDemo("pro", true)).toBe(false));
});
