import { describe, expect, test } from "vitest";
import { computeRecommendation } from "@/lib/recommendation";
import type { DiagnosticState } from "@/lib/lucie-store";

const base = {
  companyName: "X",
  activity: "plombier",
  employees: 2,
  callsPerWeek: 30,
  missedCalls: 15,
  channels: ["google-ads", "bouche-a-oreille", "recommandation"],
} as unknown as DiagnosticState;

describe("plan recommendation", () => {
  test("small artisan with 3 channels is not pushed to Premium", () => {
    const r = computeRecommendation(base, 800);
    expect(r.plan).not.toBe("premium");
  });
  test("small volume and low loss gives Essentiel", () => {
    const r = computeRecommendation({ ...base, callsPerWeek: 40 } as DiagnosticState, 1400);
    expect(["essential", null]).toContain(r.plan);
  });
  test("60+ calls per week gives Pro", () => {
    const r = computeRecommendation({ ...base, callsPerWeek: 80 } as DiagnosticState, 2000);
    expect(r.plan).toBe("pro");
  });
  test("200+ calls per week gives Premium", () => {
    const r = computeRecommendation({ ...base, callsPerWeek: 220 } as DiagnosticState, 4000);
    expect(r.plan).toBe("premium");
  });
  test("15+ employees gives Premium", () => {
    const r = computeRecommendation({ ...base, employees: 15, callsPerWeek: 100 } as DiagnosticState, 3000);
    expect(r.plan).toBe("premium");
  });
});
