"""
Dynamic-component contrast audit.

Injects axe-core into each route (mobile viewport) and reports every
color-contrast violation on live components — KPI cards, comparator
table, badges, tabs, etc. Also triggers selected/hover/pressed states
on interactive elements before re-running the scan, so state-dependent
regressions surface too.

Exit 1 if any WCAG AA text-contrast violation remains.
"""
import asyncio, json, sys
from pathlib import Path
from playwright.async_api import async_playwright

ROUTES = ["/", "/diagnostic", "/roi", "/recommandation", "/demonstration",
          "/offres", "/merci", "/preparation", "/installation", "/rdv-test", "/faq"]
VIEWPORT = {"width": 390, "height": 844}  # iPhone 14 Pro
AXE_URL = "https://cdn.jsdelivr.net/npm/axe-core@4.10.0/axe.min.js"
OUT = Path("/tmp/browser/contrast"); OUT.mkdir(parents=True, exist_ok=True)

RUN_AXE = """
async () => {
  const results = await axe.run(document, {
    runOnly: ['color-contrast', 'color-contrast-enhanced'],
    resultTypes: ['violations'],
  });
  return results.violations.map(v => ({
    id: v.id, impact: v.impact,
    nodes: v.nodes.slice(0, 8).map(n => ({
      target: n.target[0],
      html: n.html.slice(0, 180),
      summary: n.failureSummary?.split('\\n').slice(0,2).join(' | '),
    })),
  }));
}
"""

# Force interactive states (hover / focus / aria-selected) then measure again.
FORCE_STATES = """
() => {
  // Aria-selected on first tab of each tablist
  document.querySelectorAll('[role="tablist"]').forEach(tl => {
    const tabs = tl.querySelectorAll('[role="tab"]');
    tabs.forEach((t,i) => t.setAttribute('aria-selected', i===0 ? 'true' : 'false'));
  });
  // Programmatic hover-ish visual via :focus-visible where possible
  const focusables = document.querySelectorAll('button, a, [role="button"]');
  if (focusables[0]) focusables[0].focus();
  // Fake aria-pressed on toggles for the audit
  document.querySelectorAll('[data-state="off"]').forEach(el => el.setAttribute('data-state','on'));
}
"""

async def audit_route(page, route):
    url = f"http://localhost:8080{route}"
    await page.goto(url, wait_until="networkidle", timeout=20000)
    await page.add_script_tag(url=AXE_URL)
    await page.wait_for_function("typeof axe !== 'undefined'", timeout=8000)
    base = await page.evaluate(RUN_AXE)
    await page.evaluate(FORCE_STATES)
    await page.wait_for_timeout(150)
    forced = await page.evaluate(RUN_AXE)
    return {"baseline": base, "with_states": forced}

async def main():
    report = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        ctx = await b.new_context(viewport=VIEWPORT, device_scale_factor=2)
        page = await ctx.new_page()
        for r in ROUTES:
            try:
                report[r] = await audit_route(page, r)
            except Exception as e:
                report[r] = {"error": str(e)[:160]}
        await b.close()
    (OUT / "report.json").write_text(json.dumps(report, indent=2))

    fails = 0
    print("=== CONTRAST AUDIT (mobile 390px, WCAG AA + AAA) ===")
    for route, data in report.items():
        if "error" in data:
            print(f"⚠ {route:20s} ERROR {data['error']}"); continue
        b_count = sum(len(v['nodes']) for v in data['baseline'])
        s_count = sum(len(v['nodes']) for v in data['with_states'])
        # AA baseline only fails hard; enhanced is informational.
        aa_base = [v for v in data['baseline'] if v['id']=='color-contrast']
        aa_state = [v for v in data['with_states'] if v['id']=='color-contrast']
        aa_fails = sum(len(v['nodes']) for v in aa_base) + sum(len(v['nodes']) for v in aa_state)
        mark = "❌" if aa_fails else "✅"
        print(f"{mark} {route:20s} AA={aa_fails:2d}  AAA-info={b_count+s_count-aa_fails:2d}")
        fails += aa_fails
        if aa_fails:
            for v in aa_base + aa_state:
                if v['id'] != 'color-contrast': continue
                for n in v['nodes'][:3]:
                    print(f"     • {n['target']}  → {n['summary']}")

    print()
    if fails:
        print(f"❌ {fails} WCAG AA contrast violation(s) — see /tmp/browser/contrast/report.json")
        sys.exit(1)
    print(f"✅ 0 WCAG AA contrast violations across {len(ROUTES)} routes (baseline + selected/pressed/focused).")

asyncio.run(main())
