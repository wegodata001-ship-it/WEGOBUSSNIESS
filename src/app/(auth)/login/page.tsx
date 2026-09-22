"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { useAuth } from "@/components/providers/auth-provider";
import { useI18n } from "@/components/providers/i18n-provider";
import { Spinner } from "@/components/ui/spinner";
import { APP_NAME } from "@/lib/env";

function LoginContent() {
  const { t } = useI18n();
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.status === "ready") {
      router.replace("/dashboard");
    }
  }, [auth.status, router]);

  if (auth.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)]">
        <Spinner label={t("common.loading")} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--app-bg)]">
      <header className="flex h-16 items-center justify-center border-b border-[var(--line)] bg-white">
        <p className="text-sm font-semibold tracking-wide text-slate-900">{APP_NAME}</p>
      </header>

      <main className="flex justify-center px-4 pt-10 pb-16 sm:pt-14">
        <div className="w-full max-w-[420px] rounded-[28px] border border-[var(--line)] bg-white p-8 shadow-[var(--shadow)]">
          <div className="mb-7 text-center">
            <h1 className="text-2xl font-semibold text-slate-900">{t("auth.signIn")}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">{t("app.tagline")}</p>
          </div>
          <LoginForm />
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)]">
          <Spinner />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
