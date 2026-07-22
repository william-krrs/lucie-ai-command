// Client-side cache for company logo load outcomes.
// Avoids skeleton flashes on revisits and skips re-attempting known failures.

type LogoStatus = "loaded" | "error";

const STORAGE_KEY = "lucie:logo-cache:v1";
const memory = new Map<string, LogoStatus>();
let hydrated = false;

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, LogoStatus>;
    for (const [k, v] of Object.entries(parsed)) {
      if (v === "loaded" || v === "error") memory.set(k, v);
    }
  } catch {
    // ignore corrupt cache
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    const obj: Record<string, LogoStatus> = {};
    memory.forEach((v, k) => {
      obj[k] = v;
    });
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // quota / disabled storage — silent
  }
}

export function getLogoStatus(key: string): LogoStatus | undefined {
  hydrate();
  return memory.get(key);
}

export function setLogoStatus(key: string, status: LogoStatus) {
  hydrate();
  if (memory.get(key) === status) return;
  memory.set(key, status);
  persist();
}

export function logoCacheKey(domain: string, size: number) {
  return `${domain}@${size}`;
}