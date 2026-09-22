import { fetchBusinessRecords } from "@/lib/data/authorized";
import type { Project } from "@/types/department";

export async function listProjects(businessId: string | null) {
  return fetchBusinessRecords<Project[]>(businessId, "projects", []);
}
