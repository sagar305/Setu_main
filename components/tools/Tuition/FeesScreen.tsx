"use client";

// Fees: who owes what, collecting a payment, the receipt that goes to the
// parent, and the reminder queue for everyone still pending.

import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/translate";
import { useMemo, useState } from "react";
import {
  BadgeIndianRupee,
  Download,
  MessageCircle,
  Plus,
  RefreshCw,
  Share2,
  Wallet,
} from "lucide-react";
import { useTuition, type PaymentInput } from "@/lib/tuition/store";
import { daysOverdue, studentBalance, type StudentBalance } from "@/lib/tuition/calc";
import { downloadCsv, feesCsv, paymentsCsv } from "@/lib/tuition/csv";
import { formatMoney } from "@/lib/pos/types";
import { fillTemplate, type OutboundMessage } from "@/lib/tuition/messages";
import {
  currentMonthKey,
  feeKindLabel,
  FEE_KIND_ORDER,
  formatDate,
  formatMonth,
  todayIso,
  type FeeDueKind,
  type FeePayment,
  type Student,
} from "@/lib/tuition/types";
import { businessToShare, type SharedDoc } from "@/lib/toolkit/shareLink";
import { ShareDialog } from "@/components/toolkit/ShareDialog";
import {
  EmptyState,
  Field,
  inputClass,
  Modal,
  primaryBtnClass,
  secondaryBtnClass,
  StatCard,
} from "@/components/tools/FreePos/ui";
import { feeReceiptDoc, shareUrlFor } from "./share";
import { SendQueue } from "./SendQueue";
import { useReviewPrompt } from "@/lib/hooks/useReviewPrompt";
import { ReviewPromptDialog } from "@/components/review/ReviewPrompt";

type Row = { student: Student; balance: StudentBalance };

