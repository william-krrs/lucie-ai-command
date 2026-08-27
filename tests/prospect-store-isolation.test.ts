import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(resolve("src/lib/prospect-store.ts"), "utf8");

describe("prospect-store — isolation locale", () => {
  it("n'importe aucun module serveur ni client base de données", () => {
    const forbidden = [
      /from ["'][^"']*\.functions["']/,
      /from ["'][^"']*\.server["']/,
      /integrations\/supabase/,
      /createServerFn/,
      /\bfetch\s*\(/,
    ];
    for (const re of forbidden) {
      expect(SRC).not.toMatch(re);
    }
  });

  it("utilise la clé de RDV courante v3 pour les snapshots", () => {
    expect(SRC).toContain('const BOOKING_KEY = "lucie:booking:v3"');
    expect(SRC).toContain('const LEGACY_BOOKING_KEY = "lucie:booking:v2"');
  });

  it("n'inclut jamais clientRef dans le snapshot d'un prospect", () => {
    const snapshot = SRC.slice(
      SRC.indexOf("function snapshotFromLocalStorage"),
      SRC.indexOf("function readDiagnostic"),
    );
    expect(snapshot).not.toContain("clientRef");
  });
});
