"use client";

// Quotation Generator — a standalone tool with its own document design
// (deliberately not the Invoice Generator's pipeline, per product decision).
// Quotes are saved to the shared workspace `quotations` store; business
// details, customers and products come from the workspace with consent.

import { useMemo, useState } from "react";
import {
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  NumberInput,
  PrimaryButton,
  SecondaryButton,
  Select,
  TextArea,
  TextInput,
} from "@/components/toolkit/ui";
import { WorkspaceBanner } from "@/components/toolkit/WorkspaceBanner";
import { useWorkspaceConnection } from "@/lib/hooks/useWorkspaceConnection";
import { useEntityList } from "@/lib/hooks/useEntityList";
import type { Quotation, QuotationItem, QuotationStatus } from "@/lib/toolkit/types";
import { currencySymbol, formatMoney, generateId, nowIso } from "@/lib/pos/types";
import { useI18n } from "@/lib/i18n";

const todayIso = () => new Date().toISOString().split("T")[0];
const plusDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

const blankItem = (): QuotationItem => ({
  id: generateId(),
  description: "",
  quantity: 1,
  rate: 0,
  taxRate: 0,
});

const STATUS_STYLES: Record<QuotationStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-indigo/10 text-indigo",
  accepted: "bg-emerald-100 text-emerald-700",
  declined: "bg-red-100 text-red-600",
};

