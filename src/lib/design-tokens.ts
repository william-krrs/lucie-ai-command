/**
 * Design tokens — TypeScript mirror of the CSS variables declared
 * in `src/styles.css`. Keep this file in sync with the CSS source.
 *
 * Use these constants for inline styles, Framer Motion transitions,
 * canvas / SVG drawings, or any JS-side style that cannot reach a
 * Tailwind class. Do NOT hardcode shadow/border/duration values in
 * components — reference tokens here instead.
 */

// ── Elevation (shadows) ───────────────────────────────────────
export const shadow = {
  xs:       "var(--elev-xs)",
  sm:       "var(--elev-sm)",
  md:       "var(--elev-md)",
  lg:       "var(--elev-lg)",
  xl:       "var(--elev-xl)",
  glow:     "var(--elev-glow)",
  inset:    "var(--elev-inset)",
  card:     "var(--shadow-card)",
  elevated: "var(--shadow-elevated)",
} as const;

// ── Borders ───────────────────────────────────────────────────
export const border = {
  hairline: "var(--border-width-hairline)",
  strong:   "var(--border-width-strong)",
  color: {
    subtle: "var(--border-color-subtle)",
    strong: "var(--border-color-strong)",
    brand:  "var(--border-color-brand)",
  },
  radius: {
    sm:   "var(--radius-sm)",
    md:   "var(--radius-md)",
    lg:   "var(--radius-lg)",
    xl:   "var(--radius-xl)",
    "2xl":"var(--radius-2xl)",
    pill: "var(--radius-pill)",
  },
} as const;

// ── Motion ────────────────────────────────────────────────────
export const easing = {
  standard:   "cubic-bezier(0.2, 0, 0, 1)",
  emphasized: "cubic-bezier(0.3, 0, 0, 1)",
  decelerate: "cubic-bezier(0, 0, 0.2, 1)",
  accelerate: "cubic-bezier(0.3, 0, 1, 1)",
} as const;

export const duration = {
  instant: 80,
  fast:    150,
  base:    220,
  slow:    360,
} as const;

/** Ready-to-use CSS transition strings that respect the token system. */
export const transition = {
  fast:  `all ${duration.fast}ms ${easing.standard}`,
  base:  `all ${duration.base}ms ${easing.standard}`,
  slow:  `all ${duration.slow}ms ${easing.emphasized}`,
  color: `color ${duration.fast}ms ${easing.standard}, background-color ${duration.fast}ms ${easing.standard}, border-color ${duration.fast}ms ${easing.standard}`,
} as const;

export const tokens = { shadow, border, easing, duration, transition } as const;
export type DesignTokens = typeof tokens;
