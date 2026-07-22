import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, PhoneCall, Sparkles, Zap, Clock, Users, LineChart, Info } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { StepNav } from "@/components/step-nav";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SOCIAL_PROOF_COMPANY_COUNT } from "@/lib/config";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Accueil — Lucie" },
      {
        name: "description",
        content:
          "L'assistante IA qui répond à vos appels, qualifie vos prospects et vous aide à générer plus de chiffre d'affaires.",
      },
      { property: "og:title", content: "Accueil — Lucie" },
      {
        property: "og:description",
        content: "L'assistante IA qui répond à vos appels, qualifie vos prospects et vous aide à générer plus de chiffre d'affaires.",
      },
      { property: "og:url", content: "https://lucie-ai-command.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://lucie-ai-command.lovable.app/" }],
  }),
  component: Home,
});

const STATS = [
  { icon: PhoneCall, label: "Appels traités", value: "12 480", trend: "+34% ce mois" },
  { icon: Clock, label: "Temps de réponse", value: "1,2s", trend: "moyenne réseau" },
  { icon: Users, label: "Prospects qualifiés", value: "3 210", trend: "+128 cette semaine" },
  { icon: LineChart, label: "Taux de conversion", value: "42%", trend: "vs 18% humain" },
];

function Home() {
  return (
    <div className="space-y-14">
      <PageHeader
        eyebrow="Bienvenue"
        title="Lucie Command Center"
        description="L'assistante IA qui répond à vos appels, qualifie vos prospects et vous aide à générer plus de chiffre d'affaires."
      />

      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 md:p-12 shadow-[var(--shadow-card)]">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />

        <div className="relative grid gap-10 md:grid-cols-[1.15fr_1fr] md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Nouvelle génération d'assistante IA
            </div>
            <h2 className="mt-5 text-4xl md:text-5xl font-semibold leading-[1.05] tracking-tight text-foreground">
              Ne perdez plus jamais <br />
              un appel entrant.
            </h2>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              Lucie répond en 1,2 seconde, qualifie chaque prospect, prend les rendez-vous et
              synchronise votre agenda. Vous récupérez le chiffre d'affaires que vos concurrents
              laissent filer.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="group h-12 rounded-xl px-6 shadow-[var(--shadow-elevated)]">
                <Link to="/diagnostic">
                  Commencer le diagnostic
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="h-12 rounded-xl">
                <Link to="/demonstration">Voir la démonstration</Link>
              </Button>
            </div>

            <div className="mt-8 flex items-center gap-6 text-xs text-muted-foreground">
              <div className="flex -space-x-2">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-7 w-7 rounded-full border-2 border-card"
                    style={{
                      background: `linear-gradient(135deg, oklch(0.7 0.15 ${200 + i * 20}), oklch(0.55 0.22 264))`,
                    }}
                  />
                ))}
              </div>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-help items-center gap-1 underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" tabIndex={0}>
                      +25 entreprises utilisent Lucie au quotidien
                      <Info className="h-3 w-3 text-muted-foreground/80" aria-hidden="true" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="start" className="max-w-[260px] text-xs leading-relaxed">
                    Chiffre basé sur les entreprises actives utilisant Lucie pour répondre à leurs appels entrants et qualifier leurs prospects en direct.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <div className="relative rounded-2xl border border-border bg-background/70 p-5 backdrop-blur">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[oklch(0.65_0.17_155)]" />
                <span className="text-xs font-medium text-foreground">Appel entrant · N°23</span>
              </div>
              <span className="text-[11px] text-muted-foreground">01 · 12 s</span>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <Bubble side="left">Bonjour, je m'appelle Lucie, l'assistante de Spark Media. Comment puis-je vous aider ?</Bubble>
              <Bubble side="right">Je cherche un devis pour une prestation SEO.</Bubble>
              <Bubble side="left">Parfait, je note. Vous êtes plutôt B2B ou B2C, et sur quel budget mensuel ?</Bubble>
              <div className="rounded-xl border border-dashed border-border bg-card p-3 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-2 text-foreground">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  Rendez-vous proposé — Mardi 14h30
                </div>
                Envoyé sur l'agenda commercial · SMS de confirmation
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                  Live
                </span>
              </div>
              <div className="mt-6 text-2xl font-semibold tracking-tight tabular-nums">{s.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
              <div className="mt-3 text-[11px] text-primary">{s.trend}</div>
            </div>
          );
        })}
      </section>
      <StepNav current="/" />
    </div>
  );
}

function Bubble({ side, children }: { side: "left" | "right"; children: React.ReactNode }) {
  return (
    <div className={`flex ${side === "right" ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
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
