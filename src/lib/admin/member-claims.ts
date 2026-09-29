import { getAdminAuth } from "@/lib/firebase/admin";
import type { BusinessRole } from "@/types/roles";

export async function syncMemberClaims(input: {
  uid: string;
  businessId: string;
  role: BusinessRole;
  employeeId: string;
}) {
  const auth = getAdminAuth();
  const existing = await auth.getUser(input.uid).catch(() => null);
  const previous = existing?.customClaims ?? {};
  await auth.setCustomUserClaims(input.uid, {
    ...previous,
    businessId: input.businessId,
    role: input.role,
    employeeId: input.employeeId,
  });
}
