import { fetchBusinessRecords } from "@/lib/data/authorized";
import type { Business } from "@/types/business";
import type { AppUser } from "@/types/user";

export async function listBusinesses(businessId?: string | null) {
  return fetchBusinessRecords<Business[]>(businessId ?? null, "businesses", []);
}

export async function listPlatformUsers(businessId?: string | null) {
  return fetchBusinessRecords<AppUser[]>(businessId ?? null, "users", []);
}
