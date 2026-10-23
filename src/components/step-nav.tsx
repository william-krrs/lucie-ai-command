import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { JOURNEY_GROUPS, groupIndexForPath } from "@/lib/journey-groups";

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
  const gIdx = groupIndexForPath(current);
  const prev = idx > 0 ? STEPS[idx - 1] : null;
  const next = idx >= 0 && idx < STEPS.length - 1 ? STEPS[idx + 1] : null;

  return (
    <nav
      aria-label="Navigation entre les étapes"
      className="cv-auto mt-12 border-t border-border pt-6"
    >
      {gIdx >= 0 && (
        <>
          <div className="mb-4 flex items-center justify-between text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            <span>
              Étape {gIdx + 1} / {JOURNEY_GROUPS.length}
            </span>
            <span className="hidden sm:inline">{JOURNEY_GROUPS[gIdx]?.label}</span>
          </div>

          <div className="mb-6 flex gap-1.5" aria-hidden="true">
            {JOURNEY_GROUPS.map((g, i) => (
              <span
                key={g.key}
                className={cn(
                  "relative flex h-3 flex-1 items-center after:h-1.5 after:w-full after:rounded-full after:bg-current",
                  i < gIdx && "text-primary/50",
                  i === gIdx && "text-primary",
                  i > gIdx && "text-border",
                )}
              />
            ))}
          </div>
        </>
      )}

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