import type { MoneyMovement } from "@/types/movement";
import type { PaymentRecord } from "@/types/payment";

/**
 * Orphan finance rows point at deleted projects/tasks after a data reset.
 * Keep the Firestore documents unchanged; exclude them from active totals/UI.
 */
export function isOrphanMovement(
  item: MoneyMovement,
  live: { projectIds: Set<string>; taskIds: Set<string> },
) {
  if (item.projectId && !live.projectIds.has(item.projectId)) return true;
  if (item.taskIds.length > 0 && item.taskIds.every((taskId) => !live.taskIds.has(taskId))) return true;
  return false;
}

export function activeMovements(
  items: MoneyMovement[],
  live: { projectIds: Set<string>; taskIds: Set<string> },
) {
  return items.filter((item) => !isOrphanMovement(item, live));
}

export function isOrphanPayment(
  item: PaymentRecord,
  liveTaskIds: Set<string>,
  liveProjectIds?: Set<string>,
) {
  if (!item.allocations.length) {
    if (item.projectId && liveProjectIds) return !liveProjectIds.has(item.projectId);
    return false;
  }
  return item.allocations.every((row) => {
    if (row.target === "PROJECT_BASE") {
      if (!row.projectId) return true;
      return liveProjectIds ? !liveProjectIds.has(row.projectId) : false;
    }
    return !row.taskId || !liveTaskIds.has(row.taskId);
  });
}

export function activePayments(
  items: PaymentRecord[],
  liveTaskIds: Set<string>,
  liveProjectIds?: Set<string>,
) {
  return items.filter((item) => !isOrphanPayment(item, liveTaskIds, liveProjectIds));
}
