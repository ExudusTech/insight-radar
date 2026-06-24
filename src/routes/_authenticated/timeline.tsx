import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  INTERACTION_EVENT_TYPES, INTERACTION_EVENT_LABEL, INTERACTION_CHANNELS,
} from "@/lib/interactions.queries";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/timeline")({
  component: TimelinePage,
});

function TimelinePage() {
  const [missionId, setMissionId] = useState("all");
  const [eventType, setEventType] = useState("all");
  const [channel, setChannel] = useState("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["timeline", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interactions")
        .select("*, mission:missions(id, name), target:targets(id, name)")
        .order("event_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const missions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) {
      const mm = r.mission as { id: string; name: string } | null;
      if (mm) m.set(mm.id, mm.name);
    }
    return Array.from(m, ([id, name]) => ({ id, name }));
  }, [rows]);

  const filtered = rows.filter((r) => {
    if (missionId !== "all" && r.mission_id !== missionId) return false;
    if (eventType !== "all" && r.event_type !== eventType) return false;
    if (channel !== "all" && r.channel !== channel) return false;
    return true;
  });

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">Timeline</h1>
      <div className="flex flex-wrap gap-2">
        <Select value={missionId} onValueChange={setMissionId}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Missão" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as missões</SelectItem>
            {missions.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={eventType} onValueChange={setEventType}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {INTERACTION_EVENT_TYPES.map((e) => <SelectItem key={e} value={e}>{INTERACTION_EVENT_LABEL[e]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Canal" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os canais</SelectItem>
            {INTERACTION_CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {isLoading ? (
        <div className="grid place-items-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const m = r.mission as { id: string; name: string } | null;
            const t = r.target as { id: string; name: string } | null;
            return (
              <Card key={r.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{t?.name ?? "—"}</span>
                    <Badge variant="outline">{INTERACTION_EVENT_LABEL[r.event_type as never] ?? r.event_type}</Badge>
                    {r.channel && <Badge variant="secondary">{r.channel}</Badge>}
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(r.event_at).toLocaleString("pt-BR")}</span>
                </div>
                {r.content && <p className="text-sm mt-2 line-clamp-3">{r.content}</p>}
                <div className="text-[11px] text-muted-foreground mt-1">{m?.name}</div>
              </Card>
            );
          })}
          {filtered.length === 0 && <div className="text-center text-muted-foreground py-8">Nenhuma interação.</div>}
        </div>
      )}
    </div>
  );
}