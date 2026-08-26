import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Check,
  Star,
  Sparkles,
  Crown,
  Wrench,
  Clock,
  ShieldCheck,
  ArrowRight,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StepNav } from "@/components/step-nav";
import { useRecommendation } from "@/lib/lucie-store";
import { PLAN_LABELS, PLAN_TAGLINES, TIER_LABELS, PRIORITY_CTA } from "@/lib/recommendation";
import { LockedPage } from "@/components/locked-page";
import { useJourneyAccess } from "@/lib/journey-access";
import { BOOKING_URL_SETUP } from "@/lib/config";
import { useUniqueModule, MODULE_IDS } from "@/lib/module-registry";

export const Route = createFileRoute("/offres")({
  head: () => ({
    meta: [
      { title: "Offres — Lucie Command Center" },
      {
        name: "description",
        content: "Trois formules simples : Essential, Pro et Premium. Choisissez celle qui correspond à votre volume.",
      },
      { property: "og:title", content: "Offres & tarifs — Lucie" },
      { property: "og:description", content: "Essential, Pro, Premium — 3 formules pour Lucie." },
      { property: "og:url", content: "https://lucie-ai-command.lovable.app/offres" },
    ],
    links: [{ rel: "canonical", href: "https://lucie-ai-command.lovable.app/offres" }],
  }),
  component: Offres,
});

type PlanKey = "essential" | "pro" | "premium";

const STRIPE_LINKS: Record<PlanKey, string> = {
  essential: "https://buy.stripe.com/6oUdR940v8xB9C8cyq7kc0b",
  pro: "https://buy.stripe.com/3cI8wP68DeVZg0waqi7kc0a",
  premium: "https://buy.stripe.com/5kQ5kD0OjcNRbKggOG7kc0d",
};

const PLANS: {
  key: PlanKey;
  name: string;
  price: string;
  badge: string;
  badgeTone: "neutral" | "brand" | "dark";
  icon: React.ComponentType<{ className?: string }>;
  tagline: string;
  features: string[];
  cta: string;
}[] = [
  {
    key: "essential",
    name: "Essential",
    price: "149 €",
    badge: "Entrée de gamme",
    badgeTone: "neutral",
    icon: Sparkles,
    tagline: PLAN_TAGLINES.essential,
    features: [
      "Réponse aux appels",
      "Qualification",
      "Prise de rendez-vous",
      "Agenda",
      "Résumé par mail",
      "Historique des appels",
      "Support standard",
    ],
    cta: "Choisir Essential",
  },
  {
    key: "pro",
    name: "Pro",
    price: "399 €",
    badge: "⭐ La plus choisie",
    badgeTone: "brand",
    icon: Star,
    tagline: PLAN_TAGLINES.pro,
    features: [
      "Tout Essential",
      "Personnalisation avancée",
      "Jusqu'à 6 langues",
      "Transfert d'appel",
      "Voix personnalisée",
      "Connexion emails",
      "Mémoire avancée",
      "Support prioritaire",
    ],
    cta: "Choisir Pro",
  },
  {
    key: "premium",
    name: "Premium",
    price: "990 €",
    badge: "Grandes entreprises",
    badgeTone: "dark",
    icon: Crown,
    tagline: PLAN_TAGLINES.premium,
    features: [
      "Tout Pro",
      "CRM",
      "Campagnes d'appels sortants",
      "Multi-sites",
      "Multi-numéros",
      "Automatisations avancées",
      "Support Premium",
    ],
    cta: "Choisir Premium",
  },
];

const COMPARISON: { label: string; values: Record<PlanKey, string | boolean> }[] = [
  { label: "Réponse appels", values: { essential: true, pro: true, premium: true } },
  { label: "Appels sortants", values: { essential: false, pro: false, premium: true } },
  { label: "Agenda", values: { essential: true, pro: true, premium: true } },
  { label: "Emails", values: { essential: false, pro: true, premium: true } },
  { label: "WhatsApp", values: { essential: false, pro: true, premium: true } },
  { label: "CRM", values: { essential: false, pro: false, premium: true } },
  { label: "Multi-sites", values: { essential: false, pro: false, premium: true } },
  { label: "Voix personnalisée", values: { essential: false, pro: true, premium: true } },
  { label: "Multilingue", values: { essential: "1", pro: "6", premium: "12+" } },
  { label: "Support", values: { essential: "Standard", pro: "Prioritaire", premium: "Premium 24/7" } },
];

