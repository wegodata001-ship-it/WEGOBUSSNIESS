import { fetchBusinessRecords } from "@/lib/data/authorized";
import type { MoneyMovement } from "@/types/movement";

export async function listMoneyMovements(businessId: string | null) {
  return fetchBusinessRecords<MoneyMovement[]>(businessId, "movements", []);
}
