import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Star, Sparkles, Crown } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    ],
  }),
  component: Offres,
});

type PlanKey = "essential" | "pro" | "premium";

const PLANS: {
  key: PlanKey;
  name: string;
  price: string;
  badge: string;
  badgeTone: "neutral" | "brand" | "dark";
  icon: React.ComponentType<{ className?: string }>;
  features: string[];
  cta: string;
  featured?: boolean;
}[] = [
  {
    key: "essential",
    name: "Essential",
    price: "149 €",
    badge: "Entrée de gamme",
    badgeTone: "neutral",
    icon: Sparkles,
    features: [
      "Réponse aux appels",
      "Qualification",
      "Prise de rendez-vous",
      "Agenda",
      "Résumé par mail",
      "Historique des appels",
      "≈ 3h30 de conversation incluses",
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
    featured: true,
  },
  {
    key: "premium",
    name: "Premium",
    price: "990 €",
    badge: "Grandes entreprises",
    badgeTone: "dark",
    icon: Crown,
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
  { label: "Minutes incluses", values: { essential: "≈ 3h30", pro: "≈ 12h", premium: "Illimité" } },
];

function Offres() {
  const [selected, setSelected] = useState<PlanKey>("pro");

  return (
    <div className="space-y-14">
      <PageHeader
        eyebrow="Étape 05 · Offres"
        title="Choisissez votre formule"
        description="Trois formules, une même exigence. Vous pouvez changer à tout moment."
      />

      <div className="grid items-stretch gap-6 lg:grid-cols-3">
        {PLANS.map((p) => {
          const active = selected === p.key;
          const Icon = p.icon;
          const featured = p.featured;
          return (
            <button
              key={p.key}
              onClick={() => setSelected(p.key)}
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
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-primary-foreground shadow-[var(--shadow-elevated)]">
                  Recommandé
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

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight tabular-nums text-foreground">
                  {p.price}
                </span>
                <span className="text-sm text-muted-foreground">/mois TTC</span>
              </div>

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
                className={cn(
                  "mt-7 h-11 rounded-xl transition-all",
                  featured
                    ? "bg-primary text-primary-foreground shadow-[var(--shadow-elevated)] hover:bg-primary/90"
                    : "bg-foreground text-background hover:bg-foreground/90",
                )}
              >
                {p.cta}
              </Button>
            </button>
          );
        })}
      </div>

      <section>
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Comparateur
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              Comparez les fonctionnalités
            </h2>
          </div>
          <div className="hidden sm:block text-xs text-muted-foreground">
            Formule sélectionnée :{" "}
            <span className="font-medium text-primary">
              {PLANS.find((p) => p.key === selected)?.name}
            </span>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-card)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-5 py-4 text-left text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                  Fonctionnalité
                </th>
                {PLANS.map((p) => (
                  <th
                    key={p.key}
                    onClick={() => setSelected(p.key)}
                    className={cn(
                      "cursor-pointer px-5 py-4 text-center text-[11px] font-medium uppercase tracking-widest transition-colors",
                      selected === p.key
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground",
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
                    i % 2 === 1 ? "bg-muted/20" : "",
                  )}
                >
                  <td className="px-5 py-3.5 text-foreground">{row.label}</td>
                  {PLANS.map((p) => {
                    const v = row.values[p.key];
                    return (
                      <td
                        key={p.key}
                        className={cn(
                          "px-5 py-3.5 text-center transition-colors",
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
      </section>
    </div>
  );
}