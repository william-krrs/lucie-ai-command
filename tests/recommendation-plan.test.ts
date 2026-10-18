import { describe, expect, test } from "vitest";
import { computeRecommendation, computeVolumes } from "@/lib/recommendation";
import type { DiagnosticState } from "@/lib/lucie-store";

const s = (p: Partial<DiagnosticState>) =>
  ({
    employees: 2,
    callsPerWeek: 50,
    missedCalls: 15,
    averageBasket: 180,
    conversionRate: 30,
    channels: ["google-ads"],
    ...p,
  }) as DiagnosticState;

describe("plan recommendation (spec Spark Media)", () => {
  test("2 appels manqués, panier 100 € : non éligible, aucune formule", () => {
    const r = computeRecommendation(s({ callsPerWeek: 15, missedCalls: 2, averageBasket: 100 }), 0);
    expect(r.tier).toBe("refuse");
    expect(r.plan).toBeNull();
  });
  test("pertes < 300 €/mois : non éligible", () => {
    expect(computeVolumes(s({ missedCalls: 5, averageBasket: 20 })).isEligible).toBe(false);
  });
  test("15 manqués, 2 collaborateurs : Essentiel", () => {
    expect(computeRecommendation(s({}), 0).plan).toBe("essential");
  });
  test("55 manqués, 5 collaborateurs : 476 min et Pro", () => {
    const st = s({ callsPerWeek: 200, missedCalls: 55, employees: 5 });
    expect(computeVolumes(st).minutesEstimeesDebordement).toBe(476);
    expect(computeRecommendation(st, 0).plan).toBe("pro");
  });
  test("120 manqués : Premium", () => {
    expect(computeRecommendation(s({ callsPerWeek: 500, missedCalls: 120 }), 0).plan).toBe("premium");
  });
  test("15 collaborateurs : Premium", () => {
    expect(computeRecommendation(s({ employees: 15 }), 0).plan).toBe("premium");
  });
});
