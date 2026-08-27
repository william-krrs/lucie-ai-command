# Audit RDV Test / webhook iClosed / Admin — puis plan minimal

## 1. Audit en lecture seule (aucune modification effectuée)

**Détection du booking RDV Test — ce qui existe déjà**
- Type métier `setup_test` défini (`src/lib/booking-types.ts`), mappé depuis le slug iClosed `setup-test-lucie`.
- Calendrier dédié `BOOKING_URL_SETUP` affiché par `BookingEmbed` sur `/rdv-test`.
- Le webhook écrit bien une ligne `bookings` avec `booking_type = 'setup_test'` et `status_norm = 'confirmed'`.
- Lecture serveur possible via `listBookingsByRef` / `getBookingByRef` (`src/lib/bookings.functions.ts`), mais **filtrées par `client_ref` local**.

**Ce qui se passe après réservation**
- Le webhook (`src/routes/api/public/hooks/iclosed.ts`) résout le token signé `utm_booking_token`, puis corrèle par `event_id` → `client_ref` → email, et insère/met à jour la ligne en `confirmed`.
- Aucune écriture sur `journey_state` : `installation_status` n'est **jamais** passé à `live` par une réservation. Conforme à la cible, rien à corriger.
- Côté UI, `BookingEmbed` bascule sur son bloc « confirmé » à partir du **cache localStorage** (`booking-store`), sauf pour le R2 qui reçoit `authoritativeR2` (état serveur). Le `setup_test` n'a pas d'équivalent serveur.

**Rattachement au `user_id`**
- Oui pour le chemin nominal : `issueBookingToken` crée une corrélation signée (`booking_correlations`) et le webhook fixe `user_id` à partir d'elle. Le `booking_type` du token prime.
- Cas dégradé : sans token (utilisateur non connecté au moment de l'ouverture du calendrier), la ligne est créée avec `user_id = null` et n'est rattachable qu'ultérieurement par e-mail. Comportement existant, hors périmètre.

**Comment `/rdv-test` lit son état aujourd'hui**
- `src/routes/rdv-test.tsx` : `useJourneyAccess().canBookSetupTest`, c'est-à-dire `installation_status === 'ready_for_test'` (ou bypass).
- Sinon rendu de `BookingEmbed`, qui affiche le calendrier ou son bloc « confirmé » **selon le cache navigateur uniquement**.

**Ce qui manque pour « RDV de mise en service confirmé ✅ »**
- `getJourneyState` ne renvoie aucune information sur le booking `setup_test` (il ne lit que `r2_demo`).
- Donc : pas de `setupBookingStatusNorm`, pas de `setupMeetingAt` serveur, et aucune prop `authoritative*` passée à `BookingEmbed` sur `/rdv-test`. Après vidage du cache ou changement d'appareil, la page réaffiche le calendrier alors que le RDV existe.

**Comment `/admin` fonctionne aujourd'hui**
- `src/routes/admin.tsx` + `src/lib/admin.functions.ts`. Authentification par bearer vérifié (`requireSupabaseAuth`), autorisation serveur via `has_role(uid,'admin')` avant toute action.
- Toutes les actions portent **exclusivement sur `context.userId`** : l'admin ne pilote que son propre compte. Il n'existe aucune notion de « client sélectionné ».
- `payment_status` n'est jamais écrit à `paid`.

**Ajouter une vue Clients sans casser la sécurité**
- Nouvelles server functions admin acceptant un `targetUserId` **validé en uuid**, mais uniquement après `assertAdmin()`. Le paramètre navigateur ne donne aucun droit : il ne fait que désigner une cible une fois le rôle prouvé côté serveur.
- Lecture via `supabaseAdmin` chargé **dans le handler** après le contrôle de rôle (les RLS restent inchangées, aucune policy élargie).
- Écriture strictement limitée à la colonne `installation_status`.

**Données strictement en lecture seule côté admin**
`payment_status`, `paid_at`, `paid_plan`, `stripe_session_id`, `stripe_customer_id`, `demo_completed_at`, et **toutes** les lignes `bookings` (statut, dates) : aucune création/confirmation artificielle de RDV.

**Tests proposés avant mise en production**
- Sécurité : appel des nouvelles fonctions sans session → 401 ; avec session non-admin → `Forbidden` ; non-admin ciblant l'`user_id` d'un tiers → `Forbidden` ; tentative d'écrire un champ paiement → impossible par construction (schéma Zod n'accepte que `installation_status`).
- E2E : configuration soumise → `in_progress` ; admin passe `ready_for_test` → `/rdv-test` déverrouillé ; simulation webhook `setup_test` → page affiche « RDV de mise en service confirmé » avec date serveur ; vérification que `installation_status` reste `ready_for_test` après réservation ; admin passe `live` manuellement.
- Non-régression : tests existants (`tests/`) + parcours R2/Stripe inchangés.

