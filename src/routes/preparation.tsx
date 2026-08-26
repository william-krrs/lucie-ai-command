import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PageHeader } from "@/components/app-shell";
import { PreparationForm } from "@/components/preparation-form";
import { LockedPage } from "@/components/locked-page";
import { useJourneyAccess } from "@/lib/journey-access";

const searchSchema = z.object({
  plan: z.enum(["essential", "pro", "premium"]).optional(),
});

const PLAN_LABELS: Record<string, string> = {
  essential: "Lucie Essential",
  pro: "Lucie Pro",
  premium: "Lucie Premium",
};

export const Route = createFileRoute("/preparation")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Configuration personnalisée | Lucie" },
      {
        name: "description",
        content:
          "Formulaire de configuration personnalisée après paiement : renseignez vos informations pour lancer l'installation de Lucie sous 72 h.",
      },
      {
        property: "og:title",
        content: "Configuration personnalisée | Lucie",
      },
      {
        property: "og:description",
        content:
          "Renseignez votre entreprise et vos préférences pour accélérer le lancement.",
      },
      {
        property: "og:url",
        content: "https://lucie-ai-command.lovable.app/preparation",
      },
      { name: "robots", content: "noindex" },
    ],
    links: [
      {
        rel: "canonical",
        href: "https://lucie-ai-command.lovable.app/preparation",
      },
    ],
  }),
  component: Preparation,
});

function Preparation() {
  const { plan } = Route.useSearch();
  const { canConfigure } = useJourneyAccess();
  const planLabel = plan ? PLAN_LABELS[plan] : "Non précisée";

  if (!canConfigure) {
    return (
      <LockedPage
        title="Configuration verrouillée"
        step="Configuration personnalisée"
        description="La configuration personnalisée se débloque dès que votre paiement est confirmé par notre système."
        waitingFor="step"
        waitingTitle="Paiement en attente de confirmation"
        waitingText="Dès que votre paiement est confirmé, le formulaire de configuration s'ouvre automatiquement sur cette page."
        backTo="/offres"
        backLabel="Revoir les offres"
      />
    );
  }


  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Étape 08 · Configuration — Formule ${planLabel}`}
        title="Configuration personnalisée"
        description="Un formulaire sur mesure pour tout centraliser. Une fois validé, votre assistante sera prête pour une phase de test sous 72 h ouvrées."
      />
      <PreparationForm plan={plan} />
    </div>
  );
}