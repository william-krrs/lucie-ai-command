import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  ArrowRight,
  PhoneCall,
  Settings2,
  FlaskConical,
  Rocket,
  PartyPopper,
  RotateCcw,
} from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  start: z.string().optional(),
  plan: z.enum(["essential", "pro", "premium"]).optional(),
});

const PLAN_LABELS: Record<string, string> = {
  essential: "Lucie Essential",
  pro: "Lucie Pro",
  premium: "Lucie Premium",
};

export const Route = createFileRoute("/suivi")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Suivi — Lucie Command Center" },
      {
        name: "description",
        content: "Suivez l'avancement de votre installation Lucie jour après jour.",
      },
      { property: "og:title", content: "Suivi — Lucie" },
      { property: "og:description", content: "Timeline de votre installation Lucie." },
      { property: "og:url", content: "https://lucie-ai-command.lovable.app/suivi" },
    ],
    links: [{ rel: "canonical", href: "https://lucie-ai-command.lovable.app/suivi" }],
  }),
  component: Suivi,
});

const TIMELINE = [
  {
    key: "cadrage",
    day: 0,
    icon: PhoneCall,
    title: "Cadrage",
    desc: "Kickoff avec votre équipe pour valider le besoin, récupérer les accès et planifier le déploiement.",
  },
  {
    key: "configuration",
    day: 1,
    icon: Settings2,
    title: "Configuration",
    desc: "Paramétrage de la voix, des scénarios de réponse et des règles de qualification.",
  },
  {
    key: "tests",
    day: 2,
    icon: FlaskConical,
    title: "Tests",
    desc: "Simulations d'appels réels pour valider le comportement de Lucie avant la mise en production.",
  },
  {
    key: "installation",
    day: 3,
    rangeEnd: 5,
    icon: Rocket,
    title: "Installation",
    desc: "Mise en production, connexion téléphonique et activation du monitoring. Durée : J+3 à J+5 selon la complexité.",
  },
  {
    key: "live",
    day: 5,
    icon: PartyPopper,
    title: "Opérationnel",
    desc: "Lucie répond à vos appels en autonomie. Optimisation continue activée.",
  },
];

