import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PageHeader } from "@/components/app-shell";
import { PreparationForm } from "@/components/preparation-form";

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
      { title: "Préparation de votre assistante IA | Lucie" },
      {
        name: "description",
        content:
          "Formulaire de configuration après paiement : renseignez vos informations pour lancer l'installation de Lucie sous 72 h.",
      },
      {
        property: "og:title",
        content: "Préparation de votre assistante IA | Lucie",
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
  const planLabel = plan ? PLAN_LABELS[plan] : "Non précisée";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Formule ${planLabel}`}
        title="Préparation de votre assistante IA"
        description="Un formulaire unique pour tout centraliser. Une fois validé, votre assistante sera prête pour une phase de test sous 72 h ouvrées."
      />
      <PreparationForm plan={plan} />
    </div>
  );
}