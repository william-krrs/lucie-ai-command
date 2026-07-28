import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { computeRecommendation, type Recommendation } from "@/lib/recommendation";

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
  hasPartner: boolean;
  partnerCount: number;
  partnerName: string;
  partnerEmail: string;
  partners: Partner[];
};

export type Partner = {
  id: string;
  name: string;
  email: string;
  shareUrl?: string;
  sentAt?: string;
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
  hasPartner: false,
  partnerCount: 2,
  partnerName: "",
  partnerEmail: "",
  partners: [],
};

type Ctx = {
  state: DiagnosticState;
  update: <K extends keyof DiagnosticState>(key: K, value: DiagnosticState[K]) => void;
  reset: () => void;
};

const LucieCtx = createContext<Ctx | null>(null);

const DIAGNOSTIC_KEY = "lucie:diagnostic:v1";

function readPersisted(): DiagnosticState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DIAGNOSTIC_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return { ...DEFAULT_STATE, ...(parsed as Partial<DiagnosticState>) };
  } catch {
    return null;
  }
}

export function LucieProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DiagnosticState>(DEFAULT_STATE);
  const hydrated = useRef(false);

  // Hydrate from localStorage after mount to avoid SSR mismatches.
  useEffect(() => {
    const persisted = readPersisted();
    if (persisted) setState(persisted);
    hydrated.current = true;

    const onStorage = (e: StorageEvent) => {
      if (e.key === DIAGNOSTIC_KEY) {
        const next = readPersisted();
        if (next) setState(next);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Persist any change once hydrated.
  useEffect(() => {
    if (!hydrated.current || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(DIAGNOSTIC_KEY, JSON.stringify(state));
    } catch {
      // Storage quota / disabled — silently ignore.
    }
  }, [state]);

  const value = useMemo<Ctx>(
    () => ({
      state,
      update: (key, value) => setState((s) => ({ ...s, [key]: value })),
      reset: () => {
        setState(DEFAULT_STATE);
        if (typeof window !== "undefined") {
          try {
            window.localStorage.removeItem(DIAGNOSTIC_KEY);
          } catch {
            // ignore
          }
        }
      },
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

/** Reactive recommendation derived from the current diagnostic state. */
export function useRecommendation(): Recommendation {
  const { state } = useLucie();
  const m = useMetrics();
  return useMemo(
    () => computeRecommendation(state, m.monthlyLostRevenue),
    [state, m.monthlyLostRevenue],
  );
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