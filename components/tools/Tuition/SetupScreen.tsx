"use client";

import { useI18n } from "@/lib/i18n";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useTuition } from "@/lib/tuition/store";
import { CURRENCIES } from "@/lib/pos/types";
import { Field, inputClass, primaryBtnClass } from "@/components/tools/FreePos/ui";

export function SetupScreen() {
  const { t } = useI18n();
  const { createBusiness, backToWelcome } = useTuition();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [email, setEmail] = useState("");
  const [upiId, setUpiId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError(t("tuSetErrName"));
      return;
    }
    if (!phone.trim()) {
      setError(t("tuSetErrPhone"));
      return;
    }
    setError("");
    setSaving(true);
    try {
      await createBusiness({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        currency,
        email: email.trim(),
        taxNumber: "",
        upiId: upiId.trim(),
        logoDataUrl: "",
      });
    } catch {
      setError(t("tuSetErrSave"));
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg py-8">
      <button
        type="button"
        onClick={backToWelcome}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-indigo"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("back")}
      </button>

      <h2 className="text-2xl font-bold tracking-tight text-ink">{t("tuSetTitle")}</h2>
      <p className="mt-2 text-sm text-muted">
        {t("tuSetBlurb")}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Field label={t("tuPhTeacher")} required>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("tuSetNamePh")}
            className={inputClass}
            autoFocus
          />
        </Field>
        <Field label={t("clSetPhone")} required>
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="e.g. 98765 43210"
            className={inputClass}
          />
        </Field>
        <Field label={t("appAddressOptional")} hint={t("tuSetAddressHint")}>
          <textarea
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder={t("tuSetWhere")}
            rows={2}
            className={inputClass}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("currency")} required>
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className={inputClass}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("appEmailOptional")}>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className={inputClass}
            />
          </Field>
        </div>
        <Field label={t("tuSetUpiOptional")} hint={t("tuSetUpiHint")}>
          <input
            type="text"
            value={upiId}
            onChange={(event) => setUpiId(event.target.value)}
            placeholder="yourname@okhdfcbank"
            className={inputClass}
          />
        </Field>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button type="submit" disabled={saving} className={`${primaryBtnClass} w-full py-3`}>
          {saving ? t("clSetSaving") : t("tuSetStart")}
        </button>
      </form>
    </div>
  );
}
