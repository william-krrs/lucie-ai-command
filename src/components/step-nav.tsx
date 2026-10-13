import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { to: "/", label: "Accueil" },
  { to: "/diagnostic", label: "Diagnostic" },
  { to: "/roi", label: "ROI" },
  { to: "/recommandation", label: "Recommandation" },
  { to: "/demonstration", label: "Démonstration" },
  { to: "/offres", label: "Offres" },
  { to: "/merci", label: "Paiement" },
  { to: "/preparation", label: "Configuration" },
  { to: "/installation", label: "Installation" },
  { to: "/rdv-test", label: "RDV test & paramétrage" },
  { to: "/faq", label: "Questions fréquentes" },
] as const;

type StepPath = (typeof STEPS)[number]["to"];

export function StepNav({ current }: { current: StepPath }) {
  const idx = STEPS.findIndex((s) => s.to === current);
  const prev = idx > 0 ? STEPS[idx - 1] : null;
  const next = idx >= 0 && idx < STEPS.length - 1 ? STEPS[idx + 1] : null;

  return (
    <nav
      aria-label="Navigation entre les étapes"
      className="cv-auto mt-12 border-t border-border pt-6"
    >
      <div className="mb-4 flex items-center justify-between text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        <span>
          Étape {String(idx + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}
        </span>
        <span className="hidden sm:inline">{STEPS[idx]?.label}</span>
      </div>

      <div className="mb-6 flex gap-1.5">
        {STEPS.map((s, i) => (
          <Link
            key={s.to}
            to={s.to}
            aria-label={`Aller à ${s.label}`}
            className={cn(
              "relative flex h-11 flex-1 items-center rounded-none bg-transparent after:h-1.5 after:w-full after:rounded-full after:bg-current transition-colors",
              i < idx && "text-primary/50",
              i === idx && "text-primary",
              i > idx && "text-border hover:text-muted-foreground/40",
            )}
          />
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {prev ? (
          <Link
            to={prev.to}
            className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-foreground/70 group-hover:bg-accent group-hover:text-accent-foreground">
              <ArrowLeft className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">
                Étape précédente
              </span>
              <span className="block truncate text-sm font-medium text-foreground">
                {prev.label}
              </span>
            </span>
          </Link>
        ) : (
          <div className="hidden sm:block" />
        )}

        {next ? (
          <Link
            to={next.to}
            className="group flex items-center justify-end gap-3 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent p-4 text-right shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]"
          >
            <span className="min-w-0">
              <span className="block text-[10px] uppercase tracking-widest text-primary">
                Étape suivante
              </span>
              <span className="block truncate text-sm font-medium text-foreground">
                {next.label}
              </span>
            </span>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-[var(--shadow-elevated)]">
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ) : (
          <div className="hidden sm:block" />
        )}
      </div>
    </nav>
  );
}