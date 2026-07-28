import { useState } from "react";
import { FileDown, Database } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useBooking } from "@/lib/booking-store";
import { exportCrmCsv } from "@/lib/csv-export";

export function CrmExport({ plan }: { plan?: "essential" | "pro" | "premium" }) {
  const { booking } = useBooking();
  const [busy, setBusy] = useState(false);

  const handleExport = () => {
    setBusy(true);
    try {
      const result = exportCrmCsv({ booking, plan });
      if (!result.ok) {
        toast.error("Aucune donnée à exporter pour le moment.", {
          description: "Remplissez la configuration ou prenez un RDV avant l'export.",
        });
        return;
      }
      toast.success("Export CSV téléchargé.", {
        description: "Fichier prêt à être importé dans votre CRM.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="crm-export-title"
      className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8"
    >
      <header className="mb-4 flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Database className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <div className="text-[11px] font-medium uppercase tracking-widest text-primary">
            Export CRM
          </div>
          <h3
            id="crm-export-title"
            className="mt-1 text-lg font-semibold tracking-tight text-foreground"
          >
            Exportez vos données au format CSV
          </h3>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Téléchargez en un clic les réponses de la configuration et le
            rendez-vous confirmé, prêts à être importés dans HubSpot, Pipedrive,
            Salesforce, Notion ou tout CRM compatible CSV (UTF-8).
          </p>
        </div>
      </header>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={handleExport}
          disabled={busy}
          className="h-11 rounded-xl"
        >
          <FileDown className="mr-2 h-4 w-4" aria-hidden="true" />
          Télécharger le CSV
        </Button>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Format : une ligne, colonnes contact / entreprise / RDV / configuration.
        Encodage UTF-8 avec BOM pour Excel.
      </p>
    </section>
  );
}