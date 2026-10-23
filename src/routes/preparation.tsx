import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PageHeader } from "@/components/app-shell";
import { PreparationForm } from "@/components/preparation-form";
import { LockedPage } from "@/components/locked-page";
import { AccountGate } from "@/components/account-gate";
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Configuration personnalisée | Lucie" },
      {
        name: "description",
        content:
          "Formulaire de configuration personnalisée après paiement : renseigne tes informations pour lancer l'installation de Lucie en 96 h.",
      },
      {
        property: "og:title",
        content: "Configuration personnalisée | Lucie",
      },
      {
        property: "og:description",
        content:
          "Renseigne ton entreprise et tes préférences pour accélérer le lancement.",
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
  return (
    <AccountGate afterPayment step="Configuration personnalisée">
      <PreparationContent />
    </AccountGate>
  );
}

function PreparationContent() {
  const { plan } = Route.useSearch();
  const { canConfigure } = useJourneyAccess();
  const planLabel = plan ? PLAN_LABELS[plan] : "Non précisée";

  if (!canConfigure) {
    return (
      <LockedPage
        title="Configuration verrouillée"
        step="Configuration personnalisée"
        description="La configuration personnalisée se débloque dès que ton paiement est confirmé par notre système."
        waitingFor="step"
        waitingTitle="Paiement en attente de confirmation"
        waitingText="Dès que ton paiement est confirmé, le formulaire de configuration s'ouvre automatiquement sur cette page."
        backTo="/offres"
        backLabel="Revoir les offres"
      />
    );
  }


  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Étape 4 · Mise en place — Formule ${planLabel}`}
        title="Configuration personnalisée"
        description="Un formulaire sur mesure pour tout centraliser. Une fois validé, ton assistante sera prête pour une phase de test en 96 h."
      />
      <PreparationForm plan={plan} />
    </div>
  );
}