## 2. Plan de modifications minimal, fichier par fichier

**A. Configuration soumise → `installation_status = 'in_progress'`**
- `src/lib/preparation.functions.ts` : après enregistrement réussi de la configuration, écrire `installation_status = 'in_progress'` **uniquement** si l'état courant est `not_started` (jamais de régression depuis `ready_for_test`/`live`), via `supabaseAdmin` chargé dans le handler. Aucun autre champ touché.

**B. État serveur du RDV Test**
- `src/lib/journey-state.functions.ts` : ajouter au DTO `setupBookingStatusNorm`, `setupMeetingAt` (dernier `setup_test` de l'utilisateur, confirmé prioritaire). Lecture seule, une requête supplémentaire.
- `src/lib/journey-access.tsx` : exposer ces deux champs.
- `src/routes/rdv-test.tsx` : passer `authoritativeR2`-équivalent (prop existante, renommée en usage générique ou réutilisée telle quelle) à `BookingEmbed` pour que le bloc « RDV de mise en service confirmé ✅ » s'affiche à partir du serveur, avec date/heure réelles et l'action « Modifier / replanifier » déjà présente dans le composant.
- `src/components/booking-embed.tsx` : généraliser la prop `authoritativeR2` en `authoritativeBooking` (rétro-compatible), sans changer la logique.

**C. Vue Clients minimale dans `/admin`**
- `src/lib/admin.functions.ts` :
  - `adminListClients` → liste des utilisateurs ayant une ligne `journey_state` ou un `booking` : email, `user_id`, `client_ref`, `paid_plan`, `payment_status`, `paid_at`, configuration reçue, `installation_status`, dernier/prochain `r2_demo`, dernier/prochain `setup_test`, résumé de parcours. Lecture seule.
  - `adminGetClient` → même détail pour un `targetUserId` (uuid validé).
  - `adminSetClientInstallationStatus` → `{ targetUserId: uuid, status: enum }`, écrit uniquement `installation_status`.
  - Les fonctions actuelles « sur mon propre compte » restent inchangées.
- `src/routes/admin.tsx` : onglet « Clients » — tableau + sélection → fiche client en lecture seule + 4 boutons de statut d'installation + « Recharger l'état ». Le nettoyage bookings/corrélations reste limité au compte admin lui-même (mode test), non exposé sur les clients tiers.

**Non touché** : Stripe et son webhook, gating paiement, RLS, corrélation et webhook iClosed, `UNLOCK_ALL_PAGES`.

## 3. Risques

- **A** : si un client resoumet sa configuration alors qu'il est déjà `ready_for_test`, un écrasement le ferait régresser — évité par la condition « seulement depuis `not_started` ».
- **B** : divergence cache local / serveur pendant quelques secondes après réservation ; le serveur fait autorité, le cache n'est qu'un affichage transitoire.
- **C** : `adminListClients` lit des données de tous les utilisateurs via `supabaseAdmin` — le contrôle `assertAdmin()` doit précéder tout chargement du client admin dans chaque handler (règle déjà appliquée dans le fichier existant).
- Volume : liste plafonnée (ex. 100 lignes, tri par activité récente) pour rester une V1 simple.
