import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import {
  bookingTypeFromIclosedSlug,
  isBookingType,
  type BookingType,
} from "@/lib/booking-types";

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

function actionFrom(flat: Flat): Action | null {
  const raw = (str(flat, ["event", "event_type", "type", "action", "topic"]) ?? "").toLowerCase();
  if (/cancel/.test(raw)) return "cancelled";
  if (/reschedul|resched|moved/.test(raw)) return "rescheduled";
  if (/book|schedul|created|confirm/.test(raw)) return "booked";
  return null;
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
  const action = actionFrom(flat);
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
  if (!rowId && clientRef) {
    const { data } = await supabaseAdmin
      .from("bookings")
      .select("id")
      .eq("client_ref", clientRef)
      .eq("booking_type", bookingType)
      .maybeSingle();
    rowId = data?.id ?? null;
  }
  if (!rowId && email) {
    const { data } = await supabaseAdmin
      .from("bookings")
      .select("id")
      .eq("email", email)
      .eq("booking_type", bookingType)
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
