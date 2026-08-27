/**
 * Configuration des formules Lucie pour le parcours de paiement Stripe serveur.
 *
 * Les montants sont en centimes d'euro (TTC) et représentent un abonnement
 * mensuel. L'installation (490 €) est incluse dans chaque formule — aucun
 * frais distinct n'est facturé.
 *
 * Aucun objet Product/Price n'est créé dans le compte Stripe : les Checkout
 * Sessions utilisent `price_data` (tarification inline), ce qui respecte la
 * contrainte « ne pas modifier les produits/prix existants ».
 */
export type PlanKey = "essential" | "pro" | "premium";

export const STRIPE_PLANS: Record<
  PlanKey,
  { name: string; unitAmount: number; label: string }
> = {
  essential: { name: "Lucie Essential", unitAmount: 14900, label: "Essential" },
  pro: { name: "Lucie Pro", unitAmount: 39900, label: "Pro" },
  premium: { name: "Lucie Premium", unitAmount: 99000, label: "Premium" },
};

export const PLAN_LABELS: Record<PlanKey, string> = {
  essential: "Lucie Essential",
  pro: "Lucie Pro",
  premium: "Lucie Premium",
};
