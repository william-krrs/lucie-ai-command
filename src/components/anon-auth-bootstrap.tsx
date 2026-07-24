import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Ensures every visitor has an anonymous Supabase session so that RLS
 * (user_id = auth.uid()) can scope their bookings and questionnaire
 * answers to them alone. Runs once on mount, client-only.
 */
export function AnonAuthBootstrap() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) return;
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        // Non-fatal: server functions that need auth will surface their own errors.
        console.warn("[anon-auth] sign-in failed", error.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}