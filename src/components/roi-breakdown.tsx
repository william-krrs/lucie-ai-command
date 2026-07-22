import { useState } from "react";
import { ChevronDown, Calculator, TrendingUp, Clock, Users } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { formatEUR, useLucie, useMetrics, useRecommendation } from "@/lib/lucie-store";

export function RoiBreakdown() {
  const { state, update } = useLucie();
  const m = useMetrics();
  const rec = useRecommendation();
  const [openCalc, setOpenCalc] = useState(true);
  const [openHyp, setOpenHyp] = useState(false);

  const monthlyMissed = state.missedCalls * 4.33;
  const convertedOpps = monthlyMissed * (state.conversionRate / 100);
  const monthlyLoss = m.monthlyLostRevenue;
  const recovered = rec.estimatedMonthlyRoi;

  return (
    <section
      aria-labelledby="roi-breakdown-title"
      className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-widest text-primary">
            ROI · Ventilation interactive
          </div>
          <h2
            id="roi-breakdown-title"
            className="mt-1 text-lg font-semibold tracking-tight text-foreground sm:text-xl"
          >
            D'où vient le ROI estimé
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Ajustez les hypothèses ci-dessous : les calculs et l'impact projeté
            se recalculent en direct.
          </p>
        </div>
        <div className="hidden shrink-0 rounded-2xl border border-border bg-background px-4 py-3 text-right sm:block">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
            ROI mensuel estimé
          </div>
          <div className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">
            {formatEUR(recovered)}
          </div>
        </div>
      </div>

      {/* Hypothèses interactives */}
      <div className="mt-6 grid gap-5 rounded-2xl border border-border bg-background p-5 md:grid-cols-3">
        <SliderInput
          label="Appels manqués / semaine"
          value={state.missedCalls}
          min={0}
          max={100}
          step={1}
          suffix="appels"
          onChange={(v) => update("missedCalls", v)}
        />
        <SliderInput
          label="Panier moyen"
          value={state.averageBasket}
          min={20}
          max={2000}
          step={10}
          suffix="€"
          onChange={(v) => update("averageBasket", v)}
        />
        <SliderInput
          label="Taux de conversion"
          value={state.conversionRate}
          min={5}
          max={80}
          step={1}
          suffix="%"
          onChange={(v) => update("conversionRate", v)}
        />
      </div>

      {/* Calculs pas à pas */}
      <Fold
        icon={Calculator}
        title="Calculs pas à pas"
        open={openCalc}
        onToggle={() => setOpenCalc((v) => !v)}
      >
        <ol className="space-y-3">
          <CalcRow
            step="1"
            label="Appels manqués / mois"
            formula={`${state.missedCalls} × 4,33`}
            result={`${Math.round(monthlyMissed).toLocaleString("fr-FR")} appels`}
          />
          <CalcRow
            step="2"
            label="Opportunités récupérables"
            formula={`${Math.round(monthlyMissed)} × ${state.conversionRate}%`}
            result={`${Math.round(convertedOpps).toLocaleString("fr-FR")} clients`}
          />
          <CalcRow
            step="3"
            label="CA potentiel perdu / mois"
            formula={`${Math.round(convertedOpps)} × ${formatEUR(state.averageBasket)}`}
            result={formatEUR(monthlyLoss)}
            emphasize
          />
          <CalcRow
            step="4"
            label="ROI Lucie estimé (75 %)"
            formula={`${formatEUR(monthlyLoss)} × 75 %`}
            result={formatEUR(recovered)}
            emphasize
          />
        </ol>
      </Fold>

      {/* Impacts */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Impact
          icon={TrendingUp}
          label="Mensuel récupéré"
          value={formatEUR(recovered)}
          hint="Base : 75 % des appels manqués reconvertis."
        />
        <Impact
          icon={Users}
          label="Nouveaux clients / mois"
          value={`+${Math.round(convertedOpps * 0.75).toLocaleString("fr-FR")}`}
          hint="Rendez-vous qualifiés capturés par Lucie."
        />
        <Impact
          icon={Clock}
          label="Temps équipe économisé"
          value={`${m.timeSavedHours} h / mois`}
          hint="Appels traités sans mobiliser vos collaborateurs."
        />
      </div>

      {/* Projections */}
      <div className="mt-4 grid gap-3 rounded-2xl border border-dashed border-border bg-background p-5 sm:grid-cols-3">
        <Projection label="Sur 3 mois" value={formatEUR(recovered * 3)} />
        <Projection label="Sur 6 mois" value={formatEUR(recovered * 6)} />
        <Projection label="Sur 12 mois" value={formatEUR(recovered * 12)} highlight />
      </div>

      {/* Hypothèses détaillées */}
      <Fold
        icon={Calculator}
        title="Hypothèses de calcul"
        open={openHyp}
        onToggle={() => setOpenHyp((v) => !v)}
      >
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">4,33 semaines / mois</strong> —
            moyenne standard pour lisser les variations mensuelles.
          </li>
          <li>
            <strong className="text-foreground">Taux de reprise Lucie 75 %</strong> —
            base observée sur les clients existants (rappel immédiat + prise de RDV).
          </li>
          <li>
            <strong className="text-foreground">Panier moyen</strong> déclaré par
            vous — utilisé tel quel, sans marge de sécurité.
          </li>
          <li>
            <strong className="text-foreground">Estimation prudente</strong> :
            les gains de rétention, d'image et de notation ne sont pas comptés.
          </li>
        </ul>
      </Fold>
    </section>
  );
}

function SliderInput({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-[11px] uppercase tracking-widest text-muted-foreground">
          {label}
        </label>
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {value.toLocaleString("fr-FR")}
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            {suffix}
          </span>
        </span>
      </div>
      <Slider
        className="mt-2"
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        aria-label={label}
      />
    </div>
  );
}

function Fold({
  icon: Icon,
  title,
  open,
  onToggle,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-border bg-background">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? <div className="border-t border-border px-5 py-4">{children}</div> : null}
    </div>
  );
}

function CalcRow({
  step,
  label,
  formula,
  result,
  emphasize,
}: {
  step: string;
  label: string;
  formula: string;
  result: string;
  emphasize?: boolean;
}) {
  return (
    <li className="flex flex-col gap-1 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-muted text-[11px] font-semibold text-foreground/70">
          {step}
        </span>
        <div>
          <div className="text-sm font-medium text-foreground">{label}</div>
          <div className="text-xs font-mono text-muted-foreground">{formula}</div>
        </div>
      </div>
      <div
        className={`text-sm font-semibold tabular-nums ${emphasize ? "text-primary" : "text-foreground"}`}
      >
        = {result}
      </div>
    </li>
  );
}

function Impact({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-foreground">
        {value}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Projection({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-3 text-center ${highlight ? "bg-primary/10 text-primary" : "text-foreground"}`}
    >
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}