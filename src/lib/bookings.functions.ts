import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UpsertBookingInput = {
  clientRef: string;
  email: string;
  name?: string;
  phone?: string;
  meetingDate: string; // YYYY-MM-DD
  meetingTime?: string; // HH:MM
  meetingAt: string; // ISO UTC
  timezone?: string;
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
          user_id: context.userId,
          email: data.email,
          name: data.name ?? null,
          phone: data.phone ?? null,
          meeting_date: data.meetingDate,
          meeting_time: data.meetingTime ?? null,
          meeting_at: data.meetingAt,
          timezone: data.timezone ?? "Europe/Paris",
          status: "pending",
          // Reset reminders on reschedule so they fire again for the new slot.
          reminder_24h_sent_at: null,
          reminder_2h_sent_at: null,
        },
        { onConflict: "client_ref" },
      );
    if (error) {
      console.error("[upsertBooking] error", error);
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const cancelBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("invalid input");
    const clientRef = (input as { clientRef?: unknown }).clientRef;
    if (typeof clientRef !== "string" || clientRef.length < 10) throw new Error("clientRef required");
    return { clientRef };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("client_ref", data.clientRef)
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
  updatedAt: string;
  createdAt: string;
};

export const getBookingByRef = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("invalid input");
    const clientRef = (input as { clientRef?: unknown }).clientRef;
    if (typeof clientRef !== "string" || clientRef.length < 10) throw new Error("clientRef required");
    return { clientRef };
  })
  .handler(async ({ data, context }): Promise<{ booking: ServerBooking | null }> => {
    const { data: row, error } = await context.supabase
      .from("bookings")
      .select(
        "email, name, phone, meeting_date, meeting_time, meeting_at, timezone, status, updated_at, created_at",
      )
      .eq("client_ref", data.clientRef)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) {
      console.error("[getBookingByRef] error", error);
      throw new Error(error.message);
    }
    if (!row) return { booking: null };
    return {
      booking: {
        email: row.email,
        name: row.name,
        phone: row.phone,
        meetingDate: row.meeting_date,
        meetingTime: row.meeting_time,
        meetingAt: row.meeting_at,
        timezone: row.timezone,
        status: row.status,
        updatedAt: row.updated_at,
        createdAt: row.created_at,
      },
    };
  });