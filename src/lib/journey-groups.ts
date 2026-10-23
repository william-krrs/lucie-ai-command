// Regroupement visuel des sous-pages du parcours en 4 étapes affichées au visiteur.
// Les sous-pages et leurs verrous restent inchangés.
export const JOURNEY_GROUPS = [
  { key: "diagnostic", label: "Diagnostic", paths: ["/", "/diagnostic"] },
  { key: "resultats", label: "Résultats", paths: ["/roi", "/recommandation"] },
  { key: "demo-offre", label: "Démonstration & offre", paths: ["/demonstration", "/offres"] },
  {
    key: "mise-en-place",
    label: "Mise en place",
    paths: ["/merci", "/preparation", "/installation", "/rdv-test"],
  },
] as const;

export function groupIndexForPath(pathname: string): number {
  return JOURNEY_GROUPS.findIndex((g) => (g.paths as readonly string[]).includes(pathname));
}
