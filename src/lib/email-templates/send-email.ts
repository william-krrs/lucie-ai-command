import { render } from "@react-email/render";
import { sendLovableEmail, EmailAPIError } from "@lovable.dev/email-js";
import { createElement } from "react";
import { TEMPLATES, type TemplateName } from "./registry";

// The verified delegated subdomain used for the actual API lookup.
// Update after email domain provisioning if a different subdomain is chosen.
const SENDER_DOMAIN = "notify.lucieassistant.fr";
// Visible From address shown to recipients.
const FROM = "Lucie <contact@lucieassistant.fr>";

export type SendTemplateResult =
  | { sent: true; messageId?: string }
  | { sent: false; reason: "recipient_suppressed" | "domain_not_verified" | "rate_limited" | "emails_disabled" | "error"; message?: string };

export async function sendTemplateEmail<TName extends TemplateName>(
  templateName: TName,
  to: string,
  opts: {
    templateData?: Record<string, unknown>;
    idempotencyKey?: string;
    replyTo?: string;
  } = {},
): Promise<SendTemplateResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const entry = TEMPLATES[templateName];
  if (!entry) throw new Error(`Unknown template: ${templateName}`);

  const data = opts.templateData ?? {};
  const element = createElement(entry.component, data as any);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject = typeof entry.subject === "function" ? entry.subject(data) : entry.subject;

  try {
    const res = await sendLovableEmail(
      {
        to,
        from: FROM,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text,
        reply_to: opts.replyTo,
        idempotency_key: opts.idempotencyKey,
        label: templateName,
      },
      { apiKey, idempotencyKey: opts.idempotencyKey },
    );
    return { sent: true, messageId: res.message_id };
  } catch (err) {
    if (err instanceof EmailAPIError) {
      const code = (err as EmailAPIError & { code?: string }).code;
      if (code === "recipient_suppressed") return { sent: false, reason: "recipient_suppressed" };
      if (code === "domain_not_verified") return { sent: false, reason: "domain_not_verified", message: err.message };
      if (code === "emails_disabled") return { sent: false, reason: "emails_disabled", message: err.message };
      if (err.status === 429) return { sent: false, reason: "rate_limited", message: err.message };
      return { sent: false, reason: "error", message: `${code ?? err.status}: ${err.message}` };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { sent: false, reason: "error", message: msg };
  }
}