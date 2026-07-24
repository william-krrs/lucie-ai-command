import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { StepNav } from "@/components/step-nav";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "Questions fréquentes — Lucie Command Center" },
      {
        name: "description",
        content: "Toutes les réponses sur le fonctionnement, la sécurité et la mise en place de Lucie.",
      },
      { property: "og:title", content: "FAQ — Lucie" },
      { property: "og:description", content: "Les réponses aux questions les plus fréquentes sur Lucie." },
      { property: "og:url", content: "https://lucie-ai-command.lovable.app/faq" },
    ],
    links: [{ rel: "canonical", href: "https://lucie-ai-command.lovable.app/faq" }],
  }),
  component: Faq,
});

const QUESTIONS = [
  {
    q: "Comment fonctionne Lucie ?",
    a: "Lucie est une assistante IA vocale connectée à votre ligne téléphonique. Elle décroche à chaque appel entrant, comprend la demande, qualifie le prospect, prend un rendez-vous dans votre agenda et vous envoie un résumé structuré.",
  },
  {
    q: "Puis-je garder mon numéro ?",
    a: "Oui. Nous mettons en place soit un renvoi d'appel depuis votre numéro actuel, soit un portage complet. Aucun changement pour vos clients.",
  },
  {
    q: "Puis-je changer de formule ?",
    a: "Oui, vous pouvez passer d'Essential à Pro ou Premium à tout moment. Le changement est effectif immédiatement, sans coupure de service.",
  },
  {
    q: "Combien de temps pour l'installation ?",
    a: "Entre 5 et 10 jours ouvrés selon la complexité de vos workflows et le nombre de scénarios à couvrir. Vous recevez un planning précis dès la signature.",
  },
  {
    q: "Comment sont protégées les données ?",
    a: "Toutes les conversations sont chiffrées de bout en bout, stockées dans l'Union européenne, et conformes RGPD. Vous restez propriétaire de vos données à 100%.",
  },
  {
    q: "Lucie parle-t-elle plusieurs langues ?",
    a: "Oui : jusqu'à 6 langues en formule Pro (français, anglais, espagnol, allemand, italien, néerlandais). D'autres langues sont disponibles sur devis en Premium.",
  },
];

function Faq() {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Étape 06 · FAQ"
        title="Questions fréquentes"
        description="Les points que vos équipes et vos clients nous demandent le plus souvent."
      />

      <section
        data-vr="faq"
        aria-label="Liste des questions fréquentes"
        className="rounded-3xl border border-border bg-card p-4 md:p-6 shadow-[var(--shadow-card)]"
      >
        <Accordion type="single" collapsible className="w-full">
          {QUESTIONS.map((item, i) => (
            <AccordionItem key={item.q} value={`q-${i}`} className="border-border">
              <AccordionTrigger
                aria-label={`Question ${i + 1} : ${item.q}`}
                className="text-left text-base font-medium text-foreground hover:no-underline"
              >
                <span aria-hidden="true" className="mr-3 text-xs font-mono tabular-nums text-muted-foreground">
                  0{i + 1}
                </span>
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <footer className="mt-16 rounded-3xl border border-border bg-card p-6 md:p-8 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Spark Media Marketing
            </div>
            <div className="text-sm font-medium text-foreground">
              Lucie — Assistante IA commerciale
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Spark Media Marketing. Tous droits réservés.
          </div>
        </div>
      </footer>
      <StepNav current="/faq" />
    </div>
  );
}