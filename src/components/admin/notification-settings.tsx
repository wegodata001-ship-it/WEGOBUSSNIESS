"use client";

import { useEffect, useState } from "react";
import { PrimaryButton } from "@/components/admin/ui";
import { useI18n } from "@/components/providers/i18n-provider";
import { ADMIN_SETTING_KEYS, EMPLOYEE_SETTING_KEYS, type ChannelPref, type NotificationSettings } from "@/lib/notify/catalog";
import type { MessageKey } from "@/lib/i18n/types";

type DeliveryItem = {
  id: string;
  recipient: string;
  status: string;
  type: string;
  subject: string;
  errorCode: string;
  createdAt: string | null;
};

function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
      <input type="checkbox" checked={on} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function ChannelRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ChannelPref;
  onChange: (next: ChannelPref) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2">
      <p className="text-sm text-slate-700">{label}</p>
      <div className="flex gap-3">
        <Toggle on={value.inApp} label="In-App" onChange={(inApp) => onChange({ ...value, inApp })} />
        <Toggle on={value.email} label="Email" onChange={(email) => onChange({ ...value, email })} />
      </div>
    </div>
  );
}

export function NotificationSettingsPanel({
  businessId,
  employees,
}: {
  businessId: string;
  employees: Array<{ id: string; displayName: string; email: string | null }>;
}) {
  const { t } = useI18n();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void Promise.all([
      fetch(`/api/business/notifications/settings?businessId=${encodeURIComponent(businessId)}`, { credentials: "include" }).then((res) => res.json()),
      fetch(`/api/business/notifications/deliveries?businessId=${encodeURIComponent(businessId)}`, { credentials: "include" }).then((res) => res.json()),
    ]).then(([prefs, log]) => {
      if (prefs.settings) setSettings(prefs.settings);
      if (Array.isArray(log.items)) setDeliveries(log.items);
    }).catch(() => undefined);
  }, [businessId]);

  const selected = employees.find((item) => item.id === employeeId);

  async function saveSettings() {
    if (!settings) return;
    setBusy(true);
    const response = await fetch("/api/business/notifications/settings", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, settings }),
    });
    setBusy(false);
    setMessage(response.ok ? t("settings.notifySaved") : t("common.failed"));
  }

  async function testEmployee() {
    if (!employeeId) return;
    setBusy(true);
    const response = await fetch("/api/business/mail/test", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, employeeId }),
    });
    const payload = await response.json().catch(() => ({})) as { ok?: boolean };
    setBusy(false);
    setMessage(payload.ok ? t("settings.testEmployeeSent") : t("settings.testMailFailed"));
  }

  async function runJobs() {
    setBusy(true);
    const response = await fetch("/api/business/notifications/jobs", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId }),
    });
    setBusy(false);
    setMessage(response.ok ? t("settings.jobsRan") : t("common.failed"));
  }

  async function retry(id: string) {
    setBusy(true);
    await fetch("/api/business/notifications/deliveries", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, deliveryId: id }),
    });
    const log = await fetch(`/api/business/notifications/deliveries?businessId=${encodeURIComponent(businessId)}`, { credentials: "include" }).then((res) => res.json());
    if (Array.isArray(log.items)) setDeliveries(log.items);
    setBusy(false);
  }

  if (!settings) return <p className="text-sm text-slate-500">{t("common.loading")}</p>;

  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-800">{t("settings.notifyAdmin")}</h3>
        {ADMIN_SETTING_KEYS.map((key) => (
          <ChannelRow
            key={key}
            label={t(`settings.notify.${key}` as MessageKey)}
            value={settings.admin[key]}
            onChange={(value) => setSettings({ ...settings, admin: { ...settings.admin, [key]: value } })}
          />
        ))}
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-800">{t("settings.notifyEmployee")}</h3>
        {EMPLOYEE_SETTING_KEYS.map((key) => (
          <ChannelRow
            key={key}
            label={t(`settings.notifyEmp.${key}` as MessageKey)}
            value={settings.employee[key]}
            onChange={(value) => setSettings({ ...settings, employee: { ...settings.employee, [key]: value } })}
          />
        ))}
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={settings.meetingReminderEmail}
            onChange={(event) => setSettings({ ...settings, meetingReminderEmail: event.target.checked })}
          />
          {t("settings.meetingReminderEmail")}
        </label>
      </section>

      <div className="flex flex-wrap gap-2">
        <PrimaryButton disabled={busy} onClick={() => void saveSettings()}>{t("common.save")}</PrimaryButton>
        <PrimaryButton disabled={busy} onClick={() => void runJobs()}>{t("settings.runJobs")}</PrimaryButton>
      </div>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-800">{t("settings.testEmployee")}</h3>
        <div className="flex flex-wrap items-end gap-3">
          <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
            <option value="">{t("settings.pickEmployee")}</option>
            {employees.map((item) => (
              <option key={item.id} value={item.id}>{item.displayName}</option>
            ))}
          </select>
          <PrimaryButton disabled={busy || !employeeId} onClick={() => void testEmployee()}>
            {t("settings.sendEmployeeTest")}
          </PrimaryButton>
        </div>
        {selected ? <p className="mt-2 text-sm text-slate-500">Email: {selected.email || "SKIPPED_NO_EMAIL"}</p> : null}
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-800">{t("settings.deliveryLog")}</h3>
        <div className="grid gap-3 md:hidden">
          {deliveries.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm">
              <p className="font-medium text-slate-800">{item.subject || item.type}</p>
              <p className="mt-1 text-xs text-slate-500">{item.recipient}</p>
              <p className="mt-1 text-xs text-slate-400">{item.createdAt ? new Date(item.createdAt).toLocaleString("he-IL") : "—"}</p>
              <p className="mt-2">
                {item.status === "SENT" ? "✓" : item.status === "FAILED" ? (
                  <button type="button" className="min-h-10 text-rose-600" onClick={() => void retry(item.id)}>
                    ✕ {item.errorCode || t("settings.testMailFailed")}
                  </button>
                ) : item.status}
              </p>
            </div>
          ))}
          {!deliveries.length ? <p className="px-1 py-4 text-sm text-slate-400">{t("notify.empty")}</p> : null}
        </div>
        <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
          <table className="min-w-full text-start text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2">{t("settings.mailDate")}</th>
                <th className="px-3 py-2">{t("settings.mailType")}</th>
                <th className="px-3 py-2">{t("settings.mailRecipient")}</th>
                <th className="px-3 py-2">{t("common.status")}</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-500">{item.createdAt ? new Date(item.createdAt).toLocaleString("he-IL") : "—"}</td>
                  <td className="px-3 py-2">{item.subject || item.type}</td>
                  <td className="px-3 py-2">{item.recipient}</td>
                  <td className="px-3 py-2">
                    {item.status === "SENT" ? "✓" : item.status === "FAILED" ? (
                      <button type="button" className="text-rose-600" onClick={() => void retry(item.id)}>
                        ✕ {item.errorCode || t("settings.testMailFailed")}
                      </button>
                    ) : item.status}
                  </td>
                </tr>
              ))}
              {!deliveries.length ? (
                <tr><td className="px-3 py-4 text-slate-400" colSpan={4}>{t("notify.empty")}</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}
