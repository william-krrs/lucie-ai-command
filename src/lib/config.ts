/**
 * Configuration centralisée de Lucie Command Center.
 * Modifiez ces valeurs pour ajuster l'affichage sans toucher au code des composants.
 */

/** Nombre d'entreprises affiché dans le badge social proof de la page d'accueil. */
export const SOCIAL_PROOF_COMPANY_COUNT = 25;

/**
 * Domaine et URLs publiques du site.
 * Surchargeables via variables d'environnement Vite (VITE_SITE_DOMAIN, VITE_SITE_URL, etc.)
 * pour rester cohérent entre PDF, e-mails et pages sans dupliquer les valeurs.
 */
const env = (import.meta as any).env ?? {};

export const SITE_DOMAIN: string = env.VITE_SITE_DOMAIN ?? "assistantvocalpro.fr";
export const SITE_URL: string = env.VITE_SITE_URL ?? `https://${SITE_DOMAIN}`;
export const CONTACT_EMAIL: string = env.VITE_CONTACT_EMAIL ?? `contact@${SITE_DOMAIN}`;
export const EMAIL_SENDER_DOMAIN: string =
  env.VITE_EMAIL_SENDER_DOMAIN ?? `notify.${SITE_DOMAIN}`;
export const EMAIL_FROM: string = env.VITE_EMAIL_FROM ?? `Lucie <${CONTACT_EMAIL}>`;
export const BRAND_NAME: string = env.VITE_BRAND_NAME ?? "Lucie Assistant";

/**
 * URL du module de prise de rendez-vous iClosed incrusté sur /recommandation
 * (démonstration commerciale) et utilisée pour le RDV « Test & paramétrage ».
 * Remplacez ce lien par votre URL d'événement iClosed
 * (ex: https://app.iclosed.io/e/votre-compte/votre-evenement).
 */
export const BOOKING_URL = "https://app.iclosed.io/e/Iucie/demo-lucie";

/**
 * URL du RDV « Test & paramétrage » (post-installation) sur iClosed.
 * Remplacez ce lien par votre URL d'événement iClosed dédiée à la mise en service.
 */
export const BOOKING_URL_SETUP = "https://app.iclosed.io/e/Iucie/demo-lucie";
