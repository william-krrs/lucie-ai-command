import { sendTemplateEmail } from "@/lib/email-templates/send-email";
import type { TemplateName } from "@/lib/email-templates/registry";

/**
 * Emails d'avancement d'installation.
 *
 * Règles :
 * - envoi UNIQUEMENT sur une vraie transition de statut (from !== to) ;
 * - jamais bloquant : toute erreur d'envoi est loguée, jamais propagée, afin
 *   qu'un incident email ne corrompe pas le statut déjà écrit en base ;
 * - serveur uniquement (fichier .server.ts, chargé via import dynamique).
 */

export type InstallStatus = "not_started" | "in_progress" | "ready_for_test" | "live";

const RDV_TEST_URL = "https://diagnostic.lucieassistant.fr/rdv-test";

const TEMPLATE_BY_STATUS: Partial<Record<InstallStatus, TemplateName>> = {
  in_progress: "installation-in-progress",
  ready_for_test: "installation-ready-for-test",
  live: "installation-live",
};

export async function notifyInstallationStatusChange(
  userId: string,
  from: InstallStatus | null | undefined,
  to: InstallStatus,
): Promise<void> {
  try {
    if (from === to) return; // Re-clic sur le même statut : aucun email.
    const templateName = TEMPLATE_BY_STATUS[to];
    if (!templateName) return; // not_started : pas d'email.

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error || !data?.user?.email) {
      console.error("[installation-email] destinataire introuvable", userId, error);
      return;
    }

    const user = data.user;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const name =
      typeof meta.full_name === "string"
        ? meta.full_name
        : typeof meta.name === "string"
          ? meta.name
          : undefined;

    const res = await sendTemplateEmail(templateName, user.email!, {
      templateData: { name, ctaUrl: RDV_TEST_URL },
      // Une transition donnée n'envoie qu'un email, même en cas de retry.
      idempotencyKey: `install-${to}-${userId}-${new Date().toISOString().slice(0, 13)}`,
    });
    if (!res.sent) {
      console.error("[installation-email] non envoyé", to, res.reason, res.message);
    }
  } catch (err) {
    console.error("[installation-email] échec", err);
  }
}
