-- =====================================================================
-- journey_state : source de vérité du parcours client
-- =====================================================================

-- Types énumérés
CREATE TYPE public.payment_status AS ENUM ('unpaid', 'paid', 'refunded');
CREATE TYPE public.installation_status AS ENUM ('not_started', 'in_progress', 'ready_for_test', 'live');

-- Table
CREATE TABLE public.journey_state (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  client_ref uuid,
  demo_completed_at timestamp with time zone,
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  paid_at timestamp with time zone,
  paid_plan text,
  stripe_session_id text,
  stripe_customer_id text,
  installation_status public.installation_status NOT NULL DEFAULT 'not_started',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- Accès Data API (RLS auth-only, pas d'accès anon)
GRANT SELECT, INSERT ON public.journey_state TO authenticated;
GRANT ALL ON public.journey_state TO service_role;

-- RLS
ALTER TABLE public.journey_state ENABLE ROW LEVEL SECURITY;

-- Lecture : sa propre ligne
CREATE POLICY "journey_state owner select"
  ON public.journey_state FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Création : sa propre ligne, uniquement avec les valeurs par défaut verrouillées
CREATE POLICY "journey_state owner insert locked"
  ON public.journey_state FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND payment_status = 'unpaid'
    AND installation_status = 'not_started'
  );

-- Aucune politique UPDATE ni DELETE côté client :
-- les transitions sensibles (paid / ready_for_test) ne sont possibles
-- qu'en service role (webhook Stripe, action admin).

-- Triggers
CREATE TRIGGER journey_state_set_updated_at
  BEFORE UPDATE ON public.journey_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER audit_journey_state
  AFTER INSERT OR UPDATE OR DELETE ON public.journey_state
  FOR EACH ROW EXECUTE FUNCTION public.log_table_write();

-- =====================================================================
-- Lecture des soumissions de configuration par leur propriétaire
-- (nécessaire pour le déverrouillage serveur de l'étape Installation)
-- =====================================================================
ALTER TABLE public.preparation_submissions ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.preparation_submissions TO authenticated;

CREATE POLICY "prep_submissions owner select"
  ON public.preparation_submissions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());