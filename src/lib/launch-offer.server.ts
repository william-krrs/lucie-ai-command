/**
 * Un identifiant de session Stripe qui commence par "cs_test_" est un paiement de
 * test (mode test de Stripe) : il ne doit jamais être compté comme un client payant.
 * Les lignes sans identifiant de session (paiement marqué payé manuellement) sont
 * considérées comme réelles.
 */
export function isTestPaymentSession(sessionId: string | null | undefined): boolean {
  return typeof sessionId === "string" && sessionId.startsWith("cs_test_");
}

/**
 * Nombre de clients payés (journey_state.payment_status = 'paid'), paiements réels
 * uniquement : les lignes dont stripe_session_id commence par "cs_test_" sont exclues.
 * Serveur uniquement.
 */
export async function countPaidCustomers(): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("journey_state")
    .select("stripe_session_id")
    .eq("payment_status", "paid");
  if (error) throw error;
  return (data ?? []).filter((row) => !isTestPaymentSession(row.stripe_session_id)).length;
}
