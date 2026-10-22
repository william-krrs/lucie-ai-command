/** Règle des frais de mise en place (appliquée au paiement). */
export const SETUP_FEE_RULE = "Mise en place offerte avec un engagement de 3 mois minimum. Sans engagement : 490 € une seule fois, ajoutés au premier paiement.";

/** Texte de l'offre de lancement ; null quand toutes les places sont prises (offre masquée). */
export function launchOfferText(remaining: number, slots = 5): string | null {
  if (remaining <= 0) return null;
  const places = remaining > 1 ? `${remaining} places restantes` : "1 place restante";
  return `Offre de lancement : mise en place offerte pour les ${slots} premiers clients, même sans engagement (${places} sur ${slots}). Ensuite : mise en place 490 €, offerte avec un engagement de 3 mois.`;
}

export const INCLUDED_MINUTES = {
  essential: 300,
  pro: 800,
  premium: 2500,
} as const;

export const OVERAGE_RATE_CENTS = 35;
export const OVERAGE_LABEL = "Au-delà : 0,35 € par minute.";