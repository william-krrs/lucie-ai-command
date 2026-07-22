import { createFileRoute, Link } from "@tanstack/react-router";
import {
  PhoneIncoming,
  PhoneMissed,
  Euro,
  TrendingUp,
  Clock,
  Target,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StepNav } from "@/components/step-nav";
import {
  CHANNEL_OPTIONS,
  formatEUR,
  useLucie,
  useMetrics,
  type AcquisitionChannel,
} from "@/lib/lucie-store";

export const Route = createFileRoute("/diagnostic")({
  head: () => ({
    meta: [
      { title: "Diagnostic — Lucie Command Center" },
      {
        name: "description",
        content: "Diagnostic interactif : évaluez le chiffre d'affaires que vous laissez sur la table chaque mois.",
      },
      { property: "og:title", content: "Diagnostic — Lucie" },
      { property: "og:description", content: "Le diagnostic commercial en direct de Lucie." },
      { property: "og:url", content: "https://lucie-ai-command.lovable.app/diagnostic" },
    ],
    links: [{ rel: "canonical", href: "https://lucie-ai-command.lovable.app/diagnostic" }],
  }),
  component: Diagnostic,
});

function Diagnostic() {
  const { state, update } = useLucie();
  const m = useMetrics();

  const toggleChannel = (v: AcquisitionChannel) => {
    update(
      "channels",
      state.channels.includes(v) ? state.channels.filter((c) => c !== v) : [...state.channels, v],
    );
  };

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Étape 01 · Analyse"
        title="Diagnostic commercial"
        description="Répondez aux questions à gauche — les indicateurs à droite se recalculent en temps réel."
        actions={
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/roi">
              Voir le ROI détaillé <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* FORM */}
        <div className="rounded-3xl border border-border bg-card p-6 md:p-8 shadow-[var(--shadow-card)]">
          <SectionTitle step="A" title="Votre entreprise" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom de l'entreprise">
              <Input
                value={state.companyName}
                onChange={(e) => update("companyName", e.target.value)}
                placeholder="Ex. Boulangerie Léon"
              />
            </Field>
            <Field label="Activité">
              <Input
                value={state.activity}
                onChange={(e) => update("activity", e.target.value)}
                placeholder="Ex. Restauration"
              />
            </Field>
            <Field label="Nombre de collaborateurs">
              <NumberInput value={state.employees} onChange={(v) => update("employees", v)} />
            </Field>
            <Field label="Ville">
              <Input
                value={state.city}
                onChange={(e) => update("city", e.target.value)}
                placeholder="Paris"
              />
            </Field>
          </div>

          <SectionTitle step="B" title="Volume d'appels" className="mt-8" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Appels par semaine">
              <NumberInput value={state.callsPerWeek} onChange={(v) => update("callsPerWeek", v)} />
            </Field>
            <Field label="Appels manqués / semaine">
              <NumberInput value={state.missedCalls} onChange={(v) => update("missedCalls", v)} />
            </Field>
            <Field label="Panier moyen (€)">
              <NumberInput value={state.averageBasket} onChange={(v) => update("averageBasket", v)} />
            </Field>
            <Field label="Taux de conversion (%)">
              <NumberInput
                value={state.conversionRate}
                onChange={(v) => update("conversionRate", Math.min(100, Math.max(0, v)))}
              />
            </Field>
          </div>

          <SectionTitle step="C" title="Objectifs" className="mt-8" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Objectif de CA mensuel (€)">
              <NumberInput value={state.revenueGoal} onChange={(v) => update("revenueGoal", v)} />
            </Field>
            <Field label="Objectif de clients / mois">
              <NumberInput value={state.clientsGoal} onChange={(v) => update("clientsGoal", v)} />
            </Field>
          </div>

          <SectionTitle step="D" title="Comment trouvez-vous vos clients ?" className="mt-8" />
          <div className="flex flex-wrap gap-2">
            {CHANNEL_OPTIONS.map((c) => {
              const active = state.channels.includes(c.value);
              return (
                <button
                  key={c.value}
                  onClick={() => toggleChannel(c.value)}
                  className={
                    "rounded-full border px-4 py-2 text-sm transition-all duration-200 " +
                    (active
                      ? "border-primary bg-primary text-primary-foreground shadow-[var(--shadow-elevated)]"
                      : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-accent")
                  }
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* KPIs */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Tableau de bord live
              </div>
              <div className="text-lg font-semibold tracking-tight text-foreground">
                Indicateurs recalculés en temps réel
              </div>
            </div>
            <Badge className="rounded-full bg-primary/10 text-primary hover:bg-primary/10">
              Auto-sync
            </Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Kpi
              icon={PhoneIncoming}
              label="Appels reçus / mois"
              value={m.monthlyReceived.toLocaleString("fr-FR")}
              tone="neutral"
            />
            <Kpi
              icon={PhoneMissed}
              label="Appels manqués / mois"
              value={m.monthlyMissed.toLocaleString("fr-FR")}
              tone="alert"
            />
            <Kpi
              icon={Euro}
              label="CA potentiel perdu / mois"
              value={formatEUR(m.monthlyLostRevenue)}
              tone="alert"
              big
            />
            <Kpi
              icon={TrendingUp}
              label="Opportunités récupérables"
              value={m.recoverableOpportunities.toLocaleString("fr-FR")}
              tone="success"
            />
            <Kpi
              icon={Clock}
              label="Temps économisé / mois"
              value={`${m.timeSavedHours} h`}
              tone="brand"
            />
            <Kpi
              icon={Target}
              label="Objectif mensuel"
              value={`${m.goalProgress}%`}
              tone="brand"
              progress={m.goalProgress}
            />
          </div>

          <div className="rounded-3xl border border-primary/20 bg-primary/[0.04] p-5 shadow-[var(--shadow-card)]">
            <div className="text-[11px] uppercase tracking-widest text-primary">Résumé exécutif</div>
            <p className="mt-2 text-[15px] leading-relaxed text-foreground">
              À votre volume d'appels actuel, vous laissez potentiellement{" "}
              <span className="font-semibold text-primary">
                {formatEUR(m.monthlyLostRevenue)}
              </span>{" "}
              de chiffre d'affaires sur la table chaque mois, soit{" "}
              <span className="font-semibold text-primary">
                {formatEUR(m.yearlyLostRevenue)}
              </span>{" "}
              par an.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ step, title, className = "" }: { step: string; title: string; className?: string }) {
  return (
    <div className={"mb-4 flex items-center gap-3 " + className}>
      <span className="grid h-6 w-6 place-items-center rounded-md bg-primary/10 text-[10px] font-semibold text-primary">
        {step}
      </span>
      <div className="text-sm font-semibold tracking-tight text-foreground">{title}</div>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function NumberInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <Input
      type="number"
      inputMode="numeric"
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className="tabular-nums"
    />
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone = "neutral",
  big = false,
  progress,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "neutral" | "alert" | "success" | "brand";
  big?: boolean;
  progress?: number;
}) {
  const toneMap: Record<string, string> = {
    neutral: "bg-muted text-foreground",
    alert: "bg-destructive/10 text-destructive",
    success: "bg-[oklch(0.65_0.17_155)]/10 text-[oklch(0.55_0.17_155)]",
    brand: "bg-primary/10 text-primary",
  };
  return (
    <div className={"rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)] " + (big ? "sm:col-span-2" : "")}>
      <div className="flex items-center justify-between">
        <div className={"grid h-9 w-9 place-items-center rounded-lg " + toneMap[tone]}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Live
        </span>
      </div>
      <div className={"mt-6 font-semibold tracking-tight tabular-nums " + (big ? "text-4xl" : "text-2xl")}>
        {value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
      {typeof progress === "number" && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

// Kept to satisfy select import tree-shaking if reused later
export const _selectRefs = { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };