import { useEffect, useState } from "react";
import { Download, FileDown, Trash2, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  listPdfHistory,
  removePdfHistoryEntry,
  clearPdfHistory,
  downloadPdfEntry,
  type PdfHistoryEntry,
} from "@/lib/pdf-history";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function ExportHistory() {
  const [entries, setEntries] = useState<PdfHistoryEntry[]>([]);
  const [mounted, setMounted] = useState(false);

  const refresh = () => setEntries(listPdfHistory());

  useEffect(() => {
    setMounted(true);
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key.startsWith("lucie:pdf-history")) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!mounted) return null;

  return (
    <section
      aria-labelledby="export-history-title"
      className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8"
    >
      <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <History className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-widest text-primary">
              Historique
            </div>
            <h3
              id="export-history-title"
              className="mt-1 text-lg font-semibold tracking-tight text-foreground"
            >
              Vos derniers diagnostics PDF
            </h3>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Les 5 derniers exports générés depuis cet appareil restent
              disponibles pour un re-téléchargement instantané.
            </p>
          </div>
        </div>
        {entries.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-lg text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              clearPdfHistory();
              refresh();
            }}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Vider l'historique
          </Button>
        )}
      </header>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <FileDown className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="text-sm font-medium text-foreground">
            Aucun export pour le moment
          </div>
          <p className="max-w-sm text-xs text-muted-foreground">
            Générez un PDF depuis la page{" "}
            <span className="font-medium text-foreground">
              Diagnostic final
            </span>{" "}
            — il apparaîtra ici pour re-téléchargement à tout moment.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-background/40">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <FileDown className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {entry.companyName}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span>{formatDate(entry.createdAt)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatSize(entry.sizeBytes)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{entry.filename}</span>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  className="h-9 rounded-lg"
                  onClick={() => downloadPdfEntry(entry)}
                  aria-label={`Re-télécharger ${entry.filename}`}
                >
                  <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Télécharger
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 rounded-lg text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    removePdfHistoryEntry(entry.id);
                    refresh();
                  }}
                  aria-label={`Supprimer ${entry.filename} de l'historique`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}