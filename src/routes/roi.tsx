import { createFileRoute } from "@tanstack/react-router";
import { TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { formatEUR, useLucie, useMetrics } from "@/lib/lucie-store";

export const Route = createFileRoute("/roi")({
  head: () => ({
    meta: [
      { title: "Calculateur ROI — Lucie Command Center" },
      {
        name: "description",
        content: "Calculez en direct le chiffre d'affaires que vos appels manqués vous coûtent chaque semaine, mois et année.",
      },
      { property: "og:title", content: "Calculateur ROI — Lucie" },
      { property: "og:description", content: "Le vrai coût de vos appels manqués, en temps réel." },
    ],
  }),
  component: Roi,
});

function Roi() {
  const { state, update } = useLucie();
  const m = useMetrics();

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Étape 02 · ROI"
        title="Calculateur de ROI"
        description="Ajustez les curseurs pour projeter le chiffre d'affaires que vous récupérez avec Lucie."
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-5 rounded-3xl border border-border bg-card p-6 md:p-8 shadow-[var(--shadow-card)]">
          <SliderRow
            label="Appels reçus / semaine"
            value={state.callsPerWeek}
            min={0}
            max={500}
            step={5}
            onChange={(v) => update("callsPerWeek", v)}
          />
          <SliderRow
            label="Appels manqués / semaine"
            value={state.missedCalls}
            min={0}
            max={state.callsPerWeek || 100}
            step={1}
            onChange={(v) => update("missedCalls", v)}
          />
          <SliderRow
            label="Panier moyen (€)"
            value={state.averageBasket}
            min={0}
            max={5000}
            step={10}
            onChange={(v) => update("averageBasket", v)}
            suffix="€"
          />
          <SliderRow
            label="Taux de conversion (%)"
            value={state.conversionRate}
            min={0}
            max={100}
            step={1}
            onChange={(v) => update("conversionRate", v)}
            suffix="%"
          />

          <div className="grid grid-cols-2 gap-3 pt-2">
            <MiniInput
              label="Appels manqués"
              value={state.missedCalls}
              onChange={(v) => update("missedCalls", v)}
            />
            <MiniInput
              label="Panier moyen (€)"
              value={state.averageBasket}
              onChange={(v) => update("averageBasket", v)}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <RoiCard label="CA perdu / semaine" value={formatEUR(m.weeklyLostRevenue)} />
            <RoiCard label="CA perdu / mois" value={formatEUR(m.monthlyLostRevenue)} highlight />
            <RoiCard label="CA perdu / an" value={formatEUR(m.yearlyLostRevenue)} />
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[0.08] to-primary/[0.02] p-8 shadow-[var(--shadow-elevated)]">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                Manque à gagner
              </div>
              <p className="mt-4 text-xl leading-snug text-foreground md:text-2xl">
                Vous laissez potentiellement
              </p>
              <p className="mt-2 text-5xl md:text-6xl font-semibold tracking-tight tabular-nums text-primary">
                {formatEUR(m.monthlyLostRevenue)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                de chiffre d'affaires sur la table chaque mois.
              </p>

              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-6">
                <RoiSummary
                  icon={TrendingDown}
                  label="Sans Lucie"
                  value={formatEUR(m.monthlyLostRevenue)}
                  tone="alert"
                />
                <RoiSummary
                  icon={TrendingUp}
                  label="Récupéré avec Lucie"
                  value={formatEUR(m.monthlyLostRevenue * 0.75)}
                  tone="success"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {value.toLocaleString("fr-FR")}
          {suffix ? ` ${suffix}` : ""}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={Math.max(max, min + 1)}
        step={step}
        onValueChange={(v) => onChange(v[0])}
      />
    </div>
  );
}

function MiniInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="tabular-nums"
      />
    </div>
  );
}

function RoiCard({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={
        "rounded-2xl border p-5 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-0.5 " +
        (highlight
          ? "border-primary/30 bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground")
      }
    >
      <div className={"text-[11px] uppercase tracking-widest " + (highlight ? "text-primary-foreground/70" : "text-muted-foreground")}>
        {label}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
    </div>
  );
}

function RoiSummary({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "alert" | "success";
}) {
  const cls = tone === "alert" ? "text-destructive bg-destructive/10" : "text-[oklch(0.55_0.17_155)] bg-[oklch(0.65_0.17_155)]/10";
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <div className={"grid h-8 w-8 place-items-center rounded-lg " + cls}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
      <div className="mt-3 text-xl font-semibold tracking-tight tabular-nums text-foreground">
        {value}
      </div>
    </div>
  );
}