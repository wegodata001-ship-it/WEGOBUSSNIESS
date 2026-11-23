/**
 * Membership gate used conceptually by requireActor(businessId).
 * Pure helper for local regression tests — no Firebase I/O.
 */
export function canAccessBusinessMembership(input: {
  isSuperAdmin: boolean;
  memberExists: boolean;
  membershipActive: boolean;
}) {
  if (input.isSuperAdmin) return true;
  if (!input.memberExists) return false;
  return input.membershipActive;
}
