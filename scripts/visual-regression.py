#!/usr/bin/env python3
"""Visual regression check for Lucie Command Center.

For each target (route + CSS selector + optional interaction), the script
captures a PNG screenshot of the element and compares it pixel-by-pixel
against a stored baseline. A diff image is written for any mismatch.

Baselines live in tests/visual/baselines/, current runs in
tests/visual/current/, and per-run diffs in tests/visual/diffs/.

Usage
-----
  python scripts/visual-regression.py            # compare against baseline
  python scripts/visual-regression.py --update   # write new baselines
  python scripts/visual-regression.py --only kpi comparison  # subset

Exit code is non-zero when at least one target exceeds the mismatch
threshold (default 0.5% of pixels). In --update mode, exit is always 0.
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Awaitable, Callable, Optional

from PIL import Image, ImageChops
from playwright.async_api import Page, async_playwright

ROOT = Path(__file__).resolve().parents[1]
VISUAL_DIR = ROOT / "tests" / "visual"
BASELINE_DIR = VISUAL_DIR / "baselines"
CURRENT_DIR = VISUAL_DIR / "current"
DIFF_DIR = VISUAL_DIR / "diffs"

BASE_URL = "http://localhost:8080"
VIEWPORT = {"width": 1280, "height": 1800}
# Pixel-level tolerance for anti-aliasing / sub-pixel rendering noise.
CHANNEL_TOLERANCE = 6
# Fraction of pixels allowed to differ before a target is considered changed.
MISMATCH_THRESHOLD = 0.005


@dataclass
class Target:
    name: str
    path: str
    selector: str
    # Optional async setup run after navigation (e.g. click, keyboard).
    setup: Optional[Callable[[Page], Awaitable[None]]] = None
    # Extra wait selectors — useful for images/fonts that arrive late.
    wait_for: list[str] = field(default_factory=list)


async def click_plan(page: Page, plan: str) -> None:
    """Select a pricing plan on /offres by clicking its card."""
    card = page.locator(f'[data-vr="pricing-cards"] [role="button"]', has_text=plan)
    await card.first.click()
    # Let the ring animation settle.
    await page.wait_for_timeout(300)


async def expand_first_faq(page: Page) -> None:
    trigger = page.locator('[data-vr="faq"] button[aria-expanded="false"]').first
    await trigger.click()
    await page.wait_for_timeout(300)


TARGETS: list[Target] = [
    Target("kpi-grid", "/", '[data-vr="kpi-grid"]'),
    Target("pricing-cards", "/offres", '[data-vr="pricing-cards"]'),
    Target(
        "pricing-cards-pro-selected",
        "/offres",
        '[data-vr="pricing-cards"]',
        setup=lambda p: click_plan(p, "Pro"),
    ),
    Target(
        "pricing-cards-premium-selected",
        "/offres",
        '[data-vr="pricing-cards"]',
        setup=lambda p: click_plan(p, "Premium"),
    ),
    Target("comparison-table", "/offres", '[data-vr="comparison-table"]'),
    Target("faq-collapsed", "/faq", '[data-vr="faq"]'),
    Target(
        "faq-first-open",
        "/faq",
        '[data-vr="faq"]',
        setup=expand_first_faq,
    ),
]


async def capture(page: Page, target: Target, out_path: Path) -> None:
    await page.goto(f"{BASE_URL}{target.path}", wait_until="networkidle")
    # Wait for web fonts so glyph metrics are stable across runs.
    await page.evaluate("document.fonts && document.fonts.ready")
    await page.wait_for_selector(target.selector, state="visible")
    for sel in target.wait_for:
        await page.wait_for_selector(sel, state="visible")
    if target.setup is not None:
        await target.setup(page)
    # Freeze CSS animations to avoid flakiness.
    await page.add_style_tag(
        content="*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}"
    )
    await page.locator(target.selector).first.screenshot(path=str(out_path))


def _prepare(img: Image.Image) -> Image.Image:
    return img.convert("RGB")


def diff_images(baseline: Path, current: Path, diff: Path) -> tuple[float, tuple[int, int] | None]:
    """Return (mismatch fraction, current size) or (fraction, None) on size mismatch."""
    a = _prepare(Image.open(baseline))
    b = _prepare(Image.open(current))
    if a.size != b.size:
        # Save a side-by-side hint image so reviewers can see the drift.
        w = max(a.size[0], b.size[0])
        h = a.size[1] + b.size[1] + 8
        combo = Image.new("RGB", (w, h), (0, 0, 0))
        combo.paste(a, (0, 0))
        combo.paste(b, (0, a.size[1] + 8))
        combo.save(diff)
        return 1.0, None
    delta = ImageChops.difference(a, b)
    # Reduce to grayscale magnitude and threshold to ignore AA noise.
    px = delta.load()
    w, h = delta.size
    changed = 0
    heat = Image.new("RGB", (w, h), (0, 0, 0))
    heat_px = heat.load()
    for y in range(h):
        for x in range(w):
            r, g, bl = px[x, y]
            if r > CHANNEL_TOLERANCE or g > CHANNEL_TOLERANCE or bl > CHANNEL_TOLERANCE:
                changed += 1
                heat_px[x, y] = (255, 0, 128)
    frac = changed / (w * h)
    if frac > 0:
        heat.save(diff)
    return frac, (w, h)


async def run(update: bool, only: list[str]) -> int:
    BASELINE_DIR.mkdir(parents=True, exist_ok=True)
    CURRENT_DIR.mkdir(parents=True, exist_ok=True)
    DIFF_DIR.mkdir(parents=True, exist_ok=True)

    selected = [t for t in TARGETS if not only or any(o in t.name for o in only)]
    if not selected:
        print(f"No targets match filter {only!r}", file=sys.stderr)
        return 2

    failures: list[tuple[str, float]] = []
    created: list[str] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport=VIEWPORT,
            reduced_motion="reduce",
            color_scheme="dark",
            device_scale_factor=1,
        )
        page = await context.new_page()

        for t in selected:
            current = CURRENT_DIR / f"{t.name}.png"
            baseline = BASELINE_DIR / f"{t.name}.png"
            diff = DIFF_DIR / f"{t.name}.png"
            try:
                await capture(page, t, current)
            except Exception as exc:  # noqa: BLE001
                print(f"[FAIL] {t.name}: capture error — {exc}", file=sys.stderr)
                failures.append((t.name, 1.0))
                continue

            if update or not baseline.exists():
                baseline.write_bytes(current.read_bytes())
                created.append(t.name)
                print(f"[BASE] {t.name}: baseline written ({baseline})")
                continue

            frac, size = diff_images(baseline, current, diff)
            if size is None:
                print(f"[FAIL] {t.name}: size mismatch — see {diff}", file=sys.stderr)
                failures.append((t.name, 1.0))
                continue
            pct = frac * 100
            status = "OK  " if frac <= MISMATCH_THRESHOLD else "FAIL"
            print(f"[{status}] {t.name}: {pct:.3f}% pixels differ ({size[0]}x{size[1]})")
            if frac > MISMATCH_THRESHOLD:
                failures.append((t.name, frac))

        await browser.close()

    if created and not update:
        print(f"\nCreated {len(created)} new baseline(s): {', '.join(created)}")
        print("Run again to verify stability against these baselines.")

    if failures:
        print(f"\n{len(failures)} target(s) failed. Diffs in {DIFF_DIR}", file=sys.stderr)
        for name, frac in failures:
            print(f"  - {name}: {frac * 100:.3f}% differ", file=sys.stderr)
        return 1
    return 0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--update", action="store_true", help="Overwrite baselines with current run")
    parser.add_argument("--only", nargs="*", default=[], help="Substring filters for target names")
    args = parser.parse_args()
    code = asyncio.run(run(update=args.update, only=args.only))
    sys.exit(code)


if __name__ == "__main__":
    main()