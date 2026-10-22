import type { DiagnosticState } from "@/lib/lucie-store";
import { OVERAGE_LABEL } from "@/lib/offer-terms";

export type PlanKey = "essential" | "pro" | "premium";

export type Tier = "excellent" | "compatible" | "limited" | "refuse";
export type Priority = "high" | "medium" | "low";

export type Recommendation = {
  /** Overall compatibility score, 0-100. */
  score: number;
  /** Human-readable tier bucket. */
  tier: Tier;
  /** Recommended plan — null when the tier is `refuse`. */
  plan: PlanKey | null;
  /** Commercial priority index for the sales team. */
  priority: Priority;
  /** Estimated recovered monthly revenue with Lucie (75% of loss). */
  estimatedMonthlyRoi: number;
  /** Bullet list of positive triggers that led to the recommendation. */
  justifications: string[];
  /** Bullet list of things that lowered the score. */
  concerns: string[];
  /** Short reason why this specific plan was chosen. */
  planReason: string;
  /** Sub-scores exposed for future scoring criteria / debugging. */
  breakdown: {
    volume: number;
    pain: number;
    roi: number;
    investment: number;
    structure: number;
  };
};

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const PAID_CHANNELS = new Set(["google-ads", "meta-ads", "seo"]);

export const TIER_LABELS: Record<Tier, string> = {
  excellent: "Excellent fit",
  compatible: "Compatible",
  limited: "Compatibilité limitée",
  refuse: "Non recommandé",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: "Priorité élevée",
  medium: "Priorité moyenne",
  low: "Priorité faible",
};

export const PRIORITY_EMOJI: Record<Priority, string> = {
  high: "🔥",
  medium: "🟡",
  low: "⚪",
};

export type PriorityCta = {
  emoji: string;
  eyebrow: string;
  title: string;
  description: string;
  primaryLabel: string;
  secondaryLabel: string;
};

export const PRIORITY_CTA: Record<Priority, PriorityCta> = {
  high: {
    emoji: "🔥",
    eyebrow: "Priorité élevée · À traiter cette semaine",
    title: "Réservez votre créneau de démarrage prioritaire",
    description:
      "Votre profil présente un potentiel de récupération estimé. Notre équipe vous rappelle sous 24 h pour préparer la mise en place en 96 h.",
    primaryLabel: "Démarrer maintenant",
    secondaryLabel: "Voir la démonstration",
  },
  medium: {
    emoji: "🟡",
    eyebrow: "Priorité moyenne · À planifier",
    title: "Poursuivez vers la démonstration et la formule adaptée",
    description:
      "Lucie peut vous apporter de la valeur. Regardez la démonstration puis validez la formule recommandée pour cadrer le déploiement à votre rythme.",
    primaryLabel: "Voir la formule recommandée",
    secondaryLabel: "Voir la démonstration",
  },
  low: {
    emoji: "⚪",
    eyebrow: "Priorité faible · Explorer sans engagement",
    title: "Explorez Lucie à votre rythme",
    description:
      "L'impact immédiat serait limité aujourd'hui. Découvrez la démonstration et gardez notre contact : nous referons un point dès que votre activité évoluera.",
    primaryLabel: "Voir la démonstration",
    secondaryLabel: "Consulter les offres",
  },
};

export const PLAN_LABELS: Record<PlanKey, string> = {
  essential: "Essential",
  pro: "Pro",
  premium: "Premium",
};

export const PLAN_TAGLINES: Record<PlanKey, string> = {
  essential: `Idéale pour un faible volume d'appels. 149 €/mois — 300 min incluses. ${OVERAGE_LABEL}`,
  pro: `Conçue pour les entreprises en croissance. 299 €/mois — 800 min incluses. ${OVERAGE_LABEL}`,
  premium: `Pensée pour les structures complexes et multi-sites. 960 €/mois — 2 500 min incluses. ${OVERAGE_LABEL}`,
};

/** Durée moyenne retenue par appel qualifié (minutes). */
export const MINUTES_PER_CALL = 2;

/** Calculs dérivés du diagnostic (spécification Spark Media). */
export function computeVolumes(state: DiagnosticState) {
  const appelsRecusMois = Math.round(state.callsPerWeek * 4.33);
  const appelsManquesMois = Math.round(state.missedCalls * 4.33);
  const pertesMensuelles = Math.round(
    appelsManquesMois * (state.conversionRate / 100) * state.averageBasket,
  );
  const minutesEstimeesDebordement = appelsManquesMois * MINUTES_PER_CALL;
  const minutesEstimeesStandardTotal = appelsRecusMois * MINUTES_PER_CALL;
  const isEligible = state.missedCalls >= 5 && pertesMensuelles >= 300;
  return {
    appelsRecusMois,
    appelsManquesMois,
    pertesMensuelles,
    minutesEstimeesDebordement,
    minutesEstimeesStandardTotal,
    isEligible,
  };
}

