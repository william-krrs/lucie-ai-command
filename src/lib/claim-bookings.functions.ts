import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Rattache au compte connecté les RDV orphelins (user_id null) portant la
 * même adresse e-mail. Côté serveur uniquement, après vérification que
 * l'e-mail du compte est confirmé. Idempotent : seules les lignes encore
 * sans propriétaire sont modifiées, donc le rattachement n'a lieu qu'une fois.
 * Aucun identifiant ni e-mail n'est accepté depuis le client.
 */
export const claimOrphanBookings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ claimed: number }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (error || !data.user) return { claimed: 0 };
    const user = data.user;
    if (user.is_anonymous || !user.email || !user.email_confirmed_at) return { claimed: 0 };

    const { data: rows, error: updErr } = await supabaseAdmin
      .from("bookings")
      .update({ user_id: user.id })
      .is("user_id", null)
      .ilike("email", user.email.toLowerCase().replace(/[%_\\]/g, "\\$&"))
      .select("id");
    if (updErr) {
      console.error("[claimOrphanBookings] update failed", updErr.message);
      return { claimed: 0 };
    }
    return { claimed: rows?.length ?? 0 };
  });
