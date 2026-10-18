import type { PlanKey } from "@/lib/stripe-plans";

/**
 * Formules en libre-service : le client peut payer directement après le
 * diagnostic, sans RDV de démonstration (R2). Premium exige toujours la démo.
 */
export const SELF_SERVE_PLANS: readonly PlanKey[] = ["essential", "pro"];

export function isSelfServePlan(plan: PlanKey | null | undefined): boolean {
  return !!plan && SELF_SERVE_PLANS.includes(plan);
}

/**
 * RDV de démonstration (R2) obligatoire uniquement pour Premium quand la
 * décision se prend à plusieurs (associé, etc.). Décideur seul : libre-service.
 */
export function needsDemo(plan: PlanKey | null | undefined, multipleDeciders: boolean): boolean {
  return plan === "premium" && multipleDeciders;
}

/** Paiement autorisé : démonstration terminée, ou démo non requise. */
export function canCheckoutPlan(plan: PlanKey, demoCompleted: boolean, multipleDeciders = true): boolean {
  return demoCompleted || isSelfServePlan(plan) || !needsDemo(plan, multipleDeciders);
}

/**
 * Page Offres : ouverte pour Essentiel/Pro et Premium décideur seul.
 * Premium à plusieurs décideurs : verrouillée jusqu'à la validation de la
 * démonstration (elle-même ouverte seulement une fois le RDV pris).
 */
export function canOpenOffers(
  recommended: PlanKey | null,
  demoCompleted: boolean,
  multipleDeciders = false,
): boolean {
  return demoCompleted || !needsDemo(recommended, multipleDeciders);
}
