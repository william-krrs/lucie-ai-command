import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, PhoneCall, Zap, Clock, Users, PhoneForwarded } from "lucide-react";
import * as React from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { StepNav } from "@/components/step-nav";
import { useLucie } from "@/lib/lucie-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Ton diagnostic Lucie" },
      {
        name: "description",
        content:
          "Combien d'appels tu perds, et ce que Lucie récupère.",
      },
      { property: "og:title", content: "Ton diagnostic Lucie" },
      {
        property: "og:description",
        content:
          "Combien d'appels tu perds, et ce que Lucie récupère.",
      },
      { property: "og:url", content: "https://diagnostic.lucieassistant.fr/" },
    ],
    links: [{ rel: "canonical", href: "https://diagnostic.lucieassistant.fr/" }],
  }),
  component: Home,
});

const STATS = [
  { icon: PhoneCall, label: "Appels décrochés", value: "186", trend: "100 % des appels, même sur chantier" },
  { icon: Clock, label: "Appels hors horaires", value: "41 %", trend: "soirs, week-ends, pause déjeuner" },
  { icon: Users, label: "Rendez-vous posés", value: "58", trend: "directement dans l'agenda" },
  { icon: PhoneForwarded, label: "Urgences transférées", value: "12", trend: "pannes chauffage en plein hiver" },
];

// Affiche le nom de l'entreprise avec une majuscule initiale à chaque mot.
function capitalizeWords(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function Home() {
  const { state } = useLucie();
  const rawCompany = state.companyName.trim();
  const entreprise = rawCompany && rawCompany !== rawCompany.toLowerCase() ? capitalizeWords(rawCompany) : "Thermo Services";
  return (
    <div className="space-y-14">
      <PageHeader
        title="Ton diagnostic Lucie"
        description="Combien d'appels tu perds, et ce que Lucie récupère."
      />

      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 md:p-12 shadow-[var(--shadow-card)]">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />

        <div className="relative grid gap-10 md:grid-cols-[1.15fr_1fr] md:items-center">
          <div className="min-w-0">
            <h2 className="text-4xl md:text-5xl font-semibold leading-[1.05] tracking-tight text-foreground">
              Tes appels ne restent plus <br />
              sans réponse.
            </h2>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              Lucie décroche 24h/24, qualifie la demande et pose le rendez-vous dans ton agenda.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="group h-12 rounded-xl px-6 shadow-[var(--shadow-elevated)]">
                <Link to="/diagnostic">
                  Commencer mon diagnostic
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="relative min-w-0 rounded-2xl border border-border bg-background/70 p-5 backdrop-blur">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[oklch(0.65_0.17_155)]" />
                <span className="text-xs font-medium text-foreground">Exemple d'appel entrant · Chauffage</span>
              </div>
              <span className="text-[11px] whitespace-nowrap text-muted-foreground">02 · 41 s</span>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <Bubble side="left">Bonjour, ici Lucie, l'assistante de {entreprise}. Je t'écoute.</Bubble>
              <Bubble side="right">Ma chaudière s'est mise en sécurité, plus d'eau chaude depuis ce matin.</Bubble>
              <Bubble side="left">D'accord. Quelle marque, et quel code s'affiche à l'écran ?</Bubble>
              <Bubble side="right">Saunier Duval, code F28.</Bubble>
              <Bubble side="left">Merci. Quelle est l'adresse ? Je peux faire passer un technicien demain à 8 h 30.</Bubble>
              <div className="rounded-xl border border-dashed border-border bg-card p-3 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-2 text-foreground">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  Rendez-vous enregistré — demain 8 h 30
                </div>
                Ajouté à l'agenda · compte rendu envoyé par e-mail : marque, code panne, adresse
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Exemple : une entreprise CVC de 3 techniciens, sur 1 mois — données d'illustration">
        <p className="mb-4 text-sm font-medium text-muted-foreground">Exemple : une entreprise CVC de 3 techniciens, sur 1 mois</p>
        <div data-vr="kpi-grid" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="group rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]"
            >
              <div className="flex items-center justify-between">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  Exemple
                </span>
              </div>
              <div className="mt-5 sm:mt-6 kpi-value-lg text-foreground break-words">{s.value}</div>
              <div className="mt-1.5 kpi-label truncate">{s.label}</div>
              <div className="mt-3 text-[11px] font-medium text-primary">{s.trend}</div>
            </div>
          );
        })}
        </div>
      </section>
      <StepNav current="/" />
    </div>
  );
}

function Bubble({ side, children }: { side: "left" | "right"; children: React.ReactNode }) {
  return (
    <div className={`flex ${side === "right" ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] break-words rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
          side === "right"
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
