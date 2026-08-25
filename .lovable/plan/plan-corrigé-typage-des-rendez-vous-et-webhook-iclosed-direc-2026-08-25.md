# Plan corrigé — typage des rendez-vous et webhook iClosed direct

Vocabulaire retenu : `r1_discovery` (Découverte), `r2_demo` (Démo), `setup_test` (RDV post-vente de test/mise en service). Aucune modification n'est appliquée à ce stade.

## 1. SQL de migration proposé

```sql
-- 1. Type métier du rendez-vous
CREATE TYPE public.booking_type AS ENUM ('r1_discovery', 'r2_demo', 'setup_test');
CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'rescheduled', 'completed', 'no_show');

-- 2. Nouvelles colonnes (compatibles avec les lignes existantes)
ALTER TABLE public.bookings
  ADD COLUMN booking_type public.booking_type NOT NULL DEFAULT 'r2_demo',
  ADD COLUMN iclosed_event_id text,
  ADD COLUMN meeting_location text,
  ADD COLUMN status_norm public.booking_status NOT NULL DEFAULT 'pending',
  ADD COLUMN canceled_at timestamptz,
  ADD COLUMN rescheduled_from timestamptz;

-- 3. Normalisation du statut existant (texte libre -> enum)
UPDATE public.bookings
SET status_norm = CASE lower(status)
  WHEN 'pending'   THEN 'pending'
  WHEN 'active'    THEN 'confirmed'
  WHEN 'confirmed' THEN 'confirmed'
  WHEN 'cancelled' THEN 'cancelled'
  WHEN 'completed' THEN 'completed'
  ELSE 'pending' END::public.booking_status;

-- Le rétro-typage des lignes existantes reste 'r2_demo' : toutes les
-- réservations actuelles proviennent du parcours /recommandation.

-- 4. Contraintes d'unicité
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_client_ref_key;
CREATE UNIQUE INDEX bookings_client_ref_type_key
  ON public.bookings (client_ref, booking_type);
CREATE UNIQUE INDEX bookings_iclosed_event_id_key
  ON public.bookings (iclosed_event_id) WHERE iclosed_event_id IS NOT NULL;
CREATE INDEX bookings_email_idx ON public.bookings (lower(email));

-- 5. Realtime
ALTER TABLE public.bookings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
```

Les GRANT et policies RLS existants (propriétaire via `user_id`) restent inchangés ; le webhook écrit via la clé de service, donc hors RLS.

Étape 2 (migration ultérieure, une fois le code déployé) : suppression de l'ancienne colonne `status` texte et renommage de `status_norm` en `status`. Ce découpage évite toute rupture pendant le déploiement.

## 2. Fichiers qui seraient modifiés

