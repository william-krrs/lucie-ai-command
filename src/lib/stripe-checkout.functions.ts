import { canCheckoutPlan } from "@/lib/self-serve";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  COMMITMENT_MONTHS,
  setupFeeAmount,
  STRIPE_PRICE_IDS,
  type PlanKey,
} from "@/lib/stripe-plans";

/** Domaine de production réel du projet (repli si l'origine n'est pas autorisée). */
const PRODUCTION_ORIGIN = "https://diagnostic.lucieassistant.fr";

/** Liste blanche des hôtes acceptés pour success_url / cancel_url. */
function isAllowedHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === "diagnostic.lucieassistant.fr" ||
    h === "lucieassistant.fr" ||
    h === "assistantvocalpro.fr" ||
    h === "www.assistantvocalpro.fr" ||
    /^[a-z0-9-]+\.lovable\.app$/.test(h) ||
    /^localhost(:\d{1,5})?$/.test(h) ||
    /^127\.0\.0\.1(:\d{1,5})?$/.test(h)
  );
}

/**
 * Origine publique validée : l'en-tête Origin / Referer / x-forwarded-host
 * n'est utilisé que s'il figure sur la liste blanche ; sinon on retombe sur
 * le domaine de production. Jamais d'en-tête brut non vérifié.
 */
async function publicOrigin(): Promise<string> {
  const { getRequest } = await import("@tanstack/start-server-core");
  const req = getRequest();
  const candidates = [
    req.headers.get("origin"),
    req.headers.get("referer"),
    req.headers.get("x-forwarded-host") ? `https://${req.headers.get("x-forwarded-host")!.split(",")[0].trim()}` : null,
  ];
  for (const c of candidates) {
    if (!c) continue;
    try {
      const u = new URL(c);
      if (!isAllowedHost(u.host)) continue;
      const local = /^(localhost|127\.0\.0\.1)/.test(u.hostname);
      if (u.protocol !== "https:" && !local) continue;
      return `${u.protocol}//${u.host}`;
    } catch {
      /* ignore */
    }
  }
  return PRODUCTION_ORIGIN;
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
    z.object({ plan: z.enum(["essential", "pro", "premium"]), commitment: z.boolean().default(false), multipleDeciders: z.boolean().default(true) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { userId } = context;
    const plan = data.plan as PlanKey;
    
    // Premium : paiement uniquement après la démonstration (R2).
    if (!canCheckoutPlan(plan, false, data.multipleDeciders)) {
      const { data: js } = await context.supabase
        .from("journey_state")
        .select("demo_completed_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (!canCheckoutPlan(plan, !!js?.demo_completed_at, data.multipleDeciders)) {
        throw new Error("La formule Premium nécessite d'abord une démonstration.");
      }
    }
    const key = process.env["STRIPE_SECRET_KEY"];
    if (!key) {
      console.error("[createCheckoutSession] STRIPE_SECRET_KEY manquant");
    }
    if (!key) throw new Error("Paiement indisponible : configuration Stripe manquante.");

    const origin = await publicOrigin();
    const params = new URLSearchParams();
    params.set("mode", "subscription");
    // Ligne 0 : abonnement mensuel récurrent.
    params.set("line_items[0][price]", STRIPE_PRICE_IDS[plan]);
    params.set("line_items[0][quantity]", "1");
    // Sans engagement : mise en place 490 € (prix unique, première facture seulement).
    if (setupFeeAmount(data.commitment) > 0) {
      params.set("line_items[1][price]", STRIPE_PRICE_IDS.setup);
      params.set("line_items[1][quantity]", "1");
    }
    params.set("client_reference_id", userId);
    params.set("metadata[user_id]", userId);
    params.set("metadata[plan]", plan);
    params.set("subscription_data[metadata][user_id]", userId);
    params.set("subscription_data[metadata][plan]", plan);
    const commitment = data.commitment ? `${COMMITMENT_MONTHS}_months` : "none";
    params.set("metadata[commitment]", commitment);
    params.set("subscription_data[metadata][commitment]", commitment);

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

    let json: { url?: string; error?: { message?: string; type?: string; code?: string } } = {};
    try {
      json = await resp.json();
    } catch {
      /* corps non JSON */
    }
    if (!resp.ok || typeof json.url !== "string" || !json.url.startsWith("https://checkout.stripe.com/")) {
      // Erreur Stripe réelle journalisée (message/type/code uniquement, aucun secret).
      console.error("[createCheckoutSession] stripe error", {
        status: resp.status,
        type: json.error?.type,
        code: json.error?.code,
        message: json.error?.message,
        hasUrl: typeof json.url === "string",
      });
      throw new Error("Impossible de créer la session de paiement. Réessayez dans un instant.");
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
