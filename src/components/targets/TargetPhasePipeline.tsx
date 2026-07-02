import { cn } from "@/lib/utils";
import { TARGET_PHASE_ORDER, TARGET_PHASE_META, type TargetPhase } from "@/lib/target-phase";

export function TargetPhasePipeline({
  phase,
  showLabel = true,
  compact = false,
}: {
  phase: TargetPhase;
  showLabel?: boolean;
  compact?: boolean;
}) {
  const currentIdx = TARGET_PHASE_ORDER.findIndex((p) => p === phase);
  return (
    <div className={cn("flex items-center gap-1", compact ? "" : "mt-2")}>
      {TARGET_PHASE_ORDER.map((p, i) => {
        const meta = TARGET_PHASE_META[p];
        const active = i <= currentIdx;
        return (
          <div key={p} className="flex items-center gap-1">
            <div
              title={meta.label}
              className={cn(
                "h-1.5 rounded-full transition-colors",
                compact ? "w-4" : "w-6",
                active ? "bg-primary" : "bg-muted/40",
              )}
            />
            {i < TARGET_PHASE_ORDER.length - 1 && (
              <div
                className={cn(
                  "w-1 h-1 rounded-full",
                  i < currentIdx ? "bg-primary/50" : "bg-muted/20",
                )}
              />
            )}
          </div>
        );
      })}
      {showLabel && (
        <span className="text-[11px] text-muted-foreground ml-1">
          {TARGET_PHASE_META[phase].icon} {TARGET_PHASE_META[phase].label}
        </span>
      )}
    </div>
  );
}