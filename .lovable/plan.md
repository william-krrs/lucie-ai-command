# Corrélation signée des rendez-vous iClosed (utm_booking_token)

Objectif : les rendez-vous créés par webhook doivent porter le bon `user_id`, sans jamais faire confiance au navigateur.

## 1. Format exact du token

Token compact type JWS `HS256`, en trois segments base64url séparés par des points :

```text
<payload_b64url>.<signature_b64url>
```

Payload JSON (avant encodage) :

```json
{
  "v": 1,
  "uid": "<user_id auth.uid()>",
  "cref": "<client_ref>",
  "bt": "r2_demo",
  "iat": 1756160000,
  "exp": 1756246400,
  "jti": "<uuid aléatoire>"
}
```

- `exp` : 24 h après émission (le créneau est réservé dans la foulée).
- `bt` : borné à la liste `booking_type` connue.
- Signature : `HMAC-SHA256(payload_b64url, BOOKING_CORRELATION_SECRET)`, encodée base64url.
- Longueur ≈ 220 caractères, compatible avec un paramètre d'URL.

## 2. Vérification côté webhook

1. Découper sur `.` — sinon token rejeté.
2. Recalculer le HMAC sur le segment payload et comparer en temps constant (`timingSafeEqual`). Toute différence de longueur ou de valeur → token ignoré.
3. Décoder le JSON, valider : `v === 1`, `uid` au format UUID, `cref` UUID, `bt` dans la liste autorisée, `exp > now`.
4. Si tout est valide → `user_id`, `client_ref`, `booking_type` proviennent du token.
5. Si invalide/expiré → on retombe sur la chaîne de corrélation existante, jamais sur une valeur brute du payload.

Aucune donnée du token n'est journalisée ; seuls `tokenValid: true|false` et la raison courte le sont.

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
