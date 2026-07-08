ALTER TABLE public.target_timeline_events
  DROP CONSTRAINT IF EXISTS target_timeline_events_event_type_check,
  DROP CONSTRAINT IF EXISTS target_timeline_events_source_check;

ALTER TABLE public.target_timeline_events
  ADD CONSTRAINT target_timeline_events_event_type_check
    CHECK (event_type = ANY (ARRAY[
      'contato_inicial', 'resposta_recebida', 'reuniao_agendada',
      'reuniao_realizada', 'proposta_recebida', 'follow_up_recebido',
      'negociacao', 'encerramento', 'outro',
      'interacao_iniciada', 'screenshot_enviado', 'extracao_campos',
      'roteiro_gerado', 'parecer_solicitado'
    ])),
  ADD CONSTRAINT target_timeline_events_source_check
    CHECK (source = ANY (ARRAY['ai', 'manual', 'system']));