import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { STRIPE_PLANS, type PlanKey } from "@/lib/stripe-plans";
import { SITE_DOMAIN } from "@/lib/config";

/**
 * Origine publique déduite des en-têtes de la requête (proxy Lovable).
 * Import dynamique de getRequest depuis @tanstack/start-server-core à
 * l'intérieur du handler pour ne pas embarquer d'utilitaires serveur dans
 * le bundle client (les imports de module-scope des .functions.ts y vont).
 */
async function publicOrigin(): Promise<string> {
  const { getRequest } = await import("@tanstack/start-server-core");
  const req = getRequest();
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0] ||
    req.headers.get("referer")?.split("://")[0] ||
    "https";
  const host =
    req.headers.get("x-forwarded-host")?.split(",")[0] ||
    req.headers.get("host") ||
    SITE_DOMAIN;
  return `${proto}://${host}`;
}

/**
 * Crée une Stripe Checkout Session (mode subscription) côté serveur pour la
 * formule choisie. L'utilisateur authentifié est correlé via client_reference_id
 * et metadata.user_id : le webhook peut ainsi attribuer le paiement au bon
 * compte sans se fier à l'URL de retour.
 *
 * Sécurité :
 * - requireSupabaseAuth : seul un utilisateur authentifié peut initier le paiement.
 * - metadata.user_id = context.userId (jamais trusté depuis le client).
 */
export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ plan: z.enum(["essential", "pro", "premium"]) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { userId } = context;
    const plan = data.plan as PlanKey;
    const cfg = STRIPE_PLANS[plan];
    const key = process.env["STRIPE_SECRET_KEY"];
    if (!key) throw new Error("Paiement indisponible : configuration Stripe manquante.");

    const origin = await publicOrigin();
    const params = new URLSearchParams();
    params.set("mode", "subscription");
    params.set("line_items[0][quantity]", "1");
    params.set("line_items[0][price_data][currency]", "eur");
    params.set("line_items[0][price_data][unit_amount]", String(cfg.unitAmount));
    params.set("line_items[0][price_data][recurring][interval]", "month");
    params.set("line_items[0][price_data][product_data][name]", cfg.name);
    params.set("client_reference_id", userId);
    params.set("metadata[user_id]", userId);
    params.set("metadata[plan]", plan);
    params.set("subscription_data[metadata][user_id]", userId);
    params.set("subscription_data[metadata][plan]", plan);
    params.set(
      "success_url",
      `${origin}/merci?plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
    );
    params.set("cancel_url", `${origin}/offres`);

    const resp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    const json = (await resp.json()) as { url?: string; error?: { message?: string } };
    if (!resp.ok || !json.url) {
      console.error("[createCheckoutSession] stripe error", json);
      throw new Error("Impossible de créer la session de paiement Stripe.");
    }
    return { url: json.url };
  });

export type PaymentStateDTO = {
  paymentStatus: "unpaid" | "paid" | "refunded";
  paidPlan: string | null;
  paidAt: string | null;
};

/**
 * État de paiement côté serveur pour la page /merci (polling jusqu'à
 * confirmation webhook). Source de vérité : journey_state.payment_status.
 */
export const getPaymentState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PaymentStateDTO> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("journey_state")
      .select("payment_status, paid_plan, paid_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) console.error("[getPaymentState]", error);
    return {
      paymentStatus:
        (data?.payment_status as PaymentStateDTO["paymentStatus"] | undefined) ??
        "unpaid",
      paidPlan: data?.paid_plan ?? null,
      paidAt: data?.paid_at ?? null,
    };
  });
