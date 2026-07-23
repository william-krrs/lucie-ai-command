
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_ref uuid NOT NULL UNIQUE,
  email text NOT NULL,
  name text,
  phone text,
  meeting_date date NOT NULL,
  meeting_time text,
  meeting_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'Europe/Paris',
  status text NOT NULL DEFAULT 'pending',
  reminder_24h_sent_at timestamptz,
  reminder_2h_sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE INDEX bookings_meeting_at_idx ON public.bookings (meeting_at);
CREATE INDEX bookings_status_idx ON public.bookings (status);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER bookings_set_updated_at
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
