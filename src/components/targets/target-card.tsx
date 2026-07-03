import type { Target } from "@/lib/targets.queries";
import { PriorityBadge } from "./priority-badge";
import { Instagram, Linkedin, Phone } from "lucide-react";
import { COLLECTION_BLOCKS, BLOCK_FIELDS } from "@/lib/collection.queries";
import { TargetPhasePipeline } from "./TargetPhasePipeline";
import type { TargetPhase } from "@/lib/target-phase";

export function TargetCard({
  target,
  onClick,
  completion,
  phase,
}: {
  target: Target & { analyst?: { full_name: string | null } | null };
  onClick?: () => void;
  completion?: { percent: number; filled: number; total: number; completeBlocks: number };
  phase?: TargetPhase;
}) {
  const pct = completion?.percent ?? 0;
  const barColor = pct >= 71 ? "bg-emerald-500" : pct >= 31 ? "bg-amber-500" : "bg-red-500";

  return (
    <div
      onClick={onClick}
      className="bg-card border border-border rounded-md p-3 shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-elevated)] cursor-pointer transition-shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium leading-tight truncate">{target.name}</div>
        <PriorityBadge priority={target.priority} />
      </div>
      {target.brand && (
        <div className="text-xs text-muted-foreground mt-0.5 truncate">{target.brand}</div>
      )}
      {phase && <TargetPhasePipeline phase={phase} compact showLabel={false} />}
      {completion && (
        <div className="mt-2 space-y-1">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
          </div>
          <div className="text-[10px] text-muted-foreground">
            {completion.filled}/{completion.total} campos · {completion.completeBlocks} blocos completos
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 mt-2 text-muted-foreground">
        {target.instagram && <Instagram className="h-3 w-3" />}
        {target.linkedin && <Linkedin className="h-3 w-3" />}
        {target.whatsapp && <Phone className="h-3 w-3" />}
      </div>
      {target.analyst?.full_name && (
        <div className="text-[11px] text-muted-foreground mt-2 truncate">
          {target.analyst.full_name}
        </div>
      )}
    </div>
  );
}

export const TOTAL_EXPECTED_FIELDS = COLLECTION_BLOCKS.reduce(
  (s, b) => s + (BLOCK_FIELDS[b]?.length ?? 0),
  0,
);