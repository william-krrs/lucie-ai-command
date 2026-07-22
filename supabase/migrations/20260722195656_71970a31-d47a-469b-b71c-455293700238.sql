CREATE TABLE public.preparation_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan TEXT,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  company_name TEXT NOT NULL,
  company_phone TEXT NOT NULL,
  website TEXT,
  call_volume TEXT NOT NULL,
  interlocutor TEXT NOT NULL,
  greeting TEXT NOT NULL,
  location TEXT NOT NULL,
  tone TEXT NOT NULL,
  services TEXT NOT NULL,
  emergency_number TEXT NOT NULL,
  emergency_criteria TEXT,
  opening_hours TEXT NOT NULL,
  rdv_link TEXT NOT NULL,
  required_info TEXT NOT NULL,
  tech_access TEXT,
  extra TEXT,
  summary TEXT NOT NULL,
  email_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.preparation_submissions TO anon, authenticated;
GRANT ALL ON public.preparation_submissions TO service_role;

ALTER TABLE public.preparation_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a preparation questionnaire"
  ON public.preparation_submissions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);