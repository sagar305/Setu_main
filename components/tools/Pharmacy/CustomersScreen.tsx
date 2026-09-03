"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, Download, MessageCircle, Pencil, Plus, Trash2, Users } from "lucide-react";
import { usePharmacy } from "@/lib/pharmacy/store";
import { customerDues, customerLedger } from "@/lib/pharmacy/reports";
import { customerDuesCsv, downloadCsv } from "@/lib/pharmacy/csv";
import { duesMessages, refillMessages } from "@/lib/pharmacy/messages";
import { SendQueue } from "@/components/tools/Tuition/SendQueue";
import { formatMoney } from "@/lib/pos/types";
import { formatDate, todayKey, type Customer } from "@/lib/pharmacy/types";
import {
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  Pill,
  SearchInput,
  StatCard,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "./ui";

export function CustomersScreen() {
  const {
    business,
    customers,
    deleteCustomer,
    dismissReminder,
    medicines,
    recordSalePayment,
    refillReminders,
    saleReturns,
    sales,
    saveCustomer,
    settings,
    today,
  } = usePharmacy();

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [ledgerFor, setLedgerFor] = useState<Customer | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Customer | null>(null);
  const [queue, setQueue] = useState<"refills" | "dues" | null>(null);

  const currency = business?.currency ?? "INR";
  const shopName = business?.name ?? "our pharmacy";

  const dues = useMemo(
    () => customerDues(customers, sales, saleReturns),
    [customers, saleReturns, sales]
  );
  const totalDue = dues.reduce((sum, row) => sum + row.due, 0);

  /**
   * Refills that are due, not every reminder ever made.
   *
   * The due date is already set three days before the patient runs out, so
   * anything at or before today is worth a message now. Sending early would
   * train people to ignore them.
   */
  const dueRefills = useMemo(
    () =>
      refillReminders.filter(
        (reminder) => reminder.active && reminder.nextDueOn <= (today || todayKey())
      ),
    [refillReminders, today]
  );

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return dues;
    return dues.filter(
      (row) =>
        row.customer.name.toLowerCase().includes(text) || row.customer.phone.includes(text)
    );
  }, [dues, query]);

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Customers" value={String(customers.length)} />
        <StatCard
          label="Outstanding"
          value={formatMoney(totalDue, currency)}
          sub={`${dues.filter((row) => row.due > 0).length} with a balance`}
        />
        <StatCard
          label="Refills due"
          value={String(dueRefills.length)}
          sub="Three days before they run out"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[200px] flex-1">
          <SearchInput value={query} onChange={setQuery} placeholder="Search name or phone" />
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className={primaryBtnClass}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add customer
        </button>
        <button
          type="button"
          onClick={() => setQueue("refills")}
          className={secondaryBtnClass}
          disabled={dueRefills.length === 0}
        >
          <BellRing className="h-4 w-4" aria-hidden="true" />
          Refill reminders ({dueRefills.length})
        </button>
        <button
          type="button"
          onClick={() => setQueue("dues")}
          className={secondaryBtnClass}
          disabled={totalDue <= 0}
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          Chase dues
        </button>
        <button
          type="button"
          onClick={() => downloadCsv("customer-dues.csv", customerDuesCsv(dues))}
          className={secondaryBtnClass}
          disabled={customers.length === 0}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Export
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title={customers.length === 0 ? "No customers yet" : "Nothing matches that"}
          message={
            customers.length === 0
              ? "Attach a customer to a bill when there is a reason to — credit, or a refill worth reminding them about. Counter sales do not need one."
              : "Try their phone number."
          }
        />
      ) : (
        <div className="grid gap-2">
          {filtered.map((row) => (
            <div
              key={row.customer.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-muted-line/30 bg-white p-3"
            >
              <button
                type="button"
                onClick={() => setLedgerFor(row.customer)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-sm font-bold text-ink">{row.customer.name}</p>
                <p className="text-xs text-muted">
                  {[row.customer.phone, `${row.bills} bill${row.bills === 1 ? "" : "s"}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </button>
              <div className="flex shrink-0 items-center gap-2">
                {row.due > 0 ? (
                  <Pill tone="warn">{formatMoney(row.due, currency)} due</Pill>
                ) : (
                  <Pill tone="good">Settled</Pill>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditing(row.customer);
                    setFormOpen(true);
                  }}
                  className="rounded-lg border border-muted-line/40 p-2 text-muted transition hover:border-indigo/40 hover:text-indigo"
                  aria-label={`Edit ${row.customer.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(row.customer)}
                  className="rounded-lg border border-muted-line/40 p-2 text-muted transition hover:border-red-300 hover:text-red-600"
                  aria-label={`Delete ${row.customer.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CustomerFormModal
        open={formOpen}
        customer={editing}
        onClose={() => setFormOpen(false)}
        onSave={saveCustomer}
      />

      {/* One customer's bills, and settling what is owed on any of them. */}
      <Modal
        open={Boolean(ledgerFor)}
        onClose={() => setLedgerFor(null)}
        title={ledgerFor?.name ?? ""}
        wide
      >
        {ledgerFor && (
          <div className="grid gap-3">
            {customerLedger(sales, ledgerFor.id).length === 0 ? (
              <p className="text-sm text-muted">No bills against this customer yet.</p>
            ) : (
              customerLedger(sales, ledgerFor.id).map(({ sale, due }) => (
                <div
                  key={sale.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-muted-line/30 p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink">{sale.invoiceNo}</p>
                    <p className="text-xs text-muted">
                      {formatDate(sale.date)} · {sale.paymentMode} ·{" "}
                      {formatMoney(sale.total, currency)}
                    </p>
                  </div>
                  {due > 0 ? (
                    <div className="flex items-center gap-2">
                      <Pill tone="warn">{formatMoney(due, currency)} due</Pill>
                      <button
                        type="button"
                        onClick={() => void recordSalePayment(sale.id, due)}
                        className={secondaryBtnClass}
                      >
                        Settle
                      </button>
                    </div>
                  ) : (
                    <Pill tone="good">Paid</Pill>
                  )}
                </div>
              ))
            )}

            {refillReminders.filter(
              (reminder) => reminder.customerId === ledgerFor.id && reminder.active
            ).length > 0 && (
              <>
                <h4 className="mt-2 text-sm font-bold uppercase tracking-wide text-muted">
                  Refills
                </h4>
                {refillReminders
                  .filter((reminder) => reminder.customerId === ledgerFor.id && reminder.active)
                  .map((reminder) => (
                    <div
                      key={reminder.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="text-ink">
                        {medicines.find((medicine) => medicine.id === reminder.medicineId)?.name ??
                          "—"}
                        <span className="ml-2 text-xs text-muted">
                          due {formatDate(reminder.nextDueOn)}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => void dismissReminder(reminder.id)}
                        className="text-xs font-semibold text-muted hover:text-red-600"
                      >
                        Stop reminding
                      </button>
                    </div>
                  ))}
              </>
            )}
          </div>
        )}
      </Modal>

      <SendQueue
        open={queue === "refills"}
        title="Refill reminders"
        messages={refillMessages(dueRefills, customers, medicines, settings, shopName)}
        onClose={() => setQueue(null)}
        onSent={() => setQueue(null)}
      />
      <SendQueue
        open={queue === "dues"}
        title="Balance reminders"
        messages={duesMessages(sales, customers, settings, shopName, currency)}
        onClose={() => setQueue(null)}
        onSent={() => setQueue(null)}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title={`Delete ${confirmDelete?.name ?? ""}?`}
        message="Their bills stay on record — only the customer entry is removed."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (confirmDelete) await deleteCustomer(confirmDelete.id);
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function CustomerFormModal({
  open,
  customer,
  onClose,
  onSave,
}: {
  open: boolean;
  customer: Customer | null;
  onClose: () => void;
  onSave: (
    input: { name: string; phone: string; email: string; address: string; notes: string },
    id?: string
  ) => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(customer?.name ?? "");
    setPhone(customer?.phone ?? "");
    setAddress(customer?.address ?? "");
    setNotes(customer?.notes ?? "");
  }, [customer, open]);

  return (
    <Modal open={open} onClose={onClose} title={customer ? "Edit customer" : "Add a customer"}>
      <form
        className="grid gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!name.trim()) return;
          setSaving(true);
          try {
            await onSave(
              {
                name: name.trim(),
                phone: phone.trim(),
                email: "",
                address: address.trim(),
                notes: notes.trim(),
              },
              customer?.id
            );
            onClose();
          } finally {
            setSaving(false);
          }
        }}
      >
        <Field label="Name" required>
          <input
            className={inputClass}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Phone" hint="Needed for refill and balance reminders">
          <input
            className={inputClass}
            value={phone}
            inputMode="tel"
            onChange={(event) => setPhone(event.target.value)}
          />
        </Field>
        <Field label="Address">
          <input
            className={inputClass}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
        </Field>
        <Field label="Notes">
          <input
            className={inputClass}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </Field>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="submit" className={`${primaryBtnClass} sm:flex-1`} disabled={saving}>
            {saving ? "Saving…" : customer ? "Save changes" : "Add customer"}
          </button>
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
