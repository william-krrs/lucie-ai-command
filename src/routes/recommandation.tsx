import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
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
  Mail,
  History,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StepNav } from "@/components/step-nav";
import { RecommendationCard } from "@/components/recommendation-card";
import { RoiBreakdown } from "@/components/roi-breakdown";
import { QrCodeCard } from "@/components/qr-code";
import { CalendlyEmbed } from "@/components/calendly-embed";
import { formatEUR, useLucie, useMetrics, useRecommendation } from "@/lib/lucie-store";
import { PLAN_LABELS, PLAN_TAGLINES, PRIORITY_CTA } from "@/lib/recommendation";
import { createSharedDiagnostic } from "@/lib/share.functions";
import { addPdfHistoryEntry } from "@/lib/pdf-history";
import {
  addShareHistoryEntry,
  clearShareHistory,
  getShareHistory,
  removeShareHistoryEntry,
  type ShareHistoryEntry,
} from "@/lib/share-history";

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
  const { state, update } = useLucie();
  const m = useMetrics();
  const rec = useRecommendation();
  const exportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [prospectEmail, setProspectEmail] = useState("");
  const [shareHistory, setShareHistory] = useState<ShareHistoryEntry[]>([]);
  const createShare = useServerFn(createSharedDiagnostic);

  useEffect(() => {
    setShareHistory(getShareHistory());
  }, []);

  const handleShare = async (opts?: { silent?: boolean }): Promise<string | null> => {
    if (isSharing) return shareUrl;
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
      setShareHistory(
        addShareHistoryEntry({ url, token, companyName: state.companyName || undefined }),
      );
      if (!opts?.silent) {
        try {
          await navigator.clipboard.writeText(url);
          setShareCopied(true);
          setTimeout(() => setShareCopied(false), 2500);
          toast.success("Lien de partage copié", {
            description: "Le diagnostic public a été copié dans le presse-papiers.",
          });
        } catch {
          toast.error("Presse-papiers bloqué", {
            description: "Copiez le lien affiché ci-dessous manuellement.",
          });
        }
      }
      return url;
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "Impossible de générer le lien");
      return null;
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
      toast.success("Lien copié dans le presse-papiers");
    } catch {
      toast.error("Impossible de copier le lien", {
        description: "Autorisez l’accès au presse-papiers puis réessayez.",
      });
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
              onClick={() => handleShare()}
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

      <section
        aria-labelledby="decision-title"
        className="rounded-2xl border border-border bg-card/60 p-5 space-y-4"
      >
        <div>
          <h2 id="decision-title" className="text-base font-semibold text-foreground">
            Prise de décision
          </h2>
          <p className="text-sm text-muted-foreground">
            Êtes-vous seul(e) à décider, ou souhaitez-vous partager le récap avec un(e) associé(e) ?
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { value: false, label: "Je décide seul(e)" },
            { value: true, label: "Nous décidons à plusieurs" },
          ].map((opt) => {
            const active = state.hasPartner === opt.value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => update("hasPartner", opt.value)}
                aria-pressed={active}
                className={
                  "rounded-full border px-4 py-2 text-sm transition-all duration-200 " +
                  (active
                    ? "border-primary bg-primary text-primary-foreground shadow-[var(--shadow-elevated)]"
                    : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-accent")
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {state.hasPartner && (
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm space-y-1">
              <span className="text-muted-foreground">Nombre de décideurs</span>
              <Input
                type="number"
                min={2}
                max={20}
                value={state.partnerCount}
                onChange={(e) =>
                  update("partnerCount", Math.max(2, Number(e.target.value) || 2))
                }
                className="rounded-xl"
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="text-muted-foreground">Nom de l'associé(e)</span>
              <Input
                value={state.partnerName}
                onChange={(e) => update("partnerName", e.target.value)}
                placeholder="Prénom Nom"
                className="rounded-xl"
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="text-muted-foreground">Email de l'associé(e)</span>
              <Input
                type="email"
                inputMode="email"
                value={state.partnerEmail}
                onChange={(e) => update("partnerEmail", e.target.value)}
                placeholder="associe@entreprise.fr"
                className="rounded-xl"
              />
            </label>
          </div>
        )}

        {state.hasPartner && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              className="rounded-xl"
              disabled={isSharing}
              onClick={async () => {
                const email = state.partnerEmail.trim();
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                  toast.error("Renseignez un email valide pour votre associé(e).");
                  return;
                }
                let url = shareUrl;
                if (!url) {
                  try {
                    url = await handleShare({ silent: true });
                  } catch {
                    // handleShare already surfaces the error
                    return;
                  }
                }
                if (!url) return;
                const company = state.companyName || "votre entreprise";
                const who = state.partnerName.trim() || "";
                const hello = who ? `Bonjour ${who},` : "Bonjour,";
                const subject = `Récap diagnostic Lucie — ${company}`;
                const body = `${hello}\n\nVoici le récapitulatif du diagnostic Lucie pour ${company} :\n${url}\n\nCe lien sécurisé est valable 30 jours.\n\nBien à vous,`;
                window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                toast.success("Ouverture de votre client email…");
              }}
            >
              {isSharing ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Préparation…
                </>
              ) : (
                <>
                  <Mail className="mr-1.5 h-4 w-4" /> Envoyer le récap à mon associé(e)
                </>
              )}
            </Button>
          </div>
        )}
      </section>

      {(shareUrl || shareError) && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-4"
        >
          {shareError ? (
            <p className="text-sm text-destructive">{shareError}</p>
          ) : (
            <div className="space-y-4">
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

              {shareUrl && (
                <div className="border-t border-primary/20 pt-4">
                  <QrCodeCard
                    url={shareUrl}
                    label={`QR code du diagnostic de ${state.companyName || "Lucie"}`}
                    companyName={state.companyName || "diagnostic"}
                  />
                </div>
              )}

              {shareUrl && (
                <form
                  className="flex flex-col gap-2 border-t border-primary/20 pt-4 sm:flex-row sm:items-center"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const email = prospectEmail.trim();
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                      toast.error("Adresse email invalide.");
                      return;
                    }
                    const company = state.companyName || "votre entreprise";
                    const subject = `Votre diagnostic Lucie — ${company}`;
                    const body = `Bonjour,\n\nVoici le lien vers votre diagnostic Lucie personnalisé pour ${company} :\n${shareUrl}\n\nCe lien est valable 30 jours. N'hésitez pas à revenir vers moi pour en discuter.\n\nBien à vous,`;
                    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                    toast.success("Ouverture de votre client email…");
                  }}
                >
                  <label htmlFor="prospect-email" className="sr-only">
                    Email du prospect
                  </label>
                  <Input
                    id="prospect-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="prospect@entreprise.fr"
                    value={prospectEmail}
                    onChange={(e) => setProspectEmail(e.target.value)}
                    className="rounded-xl"
                  />
                  <Button type="submit" size="sm" className="rounded-xl whitespace-nowrap">
                    <Mail className="mr-1.5 h-4 w-4" /> Envoyer par email
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {shareHistory.length > 0 && (
        <section
          aria-labelledby="share-history-title"
          className="rounded-2xl border border-border bg-card/50 p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <h2
                id="share-history-title"
                className="text-sm font-semibold text-foreground"
              >
                Historique des liens ({shareHistory.length})
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-lg text-xs text-muted-foreground hover:text-destructive"
              onClick={() => {
                clearShareHistory();
                setShareHistory([]);
                toast.success("Historique vidé");
              }}
            >
              Tout effacer
            </Button>
          </div>
          <ul className="mt-3 divide-y divide-border">
            {shareHistory.map((entry) => {
              const date = new Date(entry.createdAt);
              const dateLabel = date.toLocaleString("fr-FR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <li
                  key={entry.url}
                  className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {entry.companyName || "Diagnostic partagé"}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <time dateTime={entry.createdAt}>{dateLabel}</time>
                      <span aria-hidden="true">•</span>
                      <span className="truncate font-mono">{entry.url}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(entry.url);
                          toast.success("Lien copié");
                        } catch {
                          toast.error("Copie impossible");
                        }
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span className="sr-only">Copier</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg"
                      asChild
                    >
                      <a href={entry.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span className="sr-only">Ouvrir</span>
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-lg text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        setShareHistory(removeShareHistoryEntry(entry.url));
                      }}
                      aria-label="Supprimer de l’historique"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
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

      <div id="calendly" className="scroll-mt-24">
        <CalendlyEmbed />
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
            eyebrow: "text-[oklch(0.82_0.15_60)]",
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