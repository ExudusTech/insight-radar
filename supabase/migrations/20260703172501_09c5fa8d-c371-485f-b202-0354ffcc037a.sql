
-- 1. Missão: entregável esperado
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS entregavel_esperado text;

-- 2. Tempo por mensagem
ALTER TABLE public.assistant_messages ADD COLUMN IF NOT EXISTS time_spent_seconds integer;

-- 3. View de métricas de tempo por analista/concorrente/missão
CREATE OR REPLACE VIEW public.analyst_time_metrics
WITH (security_invoker = true) AS
SELECT
  am.mission_id,
  am.target_id,
  am.analyst_id,
  p.full_name AS analyst_name,
  t.name AS target_name,
  m.name AS mission_name,
  COUNT(am.id) FILTER (WHERE am.role = 'user') AS total_user_messages,
  COUNT(am.id) AS total_messages,
  COALESCE(SUM(am.time_spent_seconds), 0) AS total_seconds_active,
  ROUND(COALESCE(SUM(am.time_spent_seconds), 0) / 3600.0, 2) AS total_hours_active,
  MIN(am.created_at) AS first_interaction,
  MAX(am.created_at) AS last_interaction
FROM public.assistant_messages am
JOIN public.profiles p ON p.id = am.analyst_id
LEFT JOIN public.targets t ON t.id = am.target_id
LEFT JOIN public.missions m ON m.id = am.mission_id
WHERE am.target_id IS NOT NULL
GROUP BY am.mission_id, am.target_id, am.analyst_id, p.full_name, t.name, m.name;

GRANT SELECT ON public.analyst_time_metrics TO authenticated;
