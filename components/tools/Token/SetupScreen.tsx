"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useToken } from "@/lib/token/store";
import { Field, inputClass, primaryBtnClass, secondaryBtnClass } from "./ui";

/**
 * Three fields, and two of them are pre-filled.
 *
 * The person setting this up is usually standing at a counter with people
 * already waiting. Everything else — extra services, more counters, the
 * announcement language, the display title — is in Settings, and none of it
 * has to be decided before the first token goes out.
 */
export function SetupScreen() {
  const { t } = useI18n();
  const { business, createQueue, backToWelcome } = useToken();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  // Seeded from the dictionary, so the first service and desk a queue is
  // created with are named in the language it was set up in.
  const [serviceName, setServiceName] = useState(() => t("tkSetServicePh"));
  const [counterName, setCounterName] = useState(() => t("tkSetCounterPh"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // A device that has already used another Setu tool has a business profile.
  // Asking for the same details a second time is how an app feels like work.
  useEffect(() => {
    if (!business) return;
    setName(business.name);
    setPhone(business.phone);
  }, [business]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError(t("tkSetErrName"));
      return;
    }
    setError("");
    setSaving(true);
    try {
      await createQueue(
        {
          name: name.trim(),
          phone: phone.trim(),
          address: business?.address ?? "",
          currency: business?.currency ?? "INR",
          email: business?.email ?? "",
          taxNumber: business?.taxNumber ?? "",
          logoDataUrl: business?.logoDataUrl ?? "",
        },
        serviceName,
        counterName
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("tkSetErrSetup"));
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg py-8">
      <button
        type="button"
        onClick={backToWelcome}
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-indigo"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("back")}
      </button>

      <h2 className="text-2xl font-bold tracking-tight text-ink">{t("tkSetTitle")}</h2>
      <p className="mt-2 text-sm text-muted">
        {t("tkSetBlurb")}
      </p>

      <form onSubmit={submit} className="mt-6 grid gap-4 rounded-2xl border border-muted-line/30 bg-white p-5">
        <Field label={t("tkSetBusinessName")} required>
          <input
            className={inputClass}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Sharma Diagnostics"
            autoFocus
          />
        </Field>

        <Field label={t("phone")} hint={t("tkSetPhoneHint")}>
          <input
            className={inputClass}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            inputMode="tel"
            placeholder="98765 43210"
          />
        </Field>

        <Field label={t("tkSetServiceQ")} hint={t("tkSetServiceHint")}>
          <input
            className={inputClass}
            value={serviceName}
            onChange={(event) => setServiceName(event.target.value)}
            placeholder={t("tkSetServicePh")}
          />
        </Field>

        <Field label={t("tkSetCounterQ")} hint={t("tkSetCounterHint")}>
          <input
            className={inputClass}
            value={counterName}
            onChange={(event) => setCounterName(event.target.value)}
            placeholder={t("tkSetCounterPh")}
          />
        </Field>

        {error && (
          <p className="text-sm font-semibold text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="submit" className={primaryBtnClass} disabled={saving}>
            {saving ? t("tkSetSaving") : t("tkSetStart")}
          </button>
          <button type="button" onClick={backToWelcome} className={secondaryBtnClass}>
            {t("cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}
