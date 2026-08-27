# V1 — Règle « 1 compte authentifié = 1 parcours client »

Aucune migration de données, aucun changement Stripe / iClosed / journey_state / RLS.

## 1. Correction du bug de snapshot prospect

Dans le module de gestion des prospects locaux, l'instantané lit et écrit encore l'ancienne clé de RDV (`v2`) alors que le parcours utilise la clé `v3`. Conséquence : l'état RDV n'est ni sauvegardé ni restauré quand on change de prospect.

Correction :
- pointer le snapshot sur la clé courante `lucie:booking:v3` ;
- lire aussi l'ancienne clé `v2` en secours pour les prospects déjà enregistrés (lecture seule, pas de réécriture de masse) ;
- garder `lucie:booking:clientRef` **hors** du snapshot (il reste attaché au poste, pas au prospect).

## 2. Étanchéité : un prospect local ne doit jamais toucher les données serveur

Vérifications à faire (et garde-fous si besoin) :
- le module prospects n'appelle aucune fonction serveur : uniquement du localStorage ;
- charger / créer / supprimer un prospect n'écrit jamais dans `journey_state`, `bookings`, `preparation_submissions` ;
- l'écriture serveur reste exclusivement déclenchée par une session authentifiée (paiement, configuration, RDV) ;
- ajout d'un test automatisé qui échoue si le module prospects importe un module `*.functions` ou le client base de données.

## 3. /admin > Clients

Inchangé : la liste reste construite sur les comptes réels via `journey_state`. Un prospect commercial local n'y apparaît pas — c'est le comportement voulu.

## 4. Distinction UX Prospect commercial / Client Lucie

- Renommer le sélecteur en **« Simulations commerciales »**, avec libellé secondaire « local à ce poste, non synchronisé ».
- Badge sur chaque entrée : *Prospect* (gris, contour) vs *Client Lucie* (violet, plein) quand une session authentifiée est active.
- Bandeau discret en tête du panneau : « Ces dossiers servent à préparer un rendez-vous. Le parcours client réel démarre à la création du compte. »
- Bouton « Nouveau » renommé **« Nouvelle simulation »** pour supprimer l'ambiguïté « nouveau client ».
- Quand un compte est connecté, afficher dans l'en-tête l'adresse du compte : c'est ce compte qui porte le parcours réel.

## 5. Parcours V1 recommandé pour convertir un prospect en client (à construire plus tard)

1. Le commercial termine le diagnostic / la recommandation en local.
2. Il envoie au prospect un lien de partage du diagnostic (déjà existant) contenant un identifiant de partage.
3. Le prospect crée son compte (email + mot de passe ou lien magique) depuis ce lien.
4. À la première connexion, une étape de rattachement propose : « Reprendre le diagnostic préparé pour vous ? » → copie du contenu du diagnostic partagé vers le parcours du nouveau `user_id`, et création de sa ligne `journey_state`.
5. À partir de là, tout (Stripe, RDV iClosed, configuration, installation) est rattaché à ce `user_id`, et le client apparaît dans /admin > Clients.
6. Côté commercial, la simulation locale peut être marquée « convertie » avec l'email du compte, à titre informatif seulement.

Prérequis pour cette étape ultérieure : rien côté schéma, sauf un champ facultatif reliant un diagnostic partagé au compte qui l'a réclamé.

## Détails techniques

Fichiers concernés par la correction immédiate : le module de store prospects (clé de snapshot) et le composant de sélection de prospect (libellés/badges), plus un nouveau test d'isolation. Aucune migration SQL.
