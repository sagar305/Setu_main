"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { usePos } from "@/lib/pos/store";
import { CURRENCIES } from "@/lib/pos/types";
import { Field, inputClass, primaryBtnClass } from "./ui";

export function SetupScreen() {
  const { createBusiness, backToWelcome } = usePos();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [email, setEmail] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [upiId, setUpiId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Business name is required.");
      return;
    }
    if (!phone.trim()) {
      setError("Phone number is required.");
      return;
    }
    if (!address.trim()) {
      setError("Address is required.");
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
        taxNumber: taxNumber.trim(),
        upiId: upiId.trim(),
        logoDataUrl: "",
      });
    } catch {
      setError("Could not save your business profile. Please try again.");
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
        Back
      </button>

      <h2 className="text-2xl font-bold tracking-tight text-ink">Set up your business</h2>
      <p className="mt-2 text-sm text-muted">
        This appears on your receipts. You can change it later in Settings.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Field label="Business name" required>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. ABC Store"
            className={inputClass}
            autoFocus
          />
        </Field>
        <Field label="Phone number" required>
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="e.g. 98765 43210"
            className={inputClass}
          />
        </Field>
        <Field label="Address" required>
          <textarea
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="Shop address shown on receipts"
            rows={2}
            className={inputClass}
          />
        </Field>
        <Field label="Currency" required>
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email (optional)">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@business.com"
              className={inputClass}
            />
          </Field>
          <Field label="Tax number (optional)" hint="e.g. GSTIN">
            <input
              type="text"
              value={taxNumber}
              onChange={(event) => setTaxNumber(event.target.value)}
              placeholder="Shown on receipts"
              className={inputClass}
            />
          </Field>
          <Field label="UPI ID (optional)" hint="For shared-invoice payment links">
            <input
              type="text"
              value={upiId}
              onChange={(event) => setUpiId(event.target.value)}
              placeholder="shopname@okhdfcbank"
              className={inputClass}
            />
          </Field>
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button type="submit" disabled={saving} className={`${primaryBtnClass} w-full py-3`}>
          {saving ? "Setting up…" : "Start selling"}
        </button>
      </form>
    </div>
  );
}
