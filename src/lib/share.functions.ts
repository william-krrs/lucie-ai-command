import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const snapshotSchema = z.object({
  companyName: z.string().max(200).default(""),
  activity: z.string().max(200).default(""),
  city: z.string().max(200).default(""),
  employees: z.number().int().min(0).max(100000),
  callsPerWeek: z.number().int().min(0).max(100000),
  missedCalls: z.number().int().min(0).max(100000),
  averageBasket: z.number().min(0).max(1000000),
  revenueGoal: z.number().min(0).max(100000000),
  conversionRate: z.number().min(0).max(100),
  channels: z.array(z.string().max(60)).max(20),
  recommendation: z.object({
    score: z.number().int().min(0).max(100),
    tier: z.enum(["excellent", "compatible", "limited", "refuse"]),
    plan: z.enum(["essential", "pro", "premium"]).nullable(),
    priority: z.enum(["high", "medium", "low"]),
    estimatedMonthlyRoi: z.number().min(0),
    justifications: z.array(z.string().max(500)).max(20),
    concerns: z.array(z.string().max(500)).max(20),
    planReason: z.string().max(600),
  }),
  metrics: z.object({
    monthlyReceived: z.number(),
    monthlyMissed: z.number(),
    monthlyLostRevenue: z.number(),
    yearlyLostRevenue: z.number(),
    recoverableOpportunities: z.number(),
    timeSavedHours: z.number(),
  }),
  booking: z
    .object({
      date: z.string().max(40),
      time: z.string().max(10).optional(),
      inviteeName: z.string().max(200).optional(),
    })
    .optional(),
});

export type DiagnosticSnapshot = z.infer<typeof snapshotSchema>;

function randomToken(): string {
  // Short, human-shareable base32 code (Crockford, no ambiguous chars).
  const ALPH = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = new Uint8Array(7);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPH[b % ALPH.length]).join("");
}

export const createSharedDiagnostic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    snapshotSchema
      .extend({ expiresInDays: z.number().int().min(1).max(365).optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { expiresInDays, ...snapshot } = data;
    const token = randomToken();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined;
    // Use admin client to bypass RLS (anonymous sessions are blocked by policy).
    // The caller is still authenticated (requireSupabaseAuth) and owner_id is
    // set server-side from the verified token.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("shared_diagnostics")
      .insert({
        token,
        snapshot,
        owner_id: context.userId,
        ...(expiresAt ? { expires_at: expiresAt } : {}),
      });
    if (error) throw new Error(error.message);
    return { token };
  });

export const getSharedDiagnostic = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ token: z.string().min(6).max(128) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("shared_diagnostics")
      .select("snapshot, created_at, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { found: false as const };
    if (new Date(row.expires_at) < new Date()) return { found: false as const, expired: true };
    return {
      found: true as const,
      snapshot: snapshotSchema.parse(row.snapshot),
      createdAt: row.created_at as string,
      expiresAt: row.expires_at as string,
    };
  });

export const sendSharedDiagnosticEmail = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        token: z.string().min(6).max(128),
        email: z.string().trim().email().max(200),
        shareUrl: z.string().url().max(600),
        senderName: z.string().max(120).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY manquant côté serveur.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("shared_diagnostics")
      .select("snapshot, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Ce lien n'existe plus.");
    if (new Date(row.expires_at as string) < new Date())
      throw new Error("Ce lien a expiré.");

    const snap = snapshotSchema.parse(row.snapshot);
    const company = snap.companyName || "Diagnostic Lucie";
    const sender = (data.senderName ?? "").trim();
    const senderLine = sender ? `${sender} vous partage ` : "Vous recevez ";

    const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f5f3ff;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111;">
  <div style="max-width:640px;margin:0 auto;padding:32px 24px;">
    <div style="background:#0f0b1f;color:#fff;border-radius:16px;padding:28px;">
      <div style="font-size:11px;letter-spacing:0.16em;color:#c4b5fd;text-transform:uppercase;">Diagnostic Lucie partagé</div>
      <h1 style="margin:8px 0 0;font-size:24px;">${escapeHtml(company)}</h1>
      <p style="margin:12px 0 0;color:#d8d4f0;font-size:14px;">${escapeHtml(senderLine)}le récapitulatif de diagnostic Lucie. Score, formule recommandée, ROI estimé — tout est dans le rapport privé.</p>
    </div>
    <div style="background:#fff;border-radius:16px;padding:24px;margin-top:16px;border:1px solid #e9e4f7;text-align:center;">
      <p style="margin:0 0 16px;color:#333;font-size:14px;">Cliquez ci-dessous pour ouvrir le rapport privé (lien sécurisé, valable 30 jours) :</p>
      <a href="${data.shareUrl}" style="display:inline-block;background:#6d28d9;color:#fff;text-decoration:none;font-weight:600;padding:14px 24px;border-radius:12px;font-size:15px;">🔒 Ouvrir le diagnostic</a>
      <p style="margin:16px 0 0;color:#888;font-size:11px;word-break:break-all;">${escapeHtml(data.shareUrl)}</p>
    </div>
    <p style="margin:16px 0 0;color:#888;font-size:12px;text-align:center;">Envoyé via Lucie Command Center — assistantvocalpro.fr</p>
  </div>
</body></html>`;

    const text = `${senderLine}le diagnostic Lucie pour ${company}.\n\nOuvrez le rapport privé (30 jours) :\n${data.shareUrl}\n`;

    const { sendLovableEmail, EmailAPIError } = await import("@lovable.dev/email-js");
    try {
      const res = await sendLovableEmail(
        {
          to: data.email,
          from: "Lucie <contact@lucieassistant.fr>",
          sender_domain: "notify.lucieassistant.fr",
          subject: `Diagnostic Lucie · ${company}`,
          html,
          text,
          reply_to: "contact@lucieassistant.fr",
          idempotency_key: `share-${data.token}-${data.email.toLowerCase()}`,
          label: "shared-diagnostic-link",
          purpose: "transactional",
        },
        { apiKey, idempotencyKey: `share-${data.token}-${data.email.toLowerCase()}` },
      );
      return { sent: true as const, messageId: res.message_id };
    } catch (err) {
      const c = classifyEmailError(err, EmailAPIError);
      console.error("[sendSharedDiagnosticEmail] failed", c);
      throw new Error(c.message);
    }
  });

function classifyEmailError(
  err: unknown,
  EmailAPIError: typeof import("@lovable.dev/email-js").EmailAPIError,
): { code: string | null; message: string } {
  const code = err instanceof EmailAPIError ? ((err as { code?: string }).code ?? null) : null;
  const status = err instanceof EmailAPIError ? (err as { status?: number }).status : undefined;
  if (code === "recipient_suppressed") {
    return { code, message: "Ce destinataire est désinscrit — impossible de lui envoyer l'email." };
  }
  if (code === "domain_not_verified") {
    return { code, message: "Le domaine d'envoi n'est pas encore vérifié. Veuillez réessayer plus tard." };
  }
  if (code === "emails_disabled") {
    return { code, message: "L'envoi d'emails est temporairement désactivé." };
  }
  if (status === 429) {
    return { code: "rate_limited", message: "Trop d'envois rapprochés. Patientez quelques minutes avant de réessayer." };
  }
  if (code === "missing_parameter" || code === "invalid_request") {
    return { code, message: "Problème de configuration de l'envoi. Contactez l'équipe Lucie si l'erreur persiste." };
  }
  const msg = err instanceof Error ? err.message : "Erreur inconnue";
  return { code, message: `L'envoi a échoué : ${msg}` };
}


function escapeHtml(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}