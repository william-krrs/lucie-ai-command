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
  Menu,
  Gauge,
  FileText,
  Lock,
  CalendarCheck2,
  CheckCircle2,
  CalendarClock,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useBooking } from "@/lib/booking-store";
import { SidebarProgress } from "@/components/sidebar-progress";
import { ProspectSwitcher } from "@/components/prospect-switcher";
import { BookingSync } from "@/components/booking-sync";
import { TopStepBar } from "@/components/top-step-bar";

const NAV = [
  { to: "/", label: "Accueil", icon: Home },
  { to: "/diagnostic", label: "Diagnostic", icon: ClipboardList },
  { to: "/roi", label: "ROI", icon: TrendingUp },
  { to: "/recommandation", label: "Recommandation", icon: Gauge },
  { to: "/demonstration", label: "Démonstration", icon: PlayCircle, gated: true },
  { to: "/offres", label: "Offres", icon: Package, gated: true },
  { to: "/merci", label: "Paiement", icon: CheckCircle2 },
  { to: "/preparation", label: "Questionnaire", icon: FileText, gated: true },
  { to: "/installation", label: "Installation", icon: Rocket, gated: true },
  { to: "/rdv-test", label: "RDV Test & paramétrage", icon: CalendarClock, gated: true },
  { to: "/faq", label: "Questions fréquentes", icon: HelpCircle },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => setMobileOpen(false), [pathname]);
  const { isUnlocked, isPendingMeeting } = useBooking();

  const navList = (
    <ul className="space-y-1" role="list">
      {NAV.map((item, i) => {
        const active = pathname === item.to;
        const Icon = item.icon;
        const locked = "gated" in item && item.gated && !isUnlocked;
        return (
          <li key={item.to}>
            <Link
              to={item.to}
              aria-current={active ? "page" : undefined}
              aria-disabled={locked ? true : undefined}
              title={
                locked
                  ? isPendingMeeting
                    ? "Débloqué le jour de votre rendez-vous"
                    : "Prenez d'abord rendez-vous depuis la recommandation"
                  : undefined
              }
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                active
                  ? "bg-primary text-primary-foreground shadow-[var(--shadow-elevated)]"
                  : locked
                    ? "text-foreground/40 hover:bg-accent/40"
                    : "text-foreground/70 hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              <span className="truncate">{item.label}</span>
              {locked ? (
                isPendingMeeting ? (
                  <CalendarCheck2
                    className="ml-auto h-3.5 w-3.5 text-muted-foreground/70"
                    aria-hidden="true"
                  />
                ) : (
                  <Lock
                    className="ml-auto h-3.5 w-3.5 text-muted-foreground/60"
                    aria-hidden="true"
                  />
                )
              ) : (
                <span
                  aria-hidden="true"
                  className={cn(
                    "ml-auto text-[10px] font-mono tabular-nums",
                    active ? "text-primary-foreground/70" : "text-muted-foreground/50",
                  )}
                >
                  0{i + 1}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <a href="#main-content" className="skip-link">
        Aller au contenu principal
      </a>
      <aside
        aria-label="Navigation principale"
        className="hidden lg:flex sticky top-0 h-screen w-64 xl:w-72 shrink-0 flex-col border-r border-border bg-sidebar"
      >
        <div className="flex items-center gap-3 px-6 pt-8 pb-6">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[var(--shadow-elevated)]">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight tracking-tight">Lucie</div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Command Center
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3" aria-label="Étapes du parcours">
          <div className="px-3 pb-2 pt-4 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Navigation
          </div>
          {navList}
        </nav>

        <div className="mt-4">
          <SidebarProgress />
        </div>

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

      <main className="flex-1 min-w-0 overflow-x-hidden">
        <div className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur lg:hidden">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="truncate text-sm font-semibold tracking-tight">Lucie</span>
          </Link>
          <div className="flex items-center gap-2">
            <ProspectSwitcher />
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              aria-label={mobileOpen ? "Fermer le menu de navigation" : "Ouvrir le menu de navigation"}
              aria-haspopup="dialog"
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-panel"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
            </SheetTrigger>
            <SheetContent
              id="mobile-nav-panel"
              side="right"
              aria-label="Menu de navigation"
              className="w-[85%] max-w-sm bg-sidebar p-0"
            >
              <SheetTitle className="sr-only">Menu de navigation</SheetTitle>
              <SheetDescription className="sr-only">
                Accédez aux différentes étapes du parcours Lucie Command Center.
              </SheetDescription>
              <div className="flex items-center gap-3 px-6 pt-8 pb-6">
                <div aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold tracking-tight">Lucie</div>
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    Command Center
                  </div>
                </div>
              </div>
              <nav className="px-3 pb-6" aria-label="Étapes du parcours (mobile)">
                <div className="px-3 pb-2 pt-2 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                  Navigation
                </div>
                {navList}
              </nav>
              <div className="pb-6">
                <SidebarProgress onNavigate={() => setMobileOpen(false)} />
              </div>
            </SheetContent>
            </Sheet>
          </div>
        </div>
        <div className="sticky top-[57px] z-30 flex items-center justify-end border-b border-border bg-background/85 px-4 py-2 backdrop-blur lg:hidden overflow-x-auto">
          <TopStepBar />
        </div>
        <div className="sticky top-0 z-30 hidden items-center justify-end gap-3 border-b border-border bg-background/85 px-6 py-3 backdrop-blur lg:flex">
          <TopStepBar className="mr-auto" />
          <ProspectSwitcher />
        </div>
        <div
          id="main-content"
          tabIndex={-1}
          key={pathname}
          className="mx-auto w-full max-w-6xl min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-12 animate-fade-in focus:outline-none"
        >
          {children}
        </div>
      </main>
      <BookingSync />
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
    <header className="mb-8 md:mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {eyebrow}
          </div>
        )}
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-2xl text-sm sm:text-[15px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}