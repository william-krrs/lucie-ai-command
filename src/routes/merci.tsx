import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import {
  CheckCircle2,
  Calendar,
  Mail,
  ArrowRight,
  Clock,
  Wrench,
  Package,
} from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";

const planSearchSchema = z.object({
  plan: z.enum(["essential", "pro", "premium"]).optional(),
});

const PLAN_LABELS: Record<string, string> = {
  essential: "Lucie Essential",
  pro: "Lucie Pro",
  premium: "Lucie Premium",
};

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

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Paiement confirmé"
        title="Merci — bienvenue chez Lucie"
        description="Votre paiement a bien été reçu. Notre équipe prend le relais pour lancer votre installation."
      />

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

      <section className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Prochaine étape
            </div>
            <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
              Passez à l'installation de Lucie
            </h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Suivez le déroulement étape par étape et retrouvez les informations sur votre formule en cours de route.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <Button
              asChild
              className="h-12 w-full rounded-xl bg-primary px-6 text-base text-primary-foreground shadow-[var(--shadow-elevated)] hover:bg-primary/90 sm:w-auto"
            >
              <Link to="/installation" search={{ plan }}>
                Continuer vers l'installation
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="ghost" className="h-9 rounded-lg text-xs text-muted-foreground hover:text-foreground">
                <Link to="/faq">Questions fréquentes</Link>
              </Button>
              <Button asChild variant="ghost" className="h-9 rounded-lg text-xs text-muted-foreground hover:text-foreground">
                <Link to="/offres">← Retour aux offres</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