function Offres() {
  useUniqueModule(MODULE_IDS.paymentPlans);
  const rec = useRecommendation();
  const { canViewOffers } = useJourneyAccess();
  const recommendedPlan: PlanKey = rec.plan ?? "pro";
  const [selected, setSelected] = useState<PlanKey>(recommendedPlan);

  // Keep the highlighted card in sync when the diagnostic changes.
  useEffect(() => {
    setSelected(recommendedPlan);
  }, [recommendedPlan]);

  if (!canViewOffers) {
    return (
      <LockedPage
        title="Offres verrouillées"
        step="Offres & pricing"
        description="Les offres se débloquent une fois votre démonstration terminée."
        waitingFor="step"
        waitingTitle="Démonstration à valider"
        waitingText="Rendez-vous sur la page Démonstration et validez « Continuer vers mes offres » pour débloquer cette étape."
        backTo="/demonstration"
        backLabel="Aller à la démonstration"
      />

    );
  }

  const isRefusal = rec.tier === "refuse";
  const cta = PRIORITY_CTA[rec.priority];

  return (
    <div className="space-y-14">
      <PageHeader
        eyebrow="Étape 06 · Offres"
        title="Notre recommandation"
        description="Trois formules, une même exigence. La formule mise en avant est déterminée automatiquement par votre diagnostic."
      />

      <section
        aria-labelledby="reco-inline-title"
        className={cn(
          "rounded-3xl border p-5 shadow-[var(--shadow-card)] sm:p-6",
          isRefusal
            ? "border-destructive/30 bg-destructive/[0.05]"
            : "border-primary/25 bg-primary/[0.05]",
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div
              className={cn(
                "text-[11px] font-medium uppercase tracking-widest",
                isRefusal ? "text-destructive" : "text-primary",
              )}
            >
              <span aria-hidden="true">{cta.emoji}</span> Score {rec.score}/100 ·{" "}
              {TIER_LABELS[rec.tier]} · {cta.eyebrow}
            </div>
            <h2
              id="reco-inline-title"
              className="mt-1 text-base font-semibold tracking-tight text-foreground sm:text-lg"
            >
              {isRefusal
                ? "Nous ne recommandons pas de formule pour l'instant."
                : `Formule recommandée : ${PLAN_LABELS[recommendedPlan]}`}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {isRefusal
                ? "Après analyse, Lucie n'apporterait pas suffisamment de valeur aujourd'hui. Nous préférons être transparents plutôt que de vendre une solution inadaptée."
                : `${rec.planReason} ${cta.description}`}
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/recommandation">
              {isRefusal ? "Voir le diagnostic complet" : cta.primaryLabel}{" "}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <div data-vr="pricing-cards" className="grid items-stretch gap-6 lg:grid-cols-3">
        {PLANS.map((p) => {
          const active = selected === p.key;
          const Icon = p.icon;
          const featured = p.key === recommendedPlan && !isRefusal;
          return (
            <div
              key={p.key}
              onClick={() => setSelected(p.key)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(p.key);
                }
              }}
              className={cn(
                "group relative flex flex-col rounded-3xl border p-7 text-left transition-all duration-300",
                "shadow-[var(--shadow-card)] hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)]",
                featured ? "lg:-my-4 lg:py-9" : "",
                active
                  ? "border-primary bg-card ring-2 ring-primary/30"
                  : "border-border bg-card",
              )}
            >
              {featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-primary-foreground shadow-[var(--shadow-elevated)] animate-fade-in">
                  <Sparkles className="h-3 w-3" aria-hidden="true" /> Notre recommandation
                </span>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-xl",
                      p.key === "premium"
                        ? "bg-foreground text-background"
                        : p.key === "pro"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="text-lg font-semibold tracking-tight text-foreground">
                    {p.name}
                  </div>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                    p.badgeTone === "brand"
                      ? "bg-primary/10 text-primary"
                      : p.badgeTone === "dark"
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {p.badge}
                </span>
              </div>

              <div className="mt-6 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                <span className="kpi-value-xl text-foreground">{p.price}</span>
                <span className="text-sm text-muted-foreground">/mois TTC</span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{p.tagline}</p>

              <ul className="mt-6 flex-1 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <Check className="h-3 w-3" />
                    </span>
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                className={cn(
                  "mt-7 h-11 rounded-xl transition-all",
                  featured
                    ? "bg-primary text-primary-foreground shadow-[var(--shadow-elevated)] hover:bg-primary/90"
                    : "bg-foreground text-background hover:bg-foreground/90",
                )}
              >
                <a
                  href={STRIPE_LINKS[p.key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  {p.cta}
                </a>
              </Button>
            </div>
          );
        })}
      </div>

      <section
        aria-labelledby="installation-included"
        className="rounded-3xl border border-primary/20 bg-primary/[0.04] p-6 shadow-[var(--shadow-card)] sm:p-8"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Wrench className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-widest text-primary">
                Installation incluse
              </div>
              <h2
                id="installation-included"
                className="mt-1 text-lg font-semibold tracking-tight text-foreground sm:text-xl"
              >
                Frais d'installation de 490 € inclus
              </h2>
              <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
                Le paramétrage complet de Lucie, la connexion à vos outils et la mise en production sont désormais inclus dans chaque formule. Installation en 3 à 5 jours selon la complexité de votre activité.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  Installation en 3 à 5 jours selon la complexité
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Paiement sécurisé Stripe
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="rdv-test-title"
        className="rounded-3xl border border-primary/20 bg-primary/[0.04] p-6 shadow-[var(--shadow-card)] sm:p-8"
      >
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Calendar className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-widest text-primary">
                Rendez-vous test
              </div>
              <h2
                id="rdv-test-title"
                className="mt-1 text-lg font-semibold tracking-tight text-foreground sm:text-xl"
              >
                Vous préférez être accompagné avant de choisir ?
              </h2>
              <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
                Réservez un rendez-vous test gratuit avec l'équipe Lucie. On vous présente la solution, on répond à vos questions et on valide ensemble la formule adaptée.
              </p>
            </div>
          </div>
          <Button
            asChild
            className="h-11 shrink-0 rounded-xl bg-primary text-primary-foreground shadow-[var(--shadow-elevated)] hover:bg-primary/90"
          >
            <a
              href={BOOKING_URL_SETUP}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Prendre rendez-vous test avec Lucie (ouvre un nouvel onglet)"
            >
              Prendre un RDV test
              <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
            </a>
          </Button>
        </div>
      </section>

      <section>
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Comparateur
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Comparez les fonctionnalités
            </h2>
            <div className="mt-1 text-xs text-muted-foreground sm:hidden">
              Formule sélectionnée :{" "}
              <span className="font-medium text-primary">
                {PLANS.find((p) => p.key === selected)?.name}
              </span>
            </div>
          </div>
          <div className="hidden text-xs text-muted-foreground sm:block">
            Formule sélectionnée :{" "}
            <span className="font-medium text-primary">
              {PLANS.find((p) => p.key === selected)?.name}
            </span>
          </div>
        </div>

        <div data-vr="comparison-table" className="relative -mx-4 sm:mx-0">
          <div className="overflow-x-auto overscroll-x-contain rounded-3xl border border-border bg-card shadow-[var(--shadow-card)]">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="sticky left-0 top-16 z-40 border-r border-border bg-card px-4 py-4 text-left text-[11px] font-medium uppercase tracking-widest text-muted-foreground shadow-[2px_0_0_0_hsl(var(--border))] sm:top-0 sm:px-5">
                    Fonctionnalité
                  </th>
                  {PLANS.map((p) => (
                    <th
                      key={p.key}
                      onClick={() => setSelected(p.key)}
                      className={cn(
                        "sticky top-16 z-20 cursor-pointer px-4 py-4 text-center text-[11px] font-medium uppercase tracking-widest transition-colors sm:top-0 sm:px-5",
                        selected === p.key
                          ? "bg-primary/10 text-primary"
                          : "bg-muted/40 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr
                    key={row.label}
                    className={cn(
                      "border-b border-border last:border-0 transition-colors",
                      i % 2 === 1 ? "bg-muted/20" : "bg-card",
                    )}
                  >
                    <td className="sticky left-0 z-10 border-r border-border bg-card px-4 py-3.5 text-foreground sm:px-5">
                      {row.label}
                    </td>
                    {PLANS.map((p) => {
                      const v = row.values[p.key];
                      return (
                        <td
                          key={p.key}
                          className={cn(
                            "px-4 py-3.5 text-center transition-colors sm:px-5",
                            selected === p.key ? "bg-primary/[0.06]" : "",
                          )}
                        >
                          {typeof v === "boolean" ? (
                            v ? (
                              <span className="mx-auto grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-primary">
                                <Check className="h-3.5 w-3.5" />
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )
                          ) : (
                            <span className="font-medium text-foreground">{v}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card/80 to-transparent sm:hidden" />
        </div>
      </section>
      <StepNav current="/offres" />
    </div>
  );
}