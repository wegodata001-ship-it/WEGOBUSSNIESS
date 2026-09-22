"use client";

import { CircleAlert, Eye, EyeOff, LoaderCircle, Lock, LogIn, Mail } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { useI18n } from "@/components/providers/i18n-provider";
import type { SessionBlockReason } from "@/types/session";

function blockMessageKey(reason: SessionBlockReason) {
  if (reason === "invalid_credentials") return "auth.invalidCredentials" as const;
  if (reason === "inactive_user") return "auth.inactiveUser" as const;
  if (reason === "inactive_membership") return "auth.inactiveMembership" as const;
  if (reason === "no_membership") return "auth.noMembership" as const;
  if (reason === "no_business") return "auth.noBusiness" as const;
  if (reason === "too_many_requests") return "auth.tooManyRequests" as const;
  if (reason === "unconfigured") return "auth.unconfigured" as const;
  return "auth.genericError" as const;
}

const fieldClass =
  "h-14 w-full rounded-xl border border-[#D9E1EC] bg-white ps-12 pe-4 text-sm text-[#0F172A] outline-none transition placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15";

export function LoginForm() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const resolved = await auth.login(email.trim(), password);
      if (resolved.status === "blocked") {
        setError(t(blockMessageKey(resolved.reason)));
        return;
      }

      const next = searchParams.get("next") || "/dashboard";
      router.replace(next.startsWith("/") ? next : "/dashboard");
    } catch {
      setError(t("auth.genericError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-[#0F172A]">
          {t("auth.email")}
        </span>
        <div className="relative">
          <Mail className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            dir="ltr"
            placeholder={t("auth.emailPlaceholder")}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={`${fieldClass} text-left`}
          />
        </div>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-[#0F172A]">
          {t("auth.password")}
        </span>
        <div className="relative">
          <Lock className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="current-password"
            required
            dir="ltr"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={`${fieldClass} pe-12 text-left`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((open) => !open)}
            aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
            className="absolute inset-y-0 end-0 flex w-12 items-center justify-center text-slate-400 transition hover:text-slate-700"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </label>

      <button
        type="submit"
        disabled={loading}
        className="mt-1 inline-flex h-[54px] w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] text-sm font-semibold text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" />
            {t("auth.signingIn")}
          </>
        ) : (
          <>
            {t("auth.signIn")}
            <LogIn className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  );
}
