import { useEffect } from "react";

/**
 * Runtime guard that detects duplicate mounts of "singleton" page modules
 * (e.g. payment blocks, configuration form) inside a single render tree.
 *
 * If two components register the same module id at the same time, we log a
 * console.error in dev and throw in test — so a regression that re-introduces
 * a duplicate on a page fails CI or lights up the console immediately.
 */
const mounted = new Map<string, number>();

export function registerModule(id: string): () => void {
  const next = (mounted.get(id) ?? 0) + 1;
  mounted.set(id, next);
  if (next > 1) {
    const msg = `[module-registry] Duplicate module "${id}" mounted ${next} times in the current page render.`;
    if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") {
      throw new Error(msg);
    }
    // eslint-disable-next-line no-console
    console.error(msg);
  }
  return () => {
    const cur = mounted.get(id) ?? 0;
    if (cur <= 1) mounted.delete(id);
    else mounted.set(id, cur - 1);
  };
}

export function useUniqueModule(id: string) {
  useEffect(() => registerModule(id), [id]);
}

/** Test-only helper. */
export function __resetModuleRegistry() {
  mounted.clear();
}

/** Canonical module ids used across the app. */
export const MODULE_IDS = {
  paymentPlans: "payment-plans",
  preparationForm: "preparation-form",
  bookingSetup: "booking-setup",
} as const;