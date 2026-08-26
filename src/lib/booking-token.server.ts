import { createHmac, timingSafeEqual, randomUUID } from "crypto";
import type { BookingType } from "@/lib/booking-types";

/**
 * Token de corrélation signé pour relier un RDV iClosed au bon utilisateur.
 *
 * Format : JWS compact HS256 (`header.payload.signature`, base64url).
 * Le payload ne contient AUCUN identifiant métier lisible : seulement un
 * `sid` opaque résolu côté serveur via la table `booking_correlations`.
 * `user_id` et `client_ref` ne transitent jamais dans l'URL.
 */

const HEADER = { alg: "HS256", typ: "JWT" } as const;
const ENCODED_HEADER = Buffer.from(JSON.stringify(HEADER)).toString("base64url");

export type BookingTokenPayload = {
  v: 1;
  sid: string;
  iat: number;
  exp: number;
};

export type VerifiedBookingToken = {
  sid: string;
  /** user_id à utiliser pour le booking, résolu côté serveur. */
  userId: string;
  clientRef: string;
  bookingType: BookingType;
};

function getSecret(): string {
  const secret = process.env["BOOKING_CORRELATION_SECRET"];
  if (!secret) throw new Error("BOOKING_CORRELATION_SECRET is not configured");
  return secret;
}

function b64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

/** Construit un token signé pour un `sid` donné. Renvoie `header.payload.signature`. */
export function signBookingToken(payload: BookingTokenPayload): string {
  const data = `${ENCODED_HEADER}.${b64urlJson(payload)}`;
  const sig = createHmac("sha256", getSecret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

/**
 * Vérifie signature + structure + expiration d'un token JWS HS256.
 * Renvoie le payload décodé (sans les identifiants métier) ou `null`.
 * Ne lève jamais ; toute anomalie -> `null` pour repli silencieux.
 */
export function verifyBookingToken(token: string): { sid: string; exp: number } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;

  // 1. Header : alg HS256 obligatoire, `none` refusé.
  let header: unknown;
  try {
    header = JSON.parse(Buffer.from(h, "base64url").toString());
  } catch {
    return null;
  }
  if (
    !header ||
    typeof header !== "object" ||
    (header as { alg?: unknown }).alg !== "HS256" ||
    (header as { typ?: unknown }).typ !== "JWT"
  ) {
    return null;
  }

  // 2. Signature en temps constant.
  const expected = createHmac("sha256", getSecret())
    .update(`${h}.${p}`)
    .digest("base64url");
  const a = Buffer.from(s);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  // 3. Payload + expiration.
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(p, "base64url").toString());
  } catch {
    return null;
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    (payload as { v?: unknown }).v !== 1 ||
    typeof (payload as { sid?: unknown }).sid !== "string" ||
    typeof (payload as { exp?: unknown }).exp !== "number"
  ) {
    return null;
  }
  const exp = (payload as { exp: number }).exp;
  if (exp < Math.floor(Date.now() / 1000)) return null;

  return { sid: (payload as { sid: string }).sid, exp };
}

/** Génère un nouveau `sid` (uuid v4) pour une corrélation. */
export function newCorrelationSid(): string {
  return randomUUID();
}
