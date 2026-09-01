/**
 * Configuration des formules Lucie pour le parcours de paiement Stripe serveur.
 *
 * Les montants sont en centimes d'euro (TTC).
 * - `unitAmount` : abonnement mensuel récurrent.
 * - `SETUP_FEE_AMOUNT` : frais d'installation et personnalisation, facturés
 *   **une seule fois** sur la première facture (ligne one-shot du Checkout,
 *   jamais récurrente).
 *
 * Aucun objet Product/Price n'est créé dans le compte Stripe : les Checkout
 * Sessions utilisent `price_data` (tarification inline).
 */
export type PlanKey = "essential" | "pro" | "premium";

/** Frais d'installation et personnalisation, une seule fois (490 € TTC). */
export const SETUP_FEE_AMOUNT = 49000;
export const SETUP_FEE_NAME = "Installation et personnalisation Lucie (une seule fois)";

export const STRIPE_PLANS: Record<
  PlanKey,
  { name: string; unitAmount: number; label: string }
> = {
  essential: { name: "Lucie Essential", unitAmount: 14900, label: "Essential" },
  pro: { name: "Lucie Pro", unitAmount: 39900, label: "Pro" },
  premium: { name: "Lucie Premium", unitAmount: 99000, label: "Premium" },
};

/** Total facturé au premier paiement (abonnement + setup). */
export function firstPaymentAmount(plan: PlanKey): number {
  return STRIPE_PLANS[plan].unitAmount + SETUP_FEE_AMOUNT;
}


export const PLAN_LABELS: Record<PlanKey, string> = {
  essential: "Lucie Essential",
  pro: "Lucie Pro",
  premium: "Lucie Premium",
};
