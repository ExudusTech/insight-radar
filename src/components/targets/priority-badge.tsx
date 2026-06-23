import { TARGET_PRIORITY_LABEL, targetPriorityStyle, type TargetPriority } from "@/lib/target-status";

export function PriorityBadge({ priority }: { priority: TargetPriority }) {
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium leading-5"
      style={targetPriorityStyle(priority)}
    >
      {TARGET_PRIORITY_LABEL[priority]}
    </span>
  );
}