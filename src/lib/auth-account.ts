import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Statut d'identité côté client.
 *
 * IMPORTANT : une session anonyme n'est JAMAIS un compte client. Toutes les
 * protections doivent distinguer explicitement les trois états ci-dessous et
 * ne jamais se contenter de `session != null`.
 */
export type AccountStatus = "loading" | "none" | "anonymous" | "account";

export type AccountInfo = {
  status: AccountStatus;
  /** true uniquement pour un compte email confirmé. */
  isAccount: boolean;
  email: string | null;
  userId: string | null;
};

function statusFromSession(session: Session | null): AccountStatus {
  if (!session?.user) return "none";
  // `is_anonymous` est porté par le JWT Supabase. En cas d'absence du champ on
  // retombe sur l'absence d'email, qui caractérise également l'anonyme.
  const user = session.user as { is_anonymous?: boolean; email?: string | null };
  if (user.is_anonymous === true) return "anonymous";
  if (!user.email) return "anonymous";
  return "account";
}

export function useAccount(): AccountInfo {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Le listener est enregistré avant la lecture initiale pour ne pas rater
    // la session posée par `detectSessionInUrl` au retour du lien de mail.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        setSession(data.session);
        setReady(true);
      })
      .catch(() => {
        // lecture de session impossible : on sort de l'état "loading" en
        // considérant qu'aucun compte n'est présent (le mur s'affiche).
        if (!cancelled) setReady(true);
      });
    // Filet de sécurité : si la lecture de session reste en suspens (réseau
    // indisponible), on dégrade vers l'état visiteur plutôt que de bloquer
    // indéfiniment toute l'UX dépendante du statut de compte.
    const fallback = window.setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 4000);
    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
      sub.subscription.unsubscribe();
    };
  }, []);

  const status: AccountStatus = ready ? statusFromSession(session) : "loading";
  const user = session?.user as { email?: string | null } | undefined;
  return {
    status,
    isAccount: status === "account",
    email: status === "account" ? (user?.email ?? null) : null,
    userId: status === "account" ? (session?.user.id ?? null) : null,
  };
}

/**
 * Valide une destination de redirection : chemin relatif same-origin uniquement.
 * Toute URL absolue, protocol-relative ou anti-slash est rejetée.
 */
export function sanitizeNext(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || value.length > 512) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.includes("\\")) return null;
  if (/^\/+\s*javascript:/i.test(value)) return null;
  return value;
}

export const NEXT_STORAGE_KEY = "lucie:auth:next";

/** Mémorise la destination pour survivre à l'aller-retour par email. */
export function rememberNext(next: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (next) window.sessionStorage.setItem(NEXT_STORAGE_KEY, next);
    else window.sessionStorage.removeItem(NEXT_STORAGE_KEY);
  } catch {
    /* stockage indisponible : la redirection retombera sur la valeur par défaut */
  }
}

export function recallNext(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sanitizeNext(window.sessionStorage.getItem(NEXT_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function forgetNext() {
  rememberNext(null);
}

/** Chemin de connexion préservant la destination courante. */
export function loginHref(next?: string | null): string {
  const safe = sanitizeNext(next);
  return safe ? `/connexion?next=${encodeURIComponent(safe)}` : "/connexion";
}

export const DEFAULT_AFTER_LOGIN = "/recommandation";
