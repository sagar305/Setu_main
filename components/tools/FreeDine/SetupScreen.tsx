"use client";

import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/translate";
import { useState } from "react";
import { ChevronDown, TriangleAlert } from "lucide-react";
import { useDine } from "@/lib/dine/store";
import { CURRENCIES } from "@/lib/dine/types";
import { SAMPLE_MENU } from "@/lib/dine/sampleMenu";
import { Field, inputClass, primaryBtnClass, secondaryBtnClass } from "./ui";

const SAMPLE_ITEM_COUNT = SAMPLE_MENU.reduce((sum, category) => sum + category.items.length, 0);

function guessTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  } catch {
    return "Asia/Kolkata";
  }
}

/**
 * FR-1.3: setup must finish in under a minute. Only the name is required and
 * everything else is folded away, because a restaurant that has to fill twelve
 * fields before seeing the product will close the tab instead.
 */
export function SetupScreen() {
  const { t } = useI18n();
  const { completeSetup, backToWelcome } = useDine();

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [seedSampleMenu, setSeedSampleMenu] = useState(true);
  const [showMore, setShowMore] = useState(false);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const [email, setEmail] = useState("");
  const [upiId, setUpiId] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onLogo = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError(t("dnSuNameRequired"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await completeSetup({
        profile: {
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          email: email.trim(),
          currency,
          gstin: gstin.trim().toUpperCase(),
          logoDataUrl,
          upiId: upiId.trim(),
          timezone: guessTimezone(),
        },
        seedSampleMenu,
      });
    } catch {
      setError(t("dnSuCouldNotSave"));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-lg py-8">
      <h2 className="text-xl font-bold tracking-tight text-ink">{t("dnSuYourRestaurant")}</h2>
      <p className="mt-1 text-sm text-muted">{t("dnSuOnlyNameNeeded")}</p>

      <div className="mt-6 space-y-4">
        <Field label={t("qmRestaurantName")} required>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("dnSuNamePh")}
            autoFocus
            className={inputClass}
          />
        </Field>

        <Field label={t("currency")}>
          <select
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            className={inputClass}
          >
            {CURRENCIES.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-muted-line/40 bg-white p-4">
          <input
            type="checkbox"
            checked={seedSampleMenu}
            onChange={(event) => setSeedSampleMenu(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#26306B]"
          />
          <span>
            <span className="block text-sm font-semibold text-ink">
              {fill(t("dnSuSampleMenu"), { n: SAMPLE_ITEM_COUNT })}
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              {fill(t("dnSuSampleMenuBody"), { n: SAMPLE_MENU.length })}
            </span>
          </span>
        </label>

        <button
          type="button"
          onClick={() => setShowMore((previous) => !previous)}
          className="flex items-center gap-1.5 text-sm font-semibold text-indigo"
        >
          <ChevronDown
            className={`h-4 w-4 transition ${showMore ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
          {showMore ? t("dnSuHideExtra") : t("dnSuAddExtra")}
        </button>

        {showMore && (
          <div className="space-y-4 rounded-xl border border-muted-line/30 bg-white p-4">
            <Field label={t("phone")}>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={t("address")} hint={t("dnSuAddressHint")}>
              <textarea
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                rows={2}
                className={inputClass}
              />
            </Field>
            <Field label={t("gstin")} hint={t("dnSuGstinHint")}>
              <input
                value={gstin}
                onChange={(event) => setGstin(event.target.value)}
                placeholder="22AAAAA0000A1Z5"
                className={`${inputClass} uppercase`}
              />
            </Field>
            <Field label={t("upiId")} hint={t("dnSuUpiHint")}>
              <input
                value={upiId}
                onChange={(event) => setUpiId(event.target.value)}
                placeholder="restaurant@okaxis"
                className={inputClass}
              />
            </Field>
            <Field label={t("email")}>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={t("bpLogo")}>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => onLogo(event.target.files?.[0])}
                className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-cream file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink"
              />
            </Field>
          </div>
        )}
      </div>

      {/* FR-10.5: say plainly where the data lives, before they rely on it. */}
      <div className="mt-6 flex gap-3 rounded-xl border border-saffron/40 bg-saffron/10 p-4">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-ink" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-ink">
          <strong className="font-bold">{t("dnSuDataHere")}</strong>{" "}
          {t("dnSuDataHereBody")}
        </p>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className={primaryBtnClass}>
          {busy ? t("clSetSaving") : t("dnSuStartTakingOrders")}
        </button>
        <button type="button" onClick={backToWelcome} className={secondaryBtnClass}>
          {t("back")}
        </button>
      </div>
    </form>
  );
}
