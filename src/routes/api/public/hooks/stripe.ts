import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import type { PlanKey } from "@/lib/stripe-plans";

/**
 * Webhook Stripe (endpoint public, non authentifié).
 *
 * URL d'endpoint à coller dans Stripe : <origine publique>/api/public/hooks/stripe
 * (en production : le domaine personnalisé du projet).
 * Événement écouté : checkout.session.completed
 *
 * Sécurité :
 * - Vérification de signature Stripe-Signature (HMAC SHA256 sur `t.payload`).
 * - Idempotence : on ne retraite pas une session déjà enregistrée (même
 *   stripe_session_id) ; on ne rétrograde jamais un paiement remboursé.
 * - Attribution au user via metadata.user_id ou client_reference_id (jamais
 *   depuis l'URL de retour, non fiable).
 * - Écriture via supabaseAdmin (service role) : RLS contournée légitimement
 *   car le webhook est la source de vérité serveur du paiement.
 */

export const Route = createFileRoute("/api/public/hooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["STRIPE_WEBHOOK_SECRET"];
        if (!secret) {
          console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET manquant");
          return new Response("Webhook misconfigured", { status: 500 });
        }

        const signature = request.headers.get("stripe-signature") ?? "";
        const rawBody = await request.text();

        // Vérification de signature Stripe (t=...,v1=...).
        const verified = verifyStripeSignature(rawBody, signature, secret);
        if (!verified) {
          console.error("[stripe-webhook] signature invalide");
          return new Response("Invalid signature", { status: 401 });
        }

        let event: any;
        try {
          event = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        if (event.type !== "checkout.session.completed") {
          // On ignore les autres événements (le endpoint n'est abonné qu'à
          // checkout.session.completed, mais Stripe peut renvoyer d'autres).
          return new Response("ok", { status: 200 });
        }

        const session = event.data?.object;
        if (!session || typeof session.id !== "string") {
          return new Response("ok", { status: 200 });
        }

        try {
          await markJourneyPaid(session);
        } catch (err) {
          // Erreur interne/transitoire : on renvoie un 5xx pour que Stripe
          // retente. L'idempotence (stripe_session_id) garantit qu'un retry
          // ne crée jamais de double paiement.
          console.error("[stripe-webhook] markJourneyPaid", err);
          return new Response("Retry", { status: 500 });
        }


        return new Response("ok", { status: 200 });
      },
    },
  },
});

/**
 * Vérifie l'en-tête Stripe-Signature au format `t=TS,v1=HEX`.
 * La signature v1 = HMAC-SHA256(secret, `${timestamp}.${payload}`).
 */
function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const parts = signature.split(",");
  const tsPart = parts.find((p) => p.startsWith("t="));
  const v1Part = parts.find((p) => p.startsWith("v1="));
  if (!tsPart || !v1Part) return false;

  const timestamp = tsPart.slice(2);
  const expected = v1Part.slice(3);
  const signedPayload = `${timestamp}.${payload}`;
  const computed = createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  // Tolérance de 5 min pour éviter les replays.
  const ageMs = Date.now() - Number(timestamp) * 1000;
  if (!Number.isFinite(ageMs) || Math.abs(ageMs) > 5 * 60 * 1000) return false;

  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(expected));
  } catch {
    return false;
  }
}

type StripeSession = {
  id: string;
  client_reference_id?: string | null;
  customer?: string | null;
  metadata?: { user_id?: string; plan?: string } | null;
};

async function markJourneyPaid(session: StripeSession): Promise<void> {
  const userId = session.metadata?.user_id || session.client_reference_id || null;
  if (!userId) {
    console.warn("[stripe-webhook] session sans user_id", session.id);
    return;
  }
  const plan = (session.metadata?.plan as PlanKey | undefined) ?? null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: existing, error: selErr } = await supabaseAdmin
    .from("journey_state")
    .select("id, payment_status, stripe_session_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (selErr) throw selErr;

  // Idempotence : même session déjà traitée → on ne fait rien.
  if (existing?.stripe_session_id === session.id) return;

  const nowIso = new Date().toISOString();

  if (!existing) {
    // Première ligne pour cet utilisateur.
    const { error } = await supabaseAdmin.from("journey_state").insert({
      user_id: userId,
      payment_status: "paid",
      paid_at: nowIso,
      paid_plan: plan,
      stripe_session_id: session.id,
      stripe_customer_id: session.customer ?? null,
      installation_status: "not_started",
    });
    if (error) throw error;
    return;
  }

  // On ne rétrograde jamais un paiement remboursé vers "paid".
  if (existing.payment_status === "refunded") return;

  const { error: updErr } = await supabaseAdmin
    .from("journey_state")
    .update({
      payment_status: "paid",
      paid_at: nowIso,
      paid_plan: plan,
      stripe_session_id: session.id,
      stripe_customer_id: session.customer ?? null,
    })
    .eq("user_id", userId);
  if (updErr) throw updErr;
}
