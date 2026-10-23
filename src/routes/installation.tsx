import { createFileRoute } from "@tanstack/react-router";
import {
  ScanSearch,
  Settings2,
  FlaskConical,
  Calendar,
  PhoneCall,
  Rocket,
  Repeat,
  ArrowDown,
} from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { StepNav } from "@/components/step-nav";
import { LockedPage } from "@/components/locked-page";
import { AccountGate } from "@/components/account-gate";
import { useJourneyAccess } from "@/lib/journey-access";

export const Route = createFileRoute("/installation")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Installation — Ton diagnostic Lucie" },
      {
        name: "description",
        content: "Le déploiement de Lucie en 7 étapes, de l'analyse à l'optimisation continue.",
      },
      { property: "og:title", content: "Installation — Lucie" },
      { property: "og:description", content: "Le parcours de mise en production de Lucie." },
      { property: "og:url", content: "https://lucie-ai-command.lovable.app/installation" },
    ],
    links: [{ rel: "canonical", href: "https://lucie-ai-command.lovable.app/installation" }],
  }),
  component: Installation,
});

const STEPS = [
  { icon: ScanSearch, title: "Analyse", desc: "Audit de tes flux d'appels, de tes scripts et de tes objectifs commerciaux.", duration: "Phase 1" },
  { icon: Settings2, title: "Paramétrage Lucie", desc: "Configuration de sa voix, ses réponses, ses règles de qualification.", duration: "Phase 2" },
  { icon: FlaskConical, title: "Tests", desc: "Simulations d'appels réels pour valider le comportement de Lucie.", duration: "Phase 3" },
  { icon: Calendar, title: "Connexion agenda", desc: "Synchronisation Google / Outlook / agenda en ligne avec règles de disponibilité.", duration: "Phase 4" },
  { icon: PhoneCall, title: "Connexion téléphone", desc: "Portage ou renvoi de ton numéro professionnel, sans coupure.", duration: "Phase 5" },
  { icon: Rocket, title: "Mise en production", desc: "Lucie prend ses premiers appels réels, monitoring 24/7 activé.", duration: "96 h" },
  { icon: Repeat, title: "Optimisation continue", desc: "Suivi hebdomadaire des performances et ajustements précis.", duration: "En continu" },
];

function Installation() {
  return (
    <AccountGate afterPayment step="Installation">
      <InstallationContent />
    </AccountGate>
  );
}

function InstallationContent() {
  const { canViewInstallation } = useJourneyAccess();
  if (!canViewInstallation) {
    return (
      <LockedPage
        title="Installation verrouillée"
        step="Installation"
        description="L'installation se débloque une fois ta configuration personnalisée envoyée et validée."
        waitingFor="step"
        waitingTitle="Configuration à envoyer"
        waitingText="Complète et envoie le formulaire de configuration personnalisée : le suivi d'installation s'ouvrira automatiquement."
        backTo="/preparation"
        backLabel="Ouvrir la configuration personnalisée"
      />

    );
  }
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Étape 4 · Mise en place"
        title="Timeline d'installation"
        description="Mise en place en 96 h : de l’analyse à la mise en production, puis optimisation continue."
      />

      <div className="relative">
        <div
          aria-hidden
          className="absolute left-6 top-0 h-full w-px bg-gradient-to-b from-primary/40 via-border to-transparent md:left-1/2"
        />

        <ol className="space-y-6">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const right = i % 2 === 1;
            return (
              <li key={s.title} className="relative md:grid md:grid-cols-2 md:gap-8">
                <div
                  className={
                    (right ? "md:col-start-2" : "md:col-start-1") +
                    " ml-16 md:ml-0 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]"
                  }
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                          Étape 0{i + 1}
                        </div>
                        <div className="text-base font-semibold tracking-tight text-foreground">
                          {s.title}
                        </div>
                      </div>
                    </div>
                    <span className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {s.duration}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
                </div>

                <span
                  aria-hidden
                  className="absolute left-6 top-6 -translate-x-1/2 md:left-1/2"
                >
                  <span className="grid h-4 w-4 place-items-center rounded-full border-2 border-background bg-primary shadow-[var(--shadow-elevated)]" />
                </span>

                {i < STEPS.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute left-6 top-14 -translate-x-1/2 text-muted-foreground/50 md:left-1/2"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      <StepNav current="/installation" />
    </div>
  );
}