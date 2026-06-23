import { useMemo } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  TARGET_STATUS_LABEL,
  TARGET_STATUS_ORDER,
  TARGET_STATUS_TOKEN,
  type TargetStatus,
} from "@/lib/target-status";
import { TargetCard } from "./target-card";
import { targetsByMissionKey, updateTargetStatus, type Target } from "@/lib/targets.queries";

type TargetWithAnalyst = Target & { analyst?: { full_name: string | null } | null };

export function TargetKanban({
  missionId,
  targets,
  onOpenTarget,
}: {
  missionId: string;
  targets: TargetWithAnalyst[];
  onOpenTarget: (id: string) => void;
}) {
  const qc = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const byStatus = useMemo(() => {
    const map = new Map<TargetStatus, TargetWithAnalyst[]>();
    for (const s of TARGET_STATUS_ORDER) map.set(s, []);
    for (const t of targets) map.get(t.status)?.push(t);
    return map;
  }, [targets]);

  const mutation = useMutation({
    mutationFn: (vars: { id: string; to: TargetStatus; from: TargetStatus }) =>
      updateTargetStatus(vars.id, vars.to, vars.from, missionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: targetsByMissionKey(missionId) }),
    onError: (e: Error) => {
      toast.error(e.message);
      qc.invalidateQueries({ queryKey: targetsByMissionKey(missionId) });
    },
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const targetId = String(active.id);
    const overId = String(over.id);
    const moved = targets.find((t) => t.id === targetId);
    if (!moved) return;
    // over.id is either a column id (status) or another card id
    const toStatus = (TARGET_STATUS_ORDER as string[]).includes(overId)
      ? (overId as TargetStatus)
      : targets.find((t) => t.id === overId)?.status;
    if (!toStatus || toStatus === moved.status) return;
    mutation.mutate({ id: targetId, to: toStatus, from: moved.status });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-3">
        {TARGET_STATUS_ORDER.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            items={byStatus.get(status) ?? []}
            onOpenTarget={onOpenTarget}
          />
        ))}
      </div>
    </DndContext>
  );
}

function KanbanColumn({
  status,
  items,
  onOpenTarget,
}: {
  status: TargetStatus;
  items: TargetWithAnalyst[];
  onOpenTarget: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const token = TARGET_STATUS_TOKEN[status];
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-64 shrink-0 rounded-lg border border-border bg-surface/60 ${isOver ? "ring-2 ring-primary/40" : ""}`}
    >
      <div
        className="px-3 py-2 rounded-t-lg border-b border-border flex items-center justify-between"
        style={{ background: `var(--status-${token}-bg)`, color: `var(--status-${token}-fg)` }}
      >
        <span className="text-xs font-semibold leading-tight">{TARGET_STATUS_LABEL[status]}</span>
        <span className="text-[11px] font-medium opacity-80">{items.length}</span>
      </div>
      <SortableContext items={items.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 p-2 space-y-2 min-h-32">
          {items.map((t) => (
            <TargetCard key={t.id} target={t} onClick={() => onOpenTarget(t.id)} />
          ))}
          {items.length === 0 && (
            <div className="text-[11px] text-muted-foreground text-center py-4 italic">vazio</div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}