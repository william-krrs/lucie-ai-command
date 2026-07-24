import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

ROUTES = ["/", "/diagnostic", "/roi", "/recommandation", "/demonstration",
          "/offres", "/merci", "/preparation", "/installation", "/rdv-test", "/faq"]
VIEWPORTS = [("mobile", 375, 812), ("tablet", 768, 1024)]
OUT = Path("/tmp/browser/overflow")

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
                    await page.goto(f"http://localhost:8080{route}", wait_until="networkidle", timeout=15000)
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
    for k, v in results.items():
        if "error" in v:
            print(f"{k:40s} ERROR {v['error']}")
        else:
            mark = "❌" if v["overflow_px"] > 0 else "✅"
            print(f"{mark} {k:38s} overflow={v['overflow_px']}px offenders={len(v['offenders'])}")
    print("\n=== TOP OFFENDERS (overflowing pages) ===")
    for k, v in results.items():
        if "offenders" in v and v["overflow_px"] > 0:
            print(f"\n--- {k} (body scroll {v['bodyScrollW']} > doc {v['docW']}) ---")
            for o in v["offenders"][:6]:
                print(f"  <{o['tag']}> sw={o['scrollW']} cw={o['clientW']} right={o['right']} cls={o['cls']}")

asyncio.run(main())
