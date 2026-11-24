"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { MobileNav } from "@/components/layout/mobile-nav";
import { RouteGuard } from "@/components/layout/route-guard";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { NotificationProvider } from "@/components/providers/notification-provider";
import { useI18n } from "@/components/providers/i18n-provider";

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { logout } = useAuth();
  const router = useRouter();
  const { t } = useI18n();

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <RouteGuard>
      <NotificationProvider>
        <div className="min-h-dvh bg-[var(--app-bg)] lg:flex">
          <div className="hidden lg:block">
            <div className="sticky top-0 h-dvh">
              <Sidebar onLogout={handleLogout} />
            </div>
          </div>

          {menuOpen ? (
            <div className="fixed inset-0 z-40 lg:hidden" data-testid="mobile-drawer">
              <button
                type="button"
                className="absolute inset-0 bg-slate-900/40"
                aria-label={t("shell.closeMenu")}
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute inset-y-0 start-0 h-full max-w-[85vw] shadow-2xl">
                <Sidebar onNavigate={() => setMenuOpen(false)} onLogout={handleLogout} />
              </div>
            </div>
          ) : null}

          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar onOpenMenu={() => setMenuOpen(true)} onLogout={() => void handleLogout()} />
            <main className="mx-auto w-full max-w-[1600px] min-w-0 flex-1 overflow-x-clip px-3 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-4 md:px-6 lg:px-8 lg:py-5 lg:pb-5">
              {children}
            </main>
            <MobileNav onMore={() => setMenuOpen(true)} />
          </div>
        </div>
      </NotificationProvider>
    </RouteGuard>
  );
}
