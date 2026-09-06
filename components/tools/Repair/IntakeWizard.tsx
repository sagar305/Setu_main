"use client";

// Taking a device in. Four steps, one screen each on a phone, target 90 seconds.
//
// The order is the order the counter actually works in: who is this, what is it,
// what is wrong and what does it look like right now, and what did we promise.
// Steps 1, 2 and 4 are ordinary forms. Step 3 is the product — the condition
// checklist, the photos and the accessories are the record that ends the "this
// scratch wasn't there before" argument, and everything about that step is built
// so it can be completed with a customer standing on the other side of the
// counter waiting.
//
// Nothing here is saved until the last step. A half-finished intake is not a
// job, and a board full of abandoned drafts would be worse than a slow form.

import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Plus,
  Search,
  UserPlus,
  X,
} from "lucide-react";
import { useRepair, type IntakeInput } from "@/lib/repair/store";
import { readIntakePhoto } from "@/lib/repair/photos";
import {
  DEVICE_KIND_LABELS,
  MAX_INTAKE_PHOTOS,
  generateId,
  presetsFor,
  todayKey,
  type ConditionItem,
  type Customer,
  type DeviceKind,
  type Job,
} from "@/lib/repair/types";
import { SignaturePad } from "@/components/tools/Clinic/SignaturePad";
import {
  Field,
  SensitiveNote,
  ToggleChip,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "./ui";

const STEPS = ["Customer", "Device", "Problem & condition", "Terms"] as const;

export function IntakeWizard({
  onDone,
  onCancel,
}: {
  /** Called with the saved job so the caller can print and message. */
  onDone: (job: Job) => void;
  onCancel: () => void;
}) {
  const { customers, jobs, technicians, settings, createJob, saveCustomer } = useRepair();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Step 1 — customer
  const [phoneSearch, setPhoneSearch] = useState("");
  const [picked, setPicked] = useState<Customer | null>(null);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newAltPhone, setNewAltPhone] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newGstin, setNewGstin] = useState("");

  // Step 2 — device
  const kinds = settings.deviceKinds.length > 0 ? settings.deviceKinds : (["mobile"] as DeviceKind[]);
  const [deviceKind, setDeviceKind] = useState<DeviceKind>(kinds[0]);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const [colour, setColour] = useState("");

  // Step 3 — problem and condition
  const [problems, setProblems] = useState<string[]>([]);
  const [problemNote, setProblemNote] = useState("");
  const [conditions, setConditions] = useState<ConditionItem[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [accessories, setAccessories] = useState<string[]>([]);
  const [unlockCode, setUnlockCode] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Step 4 — terms
  const [estimate, setEstimate] = useState("");
  const [promisedDate, setPromisedDate] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [priority, setPriority] = useState<Job["priority"]>("normal");
  const [signature, setSignature] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  /**
   * Brands and models this shop has typed before.
   *
   * A phone repair shop sees the same twenty models all week, and the second
   * "Redmi Note 12" of the day should not be typed out again. Built from the
   * jobs themselves rather than a shipped device list — a list of every phone
   * ever sold in India would be long, wrong within a month, and still missing
   * whatever this particular shop actually sees.
   */
  const knownBrands = useMemo(
    () =>
      Array.from(
        new Set(jobs.filter((job) => job.deviceKind === deviceKind).map((job) => job.brand))
      )
        .filter(Boolean)
        .sort(),
    [jobs, deviceKind]
  );
  const knownModels = useMemo(
    () =>
      Array.from(
        new Set(
          jobs
            .filter(
              (job) =>
                job.deviceKind === deviceKind &&
                (!brand || job.brand.toLowerCase() === brand.toLowerCase())
            )
            .map((job) => job.model)
        )
      )
        .filter(Boolean)
        .sort(),
    [jobs, deviceKind, brand]
  );

  const problemPresets = presetsFor(settings.problemPresets, deviceKind);
  const accessoryPresets = presetsFor(settings.accessoryPresets, deviceKind);
  const conditionPresets = presetsFor(settings.conditionPresets, deviceKind);

  // Rebuild the checklist when the device kind changes — a laptop's list is not
  // a phone's. Anything already ticked for the old kind is dropped with it.
  const syncConditions = (kind: DeviceKind) => {
    setConditions(
      presetsFor(settings.conditionPresets, kind).map((label) => ({
        id: generateId(),
        label,
        present: false,
        note: "",
      }))
    );
  };

  const matches = useMemo(() => {
    const needle = phoneSearch.trim().toLowerCase();
    if (!needle) return [];
    return customers
      .filter(
        (customer) =>
          customer.phone.toLowerCase().includes(needle) ||
          customer.name.toLowerCase().includes(needle)
      )
      .slice(0, 6);
  }, [customers, phoneSearch]);

  const anyDamage = conditions.some((item) => item.present);

  const next = () => {
    setError("");
    if (step === 0) {
      if (picked) {
        setStep(1);
        if (conditions.length === 0) syncConditions(deviceKind);
        return;
      }
      if (!newName.trim() || !newPhone.trim()) {
        setError("A new customer needs a name and a phone number.");
        return;
      }
      setStep(1);
      if (conditions.length === 0) syncConditions(deviceKind);
      return;
    }

    if (step === 2) {
      // §3.2: photos are required once any condition item is marked present.
      // The evidence is the point of the checklist — a ticked "screen cracked"
      // with no picture behind it is an assertion, not a record.
      //
      // OPEN QUESTION: the spec says "required by default" but puts no override
      // in RepairSettings. Enforced here with no way past it; confirm whether a
      // setting to relax it should exist.
      if (anyDamage && photos.length === 0) {
        setError(
          "Add at least one photo. Damage has been noted, and a photo is what makes that record hold up later."
        );
        return;
      }
    }

    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const back = () => {
    setError("");
    if (step === 0) {
      onCancel();
      return;
    }
    setStep((current) => current - 1);
  };

  const submit = async () => {
    setError("");
    setSaving(true);
    try {
      let customerId = picked?.id ?? "";
      if (!customerId) {
        const created = await saveCustomer({
          name: newName.trim(),
          phone: newPhone.trim(),
          altPhone: newAltPhone.trim(),
          address: newAddress.trim(),
          companyName: newCompany.trim(),
          gstin: newGstin.trim(),
        });
        customerId = created.id;
      }

      const input: IntakeInput = {
        customerId,
        deviceKind,
        brand: brand.trim(),
        model: model.trim(),
        serialNo: serialNo.trim(),
        colour: colour.trim(),
        reportedProblems: problems,
        problemNote: problemNote.trim(),
        conditionIn: conditions,
        intakePhotos: photos,
        accessories,
        unlockCode: settings.captureUnlockCode ? unlockCode.trim() : "",
        estimateAmount: estimate.trim() === "" ? null : Number(estimate) || 0,
        promisedDate: promisedDate || null,
        technicianId: technicianId || null,
        priority,
        intakeSignatureDataUrl: signature,
        customerNotes: customerNotes.trim(),
        internalNotes: internalNotes.trim(),
      };

      const job = await createJob(input);
      onDone(job);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this job.");
      setSaving(false);
    }
  };

  const addPhoto = async (file: File) => {
    setError("");
    if (photos.length >= MAX_INTAKE_PHOTOS) {
      setError(`Up to ${MAX_INTAKE_PHOTOS} photos per job, so backups stay a sensible size.`);
      return;
    }
    try {
      setPhotos((previous) => [...previous, ""]);
      const dataUrl = await readIntakePhoto(file);
      setPhotos((previous) => [...previous.filter(Boolean), dataUrl]);
    } catch {
      setPhotos((previous) => previous.filter(Boolean));
      setError("That photo could not be read. Try taking it again.");
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <ol className="mb-5 flex flex-wrap gap-2" aria-label="Intake steps">
        {STEPS.map((label, position) => (
          <li key={label}>
            <span
              aria-current={position === step ? "step" : undefined}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                position === step
                  ? "border-indigo bg-indigo text-white"
                  : position < step
                    ? "border-green-300 bg-green-50 text-green-800"
                    : "border-muted-line/40 bg-white text-muted"
              }`}
            >
              {position < step ? <Check className="h-3 w-3" aria-hidden="true" /> : `${position + 1}.`}
              {label}
            </span>
          </li>
        ))}
      </ol>

      <div className="rounded-2xl border border-muted-line/30 bg-white p-4 sm:p-5">
        {/* ---------------------------------------------------------------- */}
        {step === 0 && (
          <div className="grid gap-4">
            <Field label="Find the customer" hint="Search by phone number or name.">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/60"
                  aria-hidden="true"
                />
                <input
                  className={`${inputClass} pl-9`}
                  value={phoneSearch}
                  onChange={(event) => {
                    setPhoneSearch(event.target.value);
                    setPicked(null);
                  }}
                  inputMode="tel"
                  placeholder="98765 43210"
                  autoFocus
                />
              </div>
            </Field>

            {matches.length > 0 && !picked && (
              <ul className="grid gap-2">
                {matches.map((customer) => (
                  <li key={customer.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setPicked(customer);
                        setPhoneSearch(customer.phone || customer.name);
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-muted-line/30 bg-white p-3 text-left transition hover:border-indigo/50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-ink">
                          {customer.name}
                        </span>
                        <span className="block text-xs text-muted">{customer.phone}</span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-muted">
                        {jobs.filter((job) => job.customerId === customer.id).length} jobs
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {picked ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-indigo/40 bg-indigo/5 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{picked.name}</p>
                  <p className="text-xs text-muted">{picked.phone}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPicked(null);
                    setPhoneSearch("");
                  }}
                  className="shrink-0 text-xs font-semibold text-muted hover:text-indigo"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="grid gap-4 rounded-xl border border-dashed border-muted-line/40 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <UserPlus className="h-4 w-4 text-indigo" aria-hidden="true" />
                  New customer
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name" required>
                    <input
                      className={inputClass}
                      value={newName}
                      onChange={(event) => setNewName(event.target.value)}
                      placeholder="Ramesh Kumar"
                    />
                  </Field>
                  <Field label="Phone" required>
                    <input
                      className={inputClass}
                      value={newPhone || phoneSearch}
                      onChange={(event) => setNewPhone(event.target.value)}
                      inputMode="tel"
                      placeholder="98765 43210"
                    />
                  </Field>
                </div>
                <details className="text-sm">
                  <summary className="cursor-pointer font-semibold text-muted hover:text-indigo">
                    More details
                  </summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Alternate phone">
                      <input
                        className={inputClass}
                        value={newAltPhone}
                        onChange={(event) => setNewAltPhone(event.target.value)}
                        inputMode="tel"
                      />
                    </Field>
                    <Field label="Company" hint="Blank for walk-ins.">
                      <input
                        className={inputClass}
                        value={newCompany}
                        onChange={(event) => setNewCompany(event.target.value)}
                      />
                    </Field>
                    <Field label="GSTIN">
                      <input
                        className={inputClass}
                        value={newGstin}
                        onChange={(event) => setNewGstin(event.target.value.toUpperCase())}
                      />
                    </Field>
                    <Field label="Address">
                      <input
                        className={inputClass}
                        value={newAddress}
                        onChange={(event) => setNewAddress(event.target.value)}
                      />
                    </Field>
                  </div>
                </details>
              </div>
            )}
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {step === 1 && (
          <div className="grid gap-4">
            <Field label="What kind of device?">
              <div className="flex flex-wrap gap-2">
                {kinds.map((kind) => (
                  <ToggleChip
                    key={kind}
                    active={deviceKind === kind}
                    onClick={() => {
                      setDeviceKind(kind);
                      setProblems([]);
                      setAccessories([]);
                      syncConditions(kind);
                    }}
                  >
                    {DEVICE_KIND_LABELS[kind]}
                  </ToggleChip>
                ))}
              </div>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Brand">
                <input
                  className={inputClass}
                  value={brand}
                  onChange={(event) => setBrand(event.target.value)}
                  list="repair-brands"
                  placeholder="Samsung"
                  autoFocus
                />
                <datalist id="repair-brands">
                  {knownBrands.map((value) => (
                    <option key={value} value={value} />
                  ))}
                </datalist>
              </Field>
              <Field label="Model">
                <input
                  className={inputClass}
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  list="repair-models"
                  placeholder="Galaxy M31"
                />
                <datalist id="repair-models">
                  {knownModels.map((value) => (
                    <option key={value} value={value} />
                  ))}
                </datalist>
              </Field>
              <Field
                label="IMEI / serial number"
                hint="Customers read this out when they ring. Worth the ten seconds."
              >
                <input
                  className={inputClass}
                  value={serialNo}
                  onChange={(event) => setSerialNo(event.target.value)}
                  inputMode="numeric"
                />
              </Field>
              <Field label="Colour">
                <input
                  className={inputClass}
                  value={colour}
                  onChange={(event) => setColour(event.target.value)}
                  placeholder="Black"
                />
              </Field>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {step === 2 && (
          <div className="grid gap-5">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                What is wrong with it?
              </p>
              {problemPresets.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {problemPresets.map((label) => (
                    <ToggleChip
                      key={label}
                      active={problems.includes(label)}
                      onClick={() =>
                        setProblems((previous) =>
                          previous.includes(label)
                            ? previous.filter((value) => value !== label)
                            : [...previous, label]
                        )
                      }
                    >
                      {label}
                    </ToggleChip>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">
                  No checklist set up for {DEVICE_KIND_LABELS[deviceKind].toLowerCase()} yet — add
                  one in Settings, or just type it below.
                </p>
              )}
              <textarea
                className={`${inputClass} mt-3`}
                rows={2}
                value={problemNote}
                onChange={(event) => setProblemNote(event.target.value)}
                placeholder="In the customer's own words…"
              />
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                Condition when received
              </p>
              <p className="mb-2 text-xs text-muted">
                Tick anything already damaged. This is what settles a dispute later, so it is
                worth thirty seconds now.
              </p>
              {conditions.length === 0 ? (
                <p className="text-sm text-muted">
                  No condition checklist for this device kind yet — set one up in Settings.
                </p>
              ) : (
                <ul className="grid gap-2">
                  {conditions.map((item) => (
                    <li
                      key={item.id}
                      className={`rounded-xl border p-3 transition ${
                        item.present ? "border-amber-300 bg-amber-50" : "border-muted-line/30 bg-white"
                      }`}
                    >
                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-5 w-5 shrink-0 rounded border-muted-line/50 text-indigo focus:ring-indigo"
                          checked={item.present}
                          onChange={(event) =>
                            setConditions((previous) =>
                              previous.map((row) =>
                                row.id === item.id
                                  ? { ...row, present: event.target.checked }
                                  : row
                              )
                            )
                          }
                        />
                        <span className="text-sm font-semibold text-ink">{item.label}</span>
                      </label>
                      {item.present && (
                        <input
                          className={`${inputClass} mt-2`}
                          value={item.note}
                          onChange={(event) =>
                            setConditions((previous) =>
                              previous.map((row) =>
                                row.id === item.id ? { ...row, note: event.target.value } : row
                              )
                            )
                          }
                          placeholder="Where, how bad — optional"
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                Photos {anyDamage && <span className="text-red-600">— required</span>}
              </p>
              <p className="mb-2 text-xs text-muted">
                Up to {MAX_INTAKE_PHOTOS}. Shoot the damage you ticked, and the screen switched on
                if it turns on at all.
              </p>
              <div className="flex flex-wrap gap-2">
                {photos.map((photo, position) =>
                  photo ? (
                    <div key={photo.slice(-24)} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo}
                        alt={`Intake photo ${position + 1}`}
                        className="h-24 w-24 rounded-lg border border-muted-line/30 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setPhotos((previous) => previous.filter((_, index) => index !== position))
                        }
                        className="absolute -right-2 -top-2 rounded-full bg-white p-1 shadow ring-1 ring-muted-line/40"
                        aria-label={`Remove photo ${position + 1}`}
                      >
                        <X className="h-4 w-4 text-red-600" />
                      </button>
                    </div>
                  ) : (
                    <div
                      key="pending"
                      className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-muted-line/40 text-xs text-muted"
                    >
                      Adding…
                    </div>
                  )
                )}
                {photos.length < MAX_INTAKE_PHOTOS && (
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-muted-line/50 text-xs font-semibold text-muted transition hover:border-indigo/50 hover:text-indigo"
                  >
                    <Camera className="h-5 w-5" aria-hidden="true" />
                    Add photo
                  </button>
                )}
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void addPhoto(file);
                }}
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Accessories taken in
              </p>
              <div className="flex flex-wrap gap-2">
                {accessoryPresets.map((label) => (
                  <ToggleChip
                    key={label}
                    active={accessories.includes(label)}
                    onClick={() =>
                      setAccessories((previous) =>
                        previous.includes(label)
                          ? previous.filter((value) => value !== label)
                          : [...previous, label]
                      )
                    }
                  >
                    {label}
                  </ToggleChip>
                ))}
                {accessoryPresets.length === 0 && (
                  <p className="text-sm text-muted">No accessory list for this device kind yet.</p>
                )}
              </div>
            </div>

            {settings.captureUnlockCode && (
              <div className="grid gap-2">
                <SensitiveNote>
                  The unlock code is saved on this device, in this browser, along with the rest of
                  the job. Anyone who can open this app can read it. Leave it blank unless the
                  repair genuinely needs the device unlocked — you can always ring the customer.
                </SensitiveNote>
                <Field label="Unlock code / pattern" hint="Optional. Clear it once the job is done.">
                  <input
                    className={inputClass}
                    value={unlockCode}
                    onChange={(event) => setUnlockCode(event.target.value)}
                    autoComplete="off"
                  />
                </Field>
              </div>
            )}
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {step === 3 && (
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Estimate" hint="Optional — leave blank until it has been looked at.">
                <input
                  className={inputClass}
                  value={estimate}
                  onChange={(event) => setEstimate(event.target.value)}
                  inputMode="decimal"
                  placeholder="1500"
                />
              </Field>
              <Field label="Promised by">
                <input
                  type="date"
                  className={inputClass}
                  value={promisedDate}
                  min={todayKey()}
                  onChange={(event) => setPromisedDate(event.target.value)}
                />
              </Field>
              <Field label="Technician">
                <select
                  className={inputClass}
                  value={technicianId}
                  onChange={(event) => setTechnicianId(event.target.value)}
                >
                  <option value="">Not assigned yet</option>
                  {technicians
                    .filter((tech) => tech.active)
                    .map((tech) => (
                      <option key={tech.id} value={tech.id}>
                        {tech.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Priority">
                <div className="flex gap-2">
                  <ToggleChip active={priority === "normal"} onClick={() => setPriority("normal")}>
                    Normal
                  </ToggleChip>
                  <ToggleChip active={priority === "urgent"} onClick={() => setPriority("urgent")}>
                    Urgent
                  </ToggleChip>
                </div>
              </Field>
            </div>

            <Field label="Notes for the customer" hint="Prints on the job slip.">
              <textarea
                className={inputClass}
                rows={2}
                value={customerNotes}
                onChange={(event) => setCustomerNotes(event.target.value)}
              />
            </Field>

            <Field label="Internal notes" hint="Never printed, never sent.">
              <textarea
                className={inputClass}
                rows={2}
                value={internalNotes}
                onChange={(event) => setInternalNotes(event.target.value)}
              />
            </Field>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                Customer&apos;s signature
              </p>
              <p className="mb-2 text-xs text-muted">
                Optional. If your customers would rather sign paper, skip this and have them sign
                the printed slip instead — it carries the same condition record.
              </p>
              <SignaturePad value={signature} onChange={setSignature} />
            </div>
          </div>
        )}

        {error && (
          <p className="mt-4 text-sm font-semibold text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={back} className={secondaryBtnClass} disabled={saving}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {step === 0 ? "Cancel" : "Back"}
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={next} className={`${primaryBtnClass} sm:flex-1`}>
              Next
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void submit()}
              className={`${primaryBtnClass} sm:flex-1`}
              disabled={saving}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {saving ? "Saving…" : "Save job and print slip"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
