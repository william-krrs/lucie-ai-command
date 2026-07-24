import { Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  XCircle,
  Flame,
  Circle,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatEUR, useRecommendation } from "@/lib/lucie-store";
import {
  PLAN_LABELS,
  PRIORITY_LABELS,
  TIER_LABELS,
  type Recommendation,
} from "@/lib/recommendation";

const TIER_STYLES: Record<
  Recommendation["tier"],
  { ring: string; bar: string; badge: string; icon: typeof CheckCircle2; message: string }
> = {
  excellent: {
    ring: "border-[oklch(0.65_0.17_155)]/40 bg-[oklch(0.65_0.17_155)]/[0.06]",
    bar: "bg-[oklch(0.65_0.17_155)]",
    badge: "bg-[oklch(0.65_0.17_155)]/15 text-[oklch(0.45_0.17_155)]",
    icon: CheckCircle2,
    message:
      "Votre entreprise correspond parfaitement aux critères de Lucie. Notre équipe recommande de poursuivre le projet.",
  },
  compatible: {
    ring: "border-primary/30 bg-primary/[0.05]",
    bar: "bg-primary",
    badge: "bg-primary/10 text-primary",
    icon: ShieldCheck,
    message:
      "Votre entreprise peut être accompagnée. Quelques adaptations seront nécessaires pour maximiser l'impact.",
  },
  limited: {
    ring: "border-[oklch(0.75_0.15_60)]/40 bg-[oklch(0.75_0.15_60)]/[0.08]",
    bar: "bg-[oklch(0.7_0.16_60)]",
    badge: "bg-[oklch(0.75_0.15_60)]/15 text-[oklch(0.82_0.15_60)]",
    icon: AlertTriangle,
    message:
      "Lucie peut apporter de la valeur, mais l'impact dépendra fortement de vos objectifs à court terme.",
  },
  refuse: {
    ring: "border-destructive/40 bg-destructive/[0.05]",
    bar: "bg-destructive",
    badge: "bg-destructive/10 text-destructive",
    icon: XCircle,
    message:
      "Après analyse de votre situation actuelle, nous pensons que Lucie ne vous apporterait pas suffisamment de valeur. Nous préférons être transparents plutôt que de vendre une solution inadaptée. Lorsque votre activité évoluera, nous serons ravis de refaire un diagnostic.",
  },
};

const PRIORITY_STYLES: Record<
  Recommendation["priority"],
  { icon: typeof Flame; className: string }
> = {
  high: {
    icon: Flame,
    className:
      "border-destructive/30 bg-destructive/10 text-destructive",
  },
  medium: {
    icon: Circle,
    className:
      "border-[oklch(0.75_0.15_60)]/40 bg-[oklch(0.75_0.15_60)]/10 text-[oklch(0.82_0.15_60)]",
  },
  low: {
    icon: Circle,
    className:
      "border-border bg-muted text-muted-foreground",
  },
};

export function RecommendationCard({
  compact = false,
  showCta = true,
}: {
  compact?: boolean;
  showCta?: boolean;
}) {
  const rec = useRecommendation();
  const tier = TIER_STYLES[rec.tier];
  const priority = PRIORITY_STYLES[rec.priority];
  const TierIcon = tier.icon;
  const PriorityIcon = priority.icon;

  return (
    <section
      aria-labelledby="reco-title"
      className={cn(
        "rounded-3xl border p-6 shadow-[var(--shadow-card)] transition-all duration-500 animate-fade-in",
        tier.ring,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Compatibilité avec Lucie
          </div>
          <h2
            id="reco-title"
            className="mt-1 text-lg font-semibold tracking-tight text-foreground sm:text-xl"
          >
            {TIER_LABELS[rec.tier]}
          </h2>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
            priority.className,
          )}
          aria-label={`Priorité commerciale : ${PRIORITY_LABELS[rec.priority]}`}
        >
          <PriorityIcon className="h-3 w-3" aria-hidden="true" />
          {PRIORITY_LABELS[rec.priority]}
        </span>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between">
          <div className="flex items-center gap-2">
            <TierIcon className="h-4 w-4 text-foreground/70" aria-hidden="true" />
            <span className="text-xs text-muted-foreground">Score</span>
          </div>
          <span className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
            {rec.score}
            <span className="text-sm font-normal text-muted-foreground"> / 100</span>
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={rec.score}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className={cn("h-full rounded-full transition-all duration-700", tier.bar)}
            style={{ width: `${Math.max(4, rec.score)}%` }}
          />
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-foreground/80">{tier.message}</p>

      {!compact && rec.justifications.length > 0 && (
        <div className="mt-5">
          <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Pourquoi cette recommandation ?
          </div>
          <ul className="mt-2 space-y-1.5">
            {rec.justifications.map((j) => (
              <li key={j} className="flex items-start gap-2 text-sm text-foreground/85">
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span>{j}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!compact && rec.concerns.length > 0 && (
        <div className="mt-4">
          <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Points de vigilance
          </div>
          <ul className="mt-2 space-y-1.5">
            {rec.concerns.map((c) => (
              <li key={c} className="flex items-start gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Formule recommandée
          </div>
          <div className="mt-1 flex items-center gap-2 text-base font-semibold text-foreground">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
            {rec.plan ? PLAN_LABELS[rec.plan] : "Aucune"}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
            ROI estimé / mois
          </div>
          <div className="mt-1 text-base font-semibold tabular-nums text-foreground">
            {rec.plan ? formatEUR(rec.estimatedMonthlyRoi) : "—"}
          </div>
        </div>
      </div>

      {showCta && (
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild className="rounded-xl">
            <Link to="/recommandation">
              Voir le diagnostic final <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          {rec.plan && (
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/offres">Voir la formule recommandée</Link>
            </Button>
          )}
        </div>
      )}
    </section>
  );
}