# Corrélation signée des rendez-vous iClosed (utm_booking_token)

Objectif : les rendez-vous créés par webhook doivent porter le bon `user_id`, sans jamais faire confiance au navigateur.

## 1. Format exact du token

Vrai JWS compact HS256, trois segments base64url :

```text
<header_b64url>.<payload_b64url>.<signature_b64url>
```

Header :

```json
{ "alg": "HS256", "typ": "JWT" }
```

Payload — **aucun identifiant métier lisible** (voir §1bis) :

```json
{
  "v": 1,
  "sid": "<uuid opaque de corrélation>",
  "iat": 1756160000,
  "exp": 1756246400
}
```

- Signature : `HMAC-SHA256("<header_b64url>.<payload_b64url>", BOOKING_CORRELATION_SECRET)`, base64url.
- `exp` : 24 h après émission.
- Longueur ≈ 180 caractères, compatible avec un paramètre d'URL.

## 1bis. Pourquoi un identifiant opaque plutôt que `uid`/`cref` en clair

Un payload JWT est simplement encodé, pas chiffré : `utm_booking_token` transite dans l'URL du calendrier et se retrouve dans les logs iClosed, les référents et l'historique navigateur. Y placer `user_id` et `client_ref` exposerait inutilement des identifiants internes à un tiers.

Le token ne transporte donc qu'un `sid` aléatoire, sans signification hors de notre base. La résolution se fait côté serveur : une table `booking_correlations` (`sid`, `user_id`, `client_ref`, `booking_type`, `expires_at`), écrite par la server function d'émission (RLS : aucune lecture client, accès service_role uniquement) et lue par le webhook. La signature reste utile : elle empêche l'énumération ou l'injection d'un `sid` arbitraire avant même de toucher la base.

## 2. Vérification côté webhook

1. Découper sur `.` — trois segments attendus, sinon token rejeté.
2. Vérifier le header (`alg` = `HS256`, `typ` = `JWT`) ; tout autre `alg`, notamment `none`, est refusé.
3. Recalculer le HMAC sur `header.payload` et comparer en temps constant (`timingSafeEqual`). Différence de longueur ou de valeur → token ignoré.
4. Décoder le payload, valider `v === 1`, `sid` au format UUID, `exp > now`.
5. Charger la ligne `booking_correlations` correspondant à `sid` (non expirée) → `user_id`, `client_ref`, `booking_type`.
6. Si le token est invalide/expiré ou le `sid` inconnu → repli sur la chaîne de corrélation existante, jamais sur une valeur brute du payload.

Aucune donnée du token n'est journalisée ; seuls `tokenValid: true|false` et une raison courte le sont.


## 3. Ordre de corrélation (webhook)

1. Token signé valide → `user_id` + `client_ref` + `booking_type` (prioritaire).
2. `iclosed_event_id` existant en base.
3. `client_ref` (+ `booking_type`).
4. `email` (+ `booking_type`, le plus récent) — dernier recours.

Écriture finale : `user_id` (du token si présent, sinon celui de la ligne corrélée), `booking_type`, `status_norm = 'confirmed'`, `meeting_at`, `client_ref`, `iclosed_event_id` si fourni.

## 4. Anti-usurpation

- Le token est émis uniquement par une server function protégée par `requireSupabaseAuth` : `uid` vient de `context.userId`, jamais d'un argument client.
- Le secret `BOOKING_CORRELATION_SECRET` est généré côté serveur et n'est jamais exposé au bundle client.
- Le webhook n'accepte **aucun** champ `user_id`, `uid` ou équivalent lu directement dans le payload iClosed ; ce chemin est explicitement absent du code.
- Comparaison HMAC en temps constant + expiration courte + `jti` pour limiter le rejeu utile.
- Un token forgé ou modifié échoue la signature et retombe silencieusement sur la corrélation classique (aucune élévation possible).

## 5. Fichiers concernés

| Fichier | Changement |
| --- | --- |
| `src/lib/booking-token.server.ts` | **Nouveau** — `signBookingToken()` / `verifyBookingToken()` (HMAC, base64url, validation). |
| `src/lib/booking-token.functions.ts` | **Nouveau** — server fn `issueBookingToken` avec `requireSupabaseAuth`, retourne le token pour le `booking_type` demandé. |
| `src/components/booking-embed.tsx` | Récupère le token à l'affichage du widget et ajoute `utm_booking_token=<token>` à l'URL iClosed (en plus des UTM actuels). Rendu du widget après obtention du token. |
| `src/routes/api/public/hooks/iclosed.ts` | Lecture de `utm_booking_token` (payload aplati + URL de tracking), vérification, priorité de corrélation, écriture du `user_id`. |
| Secret | `BOOKING_CORRELATION_SECRET` généré côté serveur (64 caractères). |

## 6. Réconciliation des orphelins (optionnelle, sûre)

Migration ponctuelle : rattacher un booking `user_id IS NULL` à un utilisateur **uniquement** lorsque son `client_ref` correspond à exactement une ligne `journey_state`/`bookings` déjà rattachée à un seul `user_id`. Aucun rattachement par email seul, aucune correspondance ambiguë traitée.

Non modifiés : gating, logique H-15, Stripe, RLS existantes.
