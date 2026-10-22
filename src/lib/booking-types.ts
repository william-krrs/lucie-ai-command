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

function normalizeLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Type métier déduit du NOM de l'événement iClosed (insensible à la casse et
 * aux accents). Ordre : diagnostic/découverte (R1) → test/paramétrage → démo.
 * Renvoie null si aucun mot-clé n'est reconnu.
 */
export function bookingTypeFromIclosedName(name: string | undefined | null): BookingType | null {
  if (!name) return null;
  const n = normalizeLabel(name);
  if (/\b(diagnostic|decouverte|discovery|r1)\b/.test(n)) return "r1_discovery";
  if (/\b(test|parametrage|mise en service|setup)\b/.test(n)) return "setup_test";
  if (/\b(demo|demonstration|r2)\b/.test(n)) return "r2_demo";
  return null;
}

/** Type déduit du slug, ou null si le slug est inconnu (aucun défaut silencieux). */
export function bookingTypeFromIclosedSlugStrict(slug: string | undefined | null): BookingType | null {
  if (!slug) return null;
  const key = slug.toLowerCase();
  if (ICLOSED_SLUG_TO_BOOKING_TYPE[key]) return ICLOSED_SLUG_TO_BOOKING_TYPE[key];
  return bookingTypeFromIclosedName(key);
}

/**
 * Type par défaut pour un événement non reconnu : R1 (découverte). Ne compte
 * jamais comme démo, donc ne débloque jamais /demonstration.
 */
export const UNKNOWN_BOOKING_FALLBACK: BookingType = "r1_discovery";

export function resolveIclosedBookingType(input: {
  name?: string | null;
  slug?: string | null;
  tokenType?: BookingType | null;
  explicitType?: string | null;
}): { type: BookingType; known: boolean; source: string } {
  const byName = bookingTypeFromIclosedName(input.name);
  if (byName) return { type: byName, known: true, source: "name" };
  const bySlug = bookingTypeFromIclosedSlugStrict(input.slug);
  if (bySlug) return { type: bySlug, known: true, source: "slug" };
  if (input.tokenType) return { type: input.tokenType, known: true, source: "token" };
  if (isBookingType(input.explicitType)) return { type: input.explicitType, known: true, source: "utm" };
  return { type: UNKNOWN_BOOKING_FALLBACK, known: false, source: "fallback" };
}

/** @deprecated utiliser resolveIclosedBookingType (pas de défaut silencieux r2_demo). */
export function bookingTypeFromIclosedSlug(slug: string | undefined | null): BookingType {
  return bookingTypeFromIclosedSlugStrict(slug) ?? UNKNOWN_BOOKING_FALLBACK;
}