export function QuotationGeneratorTool() {
  const workspace = useWorkspaceConnection("quotation-generator");
  const { t } = useI18n();
  const { items: quotations, save, remove } = useEntityList<Quotation>("quotations");

  const [number, setNumber] = useState(`QUO-${String(Date.now()).slice(-5)}`);
  const [date, setDate] = useState(todayIso());
  const [validUntil, setValidUntil] = useState(plusDays(15));
  const [customerId, setCustomerId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [items, setItems] = useState<QuotationItem[]>([blankItem()]);
  const [notes, setNotes] = useState("");
  const [deleting, setDeleting] = useState<Quotation | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);

  const biz = workspace.business;
  const currency = biz?.currency ?? "INR";
  const symbol = currencySymbol(currency);

  const totals = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;
    for (const item of items) {
      const line = (item.quantity || 0) * (item.rate || 0);
      subtotal += line;
      taxTotal += line * ((item.taxRate || 0) / 100);
    }
    return { subtotal, taxTotal, total: subtotal + taxTotal };
  }, [items]);

  const validItems = items.filter((i) => i.description.trim() && i.quantity > 0);
  const canSave = clientName.trim() && validItems.length > 0;

  const pickCustomer = (id: string) => {
    setCustomerId(id);
    const c = workspace.customers.find((x) => x.id === id);
    if (c) {
      setClientName(c.name);
      setClientPhone(c.phone);
      setClientAddress(c.address);
    }
  };

  const pickProduct = (itemId: string, productId: string) => {
    const p = workspace.products.find((x) => x.id === productId);
    if (!p) return;
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, description: p.name, rate: p.sellingPrice, taxRate: p.taxRate ?? 0 }
          : i
      )
    );
  };

  const updateItem = (id: string, patch: Partial<QuotationItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const buildQuotation = (): Quotation => ({
    id: generateId(),
    number: number.trim() || `QUO-${String(Date.now()).slice(-5)}`,
    date,
    validUntil,
    clientName: clientName.trim(),
    clientPhone: clientPhone.trim(),
    clientAddress: clientAddress.trim(),
    customerId: customerId || null,
    items: validItems,
    notes: notes.trim(),
    subtotal: totals.subtotal,
    taxTotal: totals.taxTotal,
    total: totals.total,
    status: "draft",
    createdByTool: "quotation-generator",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  const saveQuote = async () => {
    if (!canSave) return;
    await save(buildQuotation());
    setSavedMsg(true);
  };

  const printQuote = (q?: Quotation) => {
    const quote = q ?? buildQuotation();
    const money = (v: number) => formatMoney(v, currency);
    const rows = quote.items
      .map(
        (i, n) => `<tr>
          <td class="c">${n + 1}</td>
          <td>${esc(i.description)}</td>
          <td class="r">${i.quantity}</td>
          <td class="r">${money(i.rate)}</td>
          <td class="r">${i.taxRate ? i.taxRate + "%" : "—"}</td>
          <td class="r">${money(i.quantity * i.rate * (1 + i.taxRate / 100))}</td>
        </tr>`
      )
      .join("");

    const html = `<!doctype html><html><head><title>${esc(quote.number)}</title><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Georgia, "Times New Roman", serif; color: #1a1a2e; padding: 0; }
      @page { size: A4; margin: 0; }
      .band { background: #26306B; color: #fff; padding: 28px 40px; display: flex; justify-content: space-between; align-items: flex-start; }
      .band h1 { font-size: 26px; letter-spacing: 4px; font-weight: normal; }
      .band .no { margin-top: 6px; font-size: 12px; opacity: .85; }
      .band .biz { text-align: right; font-size: 12px; line-height: 1.5; }
      .band .biz .bn { font-size: 16px; font-weight: bold; }
      .wrap { padding: 28px 40px; }
      .meta { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
      .meta .to { font-size: 13px; line-height: 1.6; }
      .meta .to .lbl, .dates .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #8a8a9a; }
      .meta .to .cn { font-weight: bold; font-size: 15px; }
      .dates { text-align: right; font-size: 13px; line-height: 1.7; }
      .valid { display: inline-block; margin-top: 6px; border: 1px solid #26306B; color: #26306B; padding: 3px 10px; border-radius: 999px; font-size: 11px; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #8a8a9a; border-bottom: 2px solid #26306B; padding: 8px 6px; }
      td { padding: 9px 6px; border-bottom: 1px solid #e8e8ee; vertical-align: top; }
      .r { text-align: right; } .c { text-align: center; color: #8a8a9a; }
      th.r { text-align: right; }
      .totals { margin-top: 16px; margin-left: auto; width: 260px; font-size: 13px; }
      .totals div { display: flex; justify-content: space-between; padding: 5px 6px; }
      .totals .grand { border-top: 2px solid #26306B; margin-top: 4px; padding-top: 9px; font-size: 16px; font-weight: bold; color: #26306B; }
      .notes { margin-top: 28px; font-size: 12px; color: #55556a; line-height: 1.6; }
      .notes .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #8a8a9a; margin-bottom: 4px; }
      .foot { margin-top: 36px; padding-top: 12px; border-top: 1px solid #e8e8ee; font-size: 11px; color: #8a8a9a; display: flex; justify-content: space-between; }
    </style></head><body>
      <div class="band">
        <div>
          <h1>QUOTATION</h1>
          <p class="no">${esc(quote.number)}</p>
        </div>
        <div class="biz">
          <p class="bn">${esc(biz?.name ?? "")}</p>
          <p>${esc(biz?.address ?? "")}</p>
          <p>${esc([biz?.phone, biz?.email].filter(Boolean).join(" · ") ?? "")}</p>
          ${biz?.taxNumber ? `<p>GSTIN: ${esc(biz.taxNumber)}</p>` : ""}
        </div>
      </div>
      <div class="wrap">
        <div class="meta">
          <div class="to">
            <p class="lbl">Quotation for</p>
            <p class="cn">${esc(quote.clientName)}</p>
            ${quote.clientAddress ? `<p>${esc(quote.clientAddress)}</p>` : ""}
            ${quote.clientPhone ? `<p>${esc(quote.clientPhone)}</p>` : ""}
          </div>
          <div class="dates">
            <p><span class="lbl">Date</span>&nbsp; ${esc(quote.date)}</p>
            <span class="valid">Valid until ${esc(quote.validUntil)}</span>
          </div>
        </div>
        <table>
          <thead><tr><th>#</th><th>Description</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Tax</th><th class="r">Amount</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="totals">
          <div><span>Subtotal</span><span>${money(quote.subtotal)}</span></div>
          <div><span>Tax</span><span>${money(quote.taxTotal)}</span></div>
          <div class="grand"><span>Total</span><span>${money(quote.total)}</span></div>
        </div>
        ${quote.notes ? `<div class="notes"><p class="lbl">Notes & terms</p><p>${esc(quote.notes)}</p></div>` : ""}
        <div class="foot">
          <span>This is a quotation, not a tax invoice.</span>
          <span>${esc(biz?.name ?? "")}</span>
        </div>
      </div>
      <script>window.onload = () => window.print();</script>
    </body></html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  const setStatus = async (q: Quotation, status: QuotationStatus) =>
    save({ ...q, status, updatedAt: nowIso() });

  const sorted = [...quotations].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div>
      <WorkspaceBanner
        connection={workspace}
        message="Auto-fill your business details and pick saved customers and products."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="h-fit">
          <h2 className="mb-4 text-lg font-bold text-ink">New quotation</h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Quote number">
              <TextInput value={number} onChange={(e) => setNumber(e.target.value)} />
            </Field>
            <Field label={t("date")}>
              <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={t("validUntil")}>
              <TextInput
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </Field>
          </div>

          <h3 className="mb-2 mt-5 text-sm font-bold text-ink">Client</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {workspace.connected && workspace.customers.length > 0 ? (
              <Field label="Pick a saved customer">
                <Select value={customerId} onChange={(e) => pickCustomer(e.target.value)}>
                  <option value="">Type details below…</option>
                  {workspace.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label="Client name *">
              <TextInput
                value={clientName}
                onChange={(e) => {
                  setClientName(e.target.value);
                  setCustomerId("");
                }}
              />
            </Field>
            <Field label={t("phone")}>
              <TextInput value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
            </Field>
            <Field label={t("address")}>
              <TextInput value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} />
            </Field>
          </div>

          <h3 className="mb-2 mt-5 text-sm font-bold text-ink">Items</h3>
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-2 items-end gap-2 rounded-lg border border-muted-line/30 p-3 sm:grid-cols-[1fr_1fr_70px_100px_80px_auto]"
              >
                {workspace.connected && workspace.products.length > 0 ? (
                  <Field label={t("product")}>
                    <Select value="" onChange={(e) => e.target.value && pickProduct(item.id, e.target.value)}>
                      <option value="">Choose…</option>
                      {workspace.products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
                <Field label={t("description")}>
                  <TextInput
                    value={item.description}
                    onChange={(e) => updateItem(item.id, { description: e.target.value })}
                  />
                </Field>
                <Field label={t("quantity")}>
                  <NumberInput
                    min={0}
                    value={item.quantity || ""}
                    onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) || 0 })}
                  />
                </Field>
                <Field label={`${t("rate")} (${symbol})`}>
                  <NumberInput
                    min={0}
                    step="0.01"
                    value={item.rate || ""}
                    onChange={(e) => updateItem(item.id, { rate: Number(e.target.value) || 0 })}
                  />
                </Field>
                <Field label="Tax %">
                  <NumberInput
                    min={0}
                    value={item.taxRate || ""}
                    onChange={(e) => updateItem(item.id, { taxRate: Number(e.target.value) || 0 })}
                  />
                </Field>
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
                  disabled={items.length === 1}
                  className="mb-1 justify-self-end text-sm font-semibold text-red-500 hover:text-red-600 disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <SecondaryButton className="mt-3" onClick={() => setItems((p) => [...p, blankItem()])}>
            {t("addItem")}
          </SecondaryButton>

          <div className="mt-4">
            <Field label="Notes & terms">
              <TextArea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. 50% advance, delivery within 7 days, prices valid till date above."
              />
            </Field>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-muted-line/30 pt-4">
            <div className="text-sm text-muted">
              {formatMoney(totals.subtotal, currency)} + {formatMoney(totals.taxTotal, currency)}{" "}
              = <span className="text-lg font-bold text-ink">{t("total")}{" "}
                {formatMoney(totals.total, currency)}
              </span>
            </div>
            <div className="flex gap-2">
              <SecondaryButton onClick={() => printQuote()} disabled={!canSave}>
                Print / PDF
              </SecondaryButton>
              <PrimaryButton onClick={saveQuote} disabled={!canSave}>
                Save quotation
              </PrimaryButton>
            </div>
          </div>
          {savedMsg ? <p className="mt-2 text-sm font-medium text-emerald-600">Quotation saved ✓</p> : null}
        </Card>

        <Card className="h-fit">
          <h2 className="mb-4 text-lg font-bold text-ink">Saved quotations</h2>
          {sorted.length === 0 ? (
            <EmptyState
              title="No quotations yet"
              subtitle="Saved quotes appear here with their status — draft, sent, accepted or declined."
            />
          ) : (
            <div className="space-y-3">
              {sorted.slice(0, 20).map((q) => (
                <div key={q.id} className="rounded-lg border border-muted-line/30 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-ink">{q.number}</p>
                      <p className="text-xs text-muted">
                        {q.clientName} · {q.date}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[q.status]}`}
                    >
                      {q.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-ink">{formatMoney(q.total, currency)}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                    <button type="button" className="text-indigo" onClick={() => printQuote(q)}>
                      {t("print")}
                    </button>
                    {q.status === "draft" ? (
                      <button type="button" className="text-indigo" onClick={() => setStatus(q, "sent")}>
                        Mark sent
                      </button>
                    ) : null}
                    {q.status === "sent" ? (
                      <>
                        <button
                          type="button"
                          className="text-emerald-600"
                          onClick={() => setStatus(q, "accepted")}
                        >
                          Accepted
                        </button>
                        <button
                          type="button"
                          className="text-red-500"
                          onClick={() => setStatus(q, "declined")}
                        >
                          Declined
                        </button>
                      </>
                    ) : null}
                    <button type="button" className="text-red-500" onClick={() => setDeleting(q)}>
                      {t("delete")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete quotation?"
        message={deleting ? `Delete ${deleting.number} for ${deleting.clientName}?` : ""}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (deleting) await remove(deleting.id);
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
