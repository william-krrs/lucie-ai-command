# Architecture de verrouillage par étapes métier

Remplacer le booléen unique `isUnlocked` (basé sur le RDV Démo) par un état de parcours métier, avec la base de données comme source de vérité pour les étapes sensibles.

## 1. Modèle d'état métier

Un enregistrement de parcours par client (`journey_state`), plus les données déjà existantes :

| Étape | Source de vérité | Valeur par défaut |
|---|---|---|
| RDV Démo confirmé | `bookings` (`booking_type = 'r2_demo'`, `status_norm = 'confirmed'`) | aucun |
| Démonstration réalisée | `journey_state.demo_completed_at` | null (verrouillé) |
| Paiement | `journey_state.payment_status` (`unpaid` / `paid`) | `unpaid` |
| Configuration envoyée | `preparation_submissions` (ligne existante pour l'utilisateur) | aucune |
| Installation prête | `journey_state.installation_status` (`not_started` / `in_progress` / `ready_for_test`) | `not_started` |

Aucun prospect n'est marqué payé, aucune démo n'est marquée réalisée : tout démarre verrouillé.

## 2. Base de données

Nouvelle table `public.journey_state` :
- `user_id` (clé, un état par utilisateur), `client_ref`
- `demo_completed_at` (timestamp, null)
- `payment_status` (enum `payment_status` : `unpaid`, `paid`, `refunded`) — défaut `unpaid`
- `paid_at`, `paid_plan`, `stripe_session_id`, `stripe_customer_id` (préparés pour Stripe, vides)
- `installation_status` (enum `installation_status` : `not_started`, `in_progress`, `ready_for_test`, `live`) — défaut `not_started`
- `created_at`, `updated_at` (+ trigger existant `set_updated_at`)

Accès : GRANT + RLS — l'utilisateur peut lire et créer sa propre ligne ; **aucune** politique ne permet au client de passer `payment_status` à `paid` ni `installation_status` à `ready_for_test`. Ces transitions ne seront possibles que côté serveur (service role : futur webhook Stripe, action interne admin).

Ajout aussi d'une politique de lecture de ses propres `preparation_submissions` (aujourd'hui la table est fermée en lecture), pour pouvoir vérifier serveur-side que la configuration a été soumise.

## 3. Couche centrale `useJourneyAccess()`

Nouveau `src/lib/journey-access.tsx` :
- serveur : `getJourneyState` (server function authentifiée) → RDV confirmés, `journey_state`, présence d'une soumission de configuration ;
- client : provider + hook exposant

```
canViewDemonstration = r2_demo confirmé
canViewOffers        = demo_completed (fallback court terme : r2_demo confirmé)
canConfigure         = payment_status === 'paid'
canViewInstallation  = configuration soumise (preparation_submissions)
canBookSetupTest     = installation_status === 'ready_for_test'
```
Plus `isLoading`, les raisons de blocage (pour l'écran verrouillé) et le bypass `?admin=lucie` / `UNLOCK_ALL_PAGES` conservé pour la démo interne.

Le localStorage reste un cache d'affichage (RDV, brouillon) mais ne peut plus débloquer Configuration, Installation ni RDV Test : ces trois permissions ne sont vraies que si le serveur a répondu.

Note court terme : `canViewOffers` retombe sur « RDV Démo confirmé » tant que `demo_completed_at` n'est renseigné nulle part, pour ne pas casser le parcours en cours. La structure `demo_completed_at` est en place et prendra le relais dès qu'une action « démonstration terminée » sera branchée.

## 4. Règles exactes par route

| Route | Règle |
|---|---|
| `/`, `/diagnostic`, `/roi`, `/recommandation`, `/faq`, `/merci` | libres |
| `/demonstration` | `canViewDemonstration` |
| `/offres` | `canViewOffers` |
| `/preparation` | `canConfigure` (paiement serveur ; `?plan=` reste un simple affichage) |
| `/installation` | `canViewInstallation` |
| `/rdv-test` | `canBookSetupTest` |

`/merci` reste accessible après le choix d'une formule mais ne vaut pas preuve de paiement.

## 5. Fichiers modifiés

- nouveau : `src/lib/journey-state.functions.ts`, `src/lib/journey-access.tsx`
- modifiés : `src/routes/demonstration.tsx`, `offres.tsx`, `preparation.tsx`, `installation.tsx`, `rdv-test.tsx`
- modifiés : `src/components/locked-page.tsx` (message adapté à l'étape bloquante), `src/components/sidebar-progress.tsx`, `src/components/app-shell.tsx` (mêmes règles centrales)
- `src/lib/booking-store.tsx` : `isUnlocked` marqué déprécié, réduit au seul RDV Démo, plus utilisé pour le gating des routes
- `src/routes/__root.tsx` : montage du provider

## 6. Restera à connecter à Stripe

- Un webhook `/api/public/hooks/stripe` vérifiant la signature Stripe, qui passe `payment_status = 'paid'`, `paid_plan`, `paid_at` en service role sur `checkout.session.completed`.
- Le rapprochement session Stripe ↔ utilisateur (via `client_reference_id` ou l'email) à injecter dans les liens de paiement.
- Rien n'est modifié côté Stripe dans cette étape.

## 7. Plan de test

1. Nouveau visiteur : accueil, diagnostic, ROI, recommandation, FAQ accessibles ; Démonstration, Offres, Configuration, Installation, RDV Test verrouillés.
2. Réserver un RDV Démo → Démonstration et Offres se débloquent ; Configuration, Installation, RDV Test restent verrouillés.
3. Forcer `payment_status = 'paid'` en base pour un utilisateur test → Configuration se débloque uniquement.
4. Envoyer la configuration → Installation se débloque ; RDV Test reste verrouillé.
5. Passer `installation_status = 'ready_for_test'` en base → RDV Test se débloque, la réservation `setup_test` fonctionne.
6. Vider le localStorage / ouvrir en navigation privée avec la même session : les permissions serveur restent identiques ; falsifier le localStorage ne débloque rien.
7. `?admin=lucie` : accès complet pour les démonstrations internes.
