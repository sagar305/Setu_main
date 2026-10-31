"use client";

import { useMemo, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { useI18n } from "@/lib/i18n";
import {
  composePhone,
  dialCodeFor,
  dialOptions,
  isPlausibleNationalNumber,
  DEFAULT_DIAL_COUNTRY,
} from "@/lib/constants/dialCodes";

type Status = "idle" | "submitting" | "success" | "error";

export type ContactFormField = {
  name: string;
  label: string;
  type: string;
  required: boolean;
  /** Select only: the empty first option, shown until the reader picks one. */
  placeholder?: string;
  /** Select only. `value` is what reaches the inbox, `label` what the reader sees. */
  options?: { value: string; label: string }[];
};

export type ContactFormContent = {
  fields: ContactFormField[];
  submitLabel: string;
};

export function ContactForm({
  form,
  topic,
}: {
  form: ContactFormContent;
  /**
   * Sent with the submission so the inbox can tell a consultancy enquiry from a
   * general one, and used as the analytics form name. Omitted on /contact.
   */
  topic?: string;
}) {
  const { t, lang } = useI18n();
  const [status, setStatus] = useState<Status>("idle");
  const [country, setCountry] = useState(DEFAULT_DIAL_COUNTRY);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState(false);

  // Named in the reader's language and sorted the way that language sorts.
  const countries = useMemo(() => dialOptions(lang), [lang]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // The browser enforces `required`; this catches a number too short to call.
    if (!isPlausibleNationalNumber(country, phone)) {
      setPhoneError(true);
      return;
    }
    setPhoneError(false);
    setStatus("submitting");
    const formName = topic ?? "contact";
    trackEvent("form_submitted", { form: formName });

    const element = event.currentTarget;
    const { phoneNational: _raw, ...fields } = Object.fromEntries(new FormData(element));
    const data = {
      ...fields,
      // Whatever spacing or brackets were typed, one shape leaves the browser.
      phone: composePhone(country, phone),
      phoneCountry: country,
      ...(topic ? { topic } : {}),
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setStatus(res.ok ? "success" : "error");
      trackEvent(res.ok ? "form_succeeded" : "form_failed", { form: formName });
      if (res.ok) {
        element.reset();
        setPhone("");
        setCountry(DEFAULT_DIAL_COUNTRY);
      }
    } catch {
      setStatus("error");
      trackEvent("form_failed", { form: formName });
    }
  }

  if (status === "success") {
    return (
      <p className="rounded-2xl bg-white p-6 text-center text-ink shadow-sm">{t("cfSuccess")}</p>
    );
  }

  const inputClass =
    "rounded-lg border border-muted-line/40 px-4 py-3 text-sm text-ink outline-none focus:border-indigo";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-2xl bg-white p-8 shadow-sm">
      {form.fields.map((field) => {
        if (field.type === "textarea") {
          return (
            <label key={field.name} className="flex flex-col gap-2 text-sm font-medium text-ink">
              {field.label}
              <textarea name={field.name} required={field.required} rows={5} className={inputClass} />
            </label>
          );
        }

        if (field.type === "select") {
          return (
            <label key={field.name} className="flex flex-col gap-2 text-sm font-medium text-ink">
              {field.label}
              <select
                name={field.name}
                required={field.required}
                defaultValue=""
                className={`${inputClass} bg-white`}
              >
                <option value="">{field.placeholder ?? ""}</option>
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          );
        }

        if (field.type === "tel") {
          return (
            <div key={field.name} className="flex flex-col gap-2 text-sm font-medium text-ink">
              <label htmlFor="contact-phone">{field.label}</label>
              <div className="flex gap-2">
                <select
                  name="phoneCountry"
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value);
                    setPhoneError(false);
                  }}
                  aria-label={t("cfCountryCode")}
                  className={`${inputClass} w-36 shrink-0 bg-white`}
                >
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} +{c.dial}
                    </option>
                  ))}
                </select>
                <input
                  id="contact-phone"
                  type="tel"
                  name="phoneNational"
                  inputMode="tel"
                  autoComplete="tel-national"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setPhoneError(false);
                  }}
                  required={field.required}
                  aria-invalid={phoneError || undefined}
                  aria-describedby={phoneError ? "contact-phone-error" : undefined}
                  className={`${inputClass} w-full`}
                />
              </div>
              {phoneError ? (
                <p id="contact-phone-error" className="text-sm font-normal text-red-600">
                  {t("cfPhoneInvalid")}
                </p>
              ) : (
                <p className="text-xs font-normal text-muted">+{dialCodeFor(country)}</p>
              )}
            </div>
          );
        }

        return (
          <label key={field.name} className="flex flex-col gap-2 text-sm font-medium text-ink">
            {field.label}
            <input
              type={field.type}
              name={field.name}
              required={field.required}
              className={inputClass}
            />
          </label>
        );
      })}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-2 rounded-full bg-indigo px-6 py-3 text-sm font-semibold text-cream-paper transition hover:bg-ink disabled:opacity-60"
      >
        {status === "submitting" ? t("cfSending") : form.submitLabel}
      </button>

      {status === "error" && <p className="text-sm text-red-600">{t("cfError")}</p>}
    </form>
  );
}
