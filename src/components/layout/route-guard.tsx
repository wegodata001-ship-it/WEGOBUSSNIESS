"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { Spinner } from "@/components/ui/spinner";
import { useI18n } from "@/components/providers/i18n-provider";

export function RouteGuard({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();

  useEffect(() => {
    if (auth.status === "unauthenticated" || auth.status === "blocked") {
      const next = pathname && pathname !== "/login" ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${next}`);
    }
  }, [auth.status, pathname, router]);

  if (auth.status === "loading") {
    return <Spinner label={t("common.loading")} />;
  }

  if (auth.status !== "ready") {
    return <Spinner label={t("common.loading")} />;
  }

  return children;
}
