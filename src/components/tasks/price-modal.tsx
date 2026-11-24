"use client";

import { useMemo, useState } from "react";
import { Field, GhostButton, Modal, PrimaryButton, inputClass } from "@/components/admin/ui";
import { useI18n } from "@/components/providers/i18n-provider";
import { saveTaskPrice } from "@/lib/business/api";
import { formatIls, parseMoney } from "@/lib/finance/money";
import {
  calculateEnteredPriceWithVat,
  resolveProjectBaseVatMode,
  type ProjectBaseVatMode,
} from "@/lib/finance/vat";
import type { Task } from "@/types/task";

function enteredAmountFromTask(task: Task | undefined) {
  if (!task) return "";
  const mode = resolveProjectBaseVatMode(task.priceVatMode);
  if (mode === "INCLUDING_VAT") {
    return task.priceIncludingVat != null ? String(task.priceIncludingVat) : "";
  }
  return task.priceBeforeVat != null ? String(task.priceBeforeVat) : "";
}

export function PriceModal({
  tasks,
  businessId,
  vatRate,
  onClose,
  onSaved,
}: {
  tasks: Task[];
  businessId: string;
  vatRate: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const first = tasks[0];
  const [amount, setAmount] = useState(enteredAmountFromTask(first));
  const [vatMode, setVatMode] = useState<ProjectBaseVatMode>(() => resolveProjectBaseVatMode(first?.priceVatMode));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useMemo(() => {
    const parsed = parseMoney(amount);
    return parsed === null ? null : calculateEnteredPriceWithVat(parsed, vatRate, vatMode);
  }, [amount, vatMode, vatRate]);

  async function save() {
    const parsed = parseMoney(amount);
    if (parsed === null || parsed < 0 || !tasks.length) return;
    setBusy(true);
    setError(null);
    for (const task of tasks) {
      const result = await saveTaskPrice({
        businessId,
        taskId: task.id,
        priceBeforeVat: parsed,
        vatMode,
      });
      if (!result.ok) {
        setBusy(false);
        setError(result.error === "FORBIDDEN" ? t("pay.priceForbidden") : t("pay.priceFailed"));
        return;
      }
    }
    setBusy(false);
    onSaved();
  }

  return (
    <Modal title={t("pay.setAmountTask")} onClose={onClose}>
      <p className="mb-4 text-sm text-slate-600">
        {tasks.length === 1 ? first?.title : t("work.selectedCount", { count: String(tasks.length) })}
      </p>
      <Field label={t("finance.taskAmount")}>
        <div className="relative">
          <input className={`${inputClass} pe-10`} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
          <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-sm text-slate-500">₪</span>
        </div>
      </Field>
      <div className="mt-3 flex flex-col gap-2 text-sm">
        <label className="inline-flex items-center gap-2">
          <input
            type="radio"
            name="price-modal-vat-mode"
            checked={vatMode === "INCLUDING_VAT"}
            onChange={() => setVatMode("INCLUDING_VAT")}
          />
          {t("finance.vatModeIncluding")}
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="radio"
            name="price-modal-vat-mode"
            checked={vatMode === "EXCLUDING_VAT"}
            onChange={() => setVatMode("EXCLUDING_VAT")}
          />
          {t("finance.vatModeExcluding")}
        </label>
      </div>
      {preview ? (
        <div className="mt-4 space-y-1 text-sm">
          <p className="flex justify-between text-slate-600">
            <span>{t("finance.beforeVat")}</span>
            <span>{formatIls(preview.priceBeforeVat)}</span>
          </p>
          <p className="flex justify-between text-slate-600">
            <span>{t("pay.vatPct", { pct: String(Math.round(preview.vatRate * 100)) })}</span>
            <span>{formatIls(preview.vatAmount)}</span>
          </p>
          <p className="flex justify-between border-t border-slate-200 pt-2 font-semibold">
            <span>{t("pay.totalInclVat")}</span>
            <span>{formatIls(preview.priceIncludingVat)}</span>
          </p>
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <div className="mt-5 flex justify-end gap-2">
        <GhostButton onClick={onClose}>{t("common.cancel")}</GhostButton>
        <PrimaryButton disabled={busy || !preview} onClick={() => void save()}>{t("common.save")}</PrimaryButton>
      </div>
    </Modal>
  );
}
