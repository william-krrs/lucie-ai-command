# Tests de régression visuelle

Ces tests capturent des captures d'écran des composants clés (KPI,
cartes tarifaires + états sélectionnés, tableau comparateur, FAQ
ouverte/fermée) et les comparent pixel par pixel à des images de
référence.

## Structure

- `baselines/` — images de référence versionnées (à committer).
- `current/` — sortie du dernier run (ignorée par Git).
- `diffs/` — masque des pixels changés pour chaque cible en échec.

## Commandes

```bash
# comparer contre les baselines
python3 scripts/visual-regression.py

# mettre à jour toutes les baselines après un changement UI voulu
python3 scripts/visual-regression.py --update

# filtrer par nom
python3 scripts/visual-regression.py --only pricing faq
```

Le wrapper Vitest `tests/visual-regression.test.ts` fait la même
chose côté CI et échoue si un composant dérive de plus de 0,5% de
pixels par rapport à sa baseline.

## Cibles couvertes

| Nom                              | Route      | Sélecteur                       |
| -------------------------------- | ---------- | ------------------------------- |
| `kpi-grid`                       | `/`        | `[data-vr="kpi-grid"]`          |
| `pricing-cards`                  | `/offres`  | `[data-vr="pricing-cards"]`     |
| `pricing-cards-pro-selected`     | `/offres`  | idem + clic sur "Pro"           |
| `pricing-cards-premium-selected` | `/offres`  | idem + clic sur "Premium"       |
| `comparison-table`               | `/offres`  | `[data-vr="comparison-table"]`  |
| `faq-collapsed`                  | `/faq`     | `[data-vr="faq"]`               |
| `faq-first-open`                 | `/faq`     | idem + première question ouverte|

Pour ajouter une cible, éditez la liste `TARGETS` dans
`scripts/visual-regression.py`. Ajoutez un attribut `data-vr="…"`
stable côté composant si nécessaire.

## Rendre les runs stables

Le script :

- utilise un viewport fixe (1280×1800) et `device_scale_factor: 1` ;
- attend `document.fonts.ready` avant chaque capture ;
- coupe animations et transitions via un `<style>` injecté ;
- tolère 6 unités de bruit par canal (anti-aliasing) et 0,5% de
  pixels différents avant d'échouer.

Si les baselines dérivent malgré tout entre machines, régénérez-les
dans le même environnement que la CI puis committez le résultat.