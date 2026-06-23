import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Target } from "@/lib/targets.queries";
import { PriorityBadge } from "./priority-badge";
import { Instagram, Linkedin, Phone } from "lucide-react";

export function TargetCard({
  target,
  onClick,
}: {
  target: Target & { analyst?: { full_name: string | null } | null };
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: target.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="bg-card border border-border rounded-md p-3 shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-elevated)] cursor-grab active:cursor-grabbing transition-shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium leading-tight truncate">{target.name}</div>
        <PriorityBadge priority={target.priority} />
      </div>
      {target.brand && (
        <div className="text-xs text-muted-foreground mt-0.5 truncate">{target.brand}</div>
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