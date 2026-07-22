import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Building2,
  Users,
  Target,
  MapPin,
  Briefcase,
  Sparkles,
  Download,
  Loader2,
  Share2,
  Check,
  Copy,
} from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { StepNav } from "@/components/step-nav";
import { RecommendationCard } from "@/components/recommendation-card";
import { RoiBreakdown } from "@/components/roi-breakdown";
import { formatEUR, useLucie, useMetrics, useRecommendation } from "@/lib/lucie-store";
import { PLAN_LABELS, PLAN_TAGLINES, PRIORITY_CTA } from "@/lib/recommendation";
import { createSharedDiagnostic } from "@/lib/share.functions";
import { addPdfHistoryEntry } from "@/lib/pdf-history";

export const Route = createFileRoute("/recommandation")({
  head: () => ({
    meta: [
      { title: "Diagnostic final — Lucie" },
      {
        name: "description",
        content:
          "Synthèse du diagnostic Lucie : compatibilité, formule recommandée, ROI estimé et prochaines étapes.",
      },
      { property: "og:title", content: "Diagnostic final — Lucie" },
      {
        property: "og:description",
        content:
          "Le récapitulatif objectif de votre compatibilité avec Lucie.",
      },
      {
        property: "og:url",
        content: "https://lucie-ai-command.lovable.app/recommandation",
      },
    ],
    links: [
      {
        rel: "canonical",
        href: "https://lucie-ai-command.lovable.app/recommandation",
      },
    ],
  }),
  component: RecommandationPage,
});

