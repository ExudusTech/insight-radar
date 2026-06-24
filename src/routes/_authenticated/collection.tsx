import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/targets/status-badge";
import { TargetDetailSheet } from "@/components/targets/target-detail-sheet";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/collection")({
  component: CollectionPage,
});

type T = {
  id: string;
  name: string;
  status: string;
  mission_id: string;
  mission: { id: string; name: string } | null;
  blocksDone: number;
};

function CollectionPage() {
  const [openId, setOpenId] = useState<string | null>(null);

  const { data = [], isLoading } = useQuery<T[]>({
    queryKey: ["collection", "cross"],
    queryFn: async () => {
      const [{ data: targets }, { data: coll }] = await Promise.all([
        supabase.from("targets").select("id, name, status, mission_id, mission:missions(id, name)"),
        supabase.from("collection_data").select("target_id, block, field_key, field_value").eq("field_key", "block_status"),
      ]);
      const doneMap = new Map<string, Set<string>>();
      for (const r of coll ?? []) {
        if (String(r.field_value) !== "done") continue;
        const set = doneMap.get(r.target_id) ?? new Set();
        set.add(String(r.block));
        doneMap.set(r.target_id, set);
      }
      return (targets ?? []).map((t) => ({
        ...(t as unknown as T),
        blocksDone: doneMap.get(t.id)?.size ?? 0,
      }));
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; items: T[] }>();
    for (const t of data) {
      const key = t.mission?.id ?? "no-mission";
      const name = t.mission?.name ?? "Sem missão";
      const cur = map.get(key) ?? { name, items: [] };
      cur.items.push(t);
      map.set(key, cur);
    }
    return Array.from(map.entries());
  }, [data]);

  if (isLoading) {
    return <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">Coleta Guiada</h1>
      {grouped.map(([key, { name, items }]) => (
        <div key={key} className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{name}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((t) => (
              <Card key={t.id} className="p-4 cursor-pointer hover:bg-accent/50 transition" onClick={() => setOpenId(t.id)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium">{t.name}</div>
                  <StatusBadge status={t.status as never} />
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Blocos A-G</span><span>{t.blocksDone}/7</span>
                  </div>
                  <Progress value={(t.blocksDone / 7) * 100} />
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
      {grouped.length === 0 && <p className="text-muted-foreground">Nenhum alvo.</p>}
      <TargetDetailSheet targetId={openId} open={!!openId} onOpenChange={(o) => !o && setOpenId(null)} targetLabel="Alvo" />
    </div>
  );
}