"use client";

// Outside repair: the device (or a part of it) went to another service centre
// because this shop could not fix it.
//
// The job keeps its own number and its own customer; the trip is a row on the
// job, with the vendor, the dates, the courier docket and a challan number. A
// job can go out more than once — vendor A gives up, it goes to vendor B — and
// every trip stays on the record.
//
// What the vendor charges is the shop's cost. It feeds the job's margin and is
// shown beside the bill, but it is never added to the customer's bill: the
// front desk decides what to charge.

import { useEffect, useState } from "react";
import { PackageOpen, Plus, Printer, Receipt, Truck, Undo2 } from "lucide-react";
import { useRepair, type VendorInput } from "@/lib/repair/store";
import {
  currentOutside,
  defaultOutsideLabel,
  isOutsideOverdue,
  outsideCostTotal,
} from "@/lib/repair/calc";
import { printOutsideChallan, type PrintContext } from "@/lib/repair/print";
import {
  CLOSED_STATUSES,
  addDays,
  formatDate,
  todayKey,
  type Job,
  type OutsideRepair,
  type Vendor,
} from "@/lib/repair/types";
import { formatMoney } from "@/lib/pos/types";
import {
  Field,
  Modal,
  Pill,
  SectionCard,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "./ui";

export const EMPTY_VENDOR: VendorInput = {
  name: "",
  city: "",
  phone: "",
  contactPerson: "",
  speciality: "",
  address: "",
  gstin: "",
  active: true,
};

/** Where a trip stands, in a few words. */
export function tripSummary(trip: OutsideRepair): string {
  const where = [trip.vendorName, trip.vendorCity].filter(Boolean).join(", ");
  if (!trip.receivedOn) return `At ${where} since ${formatDate(trip.sentOn)}`;
  return `${where}: ${formatDate(trip.sentOn)} → ${formatDate(trip.receivedOn)} · ${
    trip.outcome === "repaired" ? "repaired" : "not repaired"
  }`;
}

/** The outside-repair section of a job. */
export function OutsideRepairSection({
  job,
  context,
  canManage,
  onError,
}: {
  job: Job;
  context: PrintContext;
  /** Front desk and owner may send and receive; a technician only sees. */
  canManage: boolean;
  onError: (message: string) => void;
}) {
  const { vendors, vendorById, today, business } = useRepair();
  const [sending, setSending] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [billing, setBilling] = useState<OutsideRepair | null>(null);
  const currency = business?.currency || "INR";
  const trips = job.outsideRepairs ?? [];
  const open = currentOutside(job);
  const overdue = isOutsideOverdue(job, today);
  const cost = outsideCostTotal(job);
  const closed = CLOSED_STATUSES.includes(job.status);

  if (trips.length === 0 && (!canManage || closed)) return null;

  return (
    <SectionCard
      title="Outside repair"
      action={
        canManage && !open && !closed ? (
          <button type="button" onClick={() => setSending(true)} className={secondaryBtnClass}>
            <Truck className="h-4 w-4" aria-hidden="true" />
            Send outside
          </button>
        ) : null
      }
    >
      {trips.length === 0 && (
        <p className="text-sm text-muted">
          Can&apos;t repair it here? Send it to another service centre and keep track of it.
          The customer&apos;s tracking page will say &quot;With our repair partner&quot;, never
          the vendor&apos;s name.
        </p>
      )}

      {open && (
        <div
          className={`rounded-xl border p-3 ${
            overdue ? "border-red-300 bg-red-50" : "border-sky-300 bg-sky-50"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Truck className="h-4 w-4 text-sky-800" aria-hidden="true" />
            <span className="text-sm font-bold text-ink">{tripSummary(open)}</span>
            {overdue && <Pill tone="danger">Overdue — expected {formatDate(open.expectedBackOn ?? "")}</Pill>}
            {!overdue && open.expectedBackOn && (
              <Pill tone="muted">Expected back {formatDate(open.expectedBackOn)}</Pill>
            )}
          </div>
          <p className="mt-1 text-sm text-ink">
            <strong>{open.sentWhat}</strong>
            {open.problem ? ` — ${open.problem}` : ""}
          </p>
          <p className="text-xs text-muted">
            Challan {open.challanNo}
            {open.sentVia ? ` · ${open.sentVia}` : ""}
            {open.docketNo ? ` · docket ${open.docketNo}` : ""}
            {open.quotedCharge !== null ? ` · quoted ${formatMoney(open.quotedCharge, currency)}` : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {canManage && (
              <button type="button" onClick={() => setReceiving(true)} className={primaryBtnClass}>
                <Undo2 className="h-4 w-4" aria-hidden="true" />
                Received back
              </button>
            )}
            <button
              type="button"
              onClick={() => printOutsideChallan(context, open, vendorById(open.vendorId) ?? null)}
              className={secondaryBtnClass}
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              Challan
            </button>
          </div>
        </div>
      )}

      {trips.filter((trip) => trip.receivedOn).length > 0 && (
        <ul className="mt-3 grid gap-2">
          {trips
            .filter((trip) => trip.receivedOn)
            .map((trip) => (
              <li key={trip.id} className="rounded-lg border border-muted-line/30 p-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <PackageOpen className="h-4 w-4 text-muted" aria-hidden="true" />
                  <span className="font-semibold text-ink">{tripSummary(trip)}</span>
                  <Pill tone={trip.outcome === "repaired" ? "good" : "danger"}>
                    {trip.outcome === "repaired" ? "Repaired" : "Not repaired"}
                  </Pill>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {trip.sentWhat} · challan {trip.challanNo}
                  {trip.finalCharge !== null
                    ? ` · charged ${formatMoney(trip.finalCharge, currency)}`
                    : trip.quotedCharge !== null
                      ? ` · quoted ${formatMoney(trip.quotedCharge, currency)}`
                      : ""}
                  {trip.returnNote ? ` · ${trip.returnNote}` : ""}
                </p>
                {trip.billedLineId && job.partsUsed.some((line) => line.id === trip.billedLineId) ? (
                  <p className="mt-1 text-xs font-semibold text-green-700">On the customer&apos;s bill</p>
                ) : (
                  canManage &&
                  !job.billId && (
                    <button
                      type="button"
                      onClick={() => setBilling(trip)}
                      className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-indigo"
                    >
                      <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
                      Add to the customer&apos;s bill
                    </button>
                  )
                )}
              </li>
            ))}
        </ul>
      )}

      {cost > 0 && (
        <p className="mt-3 text-xs text-muted">
          Vendor cost on this job: <strong className="text-ink">{formatMoney(cost, currency)}</strong>.
          It counts against the job&apos;s margin. To charge the customer for it, add it to their bill.
        </p>
      )}

      <SendOutsideModal
        job={job}
        open={sending}
        vendors={vendors}
        context={context}
        onClose={() => setSending(false)}
        onError={onError}
      />
      <ReceiveBackModal job={job} open={receiving} onClose={() => setReceiving(false)} onError={onError} />
      <AddToBillModal job={job} trip={billing} onClose={() => setBilling(null)} onError={onError} />
    </SectionCard>
  );
}

function SendOutsideModal({
  job,
  open,
  vendors,
  context,
  onClose,
  onError,
}: {
  job: Job;
  open: boolean;
  vendors: Vendor[];
  context: PrintContext;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const { sendOutside, saveVendor } = useRepair();
  const active = vendors.filter((vendor) => vendor.active);
  const [vendorId, setVendorId] = useState("");
  const [addingVendor, setAddingVendor] = useState(false);
  const [newVendor, setNewVendor] = useState<VendorInput>(EMPTY_VENDOR);
  const [sentWhat, setSentWhat] = useState("Whole device");
  const [problem, setProblem] = useState("");
  const [sentOn, setSentOn] = useState(todayKey());
  const [sentVia, setSentVia] = useState("");
  const [docketNo, setDocketNo] = useState("");
  const [quoted, setQuoted] = useState("");
  const [expected, setExpected] = useState(addDays(todayKey(), 7));
  const [note, setNote] = useState("");
  const [printChallan, setPrintChallan] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  // Fresh form each time it opens, with the job's own words as the problem.
  useEffect(() => {
    if (!open) return;
    setVendorId(active[0]?.id ?? "");
    setAddingVendor(active.length === 0);
    setNewVendor(EMPTY_VENDOR);
    setSentWhat("Whole device");
    setProblem(job.diagnosis || job.reportedProblems.join(", "));
    setSentOn(todayKey());
    setSentVia("");
    setDocketNo("");
    setQuoted("");
    setExpected(addDays(todayKey(), 7));
    setNote("");
    setFormError("");
  }, [open]);

  const submit = async () => {
    setFormError("");
    setBusy(true);
    try {
      let vendor: Vendor | null = vendors.find((row) => row.id === vendorId) ?? null;
      if (addingVendor) {
        if (!newVendor.name.trim()) throw new Error("Give the vendor a name.");
        vendor = await saveVendor({ ...newVendor, name: newVendor.name.trim() });
      }
      if (!vendor) throw new Error("Pick a vendor to send it to.");
      const chosen = vendor.id;
      const updated = await sendOutside(job.id, {
        vendorId: chosen,
        sentWhat,
        problem,
        sentOn,
        sentVia,
        docketNo,
        quotedCharge: quoted.trim() === "" ? null : Number(quoted) || 0,
        expectedBackOn: expected || null,
        note,
      });
      const trip = currentOutside(updated);
      if (printChallan && trip) printOutsideChallan({ ...context, job: updated }, trip, vendor);
      onClose();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not record it.";
      setFormError(message);
      onError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Send ${job.jobNo} outside`} wide>
      <div className="grid gap-4">
        {!addingVendor ? (
          <div className="grid gap-2">
            <Field label="Vendor / service centre">
              <select className={inputClass} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                {active.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                    {vendor.city ? ` — ${vendor.city}` : ""}
                    {vendor.speciality ? ` (${vendor.speciality})` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <button
              type="button"
              onClick={() => setAddingVendor(true)}
              className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-indigo"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New vendor
            </button>
          </div>
        ) : (
          <div className="grid gap-2 rounded-xl border border-muted-line/30 p-3">
            <p className="text-sm font-semibold text-ink">New vendor</p>
            <VendorFields value={newVendor} onChange={setNewVendor} />
            {active.length > 0 && (
              <button
                type="button"
                onClick={() => setAddingVendor(false)}
                className="w-fit text-sm font-semibold text-muted"
              >
                Pick an existing vendor instead
              </button>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="What is being sent" hint="Whole device, or just the part — e.g. Motherboard only.">
            <input className={inputClass} value={sentWhat} onChange={(e) => setSentWhat(e.target.value)} />
          </Field>
          <Field label="Repair required">
            <input className={inputClass} value={problem} onChange={(e) => setProblem(e.target.value)} />
          </Field>
          <Field label="Sent on">
            <input type="date" className={inputClass} value={sentOn} onChange={(e) => setSentOn(e.target.value)} />
          </Field>
          <Field label="Expected back by">
            <input type="date" className={inputClass} value={expected} onChange={(e) => setExpected(e.target.value)} />
          </Field>
          <Field label="Sent via" hint="By hand, courier name, bus parcel…">
            <input className={inputClass} value={sentVia} onChange={(e) => setSentVia(e.target.value)} />
          </Field>
          <Field label="Docket / tracking no.">
            <input className={inputClass} value={docketNo} onChange={(e) => setDocketNo(e.target.value)} />
          </Field>
          <Field label="Vendor's quote" hint="Your cost. Not added to the customer's bill.">
            <input
              className={inputClass}
              inputMode="decimal"
              value={quoted}
              onChange={(e) => setQuoted(e.target.value)}
              placeholder="Optional"
            />
          </Field>
          <Field label="Note">
            <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            className="h-5 w-5 rounded border-muted-line/50 text-indigo focus:ring-indigo"
            checked={printChallan}
            onChange={(e) => setPrintChallan(e.target.checked)}
          />
          Print the outward challan
        </label>

        {formError && (
          <p className="text-sm font-semibold text-red-600" role="alert">
            {formError}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            Cancel
          </button>
          <button type="button" onClick={() => void submit()} disabled={busy} className={primaryBtnClass}>
            <Truck className="h-4 w-4" aria-hidden="true" />
            Send outside
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ReceiveBackModal({
  job,
  open,
  onClose,
  onError,
}: {
  job: Job;
  open: boolean;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const { receiveFromOutside } = useRepair();
  const trip = currentOutside(job);
  const [receivedOn, setReceivedOn] = useState(todayKey());
  const [outcome, setOutcome] = useState<"repaired" | "not-repaired">("repaired");
  const [charge, setCharge] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [addToBill, setAddToBill] = useState(true);
  const [billLabel, setBillLabel] = useState("");
  const [billPrice, setBillPrice] = useState("");
  const [priceTouched, setPriceTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const billed = Boolean(job.billId);

  useEffect(() => {
    if (!open) return;
    const quote = trip?.quotedCharge !== null && trip?.quotedCharge !== undefined ? String(trip.quotedCharge) : "";
    setReceivedOn(todayKey());
    setOutcome("repaired");
    setCharge(quote);
    setReturnNote("");
    setAddToBill(!billed);
    setBillLabel(trip ? defaultOutsideLabel(trip) : "");
    setBillPrice(quote);
    setPriceTouched(false);
    setFormError("");
  }, [open]);

  if (!trip) return null;

  const submit = async () => {
    setBusy(true);
    setFormError("");
    try {
      await receiveFromOutside(job.id, {
        receivedOn,
        outcome,
        finalCharge: charge.trim() === "" ? null : Number(charge) || 0,
        returnNote,
        billLine: addToBill && !billed ? { label: billLabel, price: Number(billPrice) || 0 } : null,
      });
      onClose();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not record it.";
      setFormError(message);
      onError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Back from ${trip.vendorName}`}>
      <div className="grid gap-4">
        <p className="text-sm text-muted">
          The job goes back to <strong>In repair</strong> either way, so you can decide the next
          step: finish it, send it to another vendor, or return it unrepaired.
        </p>
        <Field label="Outcome">
          <div className="flex flex-wrap gap-2">
            {(["repaired", "not-repaired"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setOutcome(value)}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                  outcome === value
                    ? "border-indigo bg-indigo text-white"
                    : "border-muted-line/40 bg-white text-ink"
                }`}
              >
                {value === "repaired" ? "Repaired" : "Could not repair"}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Received on">
            <input type="date" className={inputClass} value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} />
          </Field>
          <Field label="Vendor charged you" hint="Your cost — counts against the job's margin.">
            <input
              className={inputClass}
              inputMode="decimal"
              value={charge}
              onChange={(e) => {
                setCharge(e.target.value);
                // Until the shop sets its own price, charge the customer what the vendor charged.
                if (!priceTouched) setBillPrice(e.target.value);
              }}
            />
          </Field>
        </div>
        <Field label="Note">
          <input className={inputClass} value={returnNote} onChange={(e) => setReturnNote(e.target.value)} />
        </Field>
        {billed ? (
          <p className="text-xs text-muted">This job is already billed, so nothing is added to the bill.</p>
        ) : (
          <div className="grid gap-3 rounded-xl border border-muted-line/30 p-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-muted-line/50 text-indigo focus:ring-indigo"
                checked={addToBill}
                onChange={(e) => setAddToBill(e.target.checked)}
              />
              Add to the customer&apos;s bill
            </label>
            {addToBill && (
              <BillLineFields
                label={billLabel}
                price={billPrice}
                onLabel={setBillLabel}
                onPrice={(value) => {
                  setPriceTouched(true);
                  setBillPrice(value);
                }}
              />
            )}
          </div>
        )}
        {formError && (
          <p className="text-sm font-semibold text-red-600" role="alert">
            {formError}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            Cancel
          </button>
          <button type="button" onClick={() => void submit()} disabled={busy} className={primaryBtnClass}>
            <Undo2 className="h-4 w-4" aria-hidden="true" />
            Mark received
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Name and price of the line the vendor's work goes on the bill as. */
function BillLineFields({
  label,
  price,
  onLabel,
  onPrice,
}: {
  label: string;
  price: string;
  onLabel: (value: string) => void;
  onPrice: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
      <Field label="Name on the bill" hint="Write it the way the customer should read it.">
        <input className={inputClass} value={label} onChange={(e) => onLabel(e.target.value)} />
      </Field>
      <Field label="Charge to customer">
        <input className={inputClass} inputMode="decimal" value={price} onChange={(e) => onPrice(e.target.value)} />
      </Field>
    </div>
  );
}

/** Put a trip that already came back on the bill. */
function AddToBillModal({
  job,
  trip,
  onClose,
  onError,
}: {
  job: Job;
  trip: OutsideRepair | null;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const { billOutsideTrip } = useRepair();
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!trip) return;
    setLabel(defaultOutsideLabel(trip));
    const cost = trip.finalCharge ?? trip.quotedCharge;
    setPrice(cost === null || cost === undefined ? "" : String(cost));
  }, [trip]);

  if (!trip) return null;
  return (
    <Modal open onClose={onClose} title="Add to the customer's bill">
      <div className="grid gap-4">
        <p className="text-sm text-muted">
          Added as a line under Parts and labour, like a part: the vendor&apos;s charge is its cost, and the price
          here is what the customer pays.
        </p>
        <BillLineFields label={label} price={price} onLabel={setLabel} onPrice={setPrice} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await billOutsideTrip(job.id, trip.id, { label, price: Number(price) || 0 });
                onClose();
              } catch (caught) {
                onError(caught instanceof Error ? caught.message : "Could not add it.");
              } finally {
                setBusy(false);
              }
            }}
            className={primaryBtnClass}
          >
            <Receipt className="h-4 w-4" aria-hidden="true" />
            Add to bill
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** The vendor form, shared by Settings and the quick-add in Send outside. */
export function VendorFields({
  value,
  onChange,
}: {
  value: VendorInput;
  onChange: (next: VendorInput) => void;
}) {
  const set = (key: keyof VendorInput) => (event: { target: { value: string } }) =>
    onChange({ ...value, [key]: event.target.value });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Name">
        <input className={inputClass} value={value.name} onChange={set("name")} placeholder="e.g. Delhi Chip Lab" />
      </Field>
      <Field label="City">
        <input className={inputClass} value={value.city} onChange={set("city")} />
      </Field>
      <Field label="Phone">
        <input className={inputClass} inputMode="tel" value={value.phone} onChange={set("phone")} />
      </Field>
      <Field label="Contact person">
        <input className={inputClass} value={value.contactPerson} onChange={set("contactPerson")} />
      </Field>
      <Field label="Speciality" hint="Motherboard, chip-level, display…">
        <input className={inputClass} value={value.speciality} onChange={set("speciality")} />
      </Field>
      <Field label="GSTIN">
        <input className={inputClass} value={value.gstin} onChange={set("gstin")} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Address" hint="Printed on the outward challan.">
          <textarea className={inputClass} rows={2} value={value.address} onChange={set("address")} />
        </Field>
      </div>
    </div>
  );
}

/** Settings → Outside repair vendors: the list, with add / edit / remove. */
export function VendorsSettings() {
  const { vendors, jobs, saveVendor, deleteVendor } = useRepair();
  const [editing, setEditing] = useState<{ id?: string; value: VendorInput } | null>(null);
  const [formError, setFormError] = useState("");

  /** Jobs out with each vendor right now, so a vendor holding devices is not removed blind. */
  const outWith = (vendorId: string) =>
    jobs.filter((job) => currentOutside(job)?.vendorId === vendorId).length;

  const save = async () => {
    if (!editing) return;
    if (!editing.value.name.trim()) {
      setFormError("Give the vendor a name.");
      return;
    }
    await saveVendor({ ...editing.value, name: editing.value.name.trim() }, editing.id);
    setEditing(null);
  };

  return (
    <SectionCard
      title="Outside repair vendors"
      action={
        <button
          type="button"
          onClick={() => {
            setFormError("");
            setEditing({ value: EMPTY_VENDOR });
          }}
          className={secondaryBtnClass}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add vendor
        </button>
      }
    >
      <p className="mb-3 text-xs text-muted">
        Service centres you send work to when it can&apos;t be repaired here. Their name never
        appears on the customer&apos;s tracking page.
      </p>
      <ul className="grid gap-2">
        {vendors.map((vendor) => {
          const out = outWith(vendor.id);
          return (
            <li
              key={vendor.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-muted-line/30 p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  {vendor.name}
                  {vendor.city ? <span className="font-normal text-muted"> · {vendor.city}</span> : null}
                  {!vendor.active && <span className="ml-2 text-xs text-muted">(inactive)</span>}
                </p>
                <p className="text-xs text-muted">
                  {[vendor.speciality, vendor.contactPerson, vendor.phone].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {out > 0 && <Pill tone="indigo">{out} out now</Pill>}
                <button
                  type="button"
                  onClick={() => {
                    setFormError("");
                    setEditing({
                      id: vendor.id,
                      value: {
                        name: vendor.name,
                        city: vendor.city,
                        phone: vendor.phone,
                        contactPerson: vendor.contactPerson,
                        speciality: vendor.speciality,
                        address: vendor.address,
                        gstin: vendor.gstin,
                        active: vendor.active,
                      },
                    });
                  }}
                  className={secondaryBtnClass}
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled={out > 0}
                  title={out > 0 ? "Devices are still with this vendor" : undefined}
                  onClick={() => void deleteVendor(vendor.id)}
                  className={`${secondaryBtnClass} text-red-600 disabled:opacity-40`}
                >
                  Remove
                </button>
              </div>
            </li>
          );
        })}
        {vendors.length === 0 && <li className="text-sm text-muted">No vendors yet.</li>}
      </ul>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Edit vendor" : "Add vendor"}
        wide
      >
        {editing && (
          <div className="grid gap-4">
            <VendorFields value={editing.value} onChange={(value) => setEditing({ ...editing, value })} />
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-muted-line/50 text-indigo focus:ring-indigo"
                checked={editing.value.active}
                onChange={(e) => setEditing({ ...editing, value: { ...editing.value, active: e.target.checked } })}
              />
              Active (offered when sending a job outside)
            </label>
            {formError && (
              <p className="text-sm font-semibold text-red-600" role="alert">
                {formError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className={secondaryBtnClass}>
                Cancel
              </button>
              <button type="button" onClick={() => void save()} className={primaryBtnClass}>
                Save
              </button>
            </div>
          </div>
        )}
      </Modal>
    </SectionCard>
  );
}
