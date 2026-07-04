import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Play, Circle, Clock3, Trophy, XCircle, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  BLOCK_TITLES,
  COLLECTION_BLOCKS,
  buildFilledByBlock,
  calcBlockRequiredProgress,
} from "@/lib/collection.queries";
import type { CollectionRow } from "@/lib/collection.queries";

function formatSeconds(total: number): string {
  if (!total || total <= 0) return "0min";
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

const EVENT_LABEL: Record<string, string> = {
  contato_inicial: "Contato inicial",
  resposta_recebida: "Resposta recebida",
  reuniao_agendada: "Reunião agendada",
  reuniao_realizada: "Reunião realizada",
  proposta_recebida: "Proposta recebida",
  follow_up_recebido: "Follow-up recebido",
  negociacao: "Negociação",
  encerramento: "Encerramento",
  outro: "Outro",
};

export function ConsolidatedStatusPanel({
  targetId,
  collectionRows,
}: {
  targetId: string;
  collectionRows: CollectionRow[];
}) {
  const { data: timeline = [] } = useQuery({
    queryKey: ["consolidated-status", "timeline", targetId],
    queryFn: async () => {
      const { data } = await supabase
        .from("target_timeline_events")
        .select("event_type, event_date")
        .eq("target_id", targetId)
        .order("event_date", { ascending: false })
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!targetId,
  });

  const { data: timeSeconds = 0 } = useQuery({
    queryKey: ["consolidated-status", "time", targetId],
    queryFn: async () => {
      const { data } = await supabase
        .from("assistant_messages")
        .select("time_spent_seconds")
        .eq("target_id", targetId);
      return (data ?? []).reduce((sum, r) => sum + (r.time_spent_seconds ?? 0), 0);
    },
    enabled: !!targetId,
  });

  const filled = buildFilledByBlock(collectionRows);
  const done: string[] = [];
  const inProgress: Array<{ b: string; pct: number }> = [];
  const notStarted: string[] = [];
  for (const b of COLLECTION_BLOCKS) {
    const pct = calcBlockRequiredProgress(filled, b);
    if (pct >= 1) done.push(b);
    else if (pct > 0 || (filled[b]?.size ?? 0) > 0) inProgress.push({ b, pct: Math.round(pct * 100) });
    else notStarted.push(b);
  }

  const lastEvent = timeline[0];
  const gotDeliverable = timeline.some((t) => t.event_type === "proposta_recebida");

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Status consolidado
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="rounded-md border border-green-500/20 bg-green-500/5 p-2.5">
          <div className="flex items-center gap-1.5 text-green-500 font-medium mb-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Completos ({done.length})
          </div>
          {done.length === 0 ? (
            <div className="text-muted-foreground">—</div>
          ) : (
            <ul className="space-y-0.5">
              {done.map((b) => (
                <li key={b} className="text-foreground/80">
                  {b} · {BLOCK_TITLES[b as keyof typeof BLOCK_TITLES]}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-md border border-cyan-500/20 bg-cyan-500/5 p-2.5">
          <div className="flex items-center gap-1.5 text-cyan-500 font-medium mb-1.5">
            <Play className="h-3.5 w-3.5" /> Em progresso ({inProgress.length})
          </div>
          {inProgress.length === 0 ? (
            <div className="text-muted-foreground">—</div>
          ) : (
            <ul className="space-y-0.5">
              {inProgress.map(({ b, pct }) => (
                <li key={b} className="text-foreground/80">
                  {b} · {BLOCK_TITLES[b as keyof typeof BLOCK_TITLES]}{" "}
                  <span className="text-muted-foreground">({pct}%)</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-md border border-border/60 bg-muted/20 p-2.5">
          <div className="flex items-center gap-1.5 text-muted-foreground font-medium mb-1.5">
            <Circle className="h-3.5 w-3.5" /> Não iniciados ({notStarted.length})
          </div>
          {notStarted.length === 0 ? (
            <div className="text-muted-foreground">—</div>
          ) : (
            <ul className="space-y-0.5">
              {notStarted.map((b) => (
                <li key={b} className="text-foreground/70">
                  {b} · {BLOCK_TITLES[b as keyof typeof BLOCK_TITLES]}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
        <div className="rounded-md border p-2.5">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Calendar className="h-3.5 w-3.5" /> Último evento
          </div>
          {lastEvent ? (
            <div>
              <div className="font-medium text-foreground/90">
                {EVENT_LABEL[lastEvent.event_type] ?? lastEvent.event_type}
              </div>
              <div className="text-muted-foreground">
                {new Date(lastEvent.event_date).toLocaleDateString("pt-BR")}
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground">Sem eventos ainda</div>
          )}
        </div>

        <div className="rounded-md border p-2.5">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Trophy className="h-3.5 w-3.5" /> Entregável obtido
          </div>
          {gotDeliverable ? (
            <div className="flex items-center gap-1.5 text-green-500 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" /> Sim
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <XCircle className="h-3.5 w-3.5" /> Ainda não
            </div>
          )}
        </div>

        <div className="rounded-md border p-2.5">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Clock3 className="h-3.5 w-3.5" /> Tempo investido
          </div>
          <div className="font-medium text-foreground/90">{formatSeconds(timeSeconds)}</div>
        </div>
      </div>
    </Card>
  );
}