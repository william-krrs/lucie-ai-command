# Admin Test Center sécurisé

Objectif : une page interne `/admin` permettant de préparer/réinitialiser les états de test du tunnel, sans jamais toucher au paiement Stripe ni aux règles métier.

## Mécanisme d'autorisation (exact)

1. Nouvelle table `public.user_roles` (jamais de rôle sur un profil) + enum `app_role ('admin','user')`, avec RLS et GRANT.
2. Fonction SQL `public.has_role(_user_id uuid, _role app_role)` en `SECURITY DEFINER` (évite la récursion RLS).
3. Votre compte est inséré comme `admin` dans la migration (user_id fourni : `069ee117…`, à confirmer).
4. Chaque server function admin :
   - `.middleware([requireSupabaseAuth])` → identité issue du **bearer token vérifié côté serveur**, jamais du client ;
   - puis `context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' })` ;
   - si faux → `throw new Error('Forbidden')`, avant toute écriture.
5. Aucun `?admin=`, aucun flag localStorage, aucune vérification uniquement UI. Le `readAdminMode()` existant reste réservé à l'affichage cosmétique et ne donne aucun droit.
6. La page vit sous `src/routes/_authenticated/admin.tsx` (gate de session côté route pour l'UX) ; la sécurité réelle reste dans les server functions. La page affiche « Accès refusé » si `isAdmin` renvoie faux.
7. Toutes les actions ne portent que sur `context.userId` (votre propre compte) — aucun paramètre d'utilisateur cible accepté.

## Garde-fous paiement

- Aucune server function admin n'écrit `payment_status`, `paid_at`, `paid_plan`, `stripe_session_id`, `stripe_customer_id` vers une valeur payée.
- Seule valeur autorisée pour la préparation : `payment_status = 'unpaid'` (remise à zéro), jamais `paid`.
- Le webhook Stripe reste l'unique autorité du passage à `paid`. Webhook iClosed, gating et RLS existantes ne sont pas modifiés.

## Fonctions exposées (server functions, fichier `src/lib/admin.functions.ts`)

| Fonction | Effet |
|---|---|
| `adminGetOverview` | `user_id`, email, `journey_state` complet, présence de configuration, `isAdmin` |
| `adminPrepareBeforeStripe` | `demo_completed_at = now()`, `payment_status = 'unpaid'`, `installation_status = 'not_started'` |
| `adminResetJourney` | remet tout au début : `demo_completed_at = null`, `unpaid`, `not_started`, champs Stripe vidés |
| `adminSetInstallationStatus` | valeur validée par Zod parmi `not_started | in_progress | ready_for_test | live` |
| `adminCleanupTestBookings` | supprime les `bookings` et `booking_correlations` du user connecté |
| `adminListBookings` | 10 derniers bookings `r2_demo` / `setup_test` du user (date, statut, type, meeting_at) |

Écritures via `supabaseAdmin` chargé **dans le handler** (`await import`), après le contrôle de rôle.

## UI

`/admin` : carte identité (user_id, client_ref lu côté client, email), carte état `journey_state`, boutons d'action avec confirmation, sélecteur `installation_status`, tableau des derniers bookings, bouton « Recharger l'état » (invalide aussi le cache `journey-state`).

## Technique

- Migration SQL : enum + table + GRANT (`authenticated` select, `service_role` all) + RLS (lecture de ses propres rôles) + `has_role` + insert admin.
- Aucun changement dans `iclosed.ts`, `stripe.ts`, `journey-state.functions.ts`, ni dans les policies existantes.
