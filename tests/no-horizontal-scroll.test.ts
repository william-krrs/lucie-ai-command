/**
 * Regression guard: no route may develop horizontal scroll on
 * mobile/tablet viewports. Delegates to the Playwright audit
 * script which visits every route and asserts docW >= scrollW.
 *
 * Run:   bunx vitest run tests/no-horizontal-scroll.test.ts
 *        (or) python3 scripts/audit-overflow.py
 *
 * Prereq: dev server on http://localhost:8080 (already running
 * in the sandbox; skip the test cleanly if it isn't reachable).
 */
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

const REPORT = "/tmp/browser/overflow/report.json";

async function serverUp(): Promise<boolean> {
  try {
    const r = await fetch("http://localhost:8080/", { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch {
    return false;
  }
}

describe("Horizontal scroll regression", () => {
  it("every route stays within viewport width on mobile & tablet", async () => {
    if (!(await serverUp())) {
      console.warn("[skip] dev server not reachable on :8080");
      return;
    }

    const proc = spawnSync("python3", ["scripts/audit-overflow.py"], {
      encoding: "utf8",
      timeout: 180_000,
    });

    // Surface the human summary in test logs on failure.
    if (proc.status !== 0) console.error(proc.stdout + "\n" + proc.stderr);
    expect(proc.status, "audit-overflow.py must exit 0").toBe(0);

    // Parse the JSON report for a per-route assertion.
    expect(existsSync(REPORT), `report missing at ${REPORT}`).toBe(true);
    const report: Record<string, { overflow_px?: number; error?: string }> =
      JSON.parse(readFileSync(REPORT, "utf8"));

    const failures = Object.entries(report).filter(
      ([, v]) => v.error || (v.overflow_px ?? 0) > 0
    );
    expect(failures, `overflowing routes:\n${JSON.stringify(failures, null, 2)}`).toHaveLength(0);
  }, 200_000);
});