| Fichier | Changement |
| --- | --- |
| `src/lib/bookings.functions.ts` | `upsertBooking` prend `bookingType`, `iclosedEventId`, `meetingLocation` ; `onConflict: "client_ref,booking_type"`. `cancelBooking` et `getBookingByRef` filtrent sur `booking_type`. Ajout de `listBookingsByRef`. |
| `src/lib/booking-store.tsx` | Stockage d'une map par type (`r2_demo`, `setup_test`) au lieu d'un booking unique ; `isUnlocked` dérivé de `r2_demo` + `confirmed`. |
| `src/components/booking-embed.tsx` | Nouvelle prop `bookingType` ; injection de `utm_client_ref` dans l'URL du widget ; abonnement Realtime pour confirmation. |
| `src/routes/recommandation.tsx` | Passe `bookingType="r2_demo"`. |
| `src/routes/rdv-test.tsx` | Passe `bookingType="setup_test"`. |
| `src/routes/demonstration.tsx` | Déverrouillage uniquement si `r2_demo` + `confirmed`. |
| `src/routes/api/public/hooks/iclosed.ts` | **Nouveau** : webhook direct iClosed. |
| `src/routes/api/public/hooks/send-reminders.ts` | Filtre `status_norm = 'confirmed'` au lieu de `'pending'`. |
| `src/lib/config.ts` | `BOOKING_URL_SETUP` distinct du calendrier démo (aujourd'hui identique). |
| `src/integrations/supabase/types.ts` | Régénéré après migration. |
| `tests/rls.test.ts` | Couverture des nouvelles colonnes. |

## 3. Payload webhook iClosed attendu

`POST /api/public/hooks/iclosed`, en-tête de signature `x-iclosed-signature` (HMAC SHA-256 du corps brut, secret `ICLOSED_WEBHOOK_SECRET`), comparaison en temps constant. Trois événements traités :

```json
{
  "event": "call.booked",            // ou "call.cancelled" | "call.rescheduled"
  "data": {
    "event_id": "evt_01HXYZ...",     // -> iclosed_event_id
    "event_type_slug": "demo-lucie", // -> mapping booking_type
    "start_time": "2026-09-03T14:00:00Z",
    "end_time": "2026-09-03T14:30:00Z",
    "timezone": "Europe/Paris",
    "location": "https://meet.google.com/xxx-yyyy-zzz",
    "status": "confirmed",
    "invitee": { "name": "...", "email": "...", "phone": "..." },
    "utm": { "utm_client_ref": "d3f1..." },
    "old_start_time": "2026-09-01T09:00:00Z"  // seulement sur reschedule
  }
}
```

Traitement :
- `call.booked` → upsert `status = 'confirmed'`, réinitialisation des rappels.
- `call.cancelled` → `status = 'cancelled'`, `canceled_at = now()`.
- `call.rescheduled` → mise à jour de `meeting_at/date/time`, `rescheduled_from = old_start_time`, rappels remis à zéro.

Corrélation, dans cet ordre : `iclosed_event_id` → `utm_client_ref` + `booking_type` → `lower(email)` + `booking_type` (le plus récent). Sinon création d'une ligne orpheline avec `client_ref` généré, réconciliée plus tard par email. Réponse toujours `200` sur événement inconnu (pas de retry inutile), `401` sur signature invalide.

Mapping `event_type_slug` → `booking_type` centralisé dans `src/lib/config.ts`.

## 4. Injection de `utm_client_ref` dans l'embed iClosed

Le widget inline lit l'URL de son conteneur `data-url`. Il suffit d'ajouter les paramètres avant le rendu :

```ts
const url = new URL(baseUrl);
url.searchParams.set("utm_client_ref", getClientRef());
url.searchParams.set("utm_source", "lucie-command-center");
url.searchParams.set("utm_medium", bookingType); // r2_demo | setup_test
```

`getClientRef()` est déjà persisté en localStorage (`lucie:booking:clientRef`). Le conteneur doit être rendu **après** que la valeur soit disponible (elle est nulle en SSR), donc rendu client uniquement. Prérequis côté iClosed : activer la capture des UTM sur les deux types d'événement, sinon la corrélation retombe sur l'email.

## 5. Plan de rollback

1. **Code** : revert des fichiers listés (les server functions gardent leur signature actuelle si l'argument `bookingType` est optionnel avec défaut `r2_demo`).
2. **Realtime** : `ALTER PUBLICATION supabase_realtime DROP TABLE public.bookings;`
3. **Contraintes** : suppression des index `bookings_client_ref_type_key` et `bookings_iclosed_event_id_key`, restauration de `UNIQUE (client_ref)` après déduplication éventuelle.
4. **Colonnes** : `ALTER TABLE public.bookings DROP COLUMN booking_type, iclosed_event_id, meeting_location, status_norm, canceled_at, rescheduled_from;` puis `DROP TYPE` des deux enums. La colonne `status` texte d'origine n'ayant pas été touchée en étape 1, aucune donnée n'est perdue.
5. **Webhook** : suppression de la route et du secret ; iClosed continue de fonctionner via les messages `postMessage` existants.

Point de non-retour : l'étape 2 (suppression de `status` texte). Tant qu'elle n'est pas exécutée, le rollback est intégral et sans perte.
