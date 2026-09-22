"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { clearAuthPresenceCookie } from "@/lib/auth/cookie";
import { isSuperAdmin } from "@/lib/permissions/engine";
import { loginWithPassword, resolveUserSession } from "@/lib/session/resolve";
import type { AuthSession, ReadySession, ResolveResult } from "@/types/session";

type AuthContextValue = AuthSession & {
  firebaseUser: null;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<ResolveResult>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession>({ status: "loading" });

  const hydrate = useCallback(async () => {
    const resolved = await resolveUserSession();
    if (resolved.status === "ready") {
      setSession(resolved);
      return;
    }
    setSession({ status: "unauthenticated" });
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const login = useCallback(async (email: string, password: string) => {
    const resolved = await loginWithPassword(email, password);
    if (resolved.status === "ready") {
      setSession(resolved);
    }
    return resolved;
  }, []);

  const logout = useCallback(async () => {
    await clearAuthPresenceCookie();
    setSession({ status: "unauthenticated" });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...session,
      firebaseUser: null,
      refresh: hydrate,
      login,
      logout,
    }),
    [hydrate, login, logout, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

export function useAppSession(): ReadySession {
  const auth = useAuth();
  if (auth.status !== "ready") {
    throw new Error("Session is not ready");
  }
  return auth;
}

export function useIsSuperAdmin() {
  const auth = useAuth();
  return auth.status === "ready" && isSuperAdmin(auth.user);
}
