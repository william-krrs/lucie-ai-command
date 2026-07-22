import type { DiagnosticState } from "@/lib/lucie-store";

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

export const PLAN_LABELS: Record<PlanKey, string> = {
  essential: "Essential",
  pro: "Pro",
  premium: "Premium",
};

export const PLAN_TAGLINES: Record<PlanKey, string> = {
  essential: "Idéale pour un faible volume d'appels.",
  pro: "Conçue pour les entreprises en croissance.",
  premium: "Pensée pour les structures complexes et multi-sites.",
};

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

  // --- Tier ---
  let tier: Tier;
  if (score >= 80) tier = "excellent";
  else if (score >= 60) tier = "compatible";
  else if (score >= 40) tier = "limited";
  else tier = "refuse";

  // --- Plan ---
  let plan: PlanKey | null;
  let planReason: string;
  if (tier === "refuse") {
    plan = null;
    planReason =
      "Nous préférons ne pas vous proposer de formule tant que votre activité n'est pas prête à en tirer un vrai bénéfice.";
  } else if (
    state.callsPerWeek >= 200 ||
    state.employees >= 15 ||
    state.channels.length >= 3
  ) {
    plan = "premium";
    planReason =
      "Votre volume d'appels et la complexité de votre organisation justifient une offre Premium (multi-sites, CRM, campagnes sortantes).";
  } else if (state.callsPerWeek >= 60 || monthlyLostRevenue >= 1500) {
    plan = "pro";
    planReason =
      "Votre volume d'appels et votre potentiel de récupération placent Lucie Pro comme le meilleur rapport investissement / résultat.";
  } else {
    plan = "essential";
    planReason =
      "Votre activité peut démarrer sereinement avec Essential : réponse aux appels, qualification et prise de rendez-vous suffisent à couvrir vos besoins actuels.";
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