export const PLAN_BADGES: Record<PlanKey, string> = {
  essential: "Recommandé pour votre profil",
  pro: "Recommandé pour votre entreprise",
  premium: "Recommandé Grand Volume",
};

export const INELIGIBLE_TITLE = "Lucie n'est pas recommandée pour votre volume actuel";
export const INELIGIBLE_TEXT =
  "Avec moins de 5 appels manqués par semaine, votre flux est insuffisant pour rentabiliser un forfait à 149 €/mois. Nous vous conseillons de conserver votre organisation actuelle et de revenir vers nous lorsque votre volume dépassera 15 à 20 appels par semaine.";

export function computeRecommendation(
  state: DiagnosticState,
  monthlyLostRevenue: number,
): Recommendation {
  // --- Sub-scores (each capped). Sum caps at 100. ---
  const volume = clamp((state.callsPerWeek / 200) * 25, 0, 25);
  const pain = clamp((state.missedCalls / 30) * 25, 0, 25);
  const roi = clamp((monthlyLostRevenue / 5000) * 25, 0, 25);
  const hasPaidChannel = state.channels.some((c) => PAID_CHANNELS.has(c));
  const investment = hasPaidChannel ? 15 : 5;
  const structure = clamp(state.employees, 0, 10);

  const score = Math.round(volume + pain + roi + investment + structure);
  const v = computeVolumes(state);

  // --- Tier : l'éligibilité (volume/pertes) décide seule du refus ---
  let tier: Tier;
  if (!v.isEligible) tier = "refuse";
  else if (score >= 80) tier = "excellent";
  else if (score >= 60) tier = "compatible";
  else tier = "limited";

  // --- Plan (matrice : Premium > Pro > Essentiel) ---
  let plan: PlanKey | null;
  let planReason: string;
  const missed = state.missedCalls;
  const team = state.employees;
  if (tier === "refuse") {
    plan = null;
    planReason = INELIGIBLE_TEXT;
  } else if (missed > 90 || team > 10 || v.minutesEstimeesDebordement > 800) {
    plan = "premium";
    planReason =
      "Volume critique. Le forfait 2 500 min garantit la continuité 24/7 et le multi-lignes simultané pour l'ensemble de votre flotte de techniciens.";
  } else if (missed >= 35 || team >= 4) {
    plan = "pro";
    planReason = `Vos ${v.minutesEstimeesDebordement.toLocaleString("fr-FR")} min estimées nécessitent le forfait 800 min pour absorber les pics de débordement en journée et sécuriser vos astreintes sans risque de hors-forfait.`;
  } else {
    plan = "essential";
    planReason =
      "Vos 300 minutes incluses couvrent largement vos besoins sur chantiers et soirs/week-ends.";
  }

  // --- Priority ---
  let priority: Priority;
  if (tier === "refuse") priority = "low";
  else if (score >= 80 && monthlyLostRevenue >= 3000) priority = "high";
  else if (score >= 60) priority = "medium";
  else priority = "low";

  // --- Justifications / concerns ---
  const justifications: string[] = [];
  const concerns: string[] = [];

  if (state.missedCalls >= 10)
    justifications.push(
      `Vous perdez ${state.missedCalls} appels par semaine — un manque à gagner récurrent.`,
    );
  else if (state.missedCalls > 0)
    concerns.push(
      "Peu d'appels manqués actuellement : le levier immédiat est plus faible.",
    );

  if (state.callsPerWeek >= 60)
    justifications.push(
      "Votre activité dépend fortement du téléphone comme point de contact.",
    );
  else concerns.push("Votre volume d'appels est encore modeste.");

  if (hasPaidChannel)
    justifications.push(
      "Vous investissez déjà dans votre acquisition — Lucie sécurise ces investissements.",
    );
  else
    concerns.push(
      "Vous n'investissez pas encore en acquisition payante : le ROI est plus long à matérialiser.",
    );

  if (state.employees >= 3)
    justifications.push(
      "Votre entreprise est suffisamment structurée pour intégrer Lucie sans friction.",
    );
  else
    concerns.push(
      "Structure très légère : Lucie peut aider, mais l'impact reste limité.",
    );

  if (monthlyLostRevenue >= 2000)
    justifications.push(
      "Le retour sur investissement estimé est élevé au regard des formules Lucie.",
    );

  return {
    score,
    tier,
    plan,
    priority,
    estimatedMonthlyRoi: Math.round(monthlyLostRevenue * 0.75),
    justifications,
    concerns,
    planReason,
    breakdown: { volume, pain, roi, investment, structure },
  };
}
