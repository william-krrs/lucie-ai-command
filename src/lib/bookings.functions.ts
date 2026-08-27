import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEFAULT_BOOKING_TYPE,
  isBookingType,
  type BookingStatusNorm,
  type BookingType,
} from "@/lib/booking-types";

export type UpsertBookingInput = {
  clientRef: string;
  email: string;
  name?: string;
  phone?: string;
  meetingDate: string; // YYYY-MM-DD
  meetingTime?: string; // HH:MM
  meetingAt: string; // ISO UTC
  timezone?: string;
  bookingType: BookingType;
  iclosedEventId?: string;
  meetingLocation?: string;
};

function validate(input: unknown): UpsertBookingInput {
  if (!input || typeof input !== "object") throw new Error("invalid input");
  const i = input as Record<string, unknown>;
  if (typeof i.clientRef !== "string" || i.clientRef.length < 10) throw new Error("clientRef required");
  if (typeof i.email !== "string" || !i.email.includes("@")) throw new Error("email required");
  if (typeof i.meetingDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(i.meetingDate)) throw new Error("meetingDate required");
  if (typeof i.meetingAt !== "string" || Number.isNaN(Date.parse(i.meetingAt))) throw new Error("meetingAt required");
  return {
    clientRef: i.clientRef,
    email: i.email.trim().toLowerCase(),
    name: typeof i.name === "string" ? i.name : undefined,
    phone: typeof i.phone === "string" ? i.phone : undefined,
    meetingDate: i.meetingDate,
    meetingTime: typeof i.meetingTime === "string" ? i.meetingTime : undefined,
    meetingAt: i.meetingAt,
    timezone: typeof i.timezone === "string" ? i.timezone : "Europe/Paris",
    bookingType: isBookingType(i.bookingType) ? i.bookingType : DEFAULT_BOOKING_TYPE,
    iclosedEventId: typeof i.iclosedEventId === "string" ? i.iclosedEventId : undefined,
    meetingLocation: typeof i.meetingLocation === "string" ? i.meetingLocation : undefined,
  };
}

export const upsertBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("bookings")
      .upsert(
        {
          client_ref: data.clientRef,
          booking_type: data.bookingType,
          user_id: context.userId,
          email: data.email,
          name: data.name ?? null,
          phone: data.phone ?? null,
          meeting_date: data.meetingDate,
          meeting_time: data.meetingTime ?? null,
          meeting_at: data.meetingAt,
          timezone: data.timezone ?? "Europe/Paris",
          iclosed_event_id: data.iclosedEventId ?? null,
          meeting_location: data.meetingLocation ?? null,
          status: "pending",
          status_norm: "confirmed",
          canceled_at: null,
          // Reset reminders on reschedule so they fire again for the new slot.
          reminder_24h_sent_at: null,
          reminder_2h_sent_at: null,
        },
        { onConflict: "client_ref,booking_type" },
      );
    if (error) {
      console.error("[upsertBooking] error", error);
      throw new Error(error.message);
    }
    return { ok: true };
  });

function validateRef(input: unknown): { clientRef: string; bookingType: BookingType } {
  if (!input || typeof input !== "object") throw new Error("invalid input");
  const i = input as Record<string, unknown>;
  if (typeof i.clientRef !== "string" || i.clientRef.length < 10) throw new Error("clientRef required");
  return {
    clientRef: i.clientRef,
    bookingType: isBookingType(i.bookingType) ? i.bookingType : DEFAULT_BOOKING_TYPE,
  };
}


export const cancelBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateRef)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("bookings")
      .update({
        status: "cancelled",
        status_norm: "cancelled",
        canceled_at: new Date().toISOString(),
      })
      .eq("client_ref", data.clientRef)
      .eq("booking_type", data.bookingType)
      .eq("user_id", context.userId);
    if (error) {
      console.error("[cancelBooking] error", error);
      throw new Error(error.message);
    }
    return { ok: true };
  });

export type ServerBooking = {
  email: string;
  name: string | null;
  phone: string | null;
  meetingDate: string;
  meetingTime: string | null;
  meetingAt: string;
  timezone: string;
  status: string;
  statusNorm: BookingStatusNorm;
  bookingType: BookingType;
  meetingLocation: string | null;
  updatedAt: string;
  createdAt: string;
};

const SELECT_COLUMNS =
  "email, name, phone, meeting_date, meeting_time, meeting_at, timezone, status, status_norm, booking_type, meeting_location, updated_at, created_at";

type BookingRow = {
  email: string;
  name: string | null;
  phone: string | null;
  meeting_date: string;
  meeting_time: string | null;
  meeting_at: string;
  timezone: string;
  status: string;
  status_norm: BookingStatusNorm;
  booking_type: BookingType;
  meeting_location: string | null;
  updated_at: string;
  created_at: string;
};

function toServerBooking(row: BookingRow): ServerBooking {
  return {
    email: row.email,
    name: row.name,
    phone: row.phone,
    meetingDate: row.meeting_date,
    meetingTime: row.meeting_time,
    meetingAt: row.meeting_at,
    timezone: row.timezone,
    status: row.status,
    statusNorm: row.status_norm,
    bookingType: row.booking_type,
    meetingLocation: row.meeting_location,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

export const getBookingByRef = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateRef)
  .handler(async ({ data, context }): Promise<{ booking: ServerBooking | null }> => {
    // `client_ref` est une colonne uuid : une référence locale héritée
    // (non-uuid) ne peut correspondre à aucune ligne — on évite l'erreur 500.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.clientRef))
      return { booking: null };
    const { data: row, error } = await context.supabase
      .from("bookings")
      .select(SELECT_COLUMNS)
      .eq("client_ref", data.clientRef)
      .eq("booking_type", data.bookingType)
      .eq("user_id", context.userId)
      .maybeSingle<BookingRow>();
    if (error) {
      console.error("[getBookingByRef] error", error);
      throw new Error(error.message);
    }
    if (!row) return { booking: null };
    return { booking: toServerBooking(row) };
  });

/** Retourne tous les rendez-vous (Découverte / Démo / Test) d'un prospect. */
export const listBookingsByRef = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("invalid input");
    const clientRef = (input as { clientRef?: unknown }).clientRef;
    if (typeof clientRef !== "string" || clientRef.length < 10) throw new Error("clientRef required");
    return { clientRef };
  })
  .handler(async ({ data, context }): Promise<{ bookings: ServerBooking[] }> => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.clientRef))
      return { bookings: [] };
    const { data: rows, error } = await context.supabase
      .from("bookings")
      .select(SELECT_COLUMNS)
      .eq("client_ref", data.clientRef)
      .eq("user_id", context.userId)
      .returns<BookingRow[]>();
    if (error) {
      console.error("[listBookingsByRef] error", error);
      throw new Error(error.message);
    }
    return { bookings: (rows ?? []).map(toServerBooking) };
  });
