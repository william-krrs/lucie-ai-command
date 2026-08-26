import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import {
  bookingTypeFromIclosedSlug,
  isBookingType,
  type BookingType,
} from "@/lib/booking-types";
import { verifyBookingToken } from "@/lib/booking-token.server";

/**
 * Webhook iClosed direct (sans Zapier).
 *
 * Événements traités : Call booked / Call cancelled / Call rescheduled.
 * Corrélation, dans cet ordre :
 *   1. iclosed_event_id
 *   2. utm_client_ref (paramètre injecté dans l'URL du calendrier) + booking_type
 *   3. email (insensible à la casse) + booking_type, le plus récent
 */

type Flat = Record<string, unknown>;

function flatten(value: unknown, out: Flat = {}, depth = 0): Flat {
  if (depth > 5 || !value || typeof value !== "object") return out;
  for (const [k, v] of Object.entries(value as Flat)) {
    const key = k.toLowerCase();
    if (v && typeof v === "object") flatten(v, out, depth + 1);
    else if (!(key in out) && v !== null && v !== undefined) out[key] = v;
  }
  return out;
}

function str(flat: Flat, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = flat[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

type Action = "booked" | "cancelled" | "rescheduled";

function normalizeEventLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ");
}

function actionFromLabel(value: string): Action | null {
  const normalized = normalizeEventLabel(value);
  if (normalized === "closer") return null;

  if (/^(appel |call )?(annule|cancelled|canceled|cancel)$/.test(normalized)) return "cancelled";
  if (/^(appel |call )?(reporte|rescheduled|reschedule|resched|moved)$/.test(normalized)) return "rescheduled";
  if (/^(appel |call )?(reserve|booked|scheduled|created|confirmed|book)$/.test(normalized)) return "booked";
  return null;
}

function valueAtPath(value: unknown, path: string): unknown {
  let current = value;
  for (const segment of path.split(".")) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Flat)[segment];
  }
  return current;
}

type EventCandidate = { path: string; value: string; action: Action };

