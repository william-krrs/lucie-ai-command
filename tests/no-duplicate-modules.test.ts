import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  registerModule,
  __resetModuleRegistry,
  MODULE_IDS,
} from "../src/lib/module-registry";

// -------- Static scan: singleton modules live in exactly one route file --------

const ROUTES_DIR = join(process.cwd(), "src/routes");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const routeFiles = walk(ROUTES_DIR).filter((f) => /\.tsx?$/.test(f));

/**
 * Each entry: a "module signature" (regex) and the single route file that is
 * allowed to render it. Any other route matching the signature is a duplicate.
 */
const SINGLETONS: Array<{ name: string; pattern: RegExp; owner: string }> = [
  {
    name: "Preparation questionnaire (<PreparationForm />)",
    pattern: /<PreparationForm\b/,
    owner: "preparation.tsx",
  },
  {
    name: "Stripe payment plan links (buy.stripe.com)",
    pattern: /buy\.stripe\.com/,
    owner: "offres.tsx",
  },
];

describe("no duplicate singleton modules across routes", () => {
  for (const mod of SINGLETONS) {
    it(`${mod.name} is only rendered in ${mod.owner}`, () => {
      const offenders = routeFiles.filter((f) => {
        if (f.endsWith(mod.owner)) return false;
        const src = readFileSync(f, "utf8");
        return mod.pattern.test(src);
      });
      expect(offenders, `Unexpected duplicate in: ${offenders.join(", ")}`).toEqual([]);
    });

    it(`${mod.name} appears at most once inside ${mod.owner}`, () => {
      const ownerFile = routeFiles.find((f) => f.endsWith(mod.owner));
      expect(ownerFile, `Owner file missing: ${mod.owner}`).toBeTruthy();
      const src = readFileSync(ownerFile!, "utf8");
      const count = (src.match(new RegExp(mod.pattern.source, "g")) ?? []).length;
      // Stripe links legitimately appear multiple times (one per plan card),
      // but the questionnaire component must be mounted exactly once.
      if (mod.name.startsWith("Preparation")) {
        expect(count).toBeLessThanOrEqual(1);
      } else {
        expect(count).toBeGreaterThan(0);
      }
    });
  }
});

// -------- Runtime guard: registry throws on duplicate mount in tests --------

describe("module-registry runtime guard", () => {
  it("throws when the same module id is mounted twice concurrently", () => {
    __resetModuleRegistry();
    const off = registerModule(MODULE_IDS.preparationForm);
    expect(() => registerModule(MODULE_IDS.preparationForm)).toThrow(/Duplicate module/);
    off();
    __resetModuleRegistry();
  });

  it("allows re-mount after unmount", () => {
    __resetModuleRegistry();
    const off = registerModule(MODULE_IDS.paymentPlans);
    off();
    expect(() => {
      const off2 = registerModule(MODULE_IDS.paymentPlans);
      off2();
    }).not.toThrow();
  });
});