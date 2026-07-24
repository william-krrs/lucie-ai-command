/**
 * Visual regression guard.
 *
 * Runs scripts/visual-regression.py which screenshots key surfaces
 * (KPI grid, pricing cards + selected states, comparison table, FAQ
 * collapsed/open) and diffs them against baselines committed under
 * tests/visual/baselines/.
 *
 * Update baselines intentionally with:
 *   python3 scripts/visual-regression.py --update
 *
 * Skips cleanly when the dev server on :8080 isn't reachable, matching
 * the pattern used by tests/no-horizontal-scroll.test.ts.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const BASELINE_DIR = "tests/visual/baselines";

async function serverUp(): Promise<boolean> {
  try {
    const r = await fetch("http://localhost:8080/", { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch {
    return false;
  }
}

describe("Visual regression", () => {
  it("KPI, pricing, comparator, table, FAQ match their baselines", async () => {
    if (!(await serverUp())) {
      console.warn("[skip] dev server not reachable on :8080");
      return;
    }

    const firstRun = !existsSync(BASELINE_DIR) || readdirSync(BASELINE_DIR).length === 0;

    const proc = spawnSync("python3", ["scripts/visual-regression.py"], {
      encoding: "utf8",
      timeout: 240_000,
    });

    if (proc.status !== 0) console.error(proc.stdout + "\n" + proc.stderr);

    if (firstRun) {
      // Bootstrap run only creates baselines; treat it as informational.
      console.warn(
        "[info] visual baselines were just created — re-run the suite to compare against them.",
      );
      expect(proc.status, "baseline bootstrap must succeed").toBe(0);
      return;
    }

    expect(
      proc.status,
      "visual-regression.py must exit 0; see tests/visual/diffs/ for changed targets",
    ).toBe(0);
  }, 260_000);
});