import { createServerFn } from "@tanstack/react-start";

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
  .inputValidator(validate)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("bookings")
      .upsert(
        {
          client_ref: data.clientRef,
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
  .inputValidator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("invalid input");
    const clientRef = (input as { clientRef?: unknown }).clientRef;
    if (typeof clientRef !== "string" || clientRef.length < 10) throw new Error("clientRef required");
    return { clientRef };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("client_ref", data.clientRef);
    if (error) {
      console.error("[cancelBooking] error", error);
      throw new Error(error.message);
    }
    return { ok: true };
  });