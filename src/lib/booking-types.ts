/**
 * Vocabulaire métier des rendez-vous Lucie.
 *
 * - `r1_discovery` : RDV de Découverte (premier échange).
 * - `r2_demo`      : RDV de Démo (débloque /demonstration une fois confirmé).
 * - `setup_test`   : RDV post-vente de Test & mise en service (/rdv-test).
 */
export type BookingType = "r1_discovery" | "r2_demo" | "setup_test";

export const BOOKING_TYPES: readonly BookingType[] = [
  "r1_discovery",
  "r2_demo",
  "setup_test",
] as const;

export const DEFAULT_BOOKING_TYPE: BookingType = "r2_demo";

export function isBookingType(value: unknown): value is BookingType {
  return typeof value === "string" && (BOOKING_TYPES as readonly string[]).includes(value);
}

export const BOOKING_TYPE_LABELS: Record<BookingType, string> = {
  r1_discovery: "RDV Découverte",
  r2_demo: "RDV Démo",
  setup_test: "RDV Test & paramétrage",
};

/** Statut normalisé côté base (enum `booking_status`). */
export type BookingStatusNorm =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "rescheduled"
  | "completed"
  | "no_show";

/**
 * Correspondance entre le slug d'événement iClosed et le type métier.
 * Ajoutez ici chaque nouvel événement créé dans iClosed.
 */
export const ICLOSED_SLUG_TO_BOOKING_TYPE: Record<string, BookingType> = {
  "demo-lucie": "r2_demo",
  demo: "r2_demo",
  decouverte: "r1_discovery",
  "r1-decouverte": "r1_discovery",
  "test-parametrage": "setup_test",
  "mise-en-service": "setup_test",
  "setup-test-lucie": "setup_test",
  "setup-test": "setup_test",
};

export function bookingTypeFromIclosedSlug(slug: string | undefined | null): BookingType {
  if (!slug) return DEFAULT_BOOKING_TYPE;
  return ICLOSED_SLUG_TO_BOOKING_TYPE[slug.toLowerCase()] ?? DEFAULT_BOOKING_TYPE;
}
