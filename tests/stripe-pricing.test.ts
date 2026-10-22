import { describe, expect, it } from "vitest";
import {
  STRIPE_PLANS,
  SETUP_FEE_AMOUNT,
  firstPaymentAmount,
  setupFeeAmount,
  COMMITMENT_MONTHS,
  type PlanKey,
} from "@/lib/stripe-plans";

describe("frais de mise en place selon engagement", () => {
  it("engagement 3 mois : mise en place offerte", () => expect(setupFeeAmount(true)).toBe(0));
  it("sans engagement : 490 €", () => expect(setupFeeAmount(false)).toBe(49000));
  it("Pro avec engagement : 299 € au premier paiement", () =>
    expect(firstPaymentAmount("pro", true)).toBe(29900));
  it("Essentiel sans engagement : 639 €", () =>
    expect(firstPaymentAmount("essential", false)).toBe(63900));
  it("engagement minimum = 3 mois", () => expect(COMMITMENT_MONTHS).toBe(3));
});

describe("tarification Stripe", () => {
  it("setup = 490 € one-shot", () => {
    expect(SETUP_FEE_AMOUNT).toBe(49000);
  });

  it.each<[PlanKey, number, number]>([
    ["essential", 63900, 14900],
    ["pro", 78900, 29900],
    ["premium", 148000, 99000],
  ])("%s : premier paiement puis récurrence", (plan, first, monthly) => {
    expect(firstPaymentAmount(plan)).toBe(first);
    expect(STRIPE_PLANS[plan].unitAmount).toBe(monthly);
  });
});

