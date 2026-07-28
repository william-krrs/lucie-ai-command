import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CONTACT_EMAIL = "contact@lucieassistant.fr";
const SENDER_DOMAIN = "notify.lucieassistant.fr";
const FROM = "Lucie <contact@lucieassistant.fr>";
const BUCKET = "preparation-pdfs";

const schema = z.object({
  submissionId: z.string().min(1).max(200),
  filename: z.string().min(1).max(200),
  pdfBase64: z.string().min(100).max(15_000_000),
  contactName: z.string().max(200).optional().nullable(),
  contactEmail: z.string().email().max(200).optional().nullable(),
  companyName: z.string().max(200).optional().nullable(),
  companyPhone: z.string().max(60).optional().nullable(),
  planLabel: z.string().max(120).optional().nullable(),
  meetingLabel: z.string().max(200).optional().nullable(),
  sendToProspect: z.boolean().optional(),
});

export const sendPreparationPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Decode base64 → bytes (strip data URL prefix if present)
    const raw = data.pdfBase64.replace(/^data:application\/pdf;base64,/, "");
    const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));

    const safeName = data.filename.replace(/[^a-z0-9._-]+/gi, "-").slice(0, 120);
    const objectPath = `${context.userId}/${data.submissionId}-${Date.now()}-${safeName}`;

    const uploaded = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(objectPath, bytes, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (uploaded.error) {
      console.error("[sendPreparationPdf] upload failed", uploaded.error);
      throw new Error("Impossible d'archiver le PDF du questionnaire.");
    }

    const signed = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(objectPath, 60 * 60 * 24 * 30); // 30 jours
    if (signed.error || !signed.data?.signedUrl) {
      console.error("[sendPreparationPdf] sign failed", signed.error);
      throw new Error("Impossible de générer le lien du PDF.");
    }
    const pdfUrl = signed.data.signedUrl;

    const ref = data.submissionId.slice(0, 8).toUpperCase();
    const rows: Array<[string, string]> = [
      ["Référence", `#${ref}`],
      ["Entreprise", data.companyName ?? "—"],
      ["Contact", data.contactName ?? "—"],
      ["Email", data.contactEmail ?? "—"],
      ["Téléphone", data.companyPhone ?? "—"],
      ["Formule", data.planLabel ?? "—"],
      ["Rendez-vous", data.meetingLabel ?? "À planifier"],
    ];

    const rowsHtml = rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:6px 12px 6px 0;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">${k}</td><td style="padding:6px 0;color:#111;font-size:14px;font-weight:600;">${escapeHtml(v)}</td></tr>`,
      )
      .join("");

    const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f5f3ff;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111;">
  <div style="max-width:640px;margin:0 auto;padding:32px 24px;">
    <div style="background:#0f0b1f;color:#fff;border-radius:16px;padding:28px;">
      <div style="font-size:11px;letter-spacing:0.16em;color:#c4b5fd;text-transform:uppercase;">Nouveau questionnaire</div>
      <h1 style="margin:8px 0 0;font-size:24px;">Lucie · Préparation reçue</h1>
      <p style="margin:12px 0 0;color:#d8d4f0;font-size:14px;">${escapeHtml(data.companyName ?? "Un prospect")} vient de soumettre le questionnaire de configuration.</p>
    </div>
    <div style="background:#fff;border-radius:16px;padding:24px;margin-top:16px;border:1px solid #e9e4f7;">
      <table style="width:100%;border-collapse:collapse;">${rowsHtml}</table>
      <div style="margin-top:24px;text-align:center;">
        <a href="${pdfUrl}" style="display:inline-block;background:#6d28d9;color:#fff;text-decoration:none;font-weight:600;padding:14px 24px;border-radius:12px;font-size:15px;">📄 Télécharger le PDF récapitulatif</a>
      </div>
      <p style="margin:16px 0 0;color:#888;font-size:12px;text-align:center;">Lien signé valable 30 jours.</p>
    </div>
    <p style="margin:16px 0 0;color:#888;font-size:12px;text-align:center;">Email automatique — Lucie Command Center</p>
  </div>
