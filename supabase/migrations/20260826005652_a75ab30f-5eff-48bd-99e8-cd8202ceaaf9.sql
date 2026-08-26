CREATE TABLE public.booking_correlations (
  sid uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_ref uuid not null,
  booking_type public.booking_type not null default 'r2_demo',
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now()
);

GRANT ALL ON public.booking_correlations TO service_role;

ALTER TABLE public.booking_correlations ENABLE ROW LEVEL SECURITY;

CREATE INDEX booking_correlations_user_id_idx ON public.booking_correlations (user_id);
CREATE INDEX booking_correlations_expires_at_idx ON public.booking_correlations (expires_at);