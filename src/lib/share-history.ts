export type ShareHistoryEntry = {
  url: string;
  token: string;
  companyName?: string;
  createdAt: string;
};

const KEY = "lucie.share.history.v1";
const MAX = 10;

export function getShareHistory(): ShareHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addShareHistoryEntry(entry: Omit<ShareHistoryEntry, "createdAt"> & { createdAt?: string }): ShareHistoryEntry[] {
  if (typeof window === "undefined") return [];
  const current = getShareHistory().filter((e) => e.url !== entry.url);
  const next: ShareHistoryEntry[] = [
    { ...entry, createdAt: entry.createdAt ?? new Date().toISOString() },
    ...current,
  ].slice(0, MAX);
  window.localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function removeShareHistoryEntry(url: string): ShareHistoryEntry[] {
  if (typeof window === "undefined") return [];
  const next = getShareHistory().filter((e) => e.url !== url);
  window.localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function clearShareHistory(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}