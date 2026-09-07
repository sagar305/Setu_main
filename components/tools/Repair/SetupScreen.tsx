"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useRepair } from "@/lib/repair/store";
import { Field, inputClass, primaryBtnClass, secondaryBtnClass } from "./ui";

/**
 * Three fields, two of them usually pre-filled.
 *
 * The person setting this up has a customer at the counter holding a phone.
 * Device kinds, checklists, warranty defaults, aging thresholds, tax, templates
 * — all of it is in Settings, and none of it has to be decided before the first
 * device goes in the drawer.
 */
export function SetupScreen() {
  const { business, createShop, backToWelcome } = useRepair();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [technician, setTechnician] = useState("");
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
      setError("Your shop's name appears on every job slip and invoice.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await createShop(
        {
          name: name.trim(),
          phone: phone.trim(),
          address: business?.address ?? "",
          currency: business?.currency ?? "INR",
          email: business?.email ?? "",
          taxNumber: business?.taxNumber ?? "",
          logoDataUrl: business?.logoDataUrl ?? "",
        },
        technician
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not set up the job card.");
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

      <h2 className="text-2xl font-bold tracking-tight text-ink">Set up your job card</h2>
      <p className="mt-2 text-sm text-muted">
        Mobile and laptop checklists are ready to go. Add other device kinds, your own problem and
        condition lists, parts and technicians in Settings whenever you need them.
      </p>

      <form
        onSubmit={submit}
        className="mt-6 grid gap-4 rounded-2xl border border-muted-line/30 bg-white p-5"
      >
        <Field label="Shop name" required>
          <input
            className={inputClass}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Sharma Mobile Care"
            autoFocus
          />
        </Field>

        <Field label="Phone" hint="Optional. Printed on job slips and invoices.">
          <input
            className={inputClass}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            inputMode="tel"
            placeholder="98765 43210"
          />
        </Field>

        <Field
          label="First technician"
          hint="Optional. Jobs can be assigned to whoever is working on them."
        >
          <input
            className={inputClass}
            value={technician}
            onChange={(event) => setTechnician(event.target.value)}
            placeholder="Your name"
          />
        </Field>

        {error && (
          <p className="text-sm font-semibold text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="submit" className={primaryBtnClass} disabled={saving}>
            {saving ? "Setting up…" : "Open the job card"}
          </button>
          <button type="button" onClick={backToWelcome} className={secondaryBtnClass}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
