import type { Business } from "@/types/business";
import type { Membership } from "@/types/membership";
import type { Permission } from "@/types/permissions";
import type { AppUser } from "@/types/user";

export type SessionBlockReason =
  | "inactive_user"
  | "inactive_membership"
  | "no_membership"
  | "no_business"
  | "unconfigured"
  | "invalid_credentials";

export type ReadySession = {
  status: "ready";
  user: AppUser;
  business: Business | null;
  membership: Membership | null;
  permissions: Permission[];
};

export type ResolveResult =
  | ReadySession
  | { status: "blocked"; reason: SessionBlockReason };

export type AuthSession =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "blocked"; reason: SessionBlockReason }
  | ReadySession;
