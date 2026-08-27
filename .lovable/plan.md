# V1 — Comptes clients email + mot de passe (confirmation obligatoire)

Aucune migration SQL. Aucun changement Stripe, iClosed, `journey_state`, RLS, ni sur les simulations commerciales locales.

## 1. Où exactement on impose le compte

Règle : **la lecture reste libre, l'écriture serveur exige un compte.**

Restent 100 % publics, sans compte, sans changement :
- `/` accueil, `/diagnostic`, `/roi`, `/recommandation`, `/faq`, `/demo`, `/d/$token` (partage) ;
- le PDF et l'export CSV du diagnostic local ;
- les Simulations commerciales (localStorage uniquement).

Le mur de connexion se déclenche sur exactement trois clics :
1. **« Réserver ma démonstration »** sur `/recommandation` (et tout bouton menant à `/demonstration`) — c'est le premier acte qui crée un `booking` rattaché à un `user_id` ;
2. **« Choisir cette formule / Payer »** sur `/offres` — Stripe Checkout a besoin du `user_id` ;
3. **accès direct** à `/demonstration`, `/offres`, `/merci`, `/preparation`, `/installation`, `/rdv-test` sans session : redirection douce vers `/connexion?next=…`.

Aujourd'hui ces trois points fonctionnent grâce à une session anonyme créée automatiquement. On ne la coupe pas brutalement (voir §6).

## 2. Conserver le diagnostic rempli avant connexion

Le diagnostic vit déjà dans `localStorage` (`lucie:diagnostic:v1`), indépendamment de toute session. La connexion ne le touche pas :
- on ne vide **jamais** `localStorage` lors d'un `signIn` / `signUp` / `signOut` ;
- `supabase.auth.signOut()` n'efface que la clé de session Supabase, pas nos clés `lucie:*` ;
- après connexion, l'utilisateur retrouve son diagnostic, son ROI et sa recommandation tels quels.

Rien à copier vers le serveur : le diagnostic reste local en V1, exactement comme aujourd'hui.

## 3. Ce qui se passe après la confirmation d'email

Inscription → Supabase envoie l'email de confirmation (domaine d'envoi déjà vérifié) → **aucune session n'est ouverte à ce stade**, l'écran affiche « Vérifiez votre boîte mail ».

Le lien de confirmation renvoie vers `emailRedirectTo = ${origin}/connexion?next=<destination mémorisée>`. Au retour :
- Supabase pose la session (événement `SIGNED_IN`) ;
- la page `/connexion` détecte la session et navigue automatiquement vers `next` ;
- si `next` est absent ou invalide → `/demonstration`.

Le lien peut être ouvert dans un autre navigateur (mobile) : dans ce cas la session s'ouvre là-bas, et l'onglet d'origine se met à jour via `onAuthStateChange` s'il est encore ouvert ; sinon l'utilisateur se connecte normalement.

## 4. Reprise automatique de la destination

- Toute redirection vers le mur ajoute `?next=<chemin>`, **chemin relatif same-origin uniquement** (rejet de toute URL absolue).
- `next` est aussi recopié dans `sessionStorage` pour survivre à l'aller-retour email.
- Après `SIGNED_IN`, navigation `replace` vers `next`.
- Si l'utilisateur est déjà connecté et ouvre `/connexion`, il est renvoyé directement sur `next`.

## 5. Ne rien perdre au moment de la connexion

Trois risques identifiés et neutralisés :
- **Diagnostic local** : intact, clés distinctes (§2).
- **Simulations commerciales** : intactes, aucune écriture serveur, `clientRef` reste attaché au poste.
- **Cache RDV local (`lucie:booking:v3`)** : c'est un cache UX ; à la connexion on invalide simplement `journey-state` pour que le serveur redevienne source de vérité, et on purge le cache RDV **uniquement** au moment d'une déconnexion explicite (sinon un client A verrait le RDV du client B sur le même poste).
- Déconnexion : `cancelQueries` → `clear` du cache React Query → `signOut` → navigation `replace`.

## 6. Transition propre depuis l'anonyme (pas de coupure brutale)

Étape unique et réversible :
- `AnonAuthBootstrap` n'est plus monté globalement ; il n'est **pas supprimé** du dépôt.
- Un drapeau dans `src/lib/config.ts` (`REQUIRE_ACCOUNT`) pilote le comportement : `false` = comportement actuel (anonyme), `true` = mur de connexion. On livre à `true` après vérification.
- Les sessions anonymes déjà existantes continuent de fonctionner : on ne les invalide pas, on ne désactive pas encore les inscriptions anonymes côté auth. On le fera dans un second temps, une fois confirmé qu'aucun parcours en cours n'en dépend.
- Vérifications avant bascule : diagnostic public, ROI, recommandation, partage `/d/$token`, PDF, simulations commerciales — tous doivent fonctionner sans aucune session.

## 7. Plan minimal des fichiers

Nouveaux :
- `src/routes/connexion.tsx` — onglets Créer un compte / Se connecter + mot de passe oublié, gestion de `next`, état « confirmez votre email ».
- `src/routes/mot-de-passe.tsx` — définition du nouveau mot de passe (lien de récupération client).
- `src/lib/auth-redirect.ts` — validation/mémorisation de `next` (same-origin strict).
- `src/lib/use-session.ts` — hook léger : session courante + `isAnonymous` + déconnexion propre.

Modifiés :
- `src/routes/__root.tsx` — retirer le montage inconditionnel de `AnonAuthBootstrap` (conditionné au drapeau).
- `src/components/app-shell.tsx` — email du compte + bouton Déconnexion dans l'en-tête, distinct du bloc Simulations.
- `src/lib/config.ts` — `REQUIRE_ACCOUNT`.
- `src/components/locked-page.tsx` — nouvel état « compte requis » avec CTA vers `/connexion?next=…`.
- `src/routes/demonstration.tsx`, `offres.tsx`, `preparation.tsx`, `installation.tsx`, `rdv-test.tsx`, `merci.tsx` — court-circuit « compte requis » avant le gating métier existant (le gating lui-même est inchangé).
- `src/routes/recommandation.tsx` — le CTA « Réserver ma démonstration » passe par `/connexion?next=/demonstration` si pas de session.
- `public/robots.txt` — `Disallow` sur `/connexion` et `/mot-de-passe`.
- `src/routes/admin.tsx` / `src/lib/admin.functions.ts` — marquer les comptes anonymes résiduels et afficher l'email réel du compte. Actions et garde-fous inchangés.

Configuration : confirmation d'email obligatoire (réglage par défaut, aucune activation d'auto-confirm).

Non fait dans cette étape : conversion automatique simulation → client, désactivation définitive des inscriptions anonymes, rattachement d'un diagnostic partagé à un nouveau compte.

## Addendum UX — 1 compte = 1 parcours (simulations masquées pour les clients)

- Un compte email authentifié ne voit jamais le sélecteur « Simulations commerciales » (Prospect actif / Enregistrer / Nouveau) : cette UX est réservée au contexte commercial (visiteur sans compte, session anonyme, admin).
- Zone compte client = `AccountMenu` existant : email du client, « Mon compte », « Déconnexion ».
- `prospect-store` et les données locales ne sont ni supprimés ni migrés : retrait d'affichage uniquement, via un gate de rendu dans `AppShell` (`ProspectSwitcherGate`).
- Aucune fausse association simulation locale ↔ user_id.
