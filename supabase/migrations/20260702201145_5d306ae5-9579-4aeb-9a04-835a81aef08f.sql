ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS profundidade_autorizada TEXT,
  ADD COLUMN IF NOT EXISTS cobertura_canais TEXT,
  ADD COLUMN IF NOT EXISTS canais_obrigatorios TEXT[],
  ADD COLUMN IF NOT EXISTS restricoes TEXT;