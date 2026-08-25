import { useEffect, useState } from "react";

/**
 * Mode admin local : permet à l'équipe Lucie de saisir manuellement un
 * rendez-vous (tests internes) alors que les prospects doivent obligatoirement
 * passer par une réservation réelle dans l'agenda en ligne.
 *
 * Activation : ajouter `?admin=lucie` à l'URL (mémorisé ensuite en local).
 * Désactivation : `?admin=off`.
 */
const ADMIN_KEY = "lucie:admin";
const ADMIN_CODE = "lucie";

export function readAdminMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const param = new URLSearchParams(window.location.search).get("admin");
    if (param !== null) {
      const enabled = param !== "off" && param !== "0" && param === ADMIN_CODE;
      if (enabled) window.localStorage.setItem(ADMIN_KEY, "1");
      else window.localStorage.removeItem(ADMIN_KEY);
      return enabled;
    }
    return window.localStorage.getItem(ADMIN_KEY) === "1";
  } catch {
    return false;
  }
}

/** Hook client-only (false au SSR pour éviter tout mismatch d'hydratation). */
export function useAdminMode(): boolean {
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    setAdmin(readAdminMode());
  }, []);
  return admin;
}
