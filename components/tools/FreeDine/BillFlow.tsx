"use client";

import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/translate";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Printer, Receipt, Share2, Split, Undo2 } from "lucide-react";
import { useDine, type SplitPlan, type TenderInput } from "@/lib/dine/store";
import { amountDue } from "@/lib/dine/calc";
import { formatPaise, formatPlain, parseAmount } from "@/lib/dine/money";
import {
  billStatusLabel,
  kindOf,
  lineUnitPrice,
  paymentMethodLabel,
  type DineBill,
} from "@/lib/dine/types";
import { balanceOf } from "@/lib/dine/credit";
import { BillView, billShareText, useBillTemplate } from "./BillView";
import { PAPER_CONTENT_MM, PREVIEW_CLASS, printNode } from "./printing";
import {
  Field,
  Modal,
  dangerBtnClass,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
  tapTargetClass,
} from "./ui";
import { useReviewPrompt } from "@/lib/hooks/useReviewPrompt";
import { ReviewPromptDialog } from "@/components/review/ReviewPrompt";

type Step = "split" | "bills";

/**
 * Billing a table: decide how it splits, print each part, take payment.
 *
 * Splitting is the step that has to be right. A table asking to "split three
 * ways" means one of three different things — by what each person ate, by an
 * even share, or by amounts they have agreed between themselves — and getting
 * the wrong one out means reprinting in front of the guests.
 */
