import { describe, expect, it } from "vitest";
import { INCLUDED_MINUTES, OVERAGE_RATE_CENTS } from "@/lib/offer-terms";

describe("minutes des offres Lucie", () => {
  it("Essentiel inclut 300 minutes", () => expect(INCLUDED_MINUTES.essential).toBe(300));
  it("Pro inclut 800 minutes", () => expect(INCLUDED_MINUTES.pro).toBe(800));
  it("Premium inclut 2 500 minutes", () => expect(INCLUDED_MINUTES.premium).toBe(2500));
  it("le dépassement coûte 0,35 € par minute", () => expect(OVERAGE_RATE_CENTS).toBe(35));
});