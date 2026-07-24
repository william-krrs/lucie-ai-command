import { Link, useRouterState } from "@tanstack/react-router";
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
  { to: "/preparation", label: "Questionnaire" },
  { to: "/installation", label: "Installation" },
  { to: "/rdv-test", label: "RDV test & paramétrage" },
  { to: "/faq", label: "Questions fréquentes" },
] as const;

export function TopStepBar({ className }: { className?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const idx = STEPS.findIndex((s) => s.to === pathname);
  if (idx < 0) return null;
  const prev = idx > 0 ? STEPS[idx - 1] : null;
  const next = idx < STEPS.length - 1 ? STEPS[idx + 1] : null;

  return (
    <nav
      aria-label="Navigation rapide entre étapes"
      className={cn("flex items-center gap-2", className)}
    >
      {prev ? (
        <Link
          to={prev.to}
          aria-label={`Étape précédente : ${prev.label}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline max-w-[8rem] truncate">{prev.label}</span>
        </Link>
      ) : (
        <span aria-hidden="true" className="hidden sm:inline-block h-9 w-9" />
      )}

      <span
        className="hidden md:inline-flex items-center rounded-md bg-muted px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground tabular-nums"
        aria-hidden="true"
      >
        {String(idx + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}
      </span>

      {next ? (
        <Link
          to={next.to}
          aria-label={`Étape suivante : ${next.label}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground shadow-[var(--shadow-elevated)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="hidden sm:inline max-w-[10rem] truncate">{next.label}</span>
          <span className="sm:hidden">Suivant</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      ) : null}
    </nav>
  );
}
