"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useRental } from "@/lib/rental/store";
import { Field, inputClass, primaryBtnClass, secondaryBtnClass } from "./ui";

/**
 * Five fields, three of them pre-filled.
 *
 * The person setting this up has a customer on the phone asking about a date.
 * Everything else — deposits, late fees, tax, buffer days, message templates —
 * is in Settings, and none of it has to be decided before the first item is on
 * the books.
 */
export function SetupScreen() {
  const { business, createBook, backToWelcome } = useRental();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [categoryName, setCategoryName] = useState("Seating");
  const [itemName, setItemName] = useState("Plastic chair");
  const [quantity, setQuantity] = useState("200");
  const [rate, setRate] = useState("15");
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
      setError("Your business name appears on every quotation and challan.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await createBook(
        {
          name: name.trim(),
          phone: phone.trim(),
          address: business?.address ?? "",
          currency: business?.currency ?? "INR",
          email: business?.email ?? "",
          taxNumber: business?.taxNumber ?? "",
          logoDataUrl: business?.logoDataUrl ?? "",
        },
        categoryName,
        itemName.trim()
          ? {
              name: itemName.trim(),
              totalQuantity: Number(quantity) || 0,
              rate: Number(rate) || 0,
            }
          : null
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not set up the hire book.");
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
        Back
      </button>

      <h2 className="text-2xl font-bold tracking-tight text-ink">Set up your hire book</h2>
      <p className="mt-2 text-sm text-muted">
        Start with one item you hire out most. You can add the rest — and your rates, deposits
        and late fees — in Items afterwards.
      </p>

      <form
        onSubmit={submit}
        className="mt-6 grid gap-4 rounded-2xl border border-muted-line/30 bg-white p-5"
      >
        <Field label="Business name" required>
          <input
            className={inputClass}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Sharma Tent House"
            autoFocus
          />
        </Field>

        <Field label="Phone" hint="Optional. Printed on quotations and challans.">
          <input
            className={inputClass}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            inputMode="tel"
            placeholder="98765 43210"
          />
        </Field>

        <Field label="First category" hint='"Seating", "Lighting", "Cameras", "Scaffolding".'>
          <input
            className={inputClass}
            value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)}
          />
        </Field>

        <Field label="First item">
          <input
            className={inputClass}
            value={itemName}
            onChange={(event) => setItemName(event.target.value)}
            placeholder="Plastic chair"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="How many do you own?">
            <input
              className={inputClass}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              inputMode="numeric"
            />
          </Field>
          <Field label="Rate per day">
            <input
              className={inputClass}
              value={rate}
              onChange={(event) => setRate(event.target.value)}
              inputMode="decimal"
            />
          </Field>
        </div>

        {error && (
          <p className="text-sm font-semibold text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="submit" className={primaryBtnClass} disabled={saving}>
            {saving ? "Setting up…" : "Open the hire book"}
          </button>
          <button type="button" onClick={backToWelcome} className={secondaryBtnClass}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
