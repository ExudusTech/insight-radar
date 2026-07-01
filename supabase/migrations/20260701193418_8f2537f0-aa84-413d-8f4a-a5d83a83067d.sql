ALTER TYPE mission_status ADD VALUE IF NOT EXISTS 'pending_acceptance';
ALTER TYPE mission_status ADD VALUE IF NOT EXISTS 'date_negotiation';

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS proposed_deadline_partial date,
  ADD COLUMN IF NOT EXISTS proposed_deadline_final date,
  ADD COLUMN IF NOT EXISTS proposal_from text;