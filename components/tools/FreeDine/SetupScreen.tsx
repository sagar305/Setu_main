"use client";

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
      setError("Please enter the restaurant name.");
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
      setError("Could not save. Your browser may be blocking local storage.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-lg py-8">
      <h2 className="text-xl font-bold tracking-tight text-ink">Your restaurant</h2>
      <p className="mt-1 text-sm text-muted">
        Only the name is needed to start. Everything else can wait.
      </p>

      <div className="mt-6 space-y-4">
        <Field label="Restaurant name" required>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Anand Bhavan"
            autoFocus
            className={inputClass}
          />
        </Field>

        <Field label="Currency">
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
              Start with a sample menu ({SAMPLE_ITEM_COUNT} items)
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              Common Indian dishes across {SAMPLE_MENU.length} categories, including half/full
              biryani and add-ons. Print a real bill before you type a single dish — then edit or
              delete the lot.
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
          {showMore ? "Hide extra details" : "Add GSTIN, address and logo"}
        </button>

        {showMore && (
          <div className="space-y-4 rounded-xl border border-muted-line/30 bg-white p-4">
            <Field label="Phone">
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Address" hint="Printed at the top of every bill.">
              <textarea
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                rows={2}
                className={inputClass}
              />
            </Field>
            <Field label="GSTIN" hint="Required on the bill if you are GST registered.">
              <input
                value={gstin}
                onChange={(event) => setGstin(event.target.value)}
                placeholder="22AAAAA0000A1Z5"
                className={`${inputClass} uppercase`}
              />
            </Field>
            <Field label="UPI ID" hint="Printed on the bill so guests can pay by scanning.">
              <input
                value={upiId}
                onChange={(event) => setUpiId(event.target.value)}
                placeholder="restaurant@okaxis"
                className={inputClass}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Logo">
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
          <strong className="font-bold">Your data lives in this browser, on this device.</strong>{" "}
          Nothing is uploaded, which is why there is no login — but it also means clearing your
          browsing data would erase it. Take a backup from Settings once a week, or connect a Google
          Sheet, and you are covered.
        </p>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className={primaryBtnClass}>
          {busy ? "Setting up…" : "Start taking orders"}
        </button>
        <button type="button" onClick={backToWelcome} className={secondaryBtnClass}>
          Back
        </button>
      </div>
    </form>
  );
}
