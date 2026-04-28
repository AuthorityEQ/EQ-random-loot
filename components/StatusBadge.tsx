import { getItemStatus, statusMeta } from "@/lib/item-status";
import type { ItemDetails } from "@/lib/search";

type StatusBadgeProps = {
  details?: ItemDetails;
};

export function StatusBadge({ details }: StatusBadgeProps) {
  const status = getItemStatus(details);
  const meta = statusMeta[status];

  return (
    <span className={`status-badge status-${status}`} title={meta.tooltip}>
      {meta.label}
    </span>
  );
}
