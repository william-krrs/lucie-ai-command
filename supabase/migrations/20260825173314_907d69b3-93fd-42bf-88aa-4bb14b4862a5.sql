DO $$ BEGIN
  CREATE TYPE public.booking_type AS ENUM ('r1_discovery', 'r2_demo', 'setup_test');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'rescheduled', 'completed', 'no_show');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS booking_type public.booking_type NOT NULL DEFAULT 'r2_demo',
  ADD COLUMN IF NOT EXISTS iclosed_event_id text,
  ADD COLUMN IF NOT EXISTS meeting_location text,
  ADD COLUMN IF NOT EXISTS status_norm public.booking_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS rescheduled_from timestamptz;

UPDATE public.bookings
SET status_norm = (CASE lower(status)
  WHEN 'pending'   THEN 'pending'
  WHEN 'active'    THEN 'confirmed'
  WHEN 'confirmed' THEN 'confirmed'
  WHEN 'cancelled' THEN 'cancelled'
  WHEN 'canceled'  THEN 'cancelled'
  WHEN 'completed' THEN 'completed'
  ELSE 'pending' END)::public.booking_status;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_client_ref_key;
DROP INDEX IF EXISTS public.bookings_client_ref_key;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_client_ref_type_key
  ON public.bookings (client_ref, booking_type);
CREATE UNIQUE INDEX IF NOT EXISTS bookings_iclosed_event_id_key
  ON public.bookings (iclosed_event_id) WHERE iclosed_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS bookings_email_idx ON public.bookings (lower(email));

ALTER TABLE public.bookings REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;