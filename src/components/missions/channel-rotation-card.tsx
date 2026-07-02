import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { TARGET_STATUS_LABEL, type TargetStatus } from "@/lib/target-status";

type Row = {
  id: string;
  name: string;
  status: TargetStatus;
  canal_abordagem: string | null;
};

function normalizeChannel(c: string | null): string {
  return (c ?? "").trim().toLowerCase();
}

export function ChannelRotationCard({ missionId }: { missionId: string }) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["channel-rotation", missionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("targets")
        .select("id, name, status, canal_abordagem")
        .eq("mission_id", missionId)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = normalizeChannel(r.canal_abordagem);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const hasCollisions = Array.from(counts.values()).some((n) => n > 1);
  const missing = rows.filter((r) => !r.canal_abordagem).length;

  return (
    <Card className="p-6 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Rotação de canais
        </h2>
        {(hasCollisions || missing > 0) && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            {hasCollisions ? "Canal repetido" : `${missing} sem canal`}
          </span>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Cada concorrente deve ser abordado por um canal distinto para reduzir o risco de exposição.
      </p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Nenhum concorrente cadastrado.</p>
      ) : (
        <div className="divide-y text-sm">
          {rows.map((r) => {
            const key = normalizeChannel(r.canal_abordagem);
            const collision = key && (counts.get(key) ?? 0) > 1;
            return (
              <div key={r.id} className="flex items-center justify-between gap-2 py-2">
                <span className="truncate">{r.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {r.canal_abordagem ? (
                    <Badge variant={collision ? "destructive" : "outline"}>
                      {r.canal_abordagem}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">—</Badge>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    {TARGET_STATUS_LABEL[r.status]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}