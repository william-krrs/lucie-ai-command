import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Link2,
  Lock,
  Maximize2,
  Minimize2,
  Sparkles,
  X,
  Keyboard,
  Play,
  Pause,
} from "lucide-react";
import { useLucie, useMetrics, useRecommendation } from "@/lib/lucie-store";
import { PLAN_LABELS, PLAN_TAGLINES, PRIORITY_LABELS, TIER_LABELS } from "@/lib/recommendation";
import { cn } from "@/lib/utils";
import { CountUp, useReducedMotion } from "@/components/count-up";
import { LucieMascot } from "@/components/lucie-mascot";
import { createSharedDiagnostic } from "@/lib/share.functions";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Mode Démo — Lucie Command Center" },
      {
        name: "description",
        content:
          "Présentation plein écran optimisée pour le partage d'écran en rendez-vous commercial : diagnostic, ROI et recommandation en 7 étapes.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Mode Démo — Lucie Command Center" },
      {
        property: "og:description",
        content: "Présentation commerciale plein écran de la recommandation Lucie.",
      },
    ],
  }),
  component: DemoMode,
});

const EUR = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(n)));

type Slide = {
  id: string;
  eyebrow: string;
  title: string;
  render: () => React.ReactNode;
};

function DemoMode() {
  const navigate = useNavigate();
  const { state } = useLucie();
  const m = useMetrics();
  const rec = useRecommendation();
  const reduced = useReducedMotion();
  const createShare = useServerFn(createSharedDiagnostic);
  const [share, setShare] = useState<{ url: string; expiresAt: string } | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareErr, setShareErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateShare = useCallback(async () => {
    if (shareBusy) return;
    setShareBusy(true);
    setShareErr(null);
    try {
      const expiresInDays = 30;
      const payload = {
        companyName: state.companyName ?? "",
        activity: state.activity ?? "",
        city: state.city ?? "",
        employees: state.employees ?? 0,
        callsPerWeek: state.callsPerWeek ?? 0,
        missedCalls: state.missedCalls ?? 0,
        averageBasket: state.averageBasket ?? 0,
        revenueGoal: state.revenueGoal ?? 0,
        conversionRate: state.conversionRate ?? 0,
        channels: (state.channels ?? []).slice(0, 20),
        recommendation: {
          score: rec.score,
          tier: rec.tier,
          plan: rec.plan,
          priority: rec.priority,
          estimatedMonthlyRoi: rec.estimatedMonthlyRoi,
          justifications: rec.justifications.slice(0, 20),
          concerns: rec.concerns.slice(0, 20),
          planReason: rec.planReason,
        },
        metrics: {
          monthlyReceived: m.monthlyReceived,
          monthlyMissed: m.monthlyMissed,
          monthlyLostRevenue: m.monthlyLostRevenue,
          yearlyLostRevenue: m.yearlyLostRevenue,
          recoverableOpportunities: m.recoverableOpportunities,
          timeSavedHours: m.timeSavedHours,
        },
        expiresInDays,
      };
      const { token } = await createShare({ data: payload });
      const url = `${window.location.origin}/demo/${token}`;
      const expiresAt = new Date(Date.now() + expiresInDays * 86400_000).toISOString();
      setShare({ url, expiresAt });
    } catch (e) {
      setShareErr(e instanceof Error ? e.message : "Échec de génération du lien");
    } finally {
      setShareBusy(false);
    }
  }, [shareBusy, createShare, state, rec, m]);

  const copyShare = useCallback(async () => {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* noop */
    }
  }, [share]);

  const slides = useMemo<Slide[]>(
    () => [
      {
        id: "cover",
        eyebrow: "Rendez-vous commercial",
        title: state.companyName || "Nouvelle démonstration",
        render: () => (
          <div className="flex flex-col items-center gap-8 text-center">
            <div className="grid h-24 w-24 place-items-center rounded-3xl bg-primary text-primary-foreground shadow-[var(--elev-glow)]">
              <Sparkles className="h-12 w-12" aria-hidden="true" />
            </div>
            <div className="max-w-3xl">
              <div className="text-lg text-muted-foreground">
                {[state.activity, state.city].filter(Boolean).join(" · ") ||
                  "Diagnostic personnalisé Lucie"}
              </div>
              <div className="mt-4 text-[clamp(2.2rem,5vw,4rem)] font-semibold leading-[1.05] tracking-tight text-foreground">
                Comment Lucie récupère votre chiffre d'affaires perdu.
              </div>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                Une démonstration en 7 étapes, calculée à partir de vos chiffres.
              </p>
            </div>
          </div>
        ),
      },
      {
        id: "diagnostic",
        eyebrow: "Étape 1 — Diagnostic",
        title: "Votre volume d'appels",
        render: () => (
          <SlideGrid
            items={[
              { label: "Appels reçus / mois", value: <CountUp value={m.monthlyReceived} /> },
              { label: "Appels manqués / mois", value: <CountUp value={m.monthlyMissed} />, tone: "warning" },
              { label: "Panier moyen", value: <CountUp value={state.averageBasket} format={(n) => EUR(n)} /> },
              { label: "Taux de conversion", value: <CountUp value={state.conversionRate} format={(n) => `${Math.round(n)}%`} /> },
            ]}
          />
        ),
      },
      {
        id: "loss",
        eyebrow: "Étape 2 — Manque à gagner",
        title: "Ce que ces appels manqués vous coûtent",
        render: () => (
          <SlideGrid
            items={[
              {
                label: "Perte hebdomadaire",
                value: <CountUp value={m.weeklyLostRevenue} format={(n) => EUR(n)} />,
                tone: "warning",
              },
              {
                label: "Perte mensuelle",
                value: <CountUp value={m.monthlyLostRevenue} format={(n) => EUR(n)} />,
                tone: "warning",
              },
              {
                label: "Perte annualisée",
                value: <CountUp value={m.yearlyLostRevenue} format={(n) => EUR(n)} />,
                tone: "danger",
              },
              {
                label: "Clients récupérables / mois",
                value: <CountUp value={m.recoverableOpportunities} />,
                tone: "success",
              },
            ]}
          />
        ),
      },
      {
        id: "score",
        eyebrow: "Étape 3 — Compatibilité",
        title: "Votre score Lucie",
        render: () => {
          const tierTone =
            rec.tier === "excellent" || rec.tier === "compatible"
              ? "success"
              : rec.tier === "limited"
                ? "warning"
                : "danger";
          const dynamic =
            rec.score >= 70
              ? "Votre activité présente un fort potentiel de récupération grâce à Lucie."
              : rec.score >= 45
                ? "Votre activité peut tirer un vrai bénéfice de Lucie sur les points prioritaires."
                : "Votre activité présente un potentiel limité — Lucie sécurisera les cas les plus critiques.";
          return (
            <div className="flex w-full flex-col items-center gap-8">
              <ScoreDial value={rec.score} />
              <div className="flex items-center gap-3">
                <LucieMascot score={rec.score} size={44} />
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={tierTone}>{TIER_LABELS[rec.tier]}</Badge>
                  <Badge>Priorité {PRIORITY_LABELS[rec.priority].toLowerCase()}</Badge>
                  {rec.plan && <Badge tone="primary">Formule {PLAN_LABELS[rec.plan]}</Badge>}
                </div>
              </div>
              <p className="max-w-2xl text-center text-lg leading-relaxed text-muted-foreground">
                {dynamic}
              </p>
            </div>
          );
        },
      },
      {
        id: "roi",
        eyebrow: "Étape 4 — ROI attendu",
        title: "Ce que Lucie vous rapporte, chaque mois",
        render: () => (
          <div className="flex w-full flex-col items-center gap-8">
            <div className="text-center">
              <div className="text-sm uppercase tracking-widest text-muted-foreground">
                Revenu récupéré estimé
              </div>
              <div className="mt-3 text-[clamp(3rem,10vw,7rem)] font-semibold leading-none tracking-tight text-foreground tabular-nums">
                <CountUp value={rec.estimatedMonthlyRoi} duration={1100} format={(n) => EUR(n)} />
                <span className="ml-2 align-baseline text-xl font-normal text-muted-foreground">
                  / mois
                </span>
              </div>
            </div>
            <SlideGrid
              items={[
                { label: "Temps gagné équipe", value: <CountUp value={m.timeSavedHours} format={(n) => `${Math.round(n)} h / mois`} /> },
                {
                  label: "Objectif CA mensuel",
                  value: <CountUp value={state.revenueGoal} format={(n) => EUR(n)} />,
                },
                {
                  label: "Couverture de l'objectif",
                  value: <CountUp value={m.goalProgress} format={(n) => `${Math.round(n)}%`} />,
                  tone: m.goalProgress >= 30 ? "success" : undefined,
                },
              ]}
              columns={3}
            />
          </div>
        ),
      },
      {
        id: "plan",
        eyebrow: "Étape 5 — Formule recommandée",
        title: rec.plan ? `Lucie ${PLAN_LABELS[rec.plan]}` : "Recommandation personnalisée",
        render: () => (
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
            {rec.plan && (
              <div className="text-lg text-muted-foreground">{PLAN_TAGLINES[rec.plan]}</div>
            )}
            <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
              <BulletList title="Pourquoi c'est fait pour vous" items={rec.justifications} tone="success" />
              <BulletList title="Points à sécuriser" items={rec.concerns} tone="warning" />
            </div>
          </div>
        ),
      },
      {
        id: "share",
        eyebrow: "Étape 6 — Rapport privé",
        title: "Un lien sécurisé pour votre associé",
        render: () => (
          <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5 text-primary" />
              Rapport privé — réservé à votre entreprise
            </div>
            {!share ? (
              <>
                <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
                  Génère un lien unique pour revoir le diagnostic, le score, le ROI
                  et la recommandation. Valable 30 jours.
                </p>
                <button
                  type="button"
                  onClick={generateShare}
                  disabled={shareBusy}
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground shadow-[var(--elev-glow)] disabled:opacity-60"
                >
                  <Link2 className="h-4 w-4" />
                  {shareBusy ? "Génération…" : "Générer le lien sécurisé"}
                </button>
                {shareErr && <p className="text-sm text-destructive">{shareErr}</p>}
              </>
            ) : (
              <div className="w-full space-y-4">
                <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-3 text-left">
                  <Link2 className="h-4 w-4 shrink-0 text-primary" />
                  <code className="flex-1 truncate font-mono text-sm text-foreground">
                    {share.url}
                  </code>
                  <button
                    type="button"
                    onClick={copyShare}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs text-foreground"
                    aria-label="Copier le lien"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copié" : "Copier"}
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    Généré le{" "}
                    {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                  <span>
                    Expire le{" "}
                    {new Date(share.expiresAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={copyShare}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-5 text-sm font-medium text-primary"
                >
                  <Copy className="h-4 w-4" /> Partager avec mon associé
                </button>
              </div>
            )}
          </div>
        ),
      },
      {
        id: "next",
        eyebrow: "Étape 7 — Plan d'action",
        title: "Vous êtes déjà en route.",
        render: () => {
          const steps: { label: string; done: boolean }[] = [
            { label: "Diagnostic terminé", done: true },
            { label: "Démonstration réalisée", done: true },
            { label: "Choix de la formule", done: false },
            { label: "Paiement", done: false },
            { label: "Installation", done: false },
            { label: "Mise en service", done: false },
          ];
          return (
            <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-8">
              <ol className="w-full space-y-2.5">
                {steps.map((s) => (
                  <li
                    key={s.label}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                      s.done
                        ? "border-primary/30 bg-primary/[0.06]"
                        : "border-border bg-card",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-6 w-6 shrink-0 place-items-center rounded-md border",
                        s.done
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground",
                      )}
                      aria-hidden="true"
                    >
                      {s.done ? <Check className="h-3.5 w-3.5" /> : null}
                    </span>
                    <span
                      className={cn(
                        "text-[15px]",
                        s.done ? "font-medium text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {s.label}
                    </span>
                  </li>
                ))}
              </ol>
              <Link
                to="/offres"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-7 text-sm font-medium text-primary-foreground shadow-[var(--elev-glow)]"
              >
                Continuer avec Lucie <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          );
        },
      },
    ],
    [state, m, rec, share, shareBusy, shareErr, copied, generateShare, copyShare],
  );

  const total = slides.length;
  const [i, setI] = useState(0);
  const clamp = useCallback((n: number) => Math.max(0, Math.min(total - 1, n)), [total]);
  const go = useCallback((n: number) => setI((cur) => clamp(typeof n === "number" ? n : cur)), [clamp]);
  const next = useCallback(() => setI((c) => clamp(c + 1)), [clamp]);
  const prev = useCallback(() => setI((c) => clamp(c - 1)), [clamp]);

  const [isFs, setIsFs] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleFullscreen = useCallback(async () => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) {
      await rootRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      await document.exitFullscreen?.().catch(() => {});
    }
  }, []);
  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      switch (e.key) {
        case "ArrowRight":
        case "PageDown":
        case " ":
          e.preventDefault(); next(); break;
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault(); prev(); break;
        case "Home":
          e.preventDefault(); go(0); break;
        case "End":
          e.preventDefault(); go(total - 1); break;
        case "Escape":
          if (document.fullscreenElement) return; // let browser exit FS first
          navigate({ to: "/" }); break;
        case "f":
        case "F":
          e.preventDefault(); toggleFullscreen(); break;
        default:
          if (/^[1-9]$/.test(e.key)) { e.preventDefault(); go(Number(e.key) - 1); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, go, navigate, toggleFullscreen, total]);

  // Optional auto-advance for hands-free demo.
  const [auto, setAuto] = useState(false);
  useEffect(() => {
    if (!auto) return;
    const t = window.setInterval(() => setI((c) => (c + 1 >= total ? c : c + 1)), 12000);
    return () => window.clearInterval(t);
  }, [auto, total]);

  const current = slides[i];
  const progressPct = Math.round(((i + 1) / total) * 100);

  return (
    <div
      ref={rootRef}
      data-demo-mode
      className="relative flex min-h-dvh w-full flex-col overflow-hidden bg-background text-foreground"
    >
      {/* Top bar */}
      <header className="flex items-center justify-between gap-3 border-b border-border/60 bg-background/70 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-2 min-w-0">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="truncate text-sm font-semibold tracking-tight">
            Mode Démo{state.companyName ? ` · ${state.companyName}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAuto((a) => !a)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs text-foreground"
            aria-pressed={auto}
            aria-label={auto ? "Désactiver l'avance automatique" : "Activer l'avance automatique"}
          >
            {auto ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Auto</span>
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs text-foreground"
            aria-label={isFs ? "Quitter le plein écran" : "Passer en plein écran"}
          >
            {isFs ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{isFs ? "Sortir" : "Plein écran"}</span>
          </button>
          <button
            type="button"
            onClick={() => navigate({ to: "/" })}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs text-foreground"
            aria-label="Quitter le mode démo"
          >
            <X className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Quitter</span>
          </button>
        </div>
      </header>

      {/* Progress bar */}
      <div className="px-5 pt-3" aria-hidden="true">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-[width] duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Slide */}
      <section
        role="region"
        aria-label={`Étape ${i + 1} sur ${total} : ${current.title}`}
        className="flex flex-1 items-center justify-center px-4 py-6 sm:px-10 sm:py-12"
      >
        <article className="flex w-full max-w-6xl flex-col items-center gap-8" key={current.id}>
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {current.eyebrow}
            </div>
            <h1 className="text-[clamp(1.8rem,4.5vw,3.5rem)] font-semibold leading-[1.1] tracking-tight text-foreground">
              {current.title}
            </h1>
          </div>
          <div className="w-full">{current.render()}</div>
        </article>
      </section>

      {/* Bottom nav */}
      <footer className="flex flex-col gap-3 border-t border-border/60 bg-background/70 px-5 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <ol className="order-2 flex flex-wrap items-center gap-1.5 sm:order-1" aria-label="Choisir une étape">
          {slides.map((s, idx) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => go(idx)}
                aria-current={idx === i ? "step" : undefined}
                aria-label={`Étape ${idx + 1} : ${s.title}`}
                className={cn(
                  "h-2.5 w-6 rounded-full transition-all",
                  idx === i
                    ? "w-10 bg-primary"
                    : idx < i
                      ? "bg-primary/50"
                      : "bg-muted hover:bg-muted-foreground/40",
                )}
              />
            </li>
          ))}
        </ol>
        <div className="order-1 flex items-center justify-between gap-3 sm:order-2">
          <div className="text-xs text-muted-foreground tabular-nums">
            {String(i + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prev}
              disabled={i === 0}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border px-4 text-sm text-foreground disabled:opacity-40"
              aria-label="Étape précédente"
            >
              <ArrowLeft className="h-4 w-4" /> Précédent
            </button>
            <button
              type="button"
              onClick={next}
              disabled={i === total - 1}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-5 text-sm text-primary-foreground shadow-[var(--elev-glow)] disabled:opacity-40"
              aria-label="Étape suivante"
            >
              Suivant <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </footer>

      {/* Keyboard hint */}
      <div className="pointer-events-none absolute bottom-24 right-5 hidden items-center gap-1.5 rounded-lg border border-border bg-card/80 px-2.5 py-1 text-[11px] text-muted-foreground backdrop-blur md:inline-flex">
        <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
        <kbd className="font-mono">←</kbd>
        <kbd className="font-mono">→</kbd>
        <span className="opacity-60">·</span>
        <kbd className="font-mono">F</kbd>
        <span>plein écran</span>
      </div>
    </div>
  );
}

/* ---------- Building blocks ---------- */

function SlideGrid({
  items,
  columns = 4,
}: {
  items: { label: string; value: React.ReactNode; tone?: "success" | "warning" | "danger" | "primary" }[];
  columns?: 2 | 3 | 4;
}) {
  const cols =
    columns === 3
      ? "sm:grid-cols-3"
      : columns === 2
        ? "sm:grid-cols-2"
        : "sm:grid-cols-2 lg:grid-cols-4";
  return (
    <div className={cn("grid w-full grid-cols-1 gap-4", cols)}>
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
        >
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {it.label}
          </div>
          <div
            className={cn(
              "mt-3 text-[clamp(2rem,4vw,3rem)] font-semibold leading-none tracking-tight tabular-nums break-words",
              it.tone === "success" && "text-[oklch(0.78_0.14_155)]",
              it.tone === "warning" && "text-[oklch(0.82_0.15_60)]",
              it.tone === "danger" && "text-destructive",
              it.tone === "primary" && "text-primary",
              !it.tone && "text-foreground",
            )}
          >
            {it.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "primary" | "success" | "warning" | "danger";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-sm",
        tone === "primary" && "border-primary/40 bg-primary/10 text-primary",
        tone === "success" && "border-[oklch(0.78_0.14_155)]/40 bg-[oklch(0.78_0.14_155)]/10 text-[oklch(0.78_0.14_155)]",
        tone === "warning" && "border-[oklch(0.82_0.15_60)]/40 bg-[oklch(0.82_0.15_60)]/10 text-[oklch(0.82_0.15_60)]",
        tone === "danger" && "border-destructive/40 bg-destructive/10 text-destructive",
        !tone && "border-border bg-card text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function BulletList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "success" | "warning";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 text-left shadow-[var(--shadow-card)]">
      <div className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {title}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">—</p>
      ) : (
        <ul className="space-y-2 text-[15px] text-foreground">
          {items.map((s, k) => (
            <li key={k} className="flex gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  "mt-2 h-1.5 w-1.5 shrink-0 rounded-full",
                  tone === "success" ? "bg-[oklch(0.78_0.14_155)]" : "bg-[oklch(0.82_0.15_60)]",
                )}
              />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ScoreDial({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const r = 90;
  const c = 2 * Math.PI * r;
  const dash = (v / 100) * c;
  return (
    <div className="relative grid place-items-center">
      <svg viewBox="0 0 220 220" className="h-56 w-56 -rotate-90" aria-hidden="true">
        <circle cx="110" cy="110" r={r} className="fill-none stroke-border" strokeWidth="14" />
        <circle
          cx="110"
          cy="110"
          r={r}
          className="fill-none stroke-primary transition-[stroke-dasharray] duration-700"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <div className="text-[clamp(3rem,7vw,4.5rem)] font-semibold leading-none tabular-nums text-foreground">
          {Math.round(v)}
        </div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">/ 100</div>
      </div>
    </div>
  );
}