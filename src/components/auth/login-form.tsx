"use client";

import { Eye, EyeOff } from "lucide-react";
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
  return "auth.genericError" as const;
}

const fieldClass =
  "h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-transparent focus:bg-white focus:ring-2 focus:ring-[var(--brand-primary)]";

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
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">
          {t("auth.email")}
        </span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          dir="ltr"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={fieldClass}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">
          {t("auth.password")}
        </span>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="current-password"
            required
            dir="ltr"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={`${fieldClass} pe-12`}
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
        className="mt-2 h-12 w-full rounded-2xl bg-[var(--brand-primary)] text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? t("common.loading") : t("auth.signIn")}
      </button>
    </form>
  );
}
