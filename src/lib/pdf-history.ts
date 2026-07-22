// Client-side history of exported diagnostic PDFs.
// Persists the last few PDFs as data URLs in localStorage so the user
// can re-download them from /merci without regenerating the document.

const STORAGE_KEY = "lucie:pdf-history:v1";
const MAX_ENTRIES = 5;
// Skip persistence when a single PDF would blow past this budget (~4 MB base64).
const MAX_DATAURL_LENGTH = 4_000_000;

export type PdfHistoryEntry = {
  id: string;
  filename: string;
  companyName: string;
  createdAt: string; // ISO
  sizeBytes: number;
  dataUrl: string; // application/pdf;base64,...
};

function safeRead(): PdfHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is PdfHistoryEntry =>
        !!e && typeof e.id === "string" && typeof e.dataUrl === "string",
    );
  } catch {
    return [];
  }
}

function safeWrite(entries: PdfHistoryEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Quota exceeded — drop the oldest and retry once.
    if (entries.length > 1) {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(entries.slice(0, entries.length - 1)),
        );
      } catch {
        /* give up silently */
      }
    }
  }
}

export function listPdfHistory(): PdfHistoryEntry[] {
  return safeRead().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function addPdfHistoryEntry(entry: {
  filename: string;
  companyName: string;
  dataUrl: string;
  sizeBytes: number;
}) {
  if (entry.dataUrl.length > MAX_DATAURL_LENGTH) return null;
  const record: PdfHistoryEntry = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    filename: entry.filename,
    companyName: entry.companyName || "Prospect",
    createdAt: new Date().toISOString(),
    sizeBytes: entry.sizeBytes,
    dataUrl: entry.dataUrl,
  };
  const next = [record, ...safeRead().filter((e) => e.filename !== entry.filename)].slice(
    0,
    MAX_ENTRIES,
  );
  safeWrite(next);
  return record;
}

export function removePdfHistoryEntry(id: string) {
  safeWrite(safeRead().filter((e) => e.id !== id));
}

export function clearPdfHistory() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

export function downloadPdfEntry(entry: PdfHistoryEntry) {
  if (typeof window === "undefined") return;
  const link = document.createElement("a");
  link.href = entry.dataUrl;
  link.download = entry.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}