export function FeesScreen() {
  const { t, lang } = useI18n();
  const {
    students,
    dues,
    payments,
    business,
    settings,
    generateDues,
    recordPayment,
    addCharge,
    updateBusiness,
  } = useTuition();

  const [collectFor, setCollectFor] = useState<Student | null>(null);
  const [chargeFor, setChargeFor] = useState<Student | null>(null);
  const [shareDoc, setShareDoc] = useState<SharedDoc | null>(null);
  const [queue, setQueue] = useState<OutboundMessage[] | null>(null);
  const [generating, setGenerating] = useState(0);
  const currency = business?.currency ?? "INR";
  const period = currentMonthKey();

  const rows: Row[] = useMemo(
    () =>
      students.map((student) => ({
        student,
        balance: studentBalance(student.id, dues, payments),
      })),
    [students, dues, payments]
  );

  /** Students still on the roll — a leaver only stays visible while they owe. */
  const currentRows = useMemo(
    () => rows.filter((row) => row.student.status === "active"),
    [rows]
  );

  const pending = useMemo(
    () =>
      rows
        .filter((row) => row.balance.outstanding > 0)
        .sort((a, b) => {
          const aDays = daysOverdue(a.balance.oldestPendingDate);
          const bDays = daysOverdue(b.balance.oldestPendingDate);
          if (aDays !== bDays) return bDays - aDays;
          return b.balance.outstanding - a.balance.outstanding;
        }),
    [rows]
  );

  const collectedThisMonth = useMemo(
    () =>
      payments
        .filter((payment) => payment.date.slice(0, 7) === period)
        .reduce((sum, payment) => sum + payment.amount, 0),
    [payments, period]
  );

  const collectedToday = useMemo(() => {
    const today = todayIso();
    return payments
      .filter((payment) => payment.date.slice(0, 10) === today)
      .reduce((sum, payment) => sum + payment.amount, 0);
  }, [payments]);

  const totalPending = pending.reduce((sum, row) => sum + row.balance.outstanding, 0);

  const reminderMessage = (row: Row) => {
    const doc: SharedDoc = {
      t: "led",
      b: businessToShare(business),
      cn: row.student.name,
      cp: row.student.parentPhone || undefined,
      bal: row.balance.outstanding,
      note: `Fees pending for ${row.student.name}`,
    };
    return fillTemplate(settings.templates.feeReminder, {
      parent: row.student.parentName || t("appSirMaam"),
      student: row.student.name,
      class: row.student.classLevel,
      amount: formatMoney(row.balance.outstanding, currency),
      period: row.balance.dues
        .filter((d) => d.remaining > 0)
        .map((d) => (d.due.period ? formatMonth(d.due.period, lang) : d.due.label))
        .join(", "),
      due: row.balance.oldestPendingDate ? formatDate(row.balance.oldestPendingDate, lang) : "",
      link: shareUrlFor(doc),
      teacher: business?.name ?? "",
    });
  };

  const remindAll = () => {
    setQueue(
      pending.map((row) => ({
        id: row.student.id,
        name: row.student.name,
        phone: row.student.parentPhone,
        message: reminderMessage(row),
      }))
    );
  };

  const handleGenerate = async () => {
    const count = await generateDues();
    setGenerating(count);
    setTimeout(() => setGenerating(0), 3000);
  };

  const review = useReviewPrompt();

  const afterPayment = (student: Student, payment: FeePayment) => {
    // Balance recomputed with the new payment included.
    const nextBalance = studentBalance(student.id, dues, [...payments, payment]);
    const doc = feeReceiptDoc(business, student, payment, nextBalance.outstanding, lang);
    setShareDoc(doc);
    setQueue([
      {
        id: student.id,
        name: student.name,
        phone: student.parentPhone,
        message: fillTemplate(settings.templates.receipt, {
          parent: student.parentName || t("appSirMaam"),
          student: student.name,
          amount: formatMoney(payment.amount, currency),
          date: formatDate(payment.date.slice(0, 10), lang),
          link: shareUrlFor(doc),
          teacher: business?.name ?? "",
        }),
      },
    ]);
    // Fee collected and the receipt raised: the collection cycle is finished.
    review.complete();
  };

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={fill(t("tuTdCollected"), { month: formatMonth(period, lang) })}
          value={formatMoney(collectedThisMonth, currency)}
          sub={fill(t("tuFsCollectedToday"), { amount: formatMoney(collectedToday, currency) })}
        />
        <StatCard
          label={t("tuFsTotalPending")}
          value={formatMoney(totalPending, currency)}
          sub={fill(t(pending.length === 1 ? "tuStCountOne" : "tuStCountMany"), {
            count: pending.length,
          })}
        />
        <StatCard
          label={t("tuFsOverdue")}
          value={String(
            pending.filter((row) => daysOverdue(row.balance.oldestPendingDate) > 0).length
          )}
          sub={t("tuFsPastDueDate")}
        />
        <StatCard
          label={t("tuFsReceiptsIssued")}
          value={String(payments.length)}
          sub={fill(t("tuFsNextReceipt"), {
            number: `${settings.receiptPrefix}${String(settings.nextReceiptNumber).padStart(4, "0")}`,
          })}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleGenerate()}
          className={secondaryBtnClass}
          title={t("tuFsGenerateTitle")}
        >
          <RefreshCw className="h-4 w-4" />
          {generating > 0
            ? fill(t("tuFsDuesRaisedN"), { count: generating })
            : t("tuFsGenerateDues")}
        </button>
        <button
          type="button"
          onClick={remindAll}
          disabled={pending.length === 0}
          className={primaryBtnClass}
        >
          <MessageCircle className="h-4 w-4" />
          {fill(t(pending.length === 1 ? "tuAtNotifyOne" : "tuAtNotifyMany"), {
            count: pending.length,
          })}
        </button>
        <button
          type="button"
          onClick={() => downloadCsv("fees-outstanding.csv", feesCsv(students, dues, payments))}
          disabled={students.length === 0}
          className={secondaryBtnClass}
        >
          <Download className="h-4 w-4" />
          {t("tuFsOutstandingCsv")}
        </button>
        <button
          type="button"
          onClick={() => downloadCsv("fee-payments.csv", paymentsCsv(payments))}
          disabled={payments.length === 0}
          className={secondaryBtnClass}
        >
          <Download className="h-4 w-4" />
          {t("tuFsPaymentsCsv")}
        </button>
      </div>

      <section className="mt-6">
        <h3 className="text-sm font-bold text-ink">{t("tuFsPendingFees")}</h3>
        {rows.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              icon={<Wallet className="h-6 w-6" />}
              title={t("tuStNoStudents")}
              message={t("tuFsNoStudentsBody")}
            />
          </div>
        ) : pending.length === 0 ? (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {t("tuFsAllUpToDate")}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {pending.map((row) => {
              const overdue = daysOverdue(row.balance.oldestPendingDate);
              return (
                <li
                  key={row.student.id}
                  className="flex flex-col gap-3 rounded-xl border border-muted-line/30 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">
                      {row.student.name}
                      {row.student.status !== "active" && (
                        <span className="ml-2 rounded-full bg-cream-paper px-2 py-0.5 text-[10px] font-semibold uppercase text-muted">
                          {t("tuStLeft")}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {row.balance.dues
                        .filter((d) => d.remaining > 0)
                        .slice(0, 3)
                        .map((d) => (d.due.period ? formatMonth(d.due.period, lang) : d.due.label))
                        .join(", ")}
                      {overdue > 0
                        ? ` · ${fill(t(overdue === 1 ? "tuTdOverdueOne" : "tuTdOverdueMany"), {
                            count: overdue,
                          })}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <p
                      className={`text-base font-bold ${
                        overdue > 0 ? "text-red-600" : "text-ink"
                      }`}
                    >
                      {formatMoney(row.balance.outstanding, currency)}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setQueue([
                            {
                              id: row.student.id,
                              name: row.student.name,
                              phone: row.student.parentPhone,
                              message: reminderMessage(row),
                            },
                          ])
                        }
                        className={`${secondaryBtnClass} px-3 py-1.5`}
                        aria-label={fill(t("tuFsRemindParent"), { name: row.student.name })}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCollectFor(row.student)}
                        className={`${primaryBtnClass} px-3 py-1.5`}
                      >
                        <BadgeIndianRupee className="h-4 w-4" />
                        {t("tuFsCollect")}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {currentRows.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink">All students</h3>
            <span className="text-xs text-muted">Collect a fee or add a one-off charge</span>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {currentRows.map((row) => (
              <li
                key={row.student.id}
                className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-muted-line/30 bg-white p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{row.student.name}</p>
                  <p className="truncate text-xs text-muted">
                    Billed {formatMoney(row.balance.billed, currency)} · Paid{" "}
                    {formatMoney(row.balance.paid, currency)}
                    {row.balance.advance > 0
                      ? ` · ${formatMoney(row.balance.advance, currency)} advance`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setChargeFor(row.student)}
                    className={`${secondaryBtnClass} px-3 py-1.5`}
                    aria-label={fill(t("tuFsAddChargeFor"), { name: row.student.name })}
                    title={t("tuFsAddOtherFee")}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollectFor(row.student)}
                    className={`${secondaryBtnClass} px-3 py-1.5`}
                  >
                    {t("tuFsCollect")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {payments.length > 0 && (
        <section className="mt-8">
          <h3 className="text-sm font-bold text-ink">Recent payments</h3>
          <ul className="mt-3 divide-y divide-muted-line/20 rounded-xl border border-muted-line/30 bg-white">
            {payments.slice(0, 12).map((payment) => {
              const student = students.find((s) => s.id === payment.studentId);
              return (
                <li key={payment.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {payment.studentName || student?.name}
                      <span className="ml-2 text-xs font-normal text-muted">{payment.mode}</span>
                    </p>
                    <p className="truncate text-xs text-muted">
                      {payment.receiptNumber} · {formatDate(payment.date.slice(0, 10), lang)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <p className="text-sm font-bold text-ink">
                      {formatMoney(payment.amount, currency)}
                    </p>
                    {student && (
                      <button
                        type="button"
                        onClick={() =>
                          setShareDoc(
                            feeReceiptDoc(
                              business,
                              student,
                              payment,
                              studentBalance(student.id, dues, payments).outstanding,
                              lang
                            )
                          )
                        }
                        className={`${secondaryBtnClass} px-3 py-1.5`}
                        aria-label={fill(t("tuFeShareReceiptFor"), { number: payment.receiptNumber })}
                      >
                        <Share2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <CollectPaymentModal
        student={collectFor}
        onClose={() => setCollectFor(null)}
        onCollected={afterPayment}
        recordPayment={recordPayment}
        balanceFor={(id) => studentBalance(id, dues, payments)}
        modes={settings.paymentModes}
        currency={currency}
      />

      <AddChargeModal
        student={chargeFor}
        onClose={() => setChargeFor(null)}
        onSave={addCharge}
        currency={currency}
      />

      <ShareDialog
        open={Boolean(shareDoc)}
        doc={shareDoc}
        onClose={() => setShareDoc(null)}
        recipientLabel={t("tuRpParent")}
        title={t("tuFsFeeReceipt")}
        onSaveUpiDefault={(upiId) => void updateBusiness({ upiId })}
      />

      <SendQueue
        open={Boolean(queue)}
        title={t("tuFsSendToParents")}
        messages={queue ?? []}
        onClose={() => setQueue(null)}
        onSent={() => {}}
      />

      <ReviewPromptDialog
        open={review.open}
        onAccept={review.accept}
        onDecline={review.decline}
      />
    </div>
  );
}

function CollectPaymentModal({
  student,
  onClose,
  onCollected,
  recordPayment,
  balanceFor,
  modes,
  currency,
}: {
  student: Student | null;
  onClose: () => void;
  onCollected: (student: Student, payment: FeePayment) => void;
  recordPayment: (input: PaymentInput) => Promise<FeePayment>;
  balanceFor: (studentId: string) => StudentBalance;
  modes: string[];
  currency: string;
}) {
  const { t, lang } = useI18n();
  const balance = student ? balanceFor(student.id) : null;
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState(modes[0] ?? "Cash");
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  // Prefill with the outstanding amount the first time this opens per student.
  if (student && !touched && amount === "" && balance && balance.outstanding > 0) {
    setAmount(String(balance.outstanding));
  }

  const close = () => {
    setAmount("");
    setNote("");
    setTouched(false);
    setDate(todayIso());
    onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!student || !balance) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    setSaving(true);
    try {
      const payment = await recordPayment({
        studentId: student.id,
        amount: value,
        mode,
        date: new Date(`${date}T${new Date().toTimeString().slice(0, 8)}`).toISOString(),
        appliedTo: balance.dues
          .filter((d) => d.remaining > 0)
          .map((d) => d.due.period || d.due.label),
        note,
      });
      onCollected(student, payment);
      close();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(student)}
      onClose={close}
      title={
        student
          ? fill(t("tuFsCollectFeesFor"), { name: student.name })
          : t("tuFsCollectFees")
      }
    >
      {balance && (
        <p className="rounded-xl bg-cream-paper p-3 text-sm text-muted">
          Outstanding:{" "}
          <span className="font-bold text-ink">{formatMoney(balance.outstanding, currency)}</span>
          {balance.advance > 0 && (
            <>{fill(t("tuFsAdvanceHeld"), { amount: formatMoney(balance.advance, currency) })}</>
          )}
        </p>
      )}
      <form onSubmit={submit} className="mt-4 space-y-4">
        <Field label={t("tuFsAmountReceived")} required>
          <input
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(event) => {
              setTouched(true);
              setAmount(event.target.value);
            }}
            className={inputClass}
            autoFocus
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("tuFsPaidBy")}>
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value)}
              className={inputClass}
            >
              {modes.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("date")}>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value || todayIso())}
              className={inputClass}
            />
          </Field>
        </div>
        <Field label={t("tuFsNoteOptional")}>
          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t("tuFsNotePh")}
            className={inputClass}
          />
        </Field>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={close} className={secondaryBtnClass}>
            {t("cancel")}
          </button>
          <button type="submit" disabled={saving} className={primaryBtnClass}>
            {saving ? t("clPfSaving") : t("tuFsSaveMakeReceipt")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AddChargeModal({
  student,
  onClose,
  onSave,
  currency,
}: {
  student: Student | null;
  onClose: () => void;
  onSave: (input: {
    studentId: string;
    kind: FeeDueKind;
    label: string;
    amount: number;
    dueDate: string;
  }) => Promise<void>;
  currency: string;
}) {
  const { t, lang } = useI18n();
  const [kind, setKind] = useState<FeeDueKind>("admission");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(todayIso());
  const [saving, setSaving] = useState(false);

  const close = () => {
    setLabel("");
    setAmount("");
    setKind("admission");
    setDueDate(todayIso());
    onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!student) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    setSaving(true);
    try {
      await onSave({
        studentId: student.id,
        kind,
        label: label.trim() || feeKindLabel(kind, lang),
        amount: value,
        dueDate,
      });
      close();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(student)}
      onClose={close}
      title={
        student
          ? fill(t("tuFsAddChargeTitleFor"), { name: student.name })
          : t("tuFsAddChargeTitle")
      }
    >
      <p className="text-sm text-muted">
        {fill(t("tuFsChargeBlurb"), { currency })}
      </p>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("tuFsType")}>
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as FeeDueKind)}
              className={inputClass}
            >
              {FEE_KIND_ORDER.filter((key) => key !== "tuition").map((key) => (
                <option key={key} value={key}>
                  {feeKindLabel(key, lang)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("amount")} required>
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className={inputClass}
              autoFocus
            />
          </Field>
        </div>
        <Field label={t("tuFsDescription")}>
          <input
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={feeKindLabel(kind, lang)}
            className={inputClass}
          />
        </Field>
        <Field label={t("tuPhDue")}>
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value || todayIso())}
            className={inputClass}
          />
        </Field>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={close} className={secondaryBtnClass}>
            {t("cancel")}
          </button>
          <button type="submit" disabled={saving} className={primaryBtnClass}>
            {saving ? t("clPfSaving") : t("tuFsAddCharge")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
