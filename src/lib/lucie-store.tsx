import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type AcquisitionChannel =
  | "seo"
  | "google-ads"
  | "meta-ads"
  | "recommandation"
  | "bouche-a-oreille"
  | "autre";

export type DiagnosticState = {
  companyName: string;
  activity: string;
  employees: number;
  city: string;
  callsPerWeek: number;
  missedCalls: number;
  averageBasket: number;
  revenueGoal: number;
  clientsGoal: number;
  channels: AcquisitionChannel[];
  conversionRate: number;
};

const DEFAULT_STATE: DiagnosticState = {
  companyName: "",
  activity: "",
  employees: 5,
  city: "",
  callsPerWeek: 80,
  missedCalls: 22,
  averageBasket: 180,
  revenueGoal: 25000,
  clientsGoal: 40,
  channels: ["google-ads", "bouche-a-oreille"],
  conversionRate: 30,
};

type Ctx = {
  state: DiagnosticState;
  update: <K extends keyof DiagnosticState>(key: K, value: DiagnosticState[K]) => void;
  reset: () => void;
};

const LucieCtx = createContext<Ctx | null>(null);

export function LucieProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DiagnosticState>(DEFAULT_STATE);
  const value = useMemo<Ctx>(
    () => ({
      state,
      update: (key, value) => setState((s) => ({ ...s, [key]: value })),
      reset: () => setState(DEFAULT_STATE),
    }),
    [state],
  );
  return <LucieCtx.Provider value={value}>{children}</LucieCtx.Provider>;
}

export function useLucie() {
  const ctx = useContext(LucieCtx);
  if (!ctx) throw new Error("useLucie must be used inside LucieProvider");
  return ctx;
}

export function useMetrics() {
  const { state } = useLucie();
  const weeklyLostRevenue = state.missedCalls * state.averageBasket * (state.conversionRate / 100);
  const monthlyLostRevenue = weeklyLostRevenue * 4.33;
  const yearlyLostRevenue = weeklyLostRevenue * 52;
  const recoverableOpportunities = Math.round(state.missedCalls * 4.33 * (state.conversionRate / 100));
  const timeSavedHours = Math.round((state.missedCalls * 4.33 * 4) / 60); // 4 min per call
  const monthlyReceived = Math.round(state.callsPerWeek * 4.33);
  const monthlyMissed = Math.round(state.missedCalls * 4.33);
  const goalProgress = state.revenueGoal
    ? Math.min(100, Math.round((monthlyLostRevenue / state.revenueGoal) * 100))
    : 0;
  return {
    monthlyReceived,
    monthlyMissed,
    weeklyLostRevenue,
    monthlyLostRevenue,
    yearlyLostRevenue,
    recoverableOpportunities,
    timeSavedHours,
    goalProgress,
  };
}

export const CHANNEL_OPTIONS: { value: AcquisitionChannel; label: string }[] = [
  { value: "seo", label: "SEO" },
  { value: "google-ads", label: "Google Ads" },
  { value: "meta-ads", label: "Meta Ads" },
  { value: "recommandation", label: "Recommandation" },
  { value: "bouche-a-oreille", label: "Bouche à oreille" },
  { value: "autre", label: "Autre" },
];

export function formatEUR(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(n)));
}