import { describe, expect, it } from "vitest";
import {
  STRIPE_PLANS,
  SETUP_FEE_AMOUNT,
  firstPaymentAmount,
  type PlanKey,
} from "@/lib/stripe-plans";

describe("tarification Stripe", () => {
  it("setup = 490 € one-shot", () => {
    expect(SETUP_FEE_AMOUNT).toBe(49000);
  });

  it.each<[PlanKey, number, number]>([
    ["essential", 63900, 14900],
    ["pro", 88900, 39900],
    ["premium", 148000, 99000],
  ])("%s : premier paiement puis récurrence", (plan, first, monthly) => {
    expect(firstPaymentAmount(plan)).toBe(first);
    expect(STRIPE_PLANS[plan].unitAmount).toBe(monthly);
  });
});
