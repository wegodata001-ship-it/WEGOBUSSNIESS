import { fetchBusinessRecords } from "@/lib/data/authorized";
import type { Employee } from "@/types/employee";

export async function listBusinessEmployees(businessId: string | null) {
  return fetchBusinessRecords<Employee[]>(businessId, "employees", []);
}
