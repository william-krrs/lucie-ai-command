"""
Horizontal-scroll regression audit.

Loads every public route at mobile + tablet viewports and fails
(exit code 1) if any page shows body-level horizontal overflow.
Called directly (`python3 scripts/audit-overflow.py`) or via the
Vitest wrapper in `tests/no-horizontal-scroll.test.ts`.
"""
import asyncio, json, sys
from pathlib import Path
from playwright.async_api import async_playwright

ROUTES = ["/", "/diagnostic", "/roi", "/recommandation", "/demonstration",
          "/offres", "/merci", "/preparation", "/installation", "/rdv-test", "/faq"]
VIEWPORTS = [("mobile", 375, 812), ("tablet", 768, 1024), ("mobile-xs", 320, 640)]
OUT = Path("/tmp/browser/overflow")
OUT.mkdir(parents=True, exist_ok=True)
BASE_URL = "http://localhost:8080"
# Selectors allowed to scroll horizontally on purpose (comparator, timelines…)
ALLOWED_INTERNAL_SCROLL = [
    "[data-allow-x-scroll]",
    ".comparator-scroll",
    ".top-step-bar-scroll",
    "[role='tablist']",
]

SCRIPT = """
() => {
  const docW = document.documentElement.clientWidth;
  const offenders = [];
  const all = document.querySelectorAll('body *');
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > docW + 1 || r.left < -1 || el.scrollWidth > el.clientWidth + 2) {
      const tag = el.tagName.toLowerCase();
      const cls = (el.className && typeof el.className === 'string') ? el.className.slice(0,120) : '';
      offenders.push({tag, cls, right: Math.round(r.right), scrollW: el.scrollWidth, clientW: el.clientWidth});
      if (offenders.length >= 15) break;
    }
  }
  return { docW, bodyScrollW: document.body.scrollWidth, offenders };
}
"""

async def main():
    results = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        for label, w, h in VIEWPORTS:
            ctx = await b.new_context(viewport={"width": w, "height": h})
            page = await ctx.new_page()
            for route in ROUTES:
                try:
                    await page.goto(f"{BASE_URL}{route}", wait_until="networkidle", timeout=15000)
                except Exception as e:
                    results[f"{label}{route}"] = {"error": str(e)[:120]}
                    continue
                data = await page.evaluate(SCRIPT)
                overflow = data["bodyScrollW"] - data["docW"]
                results[f"{label}{route}"] = {"overflow_px": overflow, **data}
            await ctx.close()
        await b.close()
    (OUT / "report.json").write_text(json.dumps(results, indent=2))
    print("=== SUMMARY ===")
    failures = []
    for k, v in results.items():
        if "error" in v:
            print(f"{k:40s} ERROR {v['error']}")
            failures.append((k, "load error"))
        else:
            mark = "❌" if v["overflow_px"] > 0 else "✅"
            print(f"{mark} {k:38s} overflow={v['overflow_px']}px offenders={len(v['offenders'])}")
            if v["overflow_px"] > 0:
                failures.append((k, f"{v['overflow_px']}px"))
    print("\n=== TOP OFFENDERS (overflowing pages) ===")
    for k, v in results.items():
        if "offenders" in v and v["overflow_px"] > 0:
            print(f"\n--- {k} (body scroll {v['bodyScrollW']} > doc {v['docW']}) ---")
            for o in v["offenders"][:6]:
                print(f"  <{o['tag']}> sw={o['scrollW']} cw={o['clientW']} right={o['right']} cls={o['cls']}")
    if failures:
        print(f"\n❌ {len(failures)} route(s) with horizontal overflow:")
        for name, reason in failures:
            print(f"   - {name}: {reason}")
        sys.exit(1)
    print(f"\n✅ 0 horizontal overflow across {len(ROUTES)} routes x {len(VIEWPORTS)} viewports.")
    sys.exit(0)

asyncio.run(main())
