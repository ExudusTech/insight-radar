ALTER TABLE public.targets
  ADD COLUMN IF NOT EXISTS canal_abordagem TEXT,
  ADD COLUMN IF NOT EXISTS persona_lead JSONB NOT NULL DEFAULT '{}'::jsonb;