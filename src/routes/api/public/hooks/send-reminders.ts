import { createFileRoute } from "@tanstack/react-router";
import { sendTemplateEmail } from "@/lib/email-templates/send-email";

type BookingRow = {
  id: string;
  email: string;
  name: string | null;
  meeting_at: string;
  meeting_date: string;
  meeting_time: string | null;
  reminder_24h_sent_at: string | null;
  reminder_2h_sent_at: string | null;
  status: string;
};

function formatDateFR(date: string, time?: string | null): string {
  try {
    const [y, m, d] = date.split("-").map(Number);
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
    const base = new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(dt);
    return time ? `${base}` : base;
  } catch {
    return date;
  }
}

async function runReminders() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const now = new Date();
  // 24h window: [now + 23h, now + 25h]
  const in23h = new Date(now.getTime() + 23 * 3600_000).toISOString();
  const in25h = new Date(now.getTime() + 25 * 3600_000).toISOString();
  // 2h window: [now + 1h30, now + 2h30]
  const in90m = new Date(now.getTime() + 90 * 60_000).toISOString();
  const in150m = new Date(now.getTime() + 150 * 60_000).toISOString();

  const results: {
    total_24h: number;
    total_2h: number;
    sent_24h: number;
    sent_2h: number;
    errors: Array<{ id: string; kind: string; message: string }>;
  } = { total_24h: 0, total_2h: 0, sent_24h: 0, sent_2h: 0, errors: [] };

  // --- 24h reminders ---
  const { data: due24, error: err24 } = await supabaseAdmin
    .from("bookings")
    .select("id,email,name,meeting_at,meeting_date,meeting_time,reminder_24h_sent_at,reminder_2h_sent_at,status")
    .eq("status_norm", "confirmed")
    .is("reminder_24h_sent_at", null)
    .gte("meeting_at", in23h)
    .lte("meeting_at", in25h)
    .returns<BookingRow[]>();

  if (err24) throw new Error(`query 24h: ${err24.message}`);
  results.total_24h = due24?.length ?? 0;

  for (const b of due24 ?? []) {
    const res = await sendTemplateEmail("reminder-24h", b.email, {
      idempotencyKey: `reminder-24h-${b.id}`,
      templateData: {
        name: b.name ?? undefined,
        meetingDateLabel: formatDateFR(b.meeting_date, b.meeting_time),
        meetingTime: b.meeting_time ?? undefined,
      },
    });
    if (res.sent) {
      results.sent_24h += 1;
      await supabaseAdmin
        .from("bookings")
        .update({ reminder_24h_sent_at: new Date().toISOString() })
        .eq("id", b.id);
    } else {
      results.errors.push({ id: b.id, kind: "24h", message: res.reason + (res.message ? `: ${res.message}` : "") });
      // Mark suppressed as "sent" so we don't retry forever.
      if (res.reason === "recipient_suppressed") {
        await supabaseAdmin
          .from("bookings")
          .update({ reminder_24h_sent_at: new Date().toISOString(), last_error: "recipient_suppressed" })
          .eq("id", b.id);
      }
    }
  }

  // --- 2h reminders ---
  const { data: due2, error: err2 } = await supabaseAdmin
    .from("bookings")
    .select("id,email,name,meeting_at,meeting_date,meeting_time,reminder_24h_sent_at,reminder_2h_sent_at,status")
    .eq("status_norm", "confirmed")
    .is("reminder_2h_sent_at", null)
    .gte("meeting_at", in90m)
    .lte("meeting_at", in150m)
    .returns<BookingRow[]>();

  if (err2) throw new Error(`query 2h: ${err2.message}`);
  results.total_2h = due2?.length ?? 0;

  for (const b of due2 ?? []) {
    const res = await sendTemplateEmail("reminder-2h", b.email, {
      idempotencyKey: `reminder-2h-${b.id}`,
      templateData: {
        name: b.name ?? undefined,
        meetingDateLabel: "aujourd'hui",
        meetingTime: b.meeting_time ?? undefined,
      },
    });
    if (res.sent) {
      results.sent_2h += 1;
      await supabaseAdmin
        .from("bookings")
        .update({ reminder_2h_sent_at: new Date().toISOString() })
        .eq("id", b.id);
    } else {
      results.errors.push({ id: b.id, kind: "2h", message: res.reason + (res.message ? `: ${res.message}` : "") });
      if (res.reason === "recipient_suppressed") {
        await supabaseAdmin
          .from("bookings")
          .update({ reminder_2h_sent_at: new Date().toISOString(), last_error: "recipient_suppressed" })
          .eq("id", b.id);
      }
    }
  }

  return results;
}

export const Route = createFileRoute("/api/public/hooks/send-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.CRON_SECRET;
        const provided =
          request.headers.get("x-cron-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        if (!expected || provided !== expected) {
          return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        try {
          const result = await runReminders();
          return new Response(JSON.stringify({ ok: true, ...result }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[send-reminders] failed", err);
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
      GET: async () =>
        new Response(JSON.stringify({ ok: true, hint: "POST this endpoint to trigger reminders" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    },
  },
});