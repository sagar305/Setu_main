"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { usePharmacy } from "@/lib/pharmacy/store";
import { MEDICINE_FORMS, FORM_LABELS, TAX_RATES } from "@/lib/pharmacy/types";
import { Field, inputClass, primaryBtnClass } from "./ui";

/**
 * Shop details, licence numbers, and one medicine.
 *
 * The one medicine matters: it is what turns "welcome" into a working app, and
 * typing it teaches the shape of the master better than any explanation. Racks,
 * schedules, expiry rules and prescription settings are all in Settings, and
 * none of them has to be decided before the first bill.
 */
export function SetupScreen() {
  const { business, createShop, backToWelcome } = usePharmacy();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [drugLicenceNo, setDrugLicenceNo] = useState("");
  const [gstin, setGstin] = useState("");

  const [medicineName, setMedicineName] = useState("Crocin Advance");
  const [composition, setComposition] = useState("Paracetamol 500mg");
  const [form, setForm] = useState<(typeof MEDICINE_FORMS)[number]>("tablet");
  const [packSize, setPackSize] = useState("15");
  const [taxRate, setTaxRate] = useState("12");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // A device that has already used another Setu tool has a business profile.
  // Asking for the same details a second time is how an app feels like work.
  useEffect(() => {
    if (!business) return;
    setName(business.name);
    setPhone(business.phone);
    if (business.taxNumber) setGstin(business.taxNumber);
  }, [business]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Your shop name appears on every bill.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const size = Math.max(1, Number(packSize) || 1);
      await createShop(
        {
          name: name.trim(),
          phone: phone.trim(),
          address: business?.address ?? "",
          currency: business?.currency ?? "INR",
          email: business?.email ?? "",
          taxNumber: gstin.trim() || (business?.taxNumber ?? ""),
          logoDataUrl: business?.logoDataUrl ?? "",
        },
        { drugLicenceNo: drugLicenceNo.trim(), gstin: gstin.trim() },
        medicineName.trim()
          ? {
              name: medicineName.trim(),
              composition: composition.trim(),
              manufacturer: "",
              strength: "",
              form,
              packSize: size,
              packLabel: `${FORM_LABELS[form].toLowerCase()} of ${size}`,
              hsnCode: "",
              taxRate: Number(taxRate) || 0,
              schedule: "",
              rack: "",
              barcode: "",
              lowStockAt: 0,
              active: true,
            }
          : null
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not set up the shop.");
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

      <h2 className="text-2xl font-bold tracking-tight text-ink">Set up your shop</h2>
      <p className="mt-2 text-sm text-muted">
        Four details and one medicine. You can import your whole master list from a CSV
        afterwards.
      </p>

      <form onSubmit={submit} className="mt-6 grid gap-4">
        <Field label="Shop name" required>
          <input
            className={inputClass}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Sharma Medical Store"
            autoFocus
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone">
            <input
              className={inputClass}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              inputMode="tel"
              placeholder="98765 43210"
            />
          </Field>
          <Field label="Drug licence no." hint="Prints on every bill">
            <input
              className={inputClass}
              value={drugLicenceNo}
              onChange={(event) => setDrugLicenceNo(event.target.value)}
              placeholder="MH-XX-123456"
            />
          </Field>
        </div>

        <Field label="GSTIN" hint="Leave blank if you are not registered">
          <input
            className={inputClass}
            value={gstin}
            onChange={(event) => setGstin(event.target.value.toUpperCase())}
            placeholder="27AAAAA0000A1Z5"
          />
        </Field>

        <div className="rounded-2xl border border-muted-line/30 bg-white p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted">
            Your first medicine
          </h3>
          <div className="mt-3 grid gap-4">
            <Field label="Brand name">
              <input
                className={inputClass}
                value={medicineName}
                onChange={(event) => setMedicineName(event.target.value)}
              />
            </Field>
            <Field label="Composition" hint="The salt — this is what substitute search matches on">
              <input
                className={inputClass}
                value={composition}
                onChange={(event) => setComposition(event.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Form">
                <select
                  className={inputClass}
                  value={form}
                  onChange={(event) =>
                    setForm(event.target.value as (typeof MEDICINE_FORMS)[number])
                  }
                >
                  {MEDICINE_FORMS.map((option) => (
                    <option key={option} value={option}>
                      {FORM_LABELS[option]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Units per pack">
                <input
                  className={inputClass}
                  value={packSize}
                  onChange={(event) => setPackSize(event.target.value)}
                  inputMode="numeric"
                />
              </Field>
              <Field label="GST %">
                <select
                  className={inputClass}
                  value={taxRate}
                  onChange={(event) => setTaxRate(event.target.value)}
                >
                  {TAX_RATES.map((rate) => (
                    <option key={rate} value={rate}>
                      {rate}%
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted">
            Stock is not entered here. It arrives through Purchases, batch by batch, which is
            what lets the app track expiry at all.
          </p>
        </div>

        {error && (
          <p className="text-sm font-semibold text-red-600" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className={primaryBtnClass} disabled={saving}>
          {saving ? "Setting up…" : "Open my shop"}
        </button>
      </form>
    </div>
  );
}