export function BillFlow({
  ticketId,
  onClose,
  onSettled,
}: {
  ticketId: string;
  onClose: () => void;
  onSettled: () => void;
}) {
  const { t } = useI18n();
  const {
    tickets,
    bills,
    billItems,
    billPayments,
    business,
    settings,
    itemsOfTicket,
    ticketTotals,
    billTicket,
    unbillTicket,
  } = useDine();

  const currency = business?.currency ?? "INR";
  const ticket = tickets.find((row) => row.id === ticketId) ?? null;
  const ticketBills = useMemo(
    () => bills.filter((bill) => bill.ticketId === ticketId).sort((a, b) => a.splitIndex - b.splitIndex),
    [bills, ticketId]
  );

  const review = useReviewPrompt();

  const [step, setStep] = useState<Step>(ticketBills.length > 0 ? "bills" : "split");
  const [mode, setMode] = useState<SplitPlan["mode"]>("full");
  const [parts, setParts] = useState(2);
  const [amounts, setAmounts] = useState<string[]>(["", ""]);
  const [assignment, setAssignment] = useState<Record<string, number>>({});
  const [payingBill, setPayingBill] = useState<DineBill | null>(null);
  const [busy, setBusy] = useState(false);

  const items = itemsOfTicket(ticketId).filter((item) => item.cancelledAt === null);
  const totals = ticketTotals(ticketId);

  // Once every part is paid the ticket settles and the table frees itself.
  useEffect(() => {
    if (ticketBills.length === 0) return;
    if (ticket?.status === "settled") {
      // Every part paid and the table freed: the service cycle is finished.
      review.complete();
      onSettled();
    }
  }, [onSettled, review, ticket?.status, ticketBills.length]);

  const createBills = async () => {
    setBusy(true);
    try {
      let plan: SplitPlan;
      if (mode === "items") {
        const groups: string[][] = Array.from({ length: parts }, () => []);
        for (const item of items) {
          const index = Math.min(assignment[item.id] ?? 0, parts - 1);
          groups[index].push(item.id);
        }
        plan = { mode: "items", groups: groups.filter((group) => group.length > 0) };
      } else if (mode === "equal") {
        plan = { mode: "equal", parts };
      } else if (mode === "amount") {
        plan = { mode: "amount", amounts: amounts.map((value) => parseAmount(value)) };
      } else {
        plan = { mode: "full" };
      }
      await billTicket(ticketId, plan);
      setStep("bills");
    } finally {
      setBusy(false);
    }
  };

  const enteredTotal = amounts.reduce((sum, value) => sum + parseAmount(value), 0);
  const amountsMatch = enteredTotal === totals.total;

  if (!ticket) return null;

  return (
    <>
      <Modal
        open={step === "split"}
        onClose={onClose}
        title={fill(t("dnBfBillTitle"), { amount: formatPaise(totals.total, currency) })}
        wide
      >
        <div className="space-y-5">
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                { id: "full", label: "dnBfOneBill", hint: "dnBfOneBillHint" },
                { id: "items", label: "dnBfSplitItems", hint: "dnBfSplitItemsHint" },
                { id: "equal", label: "dnBfSplitEqual", hint: "dnBfSplitEqualHint" },
                { id: "amount", label: "dnBfSplitAmount", hint: "dnBfSplitAmountHint" },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setMode(option.id)}
                aria-pressed={mode === option.id}
                className={`${tapTargetClass} rounded-xl border p-3 text-left transition ${
                  mode === option.id
                    ? "border-indigo bg-indigo/5"
                    : "border-muted-line/40 bg-white hover:border-indigo/40"
                }`}
              >
                <span className="block text-sm font-bold text-ink">{t(option.label)}</span>
                <span className="mt-0.5 block text-xs text-muted">{t(option.hint)}</span>
              </button>
            ))}
          </div>

          {(mode === "equal" || mode === "items" || mode === "amount") && (
            <Field label={t("dnBfHowManyBills")}>
              <div className="flex flex-wrap gap-2">
                {[2, 3, 4, 5, 6].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => {
                      setParts(count);
                      setAmounts(Array.from({ length: count }, (_, index) => amounts[index] ?? ""));
                    }}
                    aria-pressed={parts === count}
                    className={`${tapTargetClass} w-12 rounded-xl border text-sm font-bold transition ${
                      parts === count
                        ? "border-indigo bg-indigo text-white"
                        : "border-muted-line/40 bg-white text-ink"
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </Field>
          )}

          {mode === "equal" && (
            <p className="rounded-xl bg-cream-paper p-3 text-sm text-ink">
              {parts} bills of about{" "}
              <strong>{formatPaise(Math.round(totals.total / parts), currency)}</strong> each. The
              odd paise are spread across the parts so they add back to{" "}
              {formatPaise(totals.total, currency)} exactly.
            </p>
          )}

          {mode === "amount" && (
            <div className="space-y-2">
              {Array.from({ length: parts }, (_, index) => (
                <Field key={index} label={`Bill ${index + 1}`}>
                  <input
                    inputMode="decimal"
                    value={amounts[index] ?? ""}
                    onChange={(event) =>
                      setAmounts((previous) => {
                        const next = [...previous];
                        next[index] = event.target.value;
                        return next;
                      })
                    }
                    placeholder={formatPlain(Math.round(totals.total / parts))}
                    className={inputClass}
                  />
                </Field>
              ))}
              <p className={`text-xs ${amountsMatch ? "text-muted" : "text-red-600"}`}>
                {fill(t("dnBfEnteredOf"), {
                  entered: formatPaise(enteredTotal, currency),
                  total: formatPaise(totals.total, currency),
                })}
                {!amountsMatch && ` ${t("dnBfAmountsScaled")}`}
              </p>
            </div>
          )}

          {mode === "items" && (
            <div className="space-y-2">
              <p className="text-xs text-muted">{t("dnBfTapToMove")}</p>
              <ul className="max-h-64 space-y-1.5 overflow-y-auto">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-muted-line/30 bg-white p-2"
                  >
                    <span className="min-w-0 text-sm text-ink">
                      <span className="font-semibold">{item.name}</span>
                      {item.variationName && (
                        <span className="text-muted"> ({item.variationName})</span>
                      )}
                      <span className="text-muted"> × {item.quantity}</span>
                      <span className="ml-2 text-xs text-muted">
                        {formatPaise(lineUnitPrice(item) * item.quantity, currency)}
                      </span>
                    </span>
                    <span className="flex shrink-0 gap-1">
                      {Array.from({ length: parts }, (_, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() =>
                            setAssignment((previous) => ({ ...previous, [item.id]: index }))
                          }
                          aria-label={fill(t("dnBfMoveToBill"), {
                            name: item.name,
                            n: index + 1,
                          })}
                          aria-pressed={(assignment[item.id] ?? 0) === index}
                          className={`h-8 w-8 rounded-lg border text-xs font-bold transition ${
                            (assignment[item.id] ?? 0) === index
                              ? "border-indigo bg-indigo text-white"
                              : "border-muted-line/40 bg-white text-muted"
                          }`}
                        >
                          {index + 1}
                        </button>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className={secondaryBtnClass}>
              Back to ticket
            </button>
            <button
              type="button"
              onClick={() => void createBills()}
              disabled={busy}
              className={`${primaryBtnClass} ${tapTargetClass}`}
            >
              <Receipt className="h-4 w-4" />
              {busy
                ? t("dnBfMakingBills")
                : mode === "full"
                  ? t("dnBfMakeBill")
                  : fill(t("dnBfMakeNBills"), { n: parts })}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={step === "bills"}
        onClose={onClose}
        title={
          ticketBills.length > 1
            ? fill(t("dnBfNBills"), { n: ticketBills.length })
            : t("dnBlColBill")
        }
        wide
      >
        <div className="space-y-3">
          {ticketBills.map((bill) => (
            <BillCard
              key={bill.id}
              bill={bill}
              onPay={() => setPayingBill(bill)}
              currency={currency}
            />
          ))}

          <div className="flex flex-wrap justify-between gap-3 border-t border-muted-line/20 pt-4">
            {ticketBills.every((bill) => bill.status === "unpaid") && (
              <button
                type="button"
                onClick={async () => {
                  await unbillTicket(ticketId);
                  setStep("split");
                }}
                className={secondaryBtnClass}
              >
                <Undo2 className="h-4 w-4" />
                Undo — keep ordering
              </button>
            )}
            <button type="button" onClick={onClose} className={`${primaryBtnClass} ml-auto`}>
              Done
            </button>
          </div>
        </div>
      </Modal>

      {payingBill && (
        <PaymentModal
          bill={payingBill}
          onClose={() => setPayingBill(null)}
        />
      )}

      <ReviewPromptDialog
        open={review.open}
        onAccept={review.accept}
        onDecline={review.decline}
      />
    </>
  );
}

function BillCard({
  bill,
  currency,
  onPay,
}: {
  bill: DineBill;
  currency: string;
  onPay: () => void;
}) {
  const { lang, t } = useI18n();
  const { billItems, billPayments, business, settings } = useDine();
  const template = useBillTemplate();
  const paperSize = template?.paperSize ?? settings.billPaperSize;
  const printRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);

  const items = billItems.filter((item) => item.billId === bill.id);
  const payments = billPayments.filter((payment) => payment.billId === bill.id);

  const share = async () => {
    setSharing(true);
    try {
      const text = billShareText(bill, business, currency, lang);
      const canShareFiles =
        typeof navigator !== "undefined" && typeof navigator.canShare === "function";

      // Sharing the PDF is the good outcome; a text summary is the fallback,
      // because file sharing is missing on a lot of the Android browsers this
      // product is actually used on.
      if (canShareFiles && printRef.current) {
        try {
          const canvasBlob = await billPdfBlob(printRef.current);
          const file = new File([canvasBlob], `${bill.billLabel}.pdf`, {
            type: "application/pdf",
          });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: bill.billLabel, text });
            return;
          }
        } catch {
          // Fall through to the text share.
        }
      }
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: bill.billLabel, text });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // The guest cancelled the share sheet — nothing to report.
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="rounded-2xl border border-muted-line/30 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-ink">
            {bill.billLabel}
            {bill.splitCount > 1 && (
              <span className="ml-2 text-xs font-normal text-muted">
                Split {bill.splitIndex} of {bill.splitCount}
              </span>
            )}
          </p>
          <p className="text-lg font-bold text-ink">{formatPaise(bill.total, currency)}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
            bill.status === "paid"
              ? "bg-green-100 text-green-800"
              : bill.status === "cancelled"
                ? "bg-red-100 text-red-700"
                : "bg-saffron/20 text-ink"
          }`}
        >
          {billStatusLabel(bill.status, lang)}
        </span>
      </div>

      {/* Rendered off-screen so print and PDF capture identical markup. */}
      <div className="pointer-events-none absolute -left-[9999px] top-0" aria-hidden="true">
        <div
          className={PREVIEW_CLASS}
          style={{ width: `${PAPER_CONTENT_MM[paperSize]}mm`, padding: "4mm" }}
        >
          <BillView
            ref={printRef}
            bill={bill}
            items={items}
            payments={payments}
            business={business}
            settings={settings}
            template={template}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {bill.status === "unpaid" && (
          <button type="button" onClick={onPay} className={`${primaryBtnClass} ${tapTargetClass}`}>
            <Check className="h-4 w-4" />
            {t("dnBfTakePayment")}
          </button>
        )}
        <button
          type="button"
          onClick={() => printNode(printRef.current, paperSize, bill.billLabel)}
          className={`${secondaryBtnClass} ${tapTargetClass}`}
        >
          <Printer className="h-4 w-4" />
          {t("print")}
        </button>
        <button
          type="button"
          onClick={() => void share()}
          disabled={sharing}
          className={`${secondaryBtnClass} ${tapTargetClass}`}
        >
          <Share2 className="h-4 w-4" />
          {sharing ? t("dnBfSharing") : t("share")}
        </button>
      </div>
    </div>
  );
}

