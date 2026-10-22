/** Nombre de clients payés (journey_state.payment_status = 'paid'). Serveur uniquement. */
export async function countPaidCustomers(): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("journey_state")
    .select("id", { count: "exact", head: true })
    .eq("payment_status", "paid");
  if (error) throw error;
  return count ?? 0;
}
