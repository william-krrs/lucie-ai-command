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
  premium: { name: "Lucie Premium", unitAmount: 99000, label: "Premium" },
};

/** Durée minimale d'engagement qui rend la mise en place gratuite. */
export const COMMITMENT_MONTHS = 3;

/** Identifiants de prix Stripe (mode LIVE, non secrets). */
export const STRIPE_PRICE_IDS: Record<PlanKey | "setup", string> = {
  essential: "price_1UTU6XHbLVmKfVFQGxOOjfHu",
  pro: "price_1UTU6XHbLVmKfVFQ2qkRS3ib",
  premium: "price_1UTU6YHbLVmKfVFQMvETWGhv",
  setup: "price_1UTU6YHbLVmKfVFQNbv6Gw6g",
};

/** Offre de lancement : nombre de premiers clients payants sans frais de mise en place. */
export const LAUNCH_OFFER_SLOTS = 5;

/** Places restantes de l'offre de lancement selon le nombre de clients payés. */
export function launchOfferRemaining(paidCount: number): number {
  const n = Number.isFinite(paidCount) ? Math.max(0, Math.floor(paidCount)) : LAUNCH_OFFER_SLOTS;
  return Math.max(0, LAUNCH_OFFER_SLOTS - n);
}

export function isLaunchOfferAvailable(paidCount: number): boolean {
  return launchOfferRemaining(paidCount) > 0;
}

/** Mise en place : offerte avec engagement 3 mois ou offre de lancement, sinon 490 €. */
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
