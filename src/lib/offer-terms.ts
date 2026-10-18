/** Règle des frais de mise en place (appliquée au paiement). */
export const SETUP_FEE_RULE = "Mise en place offerte avec un engagement de 3 mois minimum. Sans engagement : 490 € une seule fois, ajoutés au premier paiement.";

/** Shared commercial terms; these do not apply discounts or metered billing. */
export const LAUNCH_OFFER = "Offre de lancement : mise en place offerte pour les 5 premiers artisans (sans engagement). Ensuite : mise en place 490 €, offerte avec un engagement de 3 mois.";

export const INCLUDED_MINUTES = {
  essential: 300,
  pro: 800,
  premium: 2500,
} as const;

export const OVERAGE_RATE_CENTS = 35;
export const OVERAGE_LABEL = "Au-delà : 0,35 € par minute.";