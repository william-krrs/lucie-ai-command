import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { adminGetOverview } from "@/lib/admin.functions";

/**
 * Vérifie côté serveur (has_role) si l'utilisateur connecté est admin.
 * - Visiteur / session anonyme / non connecté → false, sans erreur visible.
 * - Client normal (connecté mais sans rôle admin) → false.
 * - Admin autorisé → true.
 *
 * Usage strictement cosmétique (affichage de liens) : la sécurité réelle
 * reste dans les server functions (requireSupabaseAuth + has_role).
 */
export function useIsAdmin(): boolean {
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setHasSession(!!data.session && !data.session.user.is_anonymous);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session && !session.user.is_anonymous);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const query = useQuery({
    queryKey: ["is-admin"],
    enabled: hasSession,
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      try {
        const overview = await adminGetOverview();
        return overview.isAdmin === true;
      } catch {
        // 401 (pas de session utilisable côté serveur) → pas admin.
        return false;
      }
    },
  });

  return query.data === true;
}
