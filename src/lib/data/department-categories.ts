import { fetchBusinessRecords } from "@/lib/data/authorized";
import type { DepartmentCategory } from "@/types/department";

export async function listDepartmentCategories(businessId: string | null) {
  return fetchBusinessRecords<DepartmentCategory[]>(businessId, "departmentCategories", []);
}
