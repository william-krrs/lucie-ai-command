/**
 * Configuration centralisée de Lucie Command Center.
 * Modifiez ces valeurs pour ajuster l'affichage sans toucher au code des composants.
 */

/**
 * Mode audit temporaire : quand true, toutes les pages du parcours sont
 * verrouillées et affichent un écran d'audit global. Passer à false pour
 * réactiver l'application normalement.
 */
export const AUDIT_MODE = false;

/**
 * V1 — « 1 compte authentifié = 1 user_id = 1 parcours ».
 * true  : les étapes personnelles (démonstration, offres, paiement,
 *         configuration, installation, RDV test, réservation R2) exigent un
 *         compte email authentifié. Une session anonyme ne suffit jamais.
 * false : comportement historique (session anonyme automatique).
 * Le diagnostic, le ROI, la recommandation, le partage et les simulations
 * commerciales restent publics dans les deux cas.
 */
export const REQUIRE_ACCOUNT = true;

/** Ouvre toutes les étapes du parcours à tous les visiteurs (aucun verrouillage). */
export const UNLOCK_ALL_PAGES = false;

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

/**
 * Identité e-mail : le domaine d'envoi vérifié (délégation NS Lovable) est
 * `notify.lucieassistant.fr`. Il est volontairement distinct du domaine du
 * site public (assistantvocalpro.fr).
 */
const EMAIL_ROOT_DOMAIN: string = env.VITE_EMAIL_ROOT_DOMAIN ?? "lucieassistant.fr";

export const CONTACT_EMAIL: string = env.VITE_CONTACT_EMAIL ?? `contact@${EMAIL_ROOT_DOMAIN}`;
export const EMAIL_SENDER_DOMAIN: string =
  env.VITE_EMAIL_SENDER_DOMAIN ?? `notify.${EMAIL_ROOT_DOMAIN}`;
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
export const BOOKING_URL_SETUP = "https://app.iclosed.io/e/Iucie/setup-test-lucie";
