import type { PlanKey } from "@/lib/stripe-plans";

/**
 * Formules en libre-service : le client peut payer directement après le
 * diagnostic, sans RDV de démonstration (R2). Premium exige toujours la démo.
 */
export const SELF_SERVE_PLANS: readonly PlanKey[] = ["essential", "pro"];

export function isSelfServePlan(plan: PlanKey | null | undefined): boolean {
  return !!plan && SELF_SERVE_PLANS.includes(plan);
}

/** Paiement autorisé : formule libre-service, ou démonstration terminée. */
export function canCheckoutPlan(plan: PlanKey, demoCompleted: boolean): boolean {
  return demoCompleted || isSelfServePlan(plan);
}

/**
 * Page Offres toujours ouverte : Essentiel et Pro s'achètent sans RDV, quelle
 * que soit la recommandation. Seul le paiement Premium exige la démo.
 */
export function canOpenOffers(_recommended: PlanKey | null, _demoCompleted: boolean): boolean {
  return true;
}
