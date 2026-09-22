"use client";

import { Suspense, useEffect } from "react";
import { CalendarDays, Clock3, ListChecks } from "lucide-react";
import { useRouter } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { useAuth } from "@/components/providers/auth-provider";
import { useI18n } from "@/components/providers/i18n-provider";
import { Spinner } from "@/components/ui/spinner";

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
      <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB]">
        <Spinner label={t("common.loading")} />
      </div>
    );
  }

  const features = [
    { icon: ListChecks, label: t("auth.featureTasks") },
    { icon: CalendarDays, label: t("auth.featureMeetings") },
    { icon: Clock3, label: t("auth.featureHours") },
  ];

  return (
    <div className="min-h-screen bg-[#F5F7FB] text-[#0F172A] md:flex">
      <aside className="relative hidden overflow-hidden bg-[#081426] text-white md:flex md:w-[34%] md:flex-col md:justify-between md:px-8 md:py-10 lg:w-[45%] lg:px-14 lg:py-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.16),transparent_58%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.09] [background-image:linear-gradient(rgba(255,255,255,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.16)_1px,transparent_1px)] [background-size:36px_36px]"
        />

        <div className="relative">
          <p className="text-2xl font-semibold tracking-tight">{t("auth.brandName")}</p>
          <p className="mt-1 text-sm text-slate-300">{t("auth.brandProduct")}</p>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight lg:text-4xl">
            {t("auth.heroTitle")}
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-7 text-slate-300 lg:text-base">
            {t("auth.heroText")}
          </p>

          <ul className="mt-8 space-y-3">
            {features.map((feature) => (
              <li key={feature.label} className="flex items-center gap-3 text-sm text-slate-200">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/10">
                  <feature.icon className="h-3.5 w-3.5 text-[#93C5FD]" />
                </span>
                {feature.label}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative hidden text-xs text-slate-500 lg:block">{t("auth.cornerTagline")}</p>
      </aside>

      <section className="relative flex min-h-screen flex-1 flex-col px-5 py-6 sm:px-8 lg:px-10">
        <div className="mb-8 md:mb-0">
          <p className="text-base font-semibold tracking-tight text-[#0F172A]">{t("auth.cornerBrand")}</p>
          <p className="mt-1 text-sm text-[#64748B]">{t("auth.cornerTagline")}</p>
        </div>

        <div className="flex flex-1 items-center justify-center py-4 sm:py-8">
          <div className="w-full max-w-[460px] rounded-[20px] border border-[#E5EAF2] bg-white px-6 py-9 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_rgba(15,23,42,0.05)] sm:px-10 sm:py-10">
            <div className="mb-7">
              <p className="text-sm font-semibold text-[#2563EB]">{t("auth.cornerBrand")}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#0F172A]">
                {t("auth.welcome")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#64748B]">{t("auth.welcomeSubtitle")}</p>
            </div>
            <LoginForm />
          </div>
        </div>
      </section>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB]">
          <Spinner />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
