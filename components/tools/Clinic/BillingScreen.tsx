"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  Download,
  IndianRupee,
  MessageCircle,
  Plus,
  Printer,
  Receipt,
  Trash2,
} from "lucide-react";
import { currencySymbol, generateId } from "@/lib/pos/types";
import { useClinic, type BillInput } from "@/lib/clinic/store";
import { billDue, patientDues, round2 } from "@/lib/clinic/calc";
import { billsCsv, downloadCsv } from "@/lib/clinic/csv";
import { printReceipt, type ReceiptContext } from "@/lib/clinic/print";
import { fillTemplate, whatsAppLink, type OutboundMessage } from "@/lib/clinic/messages";
import { generateUPIUrl, isValidUPIId } from "@/lib/upi";
import {
  formatDate,
  todayIso,
  type Bill,
  type BillLine,
  type Patient,
} from "@/lib/clinic/types";
import { formatCurrency } from "@/lib/format";
import {
  EmptyState,
  Modal,
  StatCard,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/tools/FreePos/ui";
import { SendQueue } from "@/components/tools/Tuition/SendQueue";
import type { NavigateFn } from "./nav";
import { PatientPicker } from "./PatientPicker";

type QueryRequest = { screen: string; value: string; nonce: number };
type Tab = "bills" | "dues";

export function BillingScreen({
  onNavigate,
  externalQuery,
}: {
  onNavigate: NavigateFn;
  externalQuery: QueryRequest | null;
}) {
  const {
    bills,
    patients,
    visits,
    doctors,
    charges,
    business,
    settings,
    activeDoctor,
    createBill,
    deleteBill,
    recordBillPayment,
    feeFor,
  } = useClinic();

  const [tab, setTab] = useState<Tab>("bills");
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerPatient, setComposerPatient] = useState<Patient | null>(null);
  const [composerVisitId, setComposerVisitId] = useState<string | null>(null);
  const [receiptBill, setReceiptBill] = useState<Bill | null>(null);
  const [collecting, setCollecting] = useState<Bill | null>(null);
  const [collectAmount, setCollectAmount] = useState("");
  const [collectMode, setCollectMode] = useState(settings.paymentModes[0] ?? "Cash");
  const [queueOpen, setQueueOpen] = useState(false);

  const currency = business?.currency ?? "INR";

  /**
   * Another screen handed us either a visit id (bill this consultation) or a
   * patient id (bill this person). Both arrive through the same channel, so
   * work out which one it is.
   */
  useEffect(() => {
    const value = externalQuery?.value;
    if (!value) return;
    const visit = visits.find((v) => v.id === value);
    if (visit) {
      const patient = patients.find((p) => p.id === visit.patientId) ?? null;
      setComposerPatient(patient);
      setComposerVisitId(visit.id);
      setComposerOpen(true);
      return;
    }
    const patient = patients.find((p) => p.id === value);
    if (patient) {
      setComposerPatient(patient);
      setComposerVisitId(null);
      setComposerOpen(true);
    }
  }, [externalQuery, visits, patients]);

  const today = todayIso();
  const todaysBills = useMemo(() => bills.filter((b) => b.date === today), [bills, today]);
  const collectedToday = todaysBills.reduce((sum, bill) => sum + (bill.paid || 0), 0);
  const billedToday = todaysBills.reduce((sum, bill) => sum + (bill.total || 0), 0);

  const dueRows = useMemo(() => {
    return patients
      .map((patient) => ({ patient, amount: patientDues(bills, patient.id) }))
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [patients, bills]);

  const totalDues = dueRows.reduce((sum, row) => sum + row.amount, 0);

  const patientOf = (id: string) => patients.find((p) => p.id === id) ?? null;
  const doctorName = (id: string) => doctors.find((d) => d.id === id)?.name ?? "";

  const dueMessages: OutboundMessage[] = dueRows.map((row) => ({
    id: row.patient.id,
    name: row.patient.name,
    phone: row.patient.phone,
    message: fillTemplate(settings.messageTemplates.duesReminder, {
      patientName: row.patient.name,
      patientCode: row.patient.code,
      clinicName: business?.name ?? "",
      clinicPhone: business?.phone ?? "",
      amount: row.amount.toFixed(0),
      upiId: business?.upiId ?? "",
    }),
  }));

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Collected today" value={formatCurrency(collectedToday, currency)} />
        <StatCard
          label="Billed today"
          value={formatCurrency(billedToday, currency)}
          sub={`${todaysBills.length} ${todaysBills.length === 1 ? "bill" : "bills"}`}
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(totalDues, currency)}
          sub={`${dueRows.length} ${dueRows.length === 1 ? "patient" : "patients"}`}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {(
            [
              ["bills", `Bills (${bills.length})`],
              ["dues", `Dues (${dueRows.length})`],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                tab === id ? "bg-indigo text-white" : "text-muted hover:bg-white hover:text-indigo"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setComposerPatient(null);
              setComposerVisitId(null);
              setComposerOpen(true);
            }}
            className={primaryBtnClass}
          >
            <Plus className="h-4 w-4" />
            New bill
          </button>
          {tab === "dues" && dueRows.length > 0 && (
            <button type="button" onClick={() => setQueueOpen(true)} className={secondaryBtnClass}>
              <MessageCircle className="h-4 w-4" />
              Send reminders
            </button>
          )}
          {tab === "bills" && (
            <button
              type="button"
              onClick={() => downloadCsv("bills.csv", billsCsv(bills, patients, doctors))}
              disabled={bills.length === 0}
              className={secondaryBtnClass}
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          )}
        </div>
      </div>

      {tab === "bills" &&
        (bills.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-6 w-6" />}
            title="No bills yet"
            message="Bills you raise after a consultation appear here, with their receipts."
          />
        ) : (
          <ul className="space-y-2">
            {bills.map((bill) => {
              const patient = patientOf(bill.patientId);
              const due = billDue(bill);
              return (
                <li
                  key={bill.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-muted-line/30 bg-white px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {patient?.name ?? "Unknown"}{" "}
                      <span className="font-normal text-muted">· {bill.receiptNo}</span>
                    </p>
                    <p className="truncate text-xs text-muted">
                      {[formatDate(bill.date), doctorName(bill.doctorId), bill.paymentMode]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-ink">
                      {formatCurrency(bill.total, currency)}
                    </p>
                    {due > 0 && (
                      <p className="text-xs font-semibold text-red-600">
                        {formatCurrency(due, currency)} due
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {due > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setCollecting(bill);
                          setCollectAmount(String(due));
                        }}
                        className={secondaryBtnClass}
                      >
                        <IndianRupee className="h-4 w-4" />
                        Collect
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setReceiptBill(bill)}
                      aria-label="Receipt"
                      title="Receipt"
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-cream hover:text-indigo"
                    >
                      <Printer className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteBill(bill.id)}
                      aria-label="Delete bill"
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ))}

      {tab === "dues" &&
        (dueRows.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-6 w-6" />}
            title="Nothing outstanding"
            message="Every bill is fully paid."
          />
        ) : (
          <ul className="space-y-2">
            {dueRows.map((row) => (
              <li
                key={row.patient.id}
                className="flex items-center gap-3 rounded-xl border border-muted-line/30 bg-white px-3 py-2.5"
              >
                <button
                  type="button"
                  onClick={() => onNavigate("patients", row.patient.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-sm font-semibold text-ink">{row.patient.name}</p>
                  <p className="truncate text-xs text-muted">
                    {[row.patient.code, row.patient.phone].filter(Boolean).join(" · ")}
                  </p>
                </button>
                <p className="shrink-0 text-sm font-semibold text-red-600">
                  {formatCurrency(row.amount, currency)}
                </p>
                {row.patient.phone && (
                  <a
                    href={whatsAppLink(
                      row.patient.phone,
                      fillTemplate(settings.messageTemplates.duesReminder, {
                        patientName: row.patient.name,
                        clinicName: business?.name ?? "",
                        amount: row.amount.toFixed(0),
                        upiId: business?.upiId ?? "",
                      })
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Send reminder"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-cream hover:text-indigo"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        ))}

      <BillComposer
        open={composerOpen}
        patient={composerPatient}
        visitId={composerVisitId}
        onClose={() => setComposerOpen(false)}
        onCreated={(bill) => {
          setComposerOpen(false);
          setReceiptBill(bill);
        }}
      />

      <ReceiptModal bill={receiptBill} onClose={() => setReceiptBill(null)} />

      <Modal
        open={Boolean(collecting)}
        onClose={() => setCollecting(null)}
        title="Collect payment"
      >
        {collecting && (
          <>
            <p className="text-sm text-muted">
              {formatCurrency(billDue(collecting), currency)} outstanding on{" "}
              {collecting.receiptNo}.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Amount
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={billDue(collecting)}
                  value={collectAmount}
                  onChange={(event) => setCollectAmount(event.target.value)}
                  className={inputClass}
                  autoFocus
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Mode
                </span>
                <select
                  value={collectMode}
                  onChange={(event) => setCollectMode(event.target.value)}
                  className={inputClass}
                >
                  {settings.paymentModes.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCollecting(null)}
                className={secondaryBtnClass}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await recordBillPayment(
                    collecting.id,
                    Number(collectAmount) || 0,
                    collectMode
                  );
                  setCollecting(null);
                }}
                className={primaryBtnClass}
              >
                Record payment
              </button>
            </div>
          </>
        )}
      </Modal>

      <SendQueue
        open={queueOpen}
        title="Send dues reminders"
        messages={dueMessages}
        onClose={() => setQueueOpen(false)}
        onSent={() => setQueueOpen(false)}
      />
    </div>
  );
}

/** New bill, pre-filled from the visit when there is one. */
function BillComposer({
  open,
  patient,
  visitId,
  onClose,
  onCreated,
}: {
  open: boolean;
  patient: Patient | null;
  visitId: string | null;
  onClose: () => void;
  onCreated: (bill: Bill) => void;
}) {
  const { charges, settings, business, activeDoctor, createBill, feeFor, visits } = useClinic();
  const [chosen, setChosen] = useState<Patient | null>(patient);
  const [lines, setLines] = useState<BillLine[]>([]);
  const [discount, setDiscount] = useState("");
  const [discountMode, setDiscountMode] = useState<"amount" | "percent">("amount");
  const [paid, setPaid] = useState("");
  const [mode, setMode] = useState(settings.paymentModes[0] ?? "Cash");
  const [saving, setSaving] = useState(false);

  const currency = business?.currency ?? "INR";
  const doctorId = useMemo(() => {
    const visit = visitId ? visits.find((v) => v.id === visitId) : null;
    return visit?.doctorId ?? activeDoctor?.id ?? "";
  }, [visitId, visits, activeDoctor]);

  // Reset and pre-fill each time the composer opens.
  useEffect(() => {
    if (!open) return;
    setChosen(patient);
    setDiscount("");
    setPaid("");
    setMode(settings.paymentModes[0] ?? "Cash");

    if (patient && doctorId) {
      const fee = feeFor(patient.id, doctorId);
      setLines([
        {
          id: generateId(),
          label: fee.isFollowUp
            ? `Follow-up — within ${fee.withinDays} days`
            : "Consultation",
          amount: fee.amount,
          kind: "consultation",
        },
      ]);
    } else {
      setLines([]);
    }
  }, [open, patient, doctorId, feeFor, settings.paymentModes]);

  const subtotal = lines.reduce((sum, line) => sum + (line.amount || 0), 0);
  const discountValue =
    discountMode === "percent"
      ? round2((subtotal * (Number(discount) || 0)) / 100)
      : Number(discount) || 0;
  const total = Math.max(0, round2(subtotal - discountValue));

  const pickPatient = (next: Patient) => {
    setChosen(next);
    if (doctorId) {
      const fee = feeFor(next.id, doctorId);
      setLines([
        {
          id: generateId(),
          label: fee.isFollowUp ? `Follow-up — within ${fee.withinDays} days` : "Consultation",
          amount: fee.amount,
          kind: "consultation",
        },
      ]);
    }
  };

  const submit = async () => {
    if (!chosen || !doctorId) return;
    setSaving(true);
    try {
      const input: BillInput = {
        patientId: chosen.id,
        doctorId,
        visitId,
        date: todayIso(),
        lines,
        discount: discountValue,
        paid: paid === "" ? total : Number(paid) || 0,
        paymentMode: mode,
      };
      onCreated(await createBill(input));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New bill" wide>
      {!chosen ? (
        <PatientPicker label="Patient" autoFocus onPick={pickPatient} />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-lg bg-cream/60 px-3 py-2">
            <span className="text-sm font-semibold text-ink">
              {chosen.name} <span className="font-normal text-muted">· {chosen.code}</span>
            </span>
            <button
              type="button"
              onClick={() => setChosen(null)}
              className="text-xs font-semibold text-indigo underline"
            >
              Change
            </button>
          </div>

          <ul className="space-y-2">
            {lines.map((line, index) => (
              <li key={line.id} className="flex gap-2">
                <input
                  type="text"
                  value={line.label}
                  onChange={(event) =>
                    setLines((prev) =>
                      prev.map((item, i) =>
                        i === index ? { ...item, label: event.target.value } : item
                      )
                    )
                  }
                  className={inputClass}
                  aria-label="Line description"
                />
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={line.amount}
                  onChange={(event) =>
                    setLines((prev) =>
                      prev.map((item, i) =>
                        i === index ? { ...item, amount: Number(event.target.value) || 0 } : item
                      )
                    )
                  }
                  className={`${inputClass} w-28 shrink-0`}
                  aria-label="Amount"
                />
                <button
                  type="button"
                  onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                  aria-label="Remove line"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-1.5">
            {charges
              .filter((charge) => charge.active)
              .map((charge) => (
                <button
                  key={charge.id}
                  type="button"
                  onClick={() =>
                    setLines((prev) => [
                      ...prev,
                      {
                        id: generateId(),
                        label: charge.name,
                        amount: charge.amount,
                        kind: "procedure",
                      },
                    ])
                  }
                  className="rounded-full border border-muted-line/40 bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-indigo/40 hover:text-indigo"
                >
                  + {charge.name} {formatCurrency(charge.amount, currency)}
                </button>
              ))}
            <button
              type="button"
              onClick={() =>
                setLines((prev) => [
                  ...prev,
                  { id: generateId(), label: "", amount: 0, kind: "other" },
                ])
              }
              className="rounded-full border border-dashed border-muted-line/50 px-3 py-1.5 text-xs font-semibold text-muted transition hover:text-indigo"
            >
              + Other
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                Discount
              </span>
              <div className="flex gap-1">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={discount}
                  onChange={(event) => setDiscount(event.target.value)}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() =>
                    setDiscountMode(discountMode === "amount" ? "percent" : "amount")
                  }
                  className="shrink-0 rounded-lg border border-muted-line/40 px-3 text-sm font-semibold text-muted"
                >
                  {discountMode === "amount" ? currencySymbol(currency) : "%"}
                </button>
              </div>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                Paid
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={paid}
                onChange={(event) => setPaid(event.target.value)}
                placeholder={String(total)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                Mode
              </span>
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value)}
                className={inputClass}
              >
                {settings.paymentModes.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-lg bg-cream/60 px-3 py-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Subtotal</span>
              <span>{formatCurrency(subtotal, currency)}</span>
            </div>
            {discountValue > 0 && (
              <div className="flex justify-between">
                <span className="text-muted">Discount</span>
                <span>-{formatCurrency(discountValue, currency)}</span>
              </div>
            )}
            <div className="mt-1 flex justify-between border-t border-muted-line/30 pt-1 font-bold text-ink">
              <span>Total</span>
              <span>{formatCurrency(total, currency)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className={secondaryBtnClass}>
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving || lines.length === 0}
              className={primaryBtnClass}
            >
              {saving ? "Saving…" : "Save bill"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Receipt preview, print and PDF. UPI QR appears when a UPI ID is configured. */
function ReceiptModal({ bill, onClose }: { bill: Bill | null; onClose: () => void }) {
  const { patients, doctors, business, settings } = useClinic();
  const [qr, setQr] = useState("");

  const due = bill ? billDue(bill) : 0;
  const currency = business?.currency ?? "INR";
  const upiId = business?.upiId ?? "";

  useEffect(() => {
    if (!bill || !upiId || !isValidUPIId(upiId) || due <= 0) {
      setQr("");
      return;
    }
    const url = generateUPIUrl(upiId, due, `Bill ${bill.receiptNo}`, business?.name);
    QRCode.toDataURL(url, { width: 220, margin: 1 })
      .then(setQr)
      .catch(() => setQr(""));
  }, [bill, upiId, due, business?.name]);

  if (!bill) return null;

  const patient = patients.find((p) => p.id === bill.patientId) ?? null;
  const context: ReceiptContext = {
    business,
    settings,
    patient,
    doctorName: doctors.find((d) => d.id === bill.doctorId)?.name ?? "",
    receiptNo: bill.receiptNo,
    date: bill.date,
    lines: bill.lines,
    discount: bill.discount,
    total: bill.total,
    paid: bill.paid,
    paymentMode: bill.paymentMode,
    currencySymbol: currencySymbol(currency),
    upiQrDataUrl: qr || undefined,
  };

  return (
    <Modal open onClose={onClose} title={`Receipt ${bill.receiptNo}`}>
      <div className="rounded-lg border border-muted-line/30 bg-white p-4 text-sm">
        <p className="font-bold text-ink">{business?.name}</p>
        <p className="text-xs text-muted">
          {patient?.name} · {formatDate(bill.date)}
        </p>
        <ul className="mt-3 space-y-1">
          {bill.lines.map((line) => (
            <li key={line.id} className="flex justify-between">
              <span>{line.label}</span>
              <span>{formatCurrency(line.amount, currency)}</span>
            </li>
          ))}
        </ul>
        {bill.discount > 0 && (
          <p className="mt-1 flex justify-between text-muted">
            <span>Discount</span>
            <span>-{formatCurrency(bill.discount, currency)}</span>
          </p>
        )}
        <p className="mt-2 flex justify-between border-t border-muted-line/30 pt-2 font-bold">
          <span>Total</span>
          <span>{formatCurrency(bill.total, currency)}</span>
        </p>
        <p className="flex justify-between text-muted">
          <span>Paid ({bill.paymentMode})</span>
          <span>{formatCurrency(bill.paid, currency)}</span>
        </p>
        {due > 0 && (
          <p className="flex justify-between font-semibold text-red-600">
            <span>Balance due</span>
            <span>{formatCurrency(due, currency)}</span>
          </p>
        )}
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="UPI QR code" className="mx-auto mt-3 h-28 w-28" />
        )}
      </div>

      <div className="mt-4 flex justify-end gap-3">
        <button type="button" onClick={onClose} className={secondaryBtnClass}>
          Close
        </button>
        <button type="button" onClick={() => printReceipt(context)} className={primaryBtnClass}>
          <Printer className="h-4 w-4" />
          Print receipt
        </button>
      </div>
    </Modal>
  );
}
