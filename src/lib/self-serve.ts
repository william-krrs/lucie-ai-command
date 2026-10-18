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

/** Page Offres ouverte : démo terminée, ou formule recommandée en libre-service. */
export function canOpenOffers(recommended: PlanKey | null, demoCompleted: boolean): boolean {
  return demoCompleted || isSelfServePlan(recommended);
}