</body></html>`;

    const text = `Nouveau questionnaire Lucie (#${ref})

${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}

PDF récapitulatif (lien signé 30 jours) :
${pdfUrl}
`;

    const { sendLovableEmail, EmailAPIError } = await import("@lovable.dev/email-js");
    try {
      const res = await sendLovableEmail(
        {
          to: CONTACT_EMAIL,
          from: FROM,
          sender_domain: SENDER_DOMAIN,
          subject: `Questionnaire Lucie · ${data.companyName ?? "Nouveau prospect"} (#${ref})`,
          html,
          text,
          reply_to: data.contactEmail ?? undefined,
          idempotency_key: `prep-${data.submissionId}`,
          label: "preparation-pdf",
        },
        { apiKey, idempotencyKey: `prep-${data.submissionId}` },
      );
      await context.supabase
        .from("preparation_submissions")
        .update({ email_status: "sent" })
        .eq("id", data.submissionId);

      // Copie facultative au prospect (si opt-in + email renseigné)
      let prospectSent = false;
      let prospectMessageId: string | undefined;
      let prospectError: string | undefined;
      if (data.sendToProspect && data.contactEmail) {
        const prospectHtml = `<!doctype html><html><body style="margin:0;padding:0;background:#f5f3ff;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111;">
  <div style="max-width:640px;margin:0 auto;padding:32px 24px;">
    <div style="background:#0f0b1f;color:#fff;border-radius:16px;padding:28px;">
      <div style="font-size:11px;letter-spacing:0.16em;color:#c4b5fd;text-transform:uppercase;">Votre récapitulatif Lucie</div>
      <h1 style="margin:8px 0 0;font-size:24px;">Merci ${escapeHtml(data.contactName ?? "")} !</h1>
      <p style="margin:12px 0 0;color:#d8d4f0;font-size:14px;">Voici votre récapitulatif de configuration. L'équipe Lucie revient vers vous très vite pour lancer l'installation.</p>
    </div>
    <div style="background:#fff;border-radius:16px;padding:24px;margin-top:16px;border:1px solid #e9e4f7;">
      <table style="width:100%;border-collapse:collapse;">${rowsHtml}</table>
      <div style="margin-top:24px;text-align:center;">
        <a href="${pdfUrl}" style="display:inline-block;background:#6d28d9;color:#fff;text-decoration:none;font-weight:600;padding:14px 24px;border-radius:12px;font-size:15px;">📄 Télécharger votre récapitulatif PDF</a>
      </div>
      <p style="margin:16px 0 0;color:#888;font-size:12px;text-align:center;">Lien signé valable 30 jours.</p>
    </div>
    <p style="margin:16px 0 0;color:#888;font-size:12px;text-align:center;">Une question ? Répondez simplement à cet email.</p>
  </div>
</body></html>`;
        const prospectText = `Votre récapitulatif Lucie (#${ref})\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nPDF récapitulatif (lien signé 30 jours) :\n${pdfUrl}\n`;
        try {
          const p = await sendLovableEmail(
            {
              to: data.contactEmail,
              from: FROM,
              sender_domain: SENDER_DOMAIN,
              subject: `Votre récapitulatif Lucie (#${ref})`,
              html: prospectHtml,
              text: prospectText,
              reply_to: CONTACT_EMAIL,
              idempotency_key: `prep-prospect-${data.submissionId}`,
              label: "preparation-pdf-prospect",
            },
            { apiKey, idempotencyKey: `prep-prospect-${data.submissionId}` },
          );
          prospectSent = true;
          prospectMessageId = p.message_id;
        } catch (err) {
          prospectError =
            err instanceof EmailAPIError
              ? `${(err as InstanceType<typeof EmailAPIError> & { code?: string }).code ?? (err as InstanceType<typeof EmailAPIError>).status}: ${(err as Error).message}`
              : err instanceof Error
                ? err.message
                : String(err);
          console.error("[sendPreparationPdf] prospect email failed", prospectError);
        }
      }

      return {
        sent: true as const,
        pdfUrl,
        messageId: res.message_id,
        prospectSent,
        prospectMessageId,
        prospectError,
      };
    } catch (err) {
      const msg =
        err instanceof EmailAPIError
          ? `${(err as InstanceType<typeof EmailAPIError> & { code?: string }).code ?? (err as InstanceType<typeof EmailAPIError>).status}: ${(err as Error).message}`
          : err instanceof Error
            ? err.message
            : String(err);
      console.error("[sendPreparationPdf] email failed", msg);
      await context.supabase
        .from("preparation_submissions")
        .update({ email_status: "failed" })
        .eq("id", data.submissionId);
      return { sent: false as const, pdfUrl, error: msg };
    }
  });

function escapeHtml(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}