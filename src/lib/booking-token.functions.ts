import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ALLOWED_BOOKING_TYPES = ["r1_discovery", "r2_demo", "setup_test"] as const;

const inputSchema = z.object({
  clientRef: z.string().uuid(),
  bookingType: z.enum(ALLOWED_BOOKING_TYPES).default("r2_demo"),
});

/**
 * Émet un token de corrélation signé (JWS HS256) pour relier le prochain RDV
 * iClosed de l'utilisateur courant. Le token porte un `sid` opaque ; la
 * correspondance `sid -> user_id/client_ref` est persistée côté serveur dans
 * `booking_correlations` (non lisible par le client — RLS sans policy).
 *
 * À appeler depuis le composant avant d'ouvrir le widget iClosed, puis injecter
 * le token renvoyé dans l'URL iClosed sous `utm_booking_token`.
 */
export const issueBookingToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { signBookingToken, newCorrelationSid } = await import(
      "@/lib/booking-token.server"
    );
    const sid = newCorrelationSid();
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 24 * 60 * 60; // 24 h

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("booking_correlations").insert({
      sid,
      user_id: context.userId,
      client_ref: data.clientRef,
      booking_type: data.bookingType,
      expires_at: new Date(exp * 1000).toISOString(),
    });
    if (error) throw error;

    const token = signBookingToken({ v: 1, sid, iat: now, exp });
    return { token };
  });
