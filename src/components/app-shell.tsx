import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  ClipboardList,
  TrendingUp,
  PlayCircle,
  Package,
  Rocket,
  HelpCircle,
  Sparkles,
  Circle,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Accueil", icon: Home },
  { to: "/diagnostic", label: "Diagnostic", icon: ClipboardList },
  { to: "/roi", label: "ROI", icon: TrendingUp },
  { to: "/demonstration", label: "Démonstration", icon: PlayCircle },
  { to: "/offres", label: "Offres", icon: Package },
  { to: "/installation", label: "Installation", icon: Rocket },
  { to: "/faq", label: "Questions fréquentes", icon: HelpCircle },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside className="hidden md:flex sticky top-0 h-screen w-72 shrink-0 flex-col border-r border-border bg-sidebar">
        <div className="flex items-center gap-3 px-6 pt-8 pb-6">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[var(--shadow-elevated)]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight tracking-tight">Lucie</div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Command Center
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3">
          <div className="px-3 pb-2 pt-4 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Navigation
          </div>
          <ul className="space-y-1">
            {NAV.map((item, i) => {
              const active = pathname === item.to;
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200",
                      active
                        ? "bg-primary text-primary-foreground shadow-[var(--shadow-elevated)]"
                        : "text-foreground/70 hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                    <span className="truncate">{item.label}</span>
                    <span
                      className={cn(
                        "ml-auto text-[10px] font-mono tabular-nums",
                        active ? "text-primary-foreground/70" : "text-muted-foreground/50",
                      )}
                    >
                      0{i + 1}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="m-4 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[oklch(0.65_0.17_155)] opacity-75" />
              <Circle className="h-2 w-2 fill-[oklch(0.65_0.17_155)] text-[oklch(0.65_0.17_155)]" />
            </span>
            Lucie en ligne
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Assistante IA active — répond aux appels en 1,2s en moyenne.
          </p>
        </div>

        <div className="border-t border-border px-6 py-4 text-[11px] text-muted-foreground">
          Spark Media Marketing
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div key={pathname} className="mx-auto max-w-6xl px-6 py-10 md:px-10 md:py-12 animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {eyebrow}
          </div>
        )}
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}