import { fetchBusinessRecords } from "@/lib/data/authorized";
import type { Department } from "@/types/department";

export async function listBusinessDepartments(businessId: string | null) {
  return fetchBusinessRecords<Department[]>(businessId, "departments", []);
}
