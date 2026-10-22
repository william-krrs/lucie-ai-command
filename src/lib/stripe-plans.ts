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
  pro: { name: "Lucie Pro", unitAmount: 29900, label: "Pro" },
  premium: { name: "Lucie Premium", unitAmount: 96000, label: "Premium" },
};

/** Durée minimale d'engagement qui rend la mise en place gratuite. */
export const COMMITMENT_MONTHS = 3;

/** Offre de lancement : mise en place offerte aux N premiers clients payants. */
export const LAUNCH_OFFER_SLOTS = 5;

/** Vrai tant que moins de N clients ont payé. */
export function isLaunchOfferAvailable(paidCount: number): boolean {
  return paidCount < LAUNCH_OFFER_SLOTS;
}

/** Frais de mise en place : offerts avec engagement ou offre de lancement, sinon 490 €. */
export function setupFeeAmount(commitment: boolean, launchOffer = false): number {
  return commitment || launchOffer ? 0 : SETUP_FEE_AMOUNT;
}

/** Total facturé au premier paiement (abonnement + setup éventuel). */
export function firstPaymentAmount(plan: PlanKey, commitment = false, launchOffer = false): number {
  return STRIPE_PLANS[plan].unitAmount + setupFeeAmount(commitment, launchOffer);
}


export const PLAN_LABELS: Record<PlanKey, string> = {
  essential: "Lucie Essential",
  pro: "Lucie Pro",
  premium: "Lucie Premium",
};
