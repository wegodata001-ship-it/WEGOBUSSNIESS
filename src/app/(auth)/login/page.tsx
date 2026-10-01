"use client";

import { Suspense, useEffect } from "react";
import { CalendarDays, CheckCircle2, Clock3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { useAuth } from "@/components/providers/auth-provider";
import { useI18n } from "@/components/providers/i18n-provider";
import { Spinner } from "@/components/ui/spinner";

function BrandPreview() {
  const { t } = useI18n();
  return (
    <div className="relative mt-10 hidden w-full max-w-sm overflow-hidden rounded-2xl border border-white/15 bg-white/8 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.18)] backdrop-blur-md lg:block">
      <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-300">{t("auth.previewLabel")}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/6 px-3 py-3 ring-1 ring-white/10">
          <p className="text-[11px] text-slate-400">{t("nav.tasks")}</p>
          <div className="mt-2 h-6 w-10 rounded-md bg-white/15" />
        </div>
        <div className="rounded-xl bg-white/6 px-3 py-3 ring-1 ring-white/10">
          <p className="text-[11px] text-slate-400">{t("nav.employees")}</p>
          <div className="mt-2 h-6 w-8 rounded-md bg-white/15" />
        </div>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-[72%] rounded-full bg-[#60A5FA]/80" />
      </div>
      <div className="mt-5 space-y-2.5">
        <p className="text-[11px] font-medium text-slate-300">{t("nav.myWork")}</p>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-300/80" />
          <span className="h-2 flex-1 rounded bg-white/10" />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-300/80" />
          <span className="h-2 w-4/5 rounded bg-white/10" />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300/80" />
          <span className="h-2 w-3/5 rounded bg-white/10" />
        </div>
      </div>
    </div>
  );
}

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
      <div className="flex min-h-screen items-center justify-center bg-[#F6F8FC]">
        <Spinner label={t("common.loading")} />
      </div>
    );
  }

  const features = [
    { icon: CheckCircle2, label: t("auth.featureTasks") },
    { icon: CalendarDays, label: t("auth.featureMeetings") },
    { icon: Clock3, label: t("auth.featureHours") },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F6F8FC] text-[#0F172A] md:flex">
      <aside className="relative hidden overflow-y-auto text-white md:flex md:w-[45%] md:flex-col md:justify-between md:px-8 md:py-10 lg:w-[55%] lg:px-14 lg:py-12 xl:w-[58%] xl:px-16">
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(160deg,#071426_0%,#0B1E3A_48%,#102A52_100%)]" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:40px_40px]"
        />
        <div aria-hidden className="pointer-events-none absolute -top-24 start-[-80px] h-72 w-72 rounded-full bg-[#2563EB]/25 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute bottom-10 end-[-60px] h-80 w-80 rounded-full bg-[#38BDF8]/12 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute top-1/3 start-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-[#1D4ED8]/18 blur-3xl" />

        <div className="relative">
          <p className="text-2xl font-semibold tracking-tight">{t("auth.brandName")}</p>
          <p className="mt-1 text-[11px] font-semibold tracking-[0.22em] text-slate-300">{t("auth.brandProduct")}</p>
        </div>

        <div className="relative max-w-xl">
          <h1 className="whitespace-pre-line text-4xl font-semibold leading-[1.15] tracking-tight xl:text-5xl">
            {t("auth.heroTitle")}
          </h1>
          <p className="mt-5 max-w-md text-sm leading-7 text-slate-300 xl:text-base">
            {t("auth.heroText")}
          </p>
          <ul className="mt-8 space-y-3">
            {features.map((feature) => (
              <li key={feature.label} className="flex items-center gap-3 text-sm text-slate-100">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/8 ring-1 ring-white/10 transition hover:bg-white/14">
                  <feature.icon className="h-4 w-4 text-[#93C5FD]" />
                </span>
                {feature.label}
              </li>
            ))}
          </ul>
          <BrandPreview />
        </div>

        <div className="relative h-4" />
      </aside>

      <section className="relative flex min-h-screen flex-1 items-center justify-center px-5 py-8 md:w-[55%] lg:w-[45%] xl:w-[42%]">
        <div className="login-card-in w-full max-w-[440px] sm:max-w-[460px]">
          <div className="mb-6 md:hidden">
            <p className="text-xl font-semibold tracking-tight">{t("auth.brandName")}</p>
            <p className="mt-1 text-sm text-[#64748B]">{t("auth.brandProduct")}</p>
          </div>

          <div className="rounded-[24px] border border-[#E5EAF2] bg-white px-6 py-9 shadow-[0_20px_60px_rgba(15,23,42,0.10)] sm:px-10 sm:py-10">
            <div className="mb-8">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2563EB] text-lg font-bold text-white">
                  W
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">{t("auth.cornerBrand")}</p>
                  <p className="text-xs text-[#64748B]">{t("auth.brandProduct")}</p>
                </div>
              </div>
              <h2 className="mt-6 text-[28px] font-semibold tracking-tight text-[#0F172A]">
                {t("auth.loginTitle")}
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
        <div className="flex min-h-screen items-center justify-center bg-[#F6F8FC]">
          <Spinner />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
