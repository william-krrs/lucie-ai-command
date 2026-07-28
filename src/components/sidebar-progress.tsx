import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, CircleDashed, ClipboardList, CalendarCheck2, FileText, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLucie } from "@/lib/lucie-store";
import { useBooking } from "@/lib/booking-store";

type Step = {
  key: string;
  label: string;
  to: string;
  icon: typeof ClipboardList;
  done: boolean;
  pending?: boolean;
  hint?: string;
};

function readConfigurationDone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem("lucie:preparation");
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { submissionId?: string };
    return typeof parsed.submissionId === "string" && parsed.submissionId.length > 0;
  } catch {
    return false;
  }
}

export function SidebarProgress({ onNavigate }: { onNavigate?: () => void }) {
  const { state } = useLucie();
  const { booking, isUnlocked, isPendingMeeting } = useBooking();
  const [configurationDone, setConfigurationDone] = useState(false);

  useEffect(() => {
    setConfigurationDone(readConfigurationDone());
    function onStorage(e: StorageEvent) {
      if (e.key === "lucie:preparation") setConfigurationDone(readConfigurationDone());
    }
    function onFocus() {
      setConfigurationDone(readConfigurationDone());
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const diagnosticDone = (state.activity ?? "").trim().length > 0;
  const rdvDone = !!booking;
  const installationDone = isUnlocked;

  const steps: Step[] = [
    {
      key: "diagnostic",
      label: "Diagnostic",
      to: "/diagnostic",
      icon: ClipboardList,
      done: diagnosticDone,
      hint: diagnosticDone ? "Complété" : "À compléter",
    },
    {
      key: "rdv",
      label: "Rendez-vous",
      to: "/recommandation",
      icon: CalendarCheck2,
      done: rdvDone,
      hint: rdvDone ? (isPendingMeeting ? "Confirmé" : "Passé") : "À planifier",
    },
    {
      key: "configuration",
      label: "Configuration",
      to: "/preparation",
      icon: FileText,
      done: configurationDone,
      pending: !configurationDone && rdvDone,
      hint: configurationDone ? "Envoyée" : rdvDone ? "À remplir" : "Après le RDV",
    },
    {
      key: "installation",
      label: "Installation",
      to: "/installation",
      icon: Rocket,
      done: installationDone,
      pending: !installationDone && rdvDone,
      hint: installationDone ? "Débloqué" : isPendingMeeting ? "Jour du RDV" : "Verrouillé",
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const percent = Math.round((completed / total) * 100);

  return (
    <section
      aria-label="Progression du parcours"
      className="mx-4 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
    >
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          Ma progression
        </div>
        <div className="text-[11px] font-mono tabular-nums text-foreground">
          {completed}/{total}
        </div>
      </div>

      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`Parcours complété à ${percent}%`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-[oklch(0.65_0.17_155)] transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ul className="mt-3 space-y-1" role="list">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <li key={step.key}>
              <Link
                to={step.to}
                onClick={onNavigate}
                className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors",
                    step.done
                      ? "border-success bg-success text-success-foreground"
                      : step.pending
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground",
                  )}
                >
                  {step.done ? (
                    <Check className="h-3 w-3" strokeWidth={3} />
                  ) : step.pending ? (
                    <CircleDashed className="h-3 w-3 animate-[spin_6s_linear_infinite]" />
                  ) : (
                    <Icon className="h-3 w-3" />
                  )}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate",
                    step.done ? "text-foreground/60 line-through decoration-1" : "text-foreground",
                  )}
                >
                  {step.label}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-[10px] uppercase tracking-wider",
                    step.done
                      ? "text-[oklch(0.45_0.17_155)]"
                      : step.pending
                        ? "text-primary"
                        : "text-muted-foreground/70",
                  )}
                >
                  {step.hint}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {completed === total ? (
        <p className="mt-3 text-[11px] leading-relaxed text-[oklch(0.45_0.17_155)]">
          🎉 Parcours terminé — bienvenue chez Lucie !
        </p>
      ) : (
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Continuez là où vous vous êtes arrêté pour débloquer la suite.
        </p>
      )}
    </section>
  );
}