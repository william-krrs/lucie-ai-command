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
import { useBooking } from "@/lib/booking-store";

export const Route = createFileRoute("/installation")({
  head: () => ({
    meta: [
      { title: "Installation — Lucie Command Center" },
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
  { icon: ScanSearch, title: "Analyse", desc: "Audit de vos flux d'appels, de vos scripts et de vos objectifs commerciaux.", duration: "1 à 2 jours" },
  { icon: Settings2, title: "Paramétrage Lucie", desc: "Configuration de sa voix, ses réponses, ses règles de qualification.", duration: "2 à 3 jours" },
  { icon: FlaskConical, title: "Tests", desc: "Simulations d'appels réels pour valider le comportement de Lucie.", duration: "2 jours" },
  { icon: Calendar, title: "Connexion agenda", desc: "Synchronisation Google / Outlook / Calendly avec règles de disponibilité.", duration: "1 jour" },
  { icon: PhoneCall, title: "Connexion téléphone", desc: "Portage ou renvoi de votre numéro professionnel, sans coupure.", duration: "1 à 3 jours" },
  { icon: Rocket, title: "Mise en production", desc: "Lucie prend ses premiers appels réels, monitoring 24/7 activé.", duration: "Jour J" },
  { icon: Repeat, title: "Optimisation continue", desc: "Suivi hebdomadaire des performances et ajustements précis.", duration: "En continu" },
];

function Installation() {
  const { isUnlocked } = useBooking();
  if (!isUnlocked) {
    return (
      <LockedPage
        title="Installation verrouillée"
        description="Cette page se débloque le jour de votre rendez-vous, une fois votre formule choisie."
      />
    );
  }
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Étape 04 · Déploiement"
        title="Timeline d'installation"
        description="Un parcours de mise en production précis, industriel, mené par nos équipes."
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
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