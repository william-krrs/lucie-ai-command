import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import {
  CheckCircle2,
  Calendar,
  Mail,
  Clock,
  Wrench,
  Package,
  AlertCircle,
  ClipboardList,
  ListChecks,
  CreditCard,
  ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { PreparationForm } from "@/components/preparation-form";
import { ExportHistory } from "@/components/export-history";
import { cn } from "@/lib/utils";

const planSearchSchema = z.object({
  plan: z.enum(["essential", "pro", "premium"]).optional(),
});

const PLAN_LABELS: Record<string, string> = {
  essential: "Lucie Essential",
  pro: "Lucie Pro",
  premium: "Lucie Premium",
};

const JOURNEY_STEPS = [
  {
    id: "paiement",
    label: "Paiement",
    description: "Abonnement + installation",
    icon: CreditCard,
  },
  {
    id: "questionnaire",
    label: "Questionnaire",
    description: "Configuration Lucie",
    icon: ClipboardList,
  },
  {
    id: "timeline",
    label: "Timeline",
    description: "Suivi d'installation",
    icon: ListChecks,
  },
] as const;

function JourneyProgress({ activeIndex }: { activeIndex: number }) {
  return (
    <nav aria-label="Progression de votre onboarding" className="w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-widest text-primary">
            Votre parcours
          </div>
          <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-foreground">
            Où en êtes-vous ?
          </h2>
        </div>
        <p className="max-w-sm text-sm text-muted-foreground">
          Terminez le questionnaire ci-dessous pour lancer la mise en production de Lucie.
        </p>
      </div>

      <ol className="mt-6 grid gap-3 sm:grid-cols-3">
        {JOURNEY_STEPS.map((step, index) => {
          const Icon = step.icon;
          const completed = index < activeIndex;
          const current = index === activeIndex;
          const upcoming = index > activeIndex;

          return (
            <li key={step.id} className="relative">
              <div
                className={cn(
                  "flex items-center gap-3 rounded-2xl border p-4 transition-colors sm:block",
                  completed && "border-primary/20 bg-primary/[0.04]",
                  current && "border-primary bg-primary/[0.06] ring-1 ring-primary/30",
                  upcoming && "border-border bg-card opacity-80",
                )}
              >
                <div className="flex items-center gap-3 sm:mb-3">
                  <div
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-semibold",
                      completed && "bg-primary text-primary-foreground",
                      current && "bg-primary text-primary-foreground shadow-[var(--shadow-elevated)]",
                      upcoming && "bg-muted text-muted-foreground",
                    )}
                    aria-hidden={!current}
                  >
                    {completed ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <div className="sm:hidden">
                    <div className="text-sm font-semibold text-foreground">{step.label}</div>
                    <div className="text-xs text-muted-foreground">{step.description}</div>
                  </div>
                </div>
                <div className="hidden sm:block">
                  <div className="text-sm font-semibold text-foreground">{step.label}</div>
                  <div className="text-xs text-muted-foreground">{step.description}</div>
                </div>
                {current && (
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary sm:mt-3">
                    Étape en cours <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                )}
                {completed && (
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary sm:mt-3">
                    Terminé <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${((activeIndex + 1) / JOURNEY_STEPS.length) * 100}%` }}
          aria-hidden="true"
        />
      </div>
      <p className="mt-2 text-right text-xs font-medium text-muted-foreground">
        Étape {activeIndex + 1} sur {JOURNEY_STEPS.length}
      </p>
    </nav>
  );
}

export const Route = createFileRoute("/merci")({
  validateSearch: planSearchSchema,
  head: () => ({
    meta: [
      { title: "Merci — Paiement confirmé | Lucie" },
      {
        name: "description",
        content:
          "Votre paiement a bien été confirmé. Prochaine étape : l'installation de Lucie sous 3 à 5 jours.",
      },
      { property: "og:title", content: "Merci — Paiement confirmé | Lucie" },
      { property: "og:description", content: "Paiement reçu. On lance l'installation de Lucie." },
      { property: "og:url", content: "https://lucie-ai-command.lovable.app/merci" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://lucie-ai-command.lovable.app/merci" }],
  }),
  component: Merci,
});

function Merci() {
  const { plan } = Route.useSearch();
  const planLabel = plan ? PLAN_LABELS[plan] : "votre formule Lucie";
  const planMissing = !plan;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Paiement confirmé"
        title="Merci — bienvenue chez Lucie"
        description="Votre paiement a bien été reçu. Notre équipe prend le relais pour lancer votre installation."
      />

      <section className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
        <JourneyProgress activeIndex={1} />
      </section>

      {planMissing && (
        <section
          role="status"
          className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-5 sm:p-6"
        >
          <div className="flex items-start gap-3">
            <AlertCircle
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
              aria-hidden="true"
            />
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-foreground">
                Paiement bien reçu — formule non détectée automatiquement
              </p>
              <p className="text-muted-foreground">
                Si vous venez de régler mais que la page n'a pas retenu votre
                formule (redirection Stripe incomplète, retour arrière du
                navigateur, lien ouvert dans un autre onglet), aucun souci :
                votre paiement est enregistré côté Stripe. Sélectionnez
                ci-dessous la formule payée pour retrouver le bon récapitulatif,
                ou écrivez-nous à{" "}
                <a
                  href="mailto:contact@lucieassistant.fr?subject=Confirmation%20paiement%20Lucie"
                  className="font-medium text-primary underline underline-offset-2"
                >
                  contact@lucieassistant.fr
                </a>
                {" "}avec votre reçu Stripe, on prend le relais sous 24 h.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {(["essential", "pro", "premium"] as const).map((p) => (
                  <Button
                    key={p}
                    asChild
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-lg text-xs"
                  >
                    <Link to="/merci" search={{ plan: p }}>
                      {PLAN_LABELS[p]}
                    </Link>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-primary/20 bg-primary/[0.04] p-8 shadow-[var(--shadow-elevated)] sm:p-10">
        <div className="flex flex-col items-center text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground">
            <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Paiement validé ✅
          </h2>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            Un reçu vient de vous être envoyé par Stripe. Notre équipe vous
            contacte sous 24 heures ouvrées pour planifier votre installation.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-start gap-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                <Package className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Formule choisie
                </div>
                <div className="mt-1 text-lg font-semibold text-foreground">{planLabel}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Abonnement mensuel activé dès réception du paiement.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-start gap-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                <Wrench className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Installation incluse
                </div>
                <div className="mt-1 text-lg font-semibold text-foreground">490 € inclus</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Paramétrage, connexion et mise en production sans frais supplémentaires.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Mail,
              title: "Reçu par email",
              text: "Vérifiez votre boîte de réception (et vos spams).",
            },
            {
              icon: Calendar,
              title: "Rendez-vous de cadrage",
              text: "Nous fixons ensemble le kickoff dans les 24 h.",
            },
            {
              icon: Clock,
              title: "Installation 3 à 5 jours",
              text: "Selon la complexité de votre configuration.",
            },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.title}
                className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
              >
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-muted text-foreground">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="mt-3 text-sm font-semibold text-foreground">{s.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{s.text}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section
        id="questionnaire"
        aria-labelledby="questionnaire-title"
        className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8"
      >
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <ClipboardList className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-widest text-primary">
                Étape 2 — Questionnaire de configuration
              </div>
              <h3
                id="questionnaire-title"
                className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
              >
                Configurez votre assistante Lucie
              </h3>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Remplissez ce formulaire directement ci-dessous — 5 minutes.
                Vos réponses lancent l'installation sous 72 h ouvrées.
              </p>
            </div>
          </div>
        </header>

        <PreparationForm plan={plan} intro={false} />
      </section>

      <ExportHistory />

      <section className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
        <header className="mb-4 flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <ListChecks className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-widest text-primary">
              Étape 3 — Timeline d'exploitation
            </div>
            <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
              Suivez le déploiement en temps réel
            </h3>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Dès le questionnaire envoyé, retrouvez ici le cadrage, la mise
              en production et la phase de test.
            </p>
          </div>
        </header>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="h-11 rounded-xl">
            <Link to="/preparation" search={{ plan }}>
              Ouvrir le questionnaire de préparation
            </Link>
          </Button>
          <Button asChild variant="ghost" className="h-11 rounded-xl">
            <Link to="/installation">
              Détails de l'installation
            </Link>
          </Button>
          <Button asChild variant="ghost" className="h-11 rounded-xl">
            <Link to="/faq">Questions fréquentes</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
