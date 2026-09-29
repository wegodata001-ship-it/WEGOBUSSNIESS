"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Field, GhostButton, PrimaryButton, inputClass } from "@/components/admin/ui";
import { mutateBusiness, removeBusinessLogo, uploadBusinessLogo } from "@/lib/admin/api";
import {
  displayBusinessType,
  emptyBusinessService,
  isOtherBusinessType,
  knownBusinessType,
} from "@/lib/data/business-profile";
import { DEFAULT_BUSINESS_VAT_RATE } from "@/lib/finance/vat";
import type { Business } from "@/types/business";
import { BUSINESS_LEGAL_TYPES, type BusinessService, type BusinessSettings } from "@/types/notification";

function saveError(code: string) {
  if (code === "NAME_REQUIRED") return "יש להזין שם עסק";
  if (code === "FORBIDDEN") return "אין הרשאה לערוך את הגדרות העסק";
  if (code === "LOGO_UPLOAD_FAILED") return "העלאת הלוגו נכשלה";
  if (code === "LOGO_REMOVE_FAILED") return "הסרת הלוגו נכשלה";
  return "שמירת הגדרות העסק נכשלה";
}

export function BusinessSettingsForm({
  business,
  settings,
  onSaved,
}: {
  business: Business;
  settings: BusinessSettings;
  onSaved: () => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(business.name);
  const [timezone, setTimezone] = useState(business.timezone);
  const [language, setLanguage] = useState(business.language);
  const [vatPercent, setVatPercent] = useState(String((settings.vatRate || DEFAULT_BUSINESS_VAT_RATE) * 100));
  const [legalType, setLegalType] = useState(knownBusinessType(settings.legalType) || settings.legalType);
  const [customBusinessType, setCustomBusinessType] = useState(settings.customBusinessType);
  const [taxId, setTaxId] = useState(settings.taxId);
  const [phone, setPhone] = useState(settings.phone);
  const [email, setEmail] = useState(settings.email);
  const [address, setAddress] = useState(settings.address);
  const [website, setWebsite] = useState(settings.website);
  const [about, setAbout] = useState(settings.about);
  const [services, setServices] = useState<BusinessService[]>(settings.services);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl || business.logoUrl);
  const [primaryColor, setPrimaryColor] = useState(business.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(business.secondaryColor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(business.name);
    setTimezone(business.timezone);
    setLanguage(business.language);
    setPrimaryColor(business.primaryColor);
    setSecondaryColor(business.secondaryColor);
    setLogoUrl(settings.logoUrl || business.logoUrl);
    setVatPercent(String(Math.round((settings.vatRate || DEFAULT_BUSINESS_VAT_RATE) * 10000) / 100));
    const known = knownBusinessType(settings.legalType);
    setLegalType(known);
    setCustomBusinessType(
      settings.customBusinessType
        || (known === "אחר" && settings.legalType && settings.legalType !== "אחר" ? settings.legalType : ""),
    );
    setTaxId(settings.taxId);
    setPhone(settings.phone);
    setEmail(settings.email);
    setAddress(settings.address);
    setWebsite(settings.website);
    setAbout(settings.about);
    setServices(settings.services);
  }, [business, settings]);

  function updateService(id: string, patch: Partial<BusinessService>) {
    setServices((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function moveService(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= services.length) return;
    const next = [...services];
    const current = next[index];
    const other = next[target];
    if (!current || !other) return;
    next[index] = other;
    next[target] = current;
    setServices(next.map((item, order) => ({ ...item, order })));
  }

  async function onLogoChange(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const url = await uploadBusinessLogo(business.id, file);
      setLogoUrl(url);
      if (fileRef.current) fileRef.current.value = "";
      await onSaved();
    } catch (caught) {
      setError(saveError(caught instanceof Error ? caught.message : ""));
    } finally {
      setBusy(false);
    }
  }

  async function onRemoveLogo() {
    setBusy(true);
    setError("");
    try {
      await removeBusinessLogo(business.id);
      setLogoUrl(null);
      if (fileRef.current) fileRef.current.value = "";
      await onSaved();
    } catch (caught) {
      setError(saveError(caught instanceof Error ? caught.message : ""));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!name.trim()) {
      setError(saveError("NAME_REQUIRED"));
      return;
    }
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await mutateBusiness({
        businessId: business.id,
        action: "updateBusiness",
        data: {
          name: name.trim(),
          timezone,
          language,
          vatRate: Number(vatPercent) / 100,
          legalType,
          customBusinessType: isOtherBusinessType(legalType) ? customBusinessType : "",
          taxId,
          phone,
          email,
          address,
          website,
          about,
          services,
          primaryColor,
          secondaryColor,
        },
      });
      setSaved(true);
      await onSaved();
    } catch (caught) {
      setError(saveError(caught instanceof Error ? caught.message : ""));
    } finally {
      setBusy(false);
    }
  }

  const typeLabel = displayBusinessType(legalType, customBusinessType);

  return (
    <div className="grid gap-5">
      <section className="grid gap-3">
        <h3 className="text-sm font-semibold text-slate-900">פרטי העסק</h3>
        <Field label="שם העסק *">
          <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">לוגו העסק</p>
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-3 sm:flex-row sm:items-center">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-slate-50">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={name || "לוגו העסק"} className="h-full w-full object-contain" />
              ) : (
                <span className="text-xs text-slate-400">אין לוגו</span>
              )}
            </div>
            <div className="flex flex-1 flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => void onLogoChange(event.target.files?.[0])}
              />
              <GhostButton disabled={busy} onClick={() => fileRef.current?.click()}>
                {logoUrl ? "החלפת לוגו" : "העלאת לוגו"}
              </GhostButton>
              {logoUrl ? (
                <GhostButton disabled={busy} onClick={() => void onRemoveLogo()}>הסרת לוגו</GhostButton>
              ) : null}
            </div>
          </div>
        </div>
        <Field label="ח.פ / ע.מ">
          <input className={inputClass} value={taxId} onChange={(event) => setTaxId(event.target.value)} />
        </Field>
        <Field label="סוג העסק">
          <select
            className={inputClass}
            value={knownBusinessType(legalType)}
            onChange={(event) => setLegalType(event.target.value)}
          >
            <option value="">בחר סוג עסק</option>
            {BUSINESS_LEGAL_TYPES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </Field>
        {isOtherBusinessType(legalType) ? (
          <Field label="סוג העסק — פירוט">
            <input
              className={inputClass}
              value={customBusinessType}
              placeholder="לדוגמה: קואופרטיב"
              onChange={(event) => setCustomBusinessType(event.target.value)}
            />
          </Field>
        ) : null}
        <Field label="טלפון"><input className={inputClass} value={phone} onChange={(event) => setPhone(event.target.value)} /></Field>
        <Field label="אימייל"><input className={inputClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
        <Field label="כתובת"><input className={inputClass} value={address} onChange={(event) => setAddress(event.target.value)} /></Field>
        <Field label="אתר אינטרנט"><input className={inputClass} value={website} onChange={(event) => setWebsite(event.target.value)} /></Field>
      </section>

      <section className="grid gap-3">
        <h3 className="text-sm font-semibold text-slate-900">אודות העסק</h3>
        <Field label="הסבר על העסק">
          <textarea
            className={`${inputClass} min-h-36 py-3`}
            placeholder="הסבר קצר על תחום הפעילות והשירותים של העסק"
            value={about}
            onChange={(event) => setAbout(event.target.value)}
          />
        </Field>
      </section>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">שירותי העסק</h3>
          <GhostButton onClick={() => setServices((current) => [...current, emptyBusinessService(current.length)])}>
            + הוסף שירות
          </GhostButton>
        </div>
        {services.length ? services.map((service, index) => (
          <article key={service.id} className="grid gap-2 rounded-2xl border border-slate-200 p-3">
            <Field label="שם השירות *">
              <input
                className={inputClass}
                value={service.name}
                placeholder="לדוגמה: בניית אתרים"
                onChange={(event) => updateService(service.id, { name: event.target.value })}
              />
            </Field>
            <Field label="תיאור">
              <textarea
                className={`${inputClass} min-h-20 py-2`}
                value={service.description}
                placeholder="לדוגמה: פיתוח אתרי תדמית וחנויות אינטרנטיות"
                onChange={(event) => updateService(service.id, { description: event.target.value })}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <GhostButton disabled={index === 0} onClick={() => moveService(index, -1)}>
                <span className="inline-flex items-center gap-1"><ArrowUp className="h-4 w-4" /> למעלה</span>
              </GhostButton>
              <GhostButton disabled={index === services.length - 1} onClick={() => moveService(index, 1)}>
                <span className="inline-flex items-center gap-1"><ArrowDown className="h-4 w-4" /> למטה</span>
              </GhostButton>
              <GhostButton onClick={() => setServices((current) => current.filter((item) => item.id !== service.id).map((item, order) => ({ ...item, order })))}>
                <span className="inline-flex items-center gap-1"><Trash2 className="h-4 w-4" /> מחיקה</span>
              </GhostButton>
            </div>
          </article>
        )) : <p className="text-sm text-slate-500">אין שירותים עדיין. הוסיפו שירות כדי שיופיע בהצעות ובחוזים.</p>}
      </section>

      <section className="grid gap-3">
        <h3 className="text-sm font-semibold text-slate-900">מיתוג</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="צבע ראשי"><input className={inputClass} value={primaryColor} onChange={(event) => setPrimaryColor(event.target.value)} /></Field>
          <Field label="צבע משני"><input className={inputClass} value={secondaryColor} onChange={(event) => setSecondaryColor(event.target.value)} /></Field>
        </div>
        <Field label="מע״מ (%)">
          <input className={inputClass} inputMode="decimal" value={vatPercent} onChange={(event) => setVatPercent(event.target.value)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="אזור זמן"><input className={inputClass} value={timezone} onChange={(event) => setTimezone(event.target.value)} /></Field>
          <Field label="שפה">
            <select className={inputClass} value={language} onChange={(event) => setLanguage(event.target.value === "ar" ? "ar" : "he")}>
              <option value="he">עברית</option>
              <option value="ar">العربية</option>
            </select>
          </Field>
        </div>
        <div className="rounded-2xl border p-4 text-sm" style={{ borderColor: primaryColor }}>
          <p className="text-xs text-slate-500">תצוגת המסמך</p>
          <div className="mt-2 flex items-start gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-12 w-12 object-contain" />
            ) : null}
            <div>
              <p className="font-semibold" style={{ color: primaryColor }}>{name || "שם העסק"}</p>
              {typeLabel ? <p className="text-xs text-slate-500">{typeLabel}</p> : null}
              {taxId ? <p className="text-xs text-slate-500">ח.פ: {taxId}</p> : null}
            </div>
          </div>
        </div>
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-700">הגדרות העסק נשמרו</p> : null}
      <PrimaryButton disabled={busy} onClick={() => void save()}>שמור הגדרות העסק</PrimaryButton>
    </div>
  );
}
