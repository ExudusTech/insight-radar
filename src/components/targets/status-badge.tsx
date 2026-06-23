import { TARGET_STATUS_LABEL, targetStatusStyle, type TargetStatus } from "@/lib/target-status";

export function StatusBadge({ status, className = "" }: { status: TargetStatus; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium leading-5 whitespace-nowrap ${className}`}
      style={targetStatusStyle(status)}
    >
      {TARGET_STATUS_LABEL[status]}
    </span>
  );
}