function RecommandationPage() {
  const { state } = useLucie();
  const m = useMetrics();
  const rec = useRecommendation();
  const exportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const createShare = useServerFn(createSharedDiagnostic);

  const handleShare = async () => {
    if (isSharing) return;
    setIsSharing(true);
    setShareError(null);
    try {
      const { token } = await createShare({
        data: {
          companyName: state.companyName,
          activity: state.activity,
          city: state.city,
          employees: state.employees,
          callsPerWeek: state.callsPerWeek,
          missedCalls: state.missedCalls,
          averageBasket: state.averageBasket,
          revenueGoal: state.revenueGoal,
          conversionRate: state.conversionRate,
          channels: state.channels,
          recommendation: {
            score: rec.score,
            tier: rec.tier,
            plan: rec.plan,
            priority: rec.priority,
            estimatedMonthlyRoi: rec.estimatedMonthlyRoi,
            justifications: rec.justifications,
            concerns: rec.concerns,
            planReason: rec.planReason,
          },
          metrics: {
            monthlyReceived: m.monthlyReceived,
            monthlyMissed: m.monthlyMissed,
            monthlyLostRevenue: m.monthlyLostRevenue,
            yearlyLostRevenue: m.yearlyLostRevenue,
            recoverableOpportunities: m.recoverableOpportunities,
            timeSavedHours: m.timeSavedHours,
          },
        },
      });
      const url = `${window.location.origin}/d/${token}`;
      setShareUrl(url);
      try {
        await navigator.clipboard.writeText(url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2500);
      } catch {
        /* clipboard blocked — url still shown */
      }
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "Impossible de générer le lien");
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyAgain = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch {
      /* noop */
    }
  };

  const handleExportPdf = async () => {
    if (!exportRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const node = exportRef.current;
      const canvas = await html2canvas(node, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = margin;
      pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - margin * 2;
      while (heightLeft > 0) {
        position = margin - (imgHeight - heightLeft);
        pdf.addPage();
        pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
        heightLeft -= pageHeight - margin * 2;
      }
      // Watermark + footer (date + version) sur chaque page
      const DIAGNOSTIC_VERSION = "v2.1";
      const generatedAt = new Date().toLocaleString("fr-FR", {
        dateStyle: "long",
        timeStyle: "short",
      });
      const totalPages = pdf.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        // Filigrane diagonal centré
        const anyPdf = pdf as any;
        anyPdf.saveGraphicsState?.();
        if (anyPdf.GState && anyPdf.setGState) {
          anyPdf.setGState(new anyPdf.GState({ opacity: 0.08 }));
        }
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(72);
        pdf.setTextColor(37, 99, 235);
        pdf.text("LUCIE", pageWidth / 2, pageHeight / 2, {
          align: "center",
          angle: 45,
        });
        anyPdf.restoreGraphicsState?.();
        // Pied de page : date + version + pagination
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(120, 120, 120);
        pdf.text(`Généré le ${generatedAt}`, margin, pageHeight - 4);
        pdf.text(`Diagnostic Lucie ${DIAGNOSTIC_VERSION}`, pageWidth / 2, pageHeight - 4, {
          align: "center",
        });
        pdf.text(`Page ${p} / ${totalPages}`, pageWidth - margin, pageHeight - 4, {
          align: "right",
        });
      }
      const filename = `diagnostic-lucie-${(state.companyName || "prospect")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}.pdf`;
      pdf.save(filename);
      try {
        const dataUrl = pdf.output("datauristring", { filename });
        const blob = pdf.output("blob");
        addPdfHistoryEntry({
          filename,
          companyName: state.companyName || "Prospect",
          dataUrl,
          sizeBytes: blob.size,
        });
      } catch {
        /* history is best-effort */
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Diagnostic · Synthèse"
        title="Votre diagnostic est terminé"
        description="Voici la synthèse objective de votre situation, la formule que Lucie recommande — ou pas — et les prochaines étapes."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={handleShare}
              disabled={isSharing}
              aria-label="Générer un lien de partage sécurisé"
            >
              {isSharing ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Génération…
                </>
              ) : (
                <>
                  <Share2 className="mr-1.5 h-4 w-4" /> Partager
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={handleExportPdf}
              disabled={isExporting}
              aria-label="Exporter le diagnostic en PDF"
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Génération…
                </>
              ) : (
                <>
                  <Download className="mr-1.5 h-4 w-4" /> Exporter en PDF
                </>
              )}
            </Button>
          </div>
        }
      />

      {(shareUrl || shareError) && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-4"
        >
          {shareError ? (
            <p className="text-sm text-destructive">{shareError}</p>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-[11px] font-medium uppercase tracking-widest text-primary">
                  Lien de partage sécurisé — expire dans 30 jours
                </div>
                <p className="mt-1 truncate font-mono text-xs text-foreground sm:text-sm">
                  {shareUrl}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={handleCopyAgain}
              >
                {shareCopied ? (
                  <>
                    <Check className="mr-1.5 h-4 w-4 text-primary" /> Copié
                  </>
                ) : (
                  <>
                    <Copy className="mr-1.5 h-4 w-4" /> Copier
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      <div ref={exportRef} className="space-y-6 bg-background">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section
          aria-labelledby="context-title"
          className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
        >
          <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Contexte du prospect
          </div>
          <h2
            id="context-title"
            className="mt-1 text-lg font-semibold tracking-tight text-foreground sm:text-xl"
          >
            {state.companyName || "Entreprise non renseignée"}
          </h2>

          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <Info icon={Briefcase} label="Secteur" value={state.activity || "—"} />
            <Info
              icon={Users}
              label="Collaborateurs"
              value={String(state.employees)}
            />
            <Info icon={MapPin} label="Ville" value={state.city || "—"} />
            <Info
              icon={Target}
              label="Objectif mensuel"
              value={formatEUR(state.revenueGoal)}
            />
            <Info
              icon={Building2}
              label="Appels reçus / mois"
              value={m.monthlyReceived.toLocaleString("fr-FR")}
            />
            <Info
              icon={Sparkles}
              label="CA potentiel perdu / mois"
              value={formatEUR(m.monthlyLostRevenue)}
            />
          </dl>

          <div className="mt-6 rounded-2xl border border-border bg-background p-4">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Canaux d'acquisition déclarés
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {state.channels.length === 0 ? (
                <span className="text-sm text-muted-foreground">Aucun canal renseigné.</span>
              ) : (
                state.channels.map((c) => (
                  <span
                    key={c}
                    className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-foreground/80"
                  >
                    {c}
                  </span>
                ))
              )}
            </div>
          </div>
        </section>

        <RecommendationCard showCta={false} />
      </div>

      <RoiBreakdown />

      <NextStep />
      </div>

      <StepNav current="/recommandation" />
    </div>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-foreground/70">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">
          {label}
        </dt>
        <dd className="mt-0.5 truncate text-sm font-medium text-foreground">
          {value}
        </dd>
      </div>
    </div>
  );
}

function NextStep() {
  const rec = useRecommendation();
  const cta = PRIORITY_CTA[rec.priority];
  const tone =
    rec.priority === "high"
      ? {
          wrap: "border-destructive/30 bg-gradient-to-br from-destructive/[0.08] to-transparent",
          eyebrow: "text-destructive",
        }
      : rec.priority === "medium"
        ? {
            wrap: "border-[oklch(0.75_0.15_60)]/35 bg-gradient-to-br from-[oklch(0.75_0.15_60)]/[0.08] to-transparent",
            eyebrow: "text-[oklch(0.5_0.15_60)]",
          }
        : {
            wrap: "border-border bg-gradient-to-br from-muted/60 to-transparent",
            eyebrow: "text-muted-foreground",
          };

  return (
    <section
      className={`rounded-3xl border p-6 shadow-[var(--shadow-card)] sm:p-8 ${tone.wrap}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div
            className={`text-[11px] font-medium uppercase tracking-widest ${tone.eyebrow}`}
          >
            <span aria-hidden="true">{cta.emoji}</span> {cta.eyebrow}
          </div>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            {cta.title}
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{cta.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/demonstration">{cta.secondaryLabel}</Link>
          </Button>
          <Button asChild className="rounded-xl">
            <Link to="/offres">
              {cta.primaryLabel} <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
      <p className="mt-4 text-[11px] text-muted-foreground">
        Références plans : {PLAN_LABELS.essential} · {PLAN_LABELS.pro} ·{" "}
        {PLAN_LABELS.premium}. {PLAN_TAGLINES.pro}
      </p>
    </section>
  );
}