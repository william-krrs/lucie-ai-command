/**
 * Prospect store — sauvegarde et bascule locale entre "prospects".
 *
 * Un prospect = un instantané du parcours (diagnostic + booking + configuration)
 * pour un client donné. Permet à l'utilisateur commercial de savoir à qui il parle
 * et de reprendre un dossier à tout moment sans re-remplir le diagnostic.
 *
 * Stocké en localStorage — pas d'auth, pas de serveur.
 */

export const PROSPECTS_KEY = "lucie:prospects:v1";
export const ACTIVE_PROSPECT_KEY = "lucie:prospects:active";

// Clés source qui composent l'instantané d'un prospect.
const DIAG_KEY = "lucie:diagnostic:v1";
/** Clé courante du store de RDV (doit rester alignée sur `booking-store.tsx`). */
const BOOKING_KEY = "lucie:booking:v3";
/** Ancienne clé, lue uniquement en secours pour les snapshots déjà enregistrés. */
const LEGACY_BOOKING_KEY = "lucie:booking:v2";
const PREP_KEY = "lucie:preparation";
// NB : `lucie:booking:clientRef` est volontairement HORS snapshot — c'est un
// identifiant de poste, jamais d'un prospect. Aucune donnée serveur n'est
// touchée par ce module : localStorage uniquement.

export type Prospect = {
  id: string;
  label: string;
  activity?: string;
  city?: string;
  createdAt: string;
  updatedAt: string;
  snapshot: {
    diagnostic?: string | null;
    booking?: string | null;
    preparation?: string | null;
  };
};

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function listProspects(): Prospect[] {
  const raw = safeGet(PROSPECTS_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr as Prospect[];
  } catch {
    return [];
  }
}

function writeProspects(list: Prospect[]) {
  safeSet(PROSPECTS_KEY, JSON.stringify(list));
  try {
    window.dispatchEvent(new StorageEvent("storage", { key: PROSPECTS_KEY }));
  } catch {
    /* ignore */
  }
}

export function getActiveProspectId(): string | null {
  return safeGet(ACTIVE_PROSPECT_KEY);
}

export function setActiveProspectId(id: string | null) {
  safeSet(ACTIVE_PROSPECT_KEY, id);
}

function snapshotFromLocalStorage() {
  return {
    diagnostic: safeGet(DIAG_KEY),
    booking: safeGet(BOOKING_KEY) ?? safeGet(LEGACY_BOOKING_KEY),
    preparation: safeGet(PREP_KEY),
  };
}

function readDiagnostic(): { companyName?: string; activity?: string; city?: string } {
  const raw = safeGet(DIAG_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) ?? {};
  } catch {
    return {};
  }
}

/** Sauvegarde la session courante (ou met à jour le prospect actif) et le rend actif. */
export function saveCurrentAsProspect(overrideLabel?: string): Prospect {
  const diag = readDiagnostic();
  const activeId = getActiveProspectId();
  const list = listProspects();
  const now = new Date().toISOString();
  const label =
    overrideLabel?.trim() ||
    diag.companyName?.trim() ||
    `Prospect ${new Date().toLocaleDateString("fr-FR")}`;

  if (activeId) {
    const idx = list.findIndex((p) => p.id === activeId);
    if (idx >= 0) {
      const updated: Prospect = {
        ...list[idx],
        label,
        activity: diag.activity,
        city: diag.city,
        updatedAt: now,
        snapshot: snapshotFromLocalStorage(),
      };
      const next = [...list];
      next[idx] = updated;
      writeProspects(next);
      return updated;
    }
  }

  const created: Prospect = {
    id: `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    label,
    activity: diag.activity,
    city: diag.city,
    createdAt: now,
    updatedAt: now,
    snapshot: snapshotFromLocalStorage(),
  };
  writeProspects([created, ...list]);
  setActiveProspectId(created.id);
  return created;
}

/** Charge un prospect : écrit son snapshot dans localStorage puis recharge la page. */
export function loadProspect(id: string) {
  const p = listProspects().find((x) => x.id === id);
  if (!p) return;
  // Sauvegarde de la session courante pour ne rien perdre si l'utilisateur avait
  // commencé un nouveau dossier sans le déclarer.
  const activeId = getActiveProspectId();
  if (!activeId) {
    // rien à sauvegarder de neuf : on passe.
  }
  safeSet(DIAG_KEY, p.snapshot.diagnostic ?? null);
  safeSet(BOOKING_KEY, p.snapshot.booking ?? null);
  safeSet(LEGACY_BOOKING_KEY, null);
  safeSet(PREP_KEY, p.snapshot.preparation ?? null);
  setActiveProspectId(id);
  if (typeof window !== "undefined") window.location.reload();
}

/** Démarre un nouveau dossier vierge (vide diagnostic / booking / préparation). */
export function startNewProspect() {
  safeSet(DIAG_KEY, null);
  safeSet(BOOKING_KEY, null);
  safeSet(LEGACY_BOOKING_KEY, null);
  safeSet(PREP_KEY, null);
  setActiveProspectId(null);
  if (typeof window !== "undefined") window.location.reload();
}

export function deleteProspect(id: string) {
  const list = listProspects().filter((p) => p.id !== id);
  writeProspects(list);
  if (getActiveProspectId() === id) {
    setActiveProspectId(null);
  }
}

export function renameProspect(id: string, label: string) {
  const list = listProspects();
  const idx = list.findIndex((p) => p.id === id);
  if (idx < 0) return;
  const next = [...list];
  next[idx] = { ...next[idx], label: label.trim() || next[idx].label, updatedAt: new Date().toISOString() };
  writeProspects(next);
}