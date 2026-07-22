import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  Users,
  Target,
  MapPin,
  Briefcase,
  Sparkles,
  Download,
} from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { StepNav } from "@/components/step-nav";
import { RecommendationCard } from "@/components/recommendation-card";
import { formatEUR, useLucie, useMetrics } from "@/lib/lucie-store";
import { PLAN_LABELS, PLAN_TAGLINES } from "@/lib/recommendation";

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

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Diagnostic · Synthèse"
        title="Votre diagnostic est terminé"
        description="Voici la synthèse objective de votre situation, la formule que Lucie recommande — ou pas — et les prochaines étapes."
        actions={
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => window.print()}
          >
            <Download className="mr-1.5 h-4 w-4" /> Exporter
          </Button>
        }
      />

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

      <NextStep />

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
  return (
    <section className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[0.07] to-transparent p-6 shadow-[var(--shadow-card)] sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-widest text-primary">
            Prochaine étape
          </div>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            Passer à la démonstration et aux offres
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Poursuivez le parcours pour visualiser Lucie en action puis retrouver
            votre formule recommandée déjà sélectionnée dans le comparateur.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/demonstration">Voir la démonstration</Link>
          </Button>
          <Button asChild className="rounded-xl">
            <Link to="/offres">
              Voir la formule recommandée <ArrowRight className="ml-1 h-4 w-4" />
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