function findEventCandidates(value: unknown): EventCandidate[] {
  const candidates: EventCandidate[] = [];

  function visit(current: unknown, path: string, depth: number): void {
    if (depth > 7 || !current || typeof current !== "object") return;
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${path}[${index}]`, depth + 1));
      return;
    }

    for (const [key, nested] of Object.entries(current as Flat)) {
      const nestedPath = path ? `${path}.${key}` : key;
      if (typeof nested === "string") {
        const action = actionFromLabel(nested);
        if (action) candidates.push({ path: nestedPath, value: normalizeEventLabel(nested), action });
      } else {
        visit(nested, nestedPath, depth + 1);
      }
    }
  }

  visit(value, "", 0);
  return candidates;
}

const ICLOSED_EVENT_PATHS = [
  "event.type",
  "event.event_type",
  "event.name",
  "data.event.type",
  "data.event.event_type",
  "data.event.name",
  "data.event_type",
  "data.event",
  "event_type",
  "event",
] as const;

function actionFrom(payload: unknown): Action | null {
  const topLevelKeys = payload && typeof payload === "object" && !Array.isArray(payload)
    ? Object.keys(payload as Flat)
    : [];

  let selected: EventCandidate | null = null;
  for (const path of ICLOSED_EVENT_PATHS) {
    const value = valueAtPath(payload, path);
    if (typeof value !== "string") continue;
    const action = actionFromLabel(value);
    if (action) {
      selected = { path, value: normalizeEventLabel(value), action };
      break;
    }
  }

  const candidates = findEventCandidates(payload);
  if (!selected) selected = candidates[0] ?? null;

  // Diagnostic structurel temporaire : uniquement des clés et des libellés
  // strictement reconnus comme événements. Aucune donnée personnelle ni URL.
  console.info("[iclosed webhook] event diagnostic", {
    topLevelKeys,
    candidates,
    selectedPath: selected?.path ?? null,
    action: selected?.action ?? "ignored",
  });
  return selected?.action ?? null;
}

function splitDateTime(iso: string): { date: string; time: string; at: string } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const wall = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  const date = wall
    ? `${wall[1]}-${wall[2]}-${wall[3]}`
    : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  const time = wall
    ? `${wall[4]}:${wall[5]}`
    : `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  return { date, time, at: d.toISOString() };
}

function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const provided = header.replace(/^sha256=/i, "").trim();
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Comparaison en temps constant entre le token reçu dans l'URL et le secret serveur. */
function verifyToken(received: string | null, secret: string): boolean {
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Résout le `user_id` propriétaire d'un RDV à partir du token signé
 * `utm_booking_token` présent dans l'URL iClosed. Le token ne contient qu'un
 * `sid` opaque : la correspondance `sid -> user_id/client_ref/booking_type` est
 * lue côté serveur dans `booking_correlations` (table non lisible par le client).
 * Renvoie `null` si le token est absent, invalide, expiré ou introuvable.
 */
async function resolveFromBookingToken(
  url: URL,
  supabaseAdmin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
): Promise<{ userId: string; clientRef: string; bookingType: BookingType } | null> {
  const rawToken = url.searchParams.get("utm_booking_token");
  if (!rawToken) return null;
  const verified = verifyBookingToken(rawToken);
  if (!verified) {
    console.info("[iclosed webhook] booking token present but invalid");
    return null;
  }
  const { data, error } = await supabaseAdmin
    .from("booking_correlations")
    .select("user_id, client_ref, booking_type, expires_at")
    .eq("sid", verified.sid)
    .maybeSingle();
  if (error || !data) {
    console.info("[iclosed webhook] correlation sid not found", { sid: verified.sid });
    return null;
  }
  // Double vérification d'expiration côté base.
  const expiresAt = new Date(data.expires_at as string).getTime();
  if (Number.isNaN(expiresAt) || expiresAt < Date.now()) {
    console.info("[iclosed webhook] correlation sid expired", { sid: verified.sid });
    return null;
  }
  if (!isBookingType(data.booking_type as string)) return null;
  return {
    userId: data.user_id as string,
    clientRef: data.client_ref as string,
    bookingType: data.booking_type as BookingType,
  };
}

async function handle(request: Request): Promise<Response> {
  const secret = process.env["ICLOSED_WEBHOOK_SECRET"];
  if (!secret) {
    console.error("[iclosed webhook] missing ICLOSED_WEBHOOK_SECRET");
    return new Response("Webhook not configured", { status: 503 });
  }

  const rawBody = await request.text();

  // Authentification : token dans l'URL (?token=...) OU signature HMAC valide.
  // Le token URL est suffisant ; la signature reste supportée en complément.
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return new Response("Invalid request URL", { status: 400 });
  }
  const tokenOk = verifyToken(url.searchParams.get("token"), secret);
  const signature =
    request.headers.get("x-iclosed-signature") ??
    request.headers.get("x-webhook-signature") ??
    request.headers.get("x-signature");
  const signatureOk = verifySignature(rawBody, signature, secret);

  if (!tokenOk && !signatureOk) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const flat = flatten(payload);
  const action = actionFrom(payload);
  if (!action) return Response.json({ ok: true, ignored: true });

  const eventId = str(flat, ["event_id", "eventid", "call_id", "callid", "uuid", "id"]);
  const clientRef = str(flat, ["utm_client_ref", "client_ref", "clientref"]);
  const email = str(flat, ["email", "invitee_email", "inviteeemail"])?.toLowerCase();
  const name = str(flat, ["name", "invitee_name", "invitee_full_name", "fullname"]);
  const phone = str(flat, ["phone", "invitee_phone", "phone_number"]);
  const location = str(flat, ["location", "meeting_location", "meeting_url", "join_url"]);
  const timezone = str(flat, ["timezone", "time_zone"]) ?? "Europe/Paris";
  const slug = str(flat, ["event_type_slug", "eventtypeslug", "slug", "event_slug"]);
  const explicitType = str(flat, ["booking_type", "utm_medium"]);
  const bookingType: BookingType = isBookingType(explicitType)
    ? explicitType
    : bookingTypeFromIclosedSlug(slug);
  const start = str(flat, ["start_time", "starttime", "event_start_time", "scheduled_at", "starts_at"]);
  const oldStart = str(flat, ["old_start_time", "previous_start_time", "former_start_time"]);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // --- Résolution prioritaire : token signé utm_booking_token ---
  // Source de vérité pour le user_id propriétaire du RDV. Ne fait jamais
  // confiance à un user_id venant du payload. Les valeurs du token (client_ref,
  // booking_type) priment sur celles du payload car elles sont signées serveur.
  const correlation = await resolveFromBookingToken(url, supabaseAdmin);
  const userId = correlation?.userId ?? null;
  const effectiveClientRef = correlation?.clientRef ?? clientRef;
  const effectiveBookingType = correlation?.bookingType ?? bookingType;

  // --- Corrélation : event_id -> utm_client_ref -> email ---
  let rowId: string | null = null;
  if (eventId) {
    const { data } = await supabaseAdmin
      .from("bookings")
      .select("id")
      .eq("iclosed_event_id", eventId)
      .maybeSingle();
    rowId = data?.id ?? null;
  }
  if (!rowId && effectiveClientRef) {
    const { data } = await supabaseAdmin
      .from("bookings")
      .select("id")
      .eq("client_ref", effectiveClientRef)
      .eq("booking_type", effectiveBookingType)
      .maybeSingle();
    rowId = data?.id ?? null;
  }
  if (!rowId && email) {
    const { data } = await supabaseAdmin
      .from("bookings")
      .select("id")
      .eq("email", email)
      .eq("booking_type", effectiveBookingType)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    rowId = data?.id ?? null;
  }

  if (action === "cancelled") {
    if (!rowId) return Response.json({ ok: true, matched: false });
    const { error } = await supabaseAdmin
      .from("bookings")
      .update({
        status: "cancelled",
        status_norm: "cancelled",
        canceled_at: new Date().toISOString(),
        ...(eventId ? { iclosed_event_id: eventId } : {}),
      })
      .eq("id", rowId);
    if (error) {
      console.error("[iclosed webhook] cancel failed", error.message);
      return new Response("Update failed", { status: 500 });
    }
    return Response.json({ ok: true, action, matched: true });
  }

  const slot = start ? splitDateTime(start) : null;
  if (!slot) return new Response("Missing start_time", { status: 400 });

  const common = {
    booking_type: bookingType,
    email: email ?? "unknown@unknown.invalid",
    name: name ?? null,
    phone: phone ?? null,
    meeting_date: slot.date,
    meeting_time: slot.time,
    meeting_at: slot.at,
    timezone,
    meeting_location: location ?? null,
    iclosed_event_id: eventId ?? null,
    status: "pending",
    status_norm: "confirmed" as const,
    canceled_at: null,
    rescheduled_from: action === "rescheduled" && oldStart ? new Date(oldStart).toISOString() : null,
    // Un nouveau créneau doit redéclencher les rappels.
    reminder_24h_sent_at: null,
    reminder_2h_sent_at: null,
  };

  if (rowId) {
    const { error } = await supabaseAdmin.from("bookings").update(common).eq("id", rowId);
    if (error) {
      console.error("[iclosed webhook] update failed", error.message);
      return new Response("Update failed", { status: 500 });
    }
    return Response.json({ ok: true, action, matched: true });
  }

  // Aucune correspondance : on crée une ligne orpheline rattachable plus tard
  // par e-mail. client_ref est généré pour respecter la contrainte d'unicité.
  const { error } = await supabaseAdmin.from("bookings").insert({
    ...common,
    client_ref: clientRef ?? crypto.randomUUID(),
    user_id: null,
  });
  if (error) {
    console.error("[iclosed webhook] insert failed", error.message);
    return new Response("Insert failed", { status: 500 });
  }
  return Response.json({ ok: true, action, matched: false, created: true });
}

export const Route = createFileRoute("/api/public/hooks/iclosed")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
    },
  },
});