/**
 * Render the bill node to a PDF blob for the share sheet.
 *
 * Same html2canvas-then-jsPDF route as the receipt exporter in lib/pos, which
 * exists because jsPDF's own text layout cannot render the rupee glyph.
 * Imported lazily so a restaurant that only ever prints never downloads it.
 */
async function billPdfBlob(node: HTMLElement): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const html2canvas = (await import("html2canvas")).default;
  const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff", logging: false });
  const widthMm = 80;
  const heightMm = (canvas.height * widthMm) / canvas.width;
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [widthMm, Math.max(heightMm, 60)],
  });
  pdf.addImage(canvas.toDataURL("image/png", 0.95), "PNG", 0, 0, widthMm, heightMm);
  return pdf.output("blob");
}

/**
 * Taking payment.
 *
 * Three kinds of tender end up here and only one of them is money arriving
 * now. A booking advance was collected days ago and is being spent; an "on
 * account" tender is not payment at all but a promise, which is why it needs a
 * diner attached and warns when it takes them past their limit. Both still
 * have to appear as tenders, because a bill's payments must add up to its
 * total whatever form they took.
 */
function PaymentModal({ bill, onClose }: { bill: DineBill; onClose: () => void }) {
  const { lang, t } = useI18n();
  const { paymentMethods, business, settings, customers, tickets, bills, ledgerEntries, payBill } =
    useDine();
  const currency = business?.currency ?? "INR";

  const ticket = tickets.find((row) => row.id === bill.ticketId) ?? null;
  const diner = bill.customerId ? customers.find((row) => row.id === bill.customerId) ?? null : null;

  const advanceMethod = paymentMethods.find((method) => kindOf(method) === "advance") ?? null;
  const creditMethod = paymentMethods.find((method) => kindOf(method) === "credit") ?? null;

  // An advance is already the restaurant's money, so it goes on the bill
  // without being asked for — the counter should not have to remember that a
  // booking happened. Capped at the bill, since the rest belongs to the other
  // splits.
  const advanceAvailable = Math.min(ticket?.advanceAmount ?? 0, bill.total);
  const canUseAdvance = Boolean(advanceMethod) && advanceAvailable > 0;

  const creditAllowed = Boolean(
    settings.creditEnabled && creditMethod && diner && diner.creditAllowed
  );
  // What they already owe across the whole business, from the shared ledger.
  const owedAlready = diner ? balanceOf(ledgerEntries, diner.id) : 0;

  const [tenders, setTenders] = useState<{ methodId: string; amount: string }[]>(() => {
    const rows: { methodId: string; amount: string }[] = [];
    if (canUseAdvance && advanceMethod) {
      rows.push({ methodId: advanceMethod.id, amount: formatPlain(advanceAvailable) });
    }
    const rest = bill.total - (canUseAdvance ? advanceAvailable : 0);
    if (rest > 0 || rows.length === 0) {
      const cash = paymentMethods.find((method) => kindOf(method) === "normal");
      rows.push({ methodId: cash?.id ?? paymentMethods[0]?.id ?? "", amount: formatPlain(rest) });
    }
    return rows;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const entered = tenders.reduce((sum, tender) => sum + parseAmount(tender.amount), 0);
  const remaining = amountDue(bill.total, [{ amount: entered }]);

  const selectable = (current: string) =>
    paymentMethods.filter((method) => {
      const kind = kindOf(method);
      if (kind === "advance") return canUseAdvance || method.id === current;
      if (kind === "credit") return creditAllowed || method.id === current;
      return true;
    });

  const onAccount = tenders
    .filter((tender) => {
      const method = paymentMethods.find((row) => row.id === tender.methodId);
      return method ? kindOf(method) === "credit" : false;
    })
    .reduce((sum, tender) => sum + parseAmount(tender.amount), 0);

  const advanceSpent = tenders
    .filter((tender) => {
      const method = paymentMethods.find((row) => row.id === tender.methodId);
      return method ? kindOf(method) === "advance" : false;
    })
    .reduce((sum, tender) => sum + parseAmount(tender.amount), 0);

  const advanceOverspent = Math.max(advanceSpent - advanceAvailable, 0);

  // Settling the last part of a ticket closes it, which discharges any advance
  // still held. If the guest put down more than they ate, that difference is
  // theirs — and this is the last moment anyone will be looking at it.
  const lastPart = !bills.some(
    (row) => row.ticketId === bill.ticketId && row.id !== bill.id && row.status === "unpaid"
  );
  const unspentAdvance = lastPart ? Math.max((ticket?.advanceAmount ?? 0) - advanceSpent, 0) : 0;

  const blocked =
    entered <= 0 ||
    advanceOverspent > 0 ||
    (onAccount > 0 && !creditAllowed);

  const submit = async () => {
    setBusy(true);
    try {
      const rows: TenderInput[] = tenders
        .map((tender) => ({ methodId: tender.methodId, amount: parseAmount(tender.amount) }))
        .filter((tender) => tender.amount > 0 && tender.methodId);
      if (rows.length === 0) return;
      setError("");
      await payBill(bill.id, rows);
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : t("dnBfCouldNotRecord")
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={fill(t("dnBfPaymentTitle"), { amount: formatPaise(bill.total, currency) })}
    >
      <div className="space-y-4">
        {tenders.map((tender, index) => (
          <div key={index} className="flex gap-2">
            <select
              value={tender.methodId}
              onChange={(event) =>
                setTenders((previous) =>
                  previous.map((row, rowIndex) =>
                    rowIndex === index ? { ...row, methodId: event.target.value } : row
                  )
                )
              }
              className={`${inputClass} min-w-0 flex-1`}
              aria-label={t("mdrInstrument")}
            >
              {selectable(tender.methodId).map((method) => (
                <option key={method.id} value={method.id}>
                  {paymentMethodLabel(method.name, lang)}
                </option>
              ))}
            </select>
            {/* Width on a wrapper: inputClass is w-full, which would beat a
                width on the input itself and squeeze the method picker. */}
            <div className="w-28 shrink-0 sm:w-32">
              <input
                inputMode="decimal"
                value={tender.amount}
                onChange={(event) =>
                  setTenders((previous) =>
                    previous.map((row, rowIndex) =>
                      rowIndex === index ? { ...row, amount: event.target.value } : row
                    )
                  )
                }
                aria-label={t("amount")}
                className={`${inputClass} text-right`}
              />
            </div>
            {tenders.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setTenders((previous) => previous.filter((_, rowIndex) => rowIndex !== index))
                }
                aria-label={t("dnBfRemoveTender")}
                className={`${dangerBtnClass} px-3`}
              >
                ×
              </button>
            )}
          </div>
        ))}

        {/* FR-6.7: several methods on one bill — ₹500 cash and ₹300 by UPI. */}
        <button
          type="button"
          onClick={() =>
            setTenders((previous) => [
              ...previous,
              {
                methodId: paymentMethods[1]?.id ?? paymentMethods[0]?.id ?? "",
                amount: remaining > 0 ? formatPlain(remaining) : "",
              },
            ])
          }
          className="flex items-center gap-1.5 text-sm font-semibold text-indigo"
        >
          <Split className="h-4 w-4" />
          {t("dnBfPayAnother")}
        </button>

        {canUseAdvance && (
          <p className="rounded-xl bg-indigo/5 p-3 text-xs text-indigo">
            {fill(t("dnBfAdvanceApplied"), {
              amount: formatPaise(advanceAvailable, currency),
            })}
          </p>
        )}

        {settings.creditEnabled && !creditAllowed && (
          <p className="text-xs text-muted">
            {!diner
              ? t("dnBfLinkDiner")
              : fill(t("dnBfNoRunningAccount"), { name: diner.name })}
          </p>
        )}

        {unspentAdvance > 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <p className="font-semibold">
              {fill(t("dnBfAdvanceUnspent"), {
                amount: formatPaise(unspentAdvance, currency),
              })}
            </p>
            <p>{t("dnBfHandItBack")}</p>
          </div>
        )}

        {advanceOverspent > 0 && (
          <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-700">
            {fill(t("dnBfAdvanceOverspent"), {
              amount: formatPaise(advanceOverspent, currency),
            })}
          </p>
        )}

        {onAccount > 0 && creditAllowed && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <p className="font-semibold">
              {fill(t("dnBfGoesOnAccount"), {
                amount: formatPaise(onAccount, currency),
                name: diner?.name ?? "",
              })}
            </p>
            <p>
              {owedAlready > 0
                ? fill(t("dnBfAlreadyOwe"), {
                    owed: formatPaise(owedAlready, currency),
                    total: formatPaise(owedAlready + onAccount, currency),
                  })
                : t("dnBfNothingOutstanding")}
            </p>
            <a
              href="/tools/customer-ledger"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline underline-offset-2"
            >
              {t("dnBfSettleInLedger")}
            </a>
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-700">
            {error}
          </p>
        )}

        <div className="rounded-xl bg-cream-paper p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">{t("dnBfEntered")}</span>
            <span className="font-bold text-ink">{formatPaise(entered, currency)}</span>
          </div>
          {onAccount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted">{t("dnBfGoingOnAccount")}</span>
              <span className="font-bold text-ink">{formatPaise(onAccount, currency)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted">{remaining >= 0 ? t("dnBfStillDue") : t("dnBfChange")}</span>
            <span
              className={`font-bold ${remaining > 0 ? "text-red-600" : "text-green-700"}`}
            >
              {formatPaise(Math.abs(remaining), currency)}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || blocked}
            className={`${primaryBtnClass} ${tapTargetClass}`}
          >
            <Check className="h-4 w-4" />
            {busy ? t("clPfSaving") : t("dnBfMarkPaid")}
          </button>
        </div>
      </div>

    </Modal>
  );
}
