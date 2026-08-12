"use client";

import { useMemo, useState } from "react";
import {
  BookUser,
  Download,
  History,
  MessageCircle,
  Pencil,
  Plus,
  Wallet,
} from "lucide-react";
import { useDine, type CustomerInput } from "@/lib/dine/store";
import { formatPaise, formatPlain, parseAmount } from "@/lib/dine/money";
import { creditLedgerCsv, downloadCsv } from "@/lib/dine/csv";
import {
  creditReminderMessage,
  entriesFor,
  headroom,
  oldestUnpaidDays,
  totalOutstanding,
} from "@/lib/dine/credit";
import { whatsappUrl } from "@/lib/dine/reservation";
import { CREDIT_REASON_LABELS, kindOf, type DineCustomer } from "@/lib/dine/types";
import { printedAt } from "./printing";
import {
  EmptyState,
  Field,
  Modal,
  SearchInput,
  SectionHeading,
  StatCard,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
  tapTargetClass,
} from "./ui";

/**
 * The khata: who eats now and pays later, and what they owe.
 *
 * Built around the two things an owner actually does with it — take money off
 * a running account, and nudge someone who has been carrying a balance for a
 * while. Everything else is history, which matters only when there is a
 * disagreement, so it lives one tap away rather than on the page.
 */