function getElapsedDays(start: string | undefined): number {
  const startDate = start ? new Date(start) : new Date();
  if (Number.isNaN(startDate.getTime())) return 0;
  const now = new Date();
  const diff = now.getTime() - startDate.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getStatus(elapsed: number) {
  if (elapsed < 0) {
    return { label: "En attente de paiement", tone: "muted" as const };
  }
  if (elapsed === 0) {
    return { label: "Cadrage en cours", tone: "brand" as const };
  }
  if (elapsed <= 2) {
    return { label: "Configuration & tests", tone: "brand" as const };
  }
  if (elapsed <= 5) {
    return { label: "Installation en cours", tone: "brand" as const };
  }
  return { label: "Lucie est opérationnelle", tone: "success" as const };
}

function isCompleted(step: (typeof TIMELINE)[number], elapsed: number) {
  if (step.key === "live") return elapsed > 5;
  const end = step.rangeEnd ?? step.day;
  return elapsed > end;
}

function isActive(step: (typeof TIMELINE)[number], elapsed: number) {
  if (step.key === "live") return elapsed > 5;
  if (elapsed < step.day) return false;
  const end = step.rangeEnd ?? step.day;
  return elapsed <= end;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDayLabel(step: (typeof TIMELINE)[number]) {
  if (step.key === "live") return "J+5 et plus";
  if (step.rangeEnd) return `J+${step.day} à J+${step.rangeEnd}`;
  return `J+${step.day}`;
}

function Suivi() {
  const { start, plan } = Route.useSearch();
  const startDate = start ? new Date(start) : new Date();
  const elapsed = getElapsedDays(start);
  const status = getStatus(elapsed);
  const planLabel = plan ? PLAN_LABELS[plan] : "votre formule";

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Suivi de commande"
        title="Où en est votre installation ?"
        description="Suivez l'avancement de votre déploiement Lucie jour après jour."
      />

      <section className="rounded-3xl border border-primary/20 bg-primary/[0.04] p-6 shadow-[var(--shadow-card)] sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-primary-foreground shadow-[var(--shadow-elevated)]",
                status.tone === "success" ? "bg-[oklch(0.65_0.17_155)]" : "bg-primary",
              )}
            >
              {status.tone === "success" ? (
                <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
              ) : (
                <Clock className="h-6 w-6" aria-hidden="true" />
              )}
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-widest text-primary">
                Statut actuel
              </div>
              <div className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">
                {status.label}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {planLabel} · Démarré le {formatDate(startDate)} · J+{elapsed}
              </div>
            </div>
          </div>

          <Button
            asChild
            variant="outline"
            className="h-11 shrink-0 rounded-xl"
          >
            <Link to="/suivi" search={{ start: new Date().toISOString().split("T")[0], plan }}>
              <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Simuler aujourd'hui
            </Link>
          </Button>
        </div>
      </section>

      <section aria-label="Timeline de déploiement" className="relative">
        <div
          aria-hidden="true"
          className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-primary/40 via-border to-transparent md:left-1/2"
        />

        <ol className="relative space-y-6">
          {TIMELINE.map((step, i) => {
            const Icon = step.icon;
            const completed = isCompleted(step, elapsed);
            const active = isActive(step, elapsed);
            const right = i % 2 === 1;

            return (
              <li key={step.key} className="relative md:grid md:grid-cols-2 md:gap-8">
                <div
                  className={cn(
                    "ml-16 md:ml-0 rounded-2xl border p-5 shadow-[var(--shadow-card)] transition-all",
                    active
                      ? "border-primary bg-card ring-2 ring-primary/20"
                      : completed
                        ? "border-border bg-card"
                        : "border-border bg-muted/30 opacity-80",
                  )}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "grid h-10 w-10 place-items-center rounded-xl",
                          active
                            ? "bg-primary text-primary-foreground"
                            : completed
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                          {formatDayLabel(step)}
                        </div>
                        <div className="text-base font-semibold tracking-tight text-foreground">
                          {step.title}
                        </div>
                      </div>
                    </div>
                    {completed && (
                      <span className="sr-only">Étape terminée</span>
                    )}
                    {active && (
                      <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-medium text-primary-foreground">
                        En cours
                      </span>
                    )}
                    {!active && !completed && (
                      <span className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                        À venir
                      </span>
                    )}
                  </div>
                  <p
                    className={cn(
                      "mt-3 text-sm leading-relaxed",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {step.desc}
                  </p>
                </div>

                <span
                  aria-hidden="true"
                  className="absolute left-6 top-5 -translate-x-1/2 md:left-1/2"
                >
                  <span
                    className={cn(
                      "grid h-4 w-4 place-items-center rounded-full border-2 border-background shadow-[var(--shadow-elevated)]",
                      active ? "bg-primary" : completed ? "bg-primary" : "bg-muted",
                    )}
                  >
                    {completed && (
                      <CheckCircle2 className="h-3 w-3 text-primary-foreground" aria-hidden="true" />
                    )}
                    {!completed && !active && (
                      <Circle className="h-2 w-2 text-muted-foreground" aria-hidden="true" />
                    )}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Besoin d'aide ?
            </div>
            <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
              Consultez la FAQ ou revenez à l'installation
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Retrouvez les réponses aux questions courantes sur le déploiement et l'utilisation de Lucie.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <Button
              asChild
              className="h-11 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
            >
              <Link to="/installation">
                Voir le détail de l'installation
                <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="h-9 w-full rounded-lg text-xs text-muted-foreground hover:text-foreground sm:w-auto"
            >
              <Link to="/faq">Questions fréquentes</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
