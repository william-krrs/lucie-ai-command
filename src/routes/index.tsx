import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, PhoneCall, Sparkles, Zap, Clock, Users, PhoneForwarded, Info, MapPin, Building2, ExternalLink } from "lucide-react";
import * as React from "react";
import type { KeyboardEvent } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { StepNav } from "@/components/step-nav";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { getLogoStatus, setLogoStatus, logoCacheKey } from "@/lib/logo-cache";
import { useLucie } from "@/lib/lucie-store";

type LogoStatus = "loading" | "loaded" | "error";

function CompanyLogo({
  domain,
  logoUrl,
  initials,
  hue,
  alt,
  size = 64,
  className = "",
}: {
  domain: string | null;
  logoUrl?: string | null;
  initials: string;
  hue: number;
  alt: string;
  size?: number;
  className?: string;
}) {
  const source = logoUrl?.trim() || (domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}` : null);
  const cacheKey = logoUrl?.trim() ? logoCacheKey(logoUrl, size) : domain ? logoCacheKey(domain, size) : null;
  const [status, setStatus] = React.useState<LogoStatus>(source ? "loading" : "error");

  // Le cache est lu après hydratation pour garder un rendu SSR/client identique.
  React.useEffect(() => {
    if (!source || !cacheKey) return;
    const cached = getLogoStatus(cacheKey);
    if (cached) setStatus(cached);
  }, [source, cacheKey]);

  const updateStatus = (next: "loaded" | "error") => {
    setStatus(next);
    if (cacheKey) setLogoStatus(cacheKey, next);
  };

  const showFallback = !source || status === "error";
  const fallbackStyle = showFallback
    ? { background: `linear-gradient(135deg, oklch(0.62 0.16 ${hue}), oklch(0.45 0.2 ${hue + 30}))` }
    : undefined;

  return (
    <span
      className={`relative block h-full w-full ${showFallback ? "text-white" : "bg-white"}`}
      style={fallbackStyle}
      title={alt}
    >
      {source && status !== "error" && (
        <>
          {status === "loading" && (
            <span
              aria-hidden="true"
              className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted via-muted/60 to-muted"
            />
          )}
          <img
            src={source}
            alt={alt}
            loading="lazy"
            decoding="async"
            width={size}
            height={size}
            onLoad={() => updateStatus("loaded")}
            onError={() => updateStatus("error")}
            className={`relative h-full w-full object-cover transition-opacity duration-300 ${
              status === "loaded" ? "opacity-100" : "opacity-0"
            } ${className}`}
          />
        </>
      )}
      {showFallback && (
        <span className="absolute inset-0 grid place-items-center font-semibold" aria-label={alt}>
          {initials}
        </span>
      )}
    </span>
  );
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  { icon: PhoneCall, label: "Appels décrochés", value: "186", trend: "100 % des appels, même sur chantier" },
  { icon: Clock, label: "Appels hors horaires", value: "41 %", trend: "soirs, week-ends, pause déjeuner" },
  { icon: Users, label: "Rendez-vous posés", value: "58", trend: "directement dans l'agenda" },
  { icon: PhoneForwarded, label: "Urgences transférées", value: "12", trend: "pannes chauffage en plein hiver" },
];

type Company = {
  name: string;
  sector: string;
  city: string;
  summary: string;
  domain: string | null;
  /** URL directe vers le logo officiel (png/jpg/svg). Si absent, on tente le favicon via Google. */
  logoUrl?: string | null;
  initials: string;
  hue: number;
};

// Pour utiliser un logo officiel personnalisé, ajoutez `logoUrl: "https://..."` dans l'objet entreprise.
// Si logoUrl est absent, le logo est récupéré automatiquement via le favicon du domaine.
const COMPANIES: Company[] = [
  {
    name: "Exemple · Salle de sport",
    sector: "Salles de sport · Fitness",
    city: "Exemple fictif",
    summary:
      "Exemple fictif : Lucie pourrait orienter les demandes d'inscription et renseigner les appelants d'une salle de sport.",
    domain: null,
    initials: "SP",
    hue: 12,
  },
  {
    name: "Exemple · Artisan électricien",
    sector: "Électricité · Photovoltaïque",
    city: "Exemple fictif",
    summary:
      "Exemple fictif : Lucie pourrait qualifier les demandes de devis d'un artisan électricien pendant ses chantiers et proposer un rendez-vous.",
    domain: null,
    initials: "EL",
    hue: 220,
  },
  {
    name: "Exemple · Conciergerie",
    sector: "Conciergerie & location saisonnière",
    city: "Exemple fictif",
    summary:
      "Exemple fictif : Lucie pourrait renseigner les propriétaires et locataires d'une conciergerie et organiser les demandes d'intervention.",
    domain: null,
    initials: "CO",
    hue: 300,
  },
  {
    name: "Exemple · Climatisation",
    sector: "Climatisation & réfrigération",
    city: "Exemple fictif",
    summary:
      "Exemple fictif : Lucie pourrait répondre immédiatement, 24h/24, aux demandes de dépannage en climatisation et qualifier les pannes.",
    domain: null,
    initials: "CL",
    hue: 170,
  },
  {
    name: "Exemple · Maçonnerie",
    sector: "Maçonnerie & rénovation",
    city: "Exemple fictif",
    summary:
      "Exemple fictif : Lucie pourrait recueillir les demandes de devis d'une entreprise de maçonnerie pendant les chantiers.",
    domain: null,
    initials: "MA",
    hue: 30,
  },
  {
    name: "Exemple · Paysagiste",
    sector: "Paysagisme & entretien de jardins",
    city: "Exemple fictif",
    summary:
      "Exemple fictif : Lucie pourrait qualifier les projets de création, d'entretien ou d'élagage avant de proposer un rendez-vous.",
    domain: null,
    initials: "PA",
    hue: 140,
  },
  {
    name: "Exemple · Rénovation",
    sector: "Rénovation & multi-services",
    city: "Exemple fictif",
    summary:
      "Exemple fictif : Lucie pourrait centraliser les demandes de dépannage et proposer des rendez-vous pour une entreprise de rénovation.",
    domain: null,
    initials: "RE",
    hue: 260,
  },
];

function Home() {
  const { state } = useLucie();
  const entreprise = state.companyName.trim() || "votre entreprise";
  const [selected, setSelected] = React.useState<Company | null>(null);
  return (
    <div className="space-y-14">
      <PageHeader
        eyebrow="Étape 01 · Accueil"
        title="Lucie Command Center"
        description="L'assistante IA qui répond à vos appels, qualifie vos prospects et vous aide à générer plus de chiffre d'affaires."
      />

      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 md:p-12 shadow-[var(--shadow-card)]">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />

        <div className="relative grid gap-10 md:grid-cols-[1.15fr_1fr] md:items-center">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Nouvelle génération d'assistante IA
            </div>
            <h2 className="mt-5 text-4xl md:text-5xl font-semibold leading-[1.05] tracking-tight text-foreground">
              Vos appels ne restent plus <br />
              sans réponse.
            </h2>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              Lucie répond immédiatement, 24h/24, se présente comme une assistante IA, qualifie
              les demandes, prend les rendez-vous et synchronise votre agenda. Vous restez
              disponible pour votre activité.
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
              <TooltipProvider delayDuration={150}>
                <ul
                  role="list"
                  aria-label="Exemples fictifs de secteurs d’activité"
                  className="flex -space-x-2"
                  onKeyDown={(e: KeyboardEvent<HTMLUListElement>) => {
                    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
                    if (!keys.includes(e.key)) return;
                    const buttons = Array.from(
                      e.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-badge="1"]')
                    );
                    const idx = buttons.indexOf(document.activeElement as HTMLButtonElement);
                    if (idx === -1) return;
                    e.preventDefault();
                    let next = idx;
                    if (e.key === "ArrowRight") next = (idx + 1) % buttons.length;
                    else if (e.key === "ArrowLeft") next = (idx - 1 + buttons.length) % buttons.length;
                    else if (e.key === "Home") next = 0;
                    else if (e.key === "End") next = buttons.length - 1;
                    buttons[next]?.focus();
                  }}
                >
                  {COMPANIES.map((c) => (
                    <li key={c.name} className="contents">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          data-badge="1"
                          aria-label={`${c.name} — ${c.sector}. Ouvrir la fiche entreprise`}
                          aria-haspopup="dialog"
                          onClick={() => setSelected(c)}
                          className="relative grid h-11 w-11 sm:h-8 sm:w-8 place-items-center overflow-hidden rounded-full border-2 border-card bg-white text-[10px] shadow-sm outline-none transition-transform duration-200 hover:z-10 hover:scale-110 focus-visible:z-10 focus-visible:scale-110 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          <CompanyLogo
                            domain={c.domain}
                            logoUrl={c.logoUrl}
                            initials={c.initials}
                            hue={c.hue}
                            alt={`Logo ${c.name}`}
                            size={64}
                          />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        align="center"
                        sideOffset={8}
                        role="tooltip"
                        className="max-w-[240px] rounded-xl border border-border/60 bg-popover/95 px-3 py-2 text-left shadow-lg backdrop-blur data-[state=delayed-open]:animate-fade-in"
                      >
                        <div className="text-[13px] font-semibold leading-tight text-foreground">
                          {c.name}
                        </div>
                        <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                          {c.sector}
                        </div>
                        {(c.logoUrl || c.domain) && (
                          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground/70">
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            {c.logoUrl ? "Logo personnalisé" : `Logo via ${c.domain}`}
                          </div>
                        )}
                      </TooltipContent>
                    </Tooltip>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-col gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label="Exemples fictifs d’utilisation de Lucie. Plus d’informations"
                        className="inline-flex cursor-help items-center gap-1 rounded text-left underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        Exemples fictifs d’utilisation de Lucie
                        <Info className="h-3 w-3 text-muted-foreground/80" aria-hidden="true" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent role="tooltip" side="top" align="start" className="max-w-[260px] text-xs leading-relaxed">
                      Ces scénarios illustrent des usages possibles. Ils ne représentent pas des clients actifs ni des résultats observés.
                    </TooltipContent>
                  </Tooltip>
                  <span className="text-[10px] text-muted-foreground/60">
                    Illustrations de secteurs, sans référence client.
                  </span>
                </div>
              </TooltipProvider>
            </div>
          </div>

          <div className="relative min-w-0 rounded-2xl border border-border bg-background/70 p-5 backdrop-blur">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[oklch(0.65_0.17_155)]" />
                <span className="text-xs font-medium text-foreground">Exemple d'appel entrant · Chauffage</span>
              </div>
              <span className="text-[11px] text-muted-foreground">02 · 41 s</span>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <Bubble side="left">Bonjour, ici Lucie, l'assistante de {entreprise}. Je vous écoute.</Bubble>
              <Bubble side="right">Ma chaudière s'est mise en sécurité, plus d'eau chaude depuis ce matin.</Bubble>
              <Bubble side="left">D'accord. Quelle marque, et quel code s'affiche à l'écran ?</Bubble>
              <Bubble side="right">Saunier Duval, code F28.</Bubble>
              <Bubble side="left">Merci. Je peux faire passer un technicien demain à 8 h 30. Ça vous va ?</Bubble>
              <div className="rounded-xl border border-dashed border-border bg-card p-3 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-2 text-foreground">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  Rendez-vous enregistré — demain 8 h 30
                </div>
                Ajouté à l'agenda · fiche envoyée par SMS : marque, code panne, adresse
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

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="text-left">
                <div className="flex items-center gap-3">
                  <div
                    className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-white text-sm shadow-sm"
                  >
                    <CompanyLogo
                      domain={selected.domain}
                      logoUrl={selected.logoUrl}
                      initials={selected.initials}
                      hue={selected.hue}
                      alt={`Logo ${selected.name}`}
                      size={128}
                    />
                  </div>
                  <div className="min-w-0">
                    <SheetTitle className="text-base leading-tight">{selected.name}</SheetTitle>
                    <SheetDescription className="mt-0.5 text-xs">Exemple fictif de secteur</SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Secteur
                  </div>
                  <div className="mt-1 text-sm font-medium text-foreground">{selected.sector}</div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    Localisation
                  </div>
                  <div className="mt-1 text-sm font-medium text-foreground">{selected.city}</div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-4">
                  <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                    Résumé
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/85">{selected.summary}</p>
                </div>

                {selected.domain && (
                  <a
                    href={`https://${selected.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Voir le site
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
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
