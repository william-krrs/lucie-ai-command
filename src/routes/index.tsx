import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, PhoneCall, Sparkles, Zap, Clock, Users, LineChart, Info, MapPin, Building2, ExternalLink } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { StepNav } from "@/components/step-nav";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { SOCIAL_PROOF_COMPANY_COUNT } from "@/lib/config";
import { getLogoStatus, setLogoStatus, logoCacheKey } from "@/lib/logo-cache";

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
  const [status, setStatus] = useState<LogoStatus>(() => {
    if (!source) return "error";
    const cached = cacheKey ? getLogoStatus(cacheKey) : null;
    return cached ?? "loading";
  });

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
    name: "Basic Fit",
    sector: "Salles de sport · Fitness",
    city: "Réseau national",
    summary:
      "Enseigne leader du fitness low-cost en Europe. Lucie prend le relais sur les appels entrants des clubs pour orienter les prospects vers l'inscription en ligne et désengorger l'accueil.",
    domain: "basic-fit.com",
    initials: "BF",
    hue: 12,
  },
  {
    name: "Bruselec — Yohann Brusseau",
    sector: "Électricité · Photovoltaïque",
    city: "Fonsorbes / Toulouse (31)",
    summary:
      "Artisan électricien spécialisé en panneaux photovoltaïques et bornes de recharge. Lucie qualifie les demandes de devis pendant les chantiers et bloque les rendez-vous d'audit directement dans l'agenda.",
    domain: "electricien-31.fr",
    initials: "BR",
    hue: 220,
  },
  {
    name: "Kris Conciergerie 66 — Christine Mintz",
    sector: "Conciergerie & location saisonnière",
    city: "Amélie-les-Bains-Palalda (66)",
    summary:
      "Conciergerie dédiée aux propriétaires de locations saisonnières dans les Pyrénées-Orientales (accueil locataires, états des lieux, remise des clés, entretien). Lucie assure la permanence téléphonique, qualifie les demandes des propriétaires et locataires et bloque les interventions dans l'agenda.",
    domain: "krisconciergerie.com",
    initials: "KC",
    hue: 300,
  },
  {
    name: "Edclim — Wendy Dewolf",
    sector: "Climatisation & réfrigération",
    city: "Magny-le-Hongre (77)",
    summary:
      "Installation, maintenance et dépannage de systèmes de climatisation. Lucie répond aux urgences en 1,2 s, qualifie les pannes et priorise les interventions selon le type d'équipement.",
    domain: "ed-clim.fr",
    initials: "ED",
    hue: 170,
  },
  {
    name: "Scalisi Bâti Rénov — Mickaël Angelo Scalisi",
    sector: "Maçonnerie & rénovation",
    city: "Vidauban (83)",
    summary:
      "Entreprise de maçonnerie, gros œuvre et rénovation immobilière dans le Var. Lucie prend les demandes de devis en journée pendant que les équipes sont sur les chantiers.",
    domain: "scalisi-batirenov.fr",
    initials: "SB",
    hue: 30,
  },
  {
    name: "Ligonde Désiré — Désir Vert Paysagiste",
    sector: "Paysagisme & entretien de jardins",
    city: "Savigny-sur-Orge (91)",
    summary:
      "Création et entretien d'espaces verts pour particuliers et copropriétés. Lucie qualifie la nature du projet (création, entretien, élagage) avant de proposer un rendez-vous sur place.",
    domain: null,
    initials: "DV",
    hue: 140,
  },
  {
    name: "AMS Rénovation — Mehdi Aloui",
    sector: "Rénovation & multi-services",
    city: "La Motte-Servolex (73)",
    summary:
      "Multi-services de dépannage et rénovation intérieure/extérieure en Savoie. Lucie centralise les demandes urgentes et convertit les appels manqués en rendez-vous confirmés.",
    domain: "ams-renovation73.fr",
    initials: "AM",
    hue: 260,
  },
];

function Home() {
  const [selected, setSelected] = useState<Company | null>(null);
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
              <TooltipProvider delayDuration={150}>
                <ul
                  role="list"
                  aria-label={`Aperçu de ${COMPANIES.length} entreprises clientes de Lucie`}
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
                        aria-label={`+${SOCIAL_PROOF_COMPANY_COUNT} entreprises utilisent Lucie au quotidien. Plus d'informations`}
                        className="inline-flex cursor-help items-center gap-1 rounded text-left underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        +{SOCIAL_PROOF_COMPANY_COUNT} entreprises utilisent Lucie au quotidien
                        <Info className="h-3 w-3 text-muted-foreground/80" aria-hidden="true" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent role="tooltip" side="top" align="start" className="max-w-[260px] text-xs leading-relaxed">
                      Chiffre basé sur les entreprises actives utilisant Lucie pour répondre à leurs appels entrants et qualifier leurs prospects en direct.
                    </TooltipContent>
                  </Tooltip>
                  <span className="text-[10px] text-muted-foreground/60">
                    Logos via les sites officiels ou URLs personnalisées.
                  </span>
                </div>
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
                    <SheetDescription className="mt-0.5 text-xs">Fiche entreprise</SheetDescription>
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
