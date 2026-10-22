import { describe, expect, it, vi } from "vitest";
import {
  LAUNCH_OFFER_SLOTS,
  firstPaymentAmount,
  isLaunchOfferAvailable,
  launchOfferRemaining,
  setupFeeAmount,
} from "@/lib/stripe-plans";
import { launchOfferText } from "@/lib/offer-terms";

// --- mock de la base : journey_state renvoie les lignes de contrôle ---
let paidRows: { stripe_session_id: string | null }[] = [];
const query: { table: string; columns: string; filters: string[] } = {
  table: "",
  columns: "",
  filters: [],
};

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: (col: string, val: string) => {
          query.table = table;
          query.columns = columns;
          query.filters = [`${col}=${val}`];
          return Promise.resolve({ data: paidRows, error: null });
        },
      }),
    }),
  },
}));

const { countPaidCustomers, isTestPaymentSession } = await import("@/lib/launch-offer.server");

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

describe("compteur : seuls les paiements réels sont comptés", () => {
  it("cs_test_ = test, cs_live_ = réel, sans session = réel", () => {
    expect(isTestPaymentSession("cs_test_a1b2")).toBe(true);
    expect(isTestPaymentSession("cs_live_a1b2")).toBe(false);
    expect(isTestPaymentSession(null)).toBe(false);
  });

  it("exclut les lignes cs_test_, garde cs_live_ et sans session", async () => {
    paidRows = [
      { stripe_session_id: "cs_live_a" },
      { stripe_session_id: "cs_test_a" },
      { stripe_session_id: null },
    ];
    expect(await countPaidCustomers()).toBe(2);
    expect(query.table).toBe("journey_state");
    expect(query.filters).toEqual(["payment_status=paid"]);
  });

  it("tous les paiements en mode test : 0 client payant", async () => {
    paidRows = [{ stripe_session_id: "cs_test_a" }, { stripe_session_id: "cs_test_b" }];
    expect(await countPaidCustomers()).toBe(0);
  });
});
