import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";
import { X, Check } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { StepNav } from "@/components/step-nav";
import { LockedPage } from "@/components/locked-page";
import { AccountGate } from "@/components/account-gate";
import { useJourneyAccess } from "@/lib/journey-access";

export const Route = createFileRoute("/demonstration")({
  head: () => ({
    meta: [
      { title: "Démonstration — Lucie Command Center" },
      {
        name: "description",
        content: "Comparez concrètement votre quotidien avant et après le déploiement de Lucie.",
      },
      { property: "og:title", content: "Démonstration — Lucie" },
      { property: "og:description", content: "Avant / après Lucie : la différence en une image." },
      { property: "og:url", content: "https://lucie-ai-command.lovable.app/demonstration" },
    ],
    links: [{ rel: "canonical", href: "https://lucie-ai-command.lovable.app/demonstration" }],
  }),
  component: Demonstration,
});

const BEFORE = [
  "Appels manqués",
  "Formulaires oubliés",
  "Rappels tardifs",
  "Temps perdu en admin",
  "Clients perdus",
];
const AFTER = [
  "Réponse immédiate en 1,2s",
  "Qualification automatique",
  "Prise de rendez-vous instantanée",
  "Résumés d'appels envoyés",
  "Suivi automatique post-appel",
];

function Demonstration() {
  return (
    <AccountGate step="Démonstration">
      <DemonstrationContent />
    </AccountGate>
  );
}

function DemonstrationContent() {
  const {
    canViewDemonstration,
    demoMeetingAt,
    demoUnlockAt,
    demoBookingStatusNorm,
    completeDemo,
  } = useJourneyAccess();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onContinue = async () => {
    setPending(true);
    setError(null);
    try {
      await completeDemo();
      await navigate({ to: "/offres" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  };

  if (!canViewDemonstration) {
    return (
      <LockedPage
        title="Démonstration verrouillée"
        step="Démonstration"
        meetingAt={demoMeetingAt}
        unlockAt={demoUnlockAt}
        bookingStatus={demoBookingStatusNorm}
        unlockNote="Votre démonstration sera accessible 15 minutes avant notre rendez-vous."
        description={
          demoMeetingAt
            ? "Votre démonstration sera accessible 15 minutes avant notre rendez-vous."
            : "Prenez d'abord votre créneau de démonstration depuis la recommandation."
        }
      />
    );
  }
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Étape 05 · Démonstration"
        title="Avant / après Lucie"
        description="Le quotidien commercial de vos équipes, transformé."
      />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="relative rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
          <div className="absolute right-6 top-6 rounded-full bg-destructive/10 px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-destructive">
            Sans Lucie
          </div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Situation actuelle
          </div>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            Le chaos silencieux
          </h3>
          <ul className="mt-8 space-y-3">
            {BEFORE.map((b) => (
              <li
                key={b}
                className="flex items-center gap-3 rounded-xl border border-border bg-background/60 px-4 py-3 text-sm text-muted-foreground"
              >
                <span className="grid h-6 w-6 place-items-center rounded-md bg-destructive/10 text-destructive">
                  <X className="h-3.5 w-3.5" />
                </span>
                <span className="line-through decoration-destructive/40">{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent p-8 shadow-[var(--shadow-elevated)]">
          <div className="absolute right-6 top-6 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-primary">
            Avec Lucie
          </div>
          <div className="text-[11px] uppercase tracking-widest text-primary">Après déploiement</div>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            Un pipeline maîtrisé
          </h3>
          <ul className="mt-8 space-y-3">
            {AFTER.map((a) => (
              <li
                key={a}
                className="flex items-center gap-3 rounded-xl border border-primary/15 bg-background px-4 py-3 text-sm text-foreground shadow-[var(--shadow-card)]"
              >
                <span className="grid h-6 w-6 place-items-center rounded-md bg-primary text-primary-foreground">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <section className="rounded-3xl border border-primary/20 bg-primary/[0.04] p-6 text-center sm:p-8">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Démonstration terminée ?
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Validez la fin de la démonstration pour débloquer vos offres et vos tarifs
          personnalisés.
        </p>
        <Button
          className="mt-5 min-h-11 rounded-xl"
          onClick={onContinue}
          disabled={pending}
          aria-label="Marquer la démonstration comme terminée et continuer vers mes offres"
        >
          {pending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : null}
          Continuer vers mes offres

          <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
        </Button>
        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
      </section>

      <StepNav current="/demonstration" />
    </div>
  );
}