export function CreditScreen() {
  const {
    customers,
    creditEntries,
    business,
    settings,
    updateSettings,
    createCustomer,
    updateCustomer,
  } = useDine();

  const currency = business?.currency ?? "INR";
  const [query, setQuery] = useState("");
  const [settling, setSettling] = useState<DineCustomer | null>(null);
  const [historyFor, setHistoryFor] = useState<DineCustomer | null>(null);
  const [editing, setEditing] = useState<DineCustomer | null>(null);
  const [creating, setCreating] = useState(false);

  const onAccount = useMemo(
    () => customers.filter((customer) => customer.creditAllowed || customer.creditBalance !== 0),
    [customers]
  );

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    return onAccount
      .filter(
        (customer) =>
          !search ||
          customer.name.toLowerCase().includes(search) ||
          customer.phone.includes(search)
      )
      .sort((a, b) => b.creditBalance - a.creditBalance || a.name.localeCompare(b.name));
  }, [onAccount, query]);

  const outstanding = useMemo(() => totalOutstanding(customers), [customers]);
  const owingCount = customers.filter((customer) => customer.creditBalance > 0).length;

  if (!settings.creditEnabled) {
    return (
      <EmptyState
        icon={<BookUser className="h-6 w-6" />}
        title="Running accounts are off"
        message="Turn this on to let regulars eat now and pay later. You choose who gets an account and how much they may run up; their bills can then be settled 'on account', and what they owe is tracked here."
        action={
          <button
            type="button"
            onClick={() => void updateSettings({ creditEnabled: true })}
            className={primaryBtnClass}
          >
            <BookUser className="h-4 w-4" />
            Turn on running accounts
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Khata"
        subtitle={
          owingCount === 0
            ? "Nobody owes anything right now."
            : `${owingCount} ${owingCount === 1 ? "diner owes" : "diners owe"} ${formatPaise(
                outstanding,
                currency
              )}`
        }
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={creditEntries.length === 0}
              onClick={() =>
                downloadCsv("khata.csv", creditLedgerCsv(creditEntries, currency))
              }
              className={secondaryBtnClass}
            >
              <Download className="h-4 w-4" />
              Export
            </button>
            <button type="button" onClick={() => setCreating(true)} className={primaryBtnClass}>
              <Plus className="h-4 w-4" />
              Add diner
            </button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Outstanding"
          value={formatPaise(outstanding, currency)}
          sub={owingCount === 0 ? "All settled" : `across ${owingCount}`}
        />
        <StatCard
          label="Accounts open"
          value={String(onAccount.filter((row) => row.creditAllowed).length)}
          sub="Diners who may run a tab"
        />
        <StatCard
          label="Longest running"
          value={(() => {
            const days = customers
              .filter((row) => row.creditBalance > 0)
              .map((row) => oldestUnpaidDays(creditEntries, row.id) ?? 0);
            return days.length ? `${Math.max(...days)} days` : "—";
          })()}
          sub="Oldest unpaid charge"
        />
      </div>

      {onAccount.length === 0 ? (
        <EmptyState
          icon={<BookUser className="h-6 w-6" />}
          title="No accounts yet"
          message="Add a diner and allow them credit, or tick 'may run an account' when you save a diner from a table."
        />
      ) : (
        <>
          <SearchInput value={query} onChange={setQuery} placeholder="Search diners…" />

          <div className="overflow-x-auto rounded-2xl border border-muted-line/40 bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-cream-paper text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Diner</th>
                  <th className="px-4 py-3 text-right">Owes</th>
                  <th className="px-4 py-3 text-right">Limit</th>
                  <th className="px-4 py-3 text-right">Oldest</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((customer) => {
                  const room = headroom(customer);
                  const days = oldestUnpaidDays(creditEntries, customer.id);
                  return (
                    <tr key={customer.id} className="border-t border-muted-line/30">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-ink">{customer.name}</p>
                        {customer.phone && (
                          <p className="text-xs text-muted">{customer.phone}</p>
                        )}
                        {!customer.creditAllowed && customer.creditBalance !== 0 && (
                          <p className="text-xs font-semibold text-amber-700">
                            Account closed, balance outstanding
                          </p>
                        )}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-bold ${
                          customer.creditBalance > 0 ? "text-red-600" : "text-muted"
                        }`}
                      >
                        {formatPaise(customer.creditBalance, currency)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted">
                        {customer.creditLimit > 0 ? (
                          <>
                            {formatPaise(customer.creditLimit, currency)}
                            {room !== null && room < 0 && (
                              <span className="ml-1 font-semibold text-red-600">over</span>
                            )}
                          </>
                        ) : (
                          "No limit"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-muted">
                        {days === null ? "—" : `${days}d`}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            disabled={customer.creditBalance <= 0}
                            onClick={() => setSettling(customer)}
                            className={`${primaryBtnClass} px-3 py-1.5 text-xs`}
                          >
                            <Wallet className="h-3.5 w-3.5" />
                            Take payment
                          </button>
                          {customer.phone && customer.creditBalance > 0 && (
                            <a
                              href={whatsappUrl(
                                customer.phone,
                                creditReminderMessage({
                                  businessName: business?.name ?? "our restaurant",
                                  guestName: customer.name,
                                  balance: formatPaise(customer.creditBalance, currency),
                                  days: oldestUnpaidDays(creditEntries, customer.id),
                                  upiId: business?.upiId || undefined,
                                }),
                                settings.whatsappDialCode
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`${secondaryBtnClass} px-3 py-1.5 text-xs`}
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              Remind
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => setHistoryFor(customer)}
                            aria-label={`History for ${customer.name}`}
                            className={`${secondaryBtnClass} px-3 py-1.5 text-xs`}
                          >
                            <History className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(customer)}
                            aria-label={`Edit ${customer.name}`}
                            className={`${secondaryBtnClass} px-3 py-1.5 text-xs`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {settling && <SettleModal customer={settling} onClose={() => setSettling(null)} />}

      {historyFor && (
        <Modal open onClose={() => setHistoryFor(null)} title={`${historyFor.name} · history`}>
          <div className="space-y-2">
            {entriesFor(creditEntries, historyFor.id).length === 0 ? (
              <p className="text-sm text-muted">Nothing on this account yet.</p>
            ) : (
              entriesFor(creditEntries, historyFor.id).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-muted-line/40 p-3 text-sm"
                >
                  <div>
                    <p className="font-semibold text-ink">
                      {CREDIT_REASON_LABELS[entry.reason]}
                      {entry.billLabel ? ` · ${entry.billLabel}` : ""}
                    </p>
                    <p className="text-xs text-muted">
                      {printedAt(entry.createdAt)}
                      {entry.methodName ? ` · ${entry.methodName}` : ""}
                    </p>
                    {entry.note && <p className="text-xs text-muted">{entry.note}</p>}
                  </div>
                  <span
                    className={`font-bold ${entry.change > 0 ? "text-red-600" : "text-green-700"}`}
                  >
                    {entry.change > 0 ? "+" : "−"}
                    {formatPaise(Math.abs(entry.change), currency)}
                  </span>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}

      {(editing || creating) && (
        <DinerModal
          customer={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSave={async (input) => {
            if (editing) {
              await updateCustomer(editing.id, input);
              return null;
            }
            return createCustomer(input);
          }}
        />
      )}
    </div>
  );
}

/**
 * Taking money against a running account.
 *
 * Pre-filled with the whole balance because that is what usually happens — a
 * diner settles up, they do not part-pay — but any amount is allowed, since
 * part-payment is exactly what a khata is for.
 */
function SettleModal({ customer, onClose }: { customer: DineCustomer; onClose: () => void }) {
  const { paymentMethods, business, settleCredit } = useDine();
  const currency = business?.currency ?? "INR";

  // Only real money settles a debt; paying a khata with the khata is a loop.
  const cashMethods = paymentMethods.filter((method) => kindOf(method) === "normal");

  const [amount, setAmount] = useState(() => formatPlain(customer.creditBalance));
  const [methodId, setMethodId] = useState(cashMethods[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const parsed = parseAmount(amount);
  const remaining = customer.creditBalance - parsed;

  return (
    <Modal open onClose={onClose} title={`Payment from ${customer.name}`}>
      <div className="space-y-4">
        <div className="rounded-xl bg-cream-paper p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Currently owes</span>
            <span className="font-bold text-ink">
              {formatPaise(customer.creditBalance, currency)}
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount received">
            <input
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              autoFocus
              className={inputClass}
            />
          </Field>
          <Field label="Taken as">
            <select
              value={methodId}
              onChange={(event) => setMethodId(event.target.value)}
              className={inputClass}
            >
              {cashMethods.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Note" hint="Optional — a reference, or who handed it over.">
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className={inputClass}
          />
        </Field>

        <div className="rounded-xl bg-cream-paper p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Left on the account</span>
            <span
              className={`font-bold ${remaining > 0 ? "text-red-600" : "text-green-700"}`}
            >
              {formatPaise(Math.max(remaining, 0), currency)}
            </span>
          </div>
          {remaining < 0 && (
            <p className="mt-1 text-xs text-amber-700">
              That is {formatPaise(-remaining, currency)} more than owed — it will sit as credit in
              their favour.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || parsed <= 0 || !methodId}
            onClick={async () => {
              setBusy(true);
              try {
                await settleCredit(customer.id, parsed, methodId, note.trim());
                onClose();
              } finally {
                setBusy(false);
              }
            }}
            className={`${primaryBtnClass} ${tapTargetClass}`}
          >
            <Wallet className="h-4 w-4" />
            {busy ? "Saving…" : "Record payment"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Diner details and credit terms. The balance is never editable here. */
function DinerModal({
  customer,
  onClose,
  onSave,
}: {
  customer: DineCustomer | null;
  onClose: () => void;
  onSave: (input: CustomerInput) => Promise<DineCustomer | null>;
}) {
  const { business, adjustCredit } = useDine();
  const currency = business?.currency ?? "INR";

  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [allowed, setAllowed] = useState(customer?.creditAllowed ?? true);
  const [limit, setLimit] = useState(() =>
    customer && customer.creditLimit > 0 ? formatPlain(customer.creditLimit) : ""
  );
  const [opening, setOpening] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Modal open onClose={onClose} title={customer ? customer.name : "Add diner"}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              className={inputClass}
            />
          </Field>
          <Field label="Phone" hint="Used for WhatsApp reminders.">
            <input
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="98765 43210"
              className={inputClass}
            />
          </Field>
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-muted-line/40 p-3">
          <input
            type="checkbox"
            checked={allowed}
            onChange={(event) => setAllowed(event.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span className="text-sm">
            <span className="font-semibold text-ink">May run an account</span>
            <span className="block text-xs text-muted">
              Their bills can be settled &ldquo;on account&rdquo; and paid later.
            </span>
          </span>
        </label>

        <Field
          label="Credit limit"
          hint="Leave blank for no ceiling. Going over warns the counter, it does not block the bill."
        >
          <input
            inputMode="decimal"
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
            placeholder="No limit"
            className={inputClass}
          />
        </Field>

        {!customer && (
          <Field
            label="Opening balance"
            hint="What they already owe from before, if you are moving an existing khata across."
          >
            <input
              inputMode="decimal"
              value={opening}
              onChange={(event) => setOpening(event.target.value)}
              placeholder="0"
              className={inputClass}
            />
          </Field>
        )}

        {customer && (
          <div className="rounded-xl bg-cream-paper p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Owes right now</span>
              <span className="font-bold text-ink">
                {formatPaise(customer.creditBalance, currency)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">
              Changed by bills and payments only, so the ledger always explains it.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                const saved = await onSave({
                  name: name.trim(),
                  phone: phone.trim(),
                  email: customer?.email ?? "",
                  address: customer?.address ?? "",
                  notes: customer?.notes ?? "",
                  creditAllowed: allowed,
                  creditLimit: parseAmount(limit),
                });
                // An opening balance is a ledger entry like any other, so the
                // running total still equals the sum of the history.
                const carried = parseAmount(opening);
                if (saved && carried > 0) {
                  await adjustCredit(saved.id, carried, "opening", "Carried over");
                }
                onClose();
              } finally {
                setBusy(false);
              }
            }}
            className={`${primaryBtnClass} ${tapTargetClass}`}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
