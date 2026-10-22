import { describe, expect, it } from "vitest";
import { resolveIclosedBookingType } from "../src/lib/booking-types";

describe("typage des RDV iClosed", () => {
  it("Diagnostic gratuit => r1_discovery", () =>
    expect(resolveIclosedBookingType({ name: "Diagnostic gratuit" }).type).toBe("r1_discovery"));
  it("Démo personnalisée => r2_demo", () =>
    expect(resolveIclosedBookingType({ name: "DÉMO personnalisée" }).type).toBe("r2_demo"));
  it("Test & paramétrage => setup_test", () =>
    expect(resolveIclosedBookingType({ name: "Test & Paramétrage" }).type).toBe("setup_test"));
  it("le nom prime sur un utm_medium r2_demo", () =>
    expect(resolveIclosedBookingType({ name: "Diagnostic gratuit", explicitType: "r2_demo" }).type).toBe("r1_discovery"));
  it("type inconnu => jamais r2_demo", () => {
    const r = resolveIclosedBookingType({ name: "Appel", slug: "xyz" });
    expect(r.known).toBe(false);
    expect(r.type).not.toBe("r2_demo");
  });
});
