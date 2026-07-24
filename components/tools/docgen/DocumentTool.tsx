"use client";

// Shared engine for the accounting document generators — Credit Note, Debit
// Note, Purchase Order and Sales Order. One form + print pipeline, configured
// per document type. Everything stays in localStorage; printing opens the
// browser's print-to-PDF dialog.

import { useMemo, useState } from "react";
import {
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  NumberInput,
  PrimaryButton,
  SecondaryButton,
  TextArea,
  TextInput,
} from "@/components/toolkit/ui";
import { useLocalStore, generateLocalId } from "@/lib/hooks/useLocalStore";
import { currencySymbol, formatMoney } from "@/lib/pos/types";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";

export type DocType = "credit-note" | "debit-note" | "purchase-order" | "sales-order";

type DocConfig = {
  printTitle: string;
  numberPrefix: string;
  partyLabel: string;
  refLabel: string | null;
  reasonLabel: string | null;
  secondDateLabel: string | null;
  footerNote: string;
  accent: string;
};

const CONFIGS: Record<DocType, DocConfig> = {
  "credit-note": {
    printTitle: "CREDIT NOTE",
    numberPrefix: "CN",
    partyLabel: "Customer",
    refLabel: "Against invoice no.",
    reasonLabel: "Reason (return / adjustment)",
    secondDateLabel: null,
    footerNote: "This credit note adjusts the referenced invoice.",
    accent: "#166534",
  },
  "debit-note": {
    printTitle: "DEBIT NOTE",
    numberPrefix: "DN",
    partyLabel: "Supplier",
    refLabel: "Against bill / invoice no.",
    reasonLabel: "Reason (return / short supply / rate difference)",
    secondDateLabel: null,
    footerNote: "This debit note is issued against the referenced purchase.",
    accent: "#9a3412",
  },
  "purchase-order": {
    printTitle: "PURCHASE ORDER",
    numberPrefix: "PO",
    partyLabel: "Supplier",
    refLabel: "Quotation ref (optional)",
    reasonLabel: null,
    secondDateLabel: "Expected delivery date",
    footerNote: "Please confirm acceptance of this purchase order and the delivery date.",
    accent: "#26306B",
  },
  "sales-order": {
    printTitle: "SALES ORDER",
    numberPrefix: "SO",
    partyLabel: "Customer",
    refLabel: "Customer PO ref (optional)",
    reasonLabel: null,
    secondDateLabel: "Expected delivery date",
    footerNote: "This sales order confirms the items and prices agreed before dispatch.",
    accent: "#26306B",
  },
};

type LineItem = { id: string; description: string; quantity: number; rate: number; taxRate: number };

type SavedDoc = {
  id: string;
  number: string;
  date: string;
  secondDate: string;
  partyName: string;
  partyAddress: string;
  partyGstin: string;
  refNumber: string;
  reason: string;
  items: LineItem[];
  notes: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  createdAt: string;
};

type BusinessInfo = { name: string; address: string; phone: string; gstin: string };

const blankItem = (): LineItem => ({
  id: generateLocalId(),
  description: "",
  quantity: 1,
  rate: 0,
  taxRate: 0,
});

const todayIso = () => new Date().toISOString().split("T")[0];

export function DocumentTool({ docType }: { docType: DocType }) {
  const cfg = CONFIGS[docType];
  const { code: currency, symbol } = usePreferredCurrency();

  const [business, setBusiness] = useLocalStore<BusinessInfo>("setu-doc-business", {
    name: "",
    address: "",
    phone: "",
    gstin: "",
  });
  const [saved, setSaved] = useLocalStore<SavedDoc[]>(`setu-doc-${docType}`, []);

  const [number, setNumber] = useState(`${cfg.numberPrefix}-${String(Date.now()).slice(-5)}`);
  const [date, setDate] = useState(todayIso());
  const [secondDate, setSecondDate] = useState("");
  const [partyName, setPartyName] = useState("");
  const [partyAddress, setPartyAddress] = useState("");
  const [partyGstin, setPartyGstin] = useState("");
  const [refNumber, setRefNumber] = useState("");
  const [reason, setReason] = useState("");
  const [items, setItems] = useState<LineItem[]>([blankItem()]);
  const [notes, setNotes] = useState("");
  const [savedMsg, setSavedMsg] = useState(false);
  const [deleting, setDeleting] = useState<SavedDoc | null>(null);

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
  const canSave = partyName.trim().length > 0 && validItems.length > 0;

  const updateItem = (id: string, patch: Partial<LineItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const buildDoc = (): SavedDoc => ({
    id: generateLocalId(),
    number: number.trim() || `${cfg.numberPrefix}-${String(Date.now()).slice(-5)}`,
    date,
    secondDate,
    partyName: partyName.trim(),
    partyAddress: partyAddress.trim(),
    partyGstin: partyGstin.trim(),
    refNumber: refNumber.trim(),
    reason: reason.trim(),
    items: validItems,
    notes: notes.trim(),
    subtotal: totals.subtotal,
    taxTotal: totals.taxTotal,
    total: totals.total,
    createdAt: new Date().toISOString(),
  });

  const saveDoc = () => {
    if (!canSave) return;
    setSaved((prev) => [buildDoc(), ...prev].slice(0, 50));
    setSavedMsg(true);
  };

  const printDoc = (doc?: SavedDoc) => {
    const d = doc ?? buildDoc();
    const money = (v: number) => formatMoney(v, currency);
    const rows = d.items
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

    const html = `<!doctype html><html><head><title>${esc(d.number)}</title><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Georgia, "Times New Roman", serif; color: #1a1a2e; }
      @page { size: A4; margin: 0; }
      .band { background: ${cfg.accent}; color: #fff; padding: 28px 40px; display: flex; justify-content: space-between; align-items: flex-start; }
      .band h1 { font-size: 24px; letter-spacing: 4px; font-weight: normal; }
      .band .no { margin-top: 6px; font-size: 12px; opacity: .85; }
      .band .biz { text-align: right; font-size: 12px; line-height: 1.5; }
      .band .biz .bn { font-size: 16px; font-weight: bold; }
      .wrap { padding: 28px 40px; }
      .meta { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
      .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #8a8a9a; }
      .to { font-size: 13px; line-height: 1.6; }
      .to .cn { font-weight: bold; font-size: 15px; }
      .dates { text-align: right; font-size: 13px; line-height: 1.7; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #8a8a9a; border-bottom: 2px solid ${cfg.accent}; padding: 8px 6px; }
      td { padding: 9px 6px; border-bottom: 1px solid #e8e8ee; vertical-align: top; }
      .r { text-align: right; } .c { text-align: center; color: #8a8a9a; }
      th.r { text-align: right; }
      .totals { margin-top: 16px; margin-left: auto; width: 260px; font-size: 13px; }
      .totals div { display: flex; justify-content: space-between; padding: 5px 6px; }
      .totals .grand { border-top: 2px solid ${cfg.accent}; margin-top: 4px; padding-top: 9px; font-size: 16px; font-weight: bold; color: ${cfg.accent}; }
      .notes { margin-top: 28px; font-size: 12px; color: #55556a; line-height: 1.6; }
      .notes .lbl { margin-bottom: 4px; }
      .foot { margin-top: 36px; padding-top: 12px; border-top: 1px solid #e8e8ee; font-size: 11px; color: #8a8a9a; display: flex; justify-content: space-between; }
      .sign { margin-top: 48px; display: flex; justify-content: flex-end; }
      .sign .box { text-align: center; font-size: 11px; color: #55556a; }
      .sign .line { width: 200px; border-top: 1px solid #8a8a9a; margin-bottom: 4px; margin-top: 40px; }
    </style></head><body>
      <div class="band">
        <div>
          <h1>${cfg.printTitle}</h1>
          <p class="no">${esc(d.number)}</p>
        </div>
        <div class="biz">
          <p class="bn">${esc(business.name)}</p>
          ${business.address ? `<p>${esc(business.address)}</p>` : ""}
          ${business.phone ? `<p>${esc(business.phone)}</p>` : ""}
          ${business.gstin ? `<p>GSTIN: ${esc(business.gstin)}</p>` : ""}
        </div>
      </div>
      <div class="wrap">
        <div class="meta">
          <div class="to">
            <p class="lbl">${esc(cfg.partyLabel)}</p>
            <p class="cn">${esc(d.partyName)}</p>
            ${d.partyAddress ? `<p>${esc(d.partyAddress)}</p>` : ""}
            ${d.partyGstin ? `<p>GSTIN: ${esc(d.partyGstin)}</p>` : ""}
          </div>
          <div class="dates">
            <p><span class="lbl">Date</span>&nbsp; ${esc(d.date)}</p>
            ${cfg.secondDateLabel && d.secondDate ? `<p><span class="lbl">${esc(cfg.secondDateLabel)}</span>&nbsp; ${esc(d.secondDate)}</p>` : ""}
            ${d.refNumber ? `<p><span class="lbl">Ref</span>&nbsp; ${esc(d.refNumber)}</p>` : ""}
          </div>
        </div>
        ${d.reason ? `<div class="notes" style="margin-top:0;margin-bottom:20px"><p class="lbl">Reason</p><p>${esc(d.reason)}</p></div>` : ""}
        <table>
          <thead><tr><th>#</th><th>Description</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Tax</th><th class="r">Amount</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="totals">
          <div><span>Subtotal</span><span>${money(d.subtotal)}</span></div>
          <div><span>Tax</span><span>${money(d.taxTotal)}</span></div>
          <div class="grand"><span>Total</span><span>${money(d.total)}</span></div>
        </div>
        ${d.notes ? `<div class="notes"><p class="lbl">Notes & terms</p><p>${esc(d.notes)}</p></div>` : ""}
        <div class="sign"><div class="box"><div class="line"></div>Authorised signatory</div></div>
        <div class="foot">
          <span>${esc(cfg.footerNote)}</span>
          <span>${esc(business.name)}</span>
        </div>
      </div>
      <script>window.onload = () => window.print();</script>
    </body></html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card className="h-fit">
        <h2 className="mb-4 text-lg font-bold text-ink">Your business</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name">
            <TextInput
              value={business.name}
              onChange={(e) => setBusiness((b) => ({ ...b, name: e.target.value }))}
            />
          </Field>
          <Field label="Phone">
            <TextInput
              value={business.phone}
              onChange={(e) => setBusiness((b) => ({ ...b, phone: e.target.value }))}
            />
          </Field>
          <Field label="Address">
            <TextInput
              value={business.address}
              onChange={(e) => setBusiness((b) => ({ ...b, address: e.target.value }))}
            />
          </Field>
          <Field label="GSTIN (optional)">
            <TextInput
              value={business.gstin}
              onChange={(e) => setBusiness((b) => ({ ...b, gstin: e.target.value }))}
            />
          </Field>
        </div>

        <h2 className="mb-4 mt-6 text-lg font-bold text-ink">Document details</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Number">
            <TextInput value={number} onChange={(e) => setNumber(e.target.value)} />
          </Field>
          <Field label="Date">
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          {cfg.secondDateLabel ? (
            <Field label={cfg.secondDateLabel}>
              <TextInput
                type="date"
                value={secondDate}
                onChange={(e) => setSecondDate(e.target.value)}
              />
            </Field>
          ) : null}
          {cfg.refLabel ? (
            <Field label={cfg.refLabel}>
              <TextInput value={refNumber} onChange={(e) => setRefNumber(e.target.value)} />
            </Field>
          ) : null}
        </div>

        <h3 className="mb-2 mt-5 text-sm font-bold text-ink">{cfg.partyLabel}</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={`${cfg.partyLabel} name *`}>
            <TextInput value={partyName} onChange={(e) => setPartyName(e.target.value)} />
          </Field>
          <Field label="Address">
            <TextInput value={partyAddress} onChange={(e) => setPartyAddress(e.target.value)} />
          </Field>
          <Field label="GSTIN (optional)">
            <TextInput value={partyGstin} onChange={(e) => setPartyGstin(e.target.value)} />
          </Field>
        </div>

        {cfg.reasonLabel ? (
          <div className="mt-4">
            <Field label={cfg.reasonLabel}>
              <TextInput
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Goods returned, rate difference, damaged in transit"
              />
            </Field>
          </div>
        ) : null}

        <h3 className="mb-2 mt-5 text-sm font-bold text-ink">Items</h3>
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-2 items-end gap-2 rounded-lg border border-muted-line/30 p-3 sm:grid-cols-[1fr_80px_110px_80px_auto]"
            >
              <Field label="Description">
                <TextInput
                  value={item.description}
                  onChange={(e) => updateItem(item.id, { description: e.target.value })}
                />
              </Field>
              <Field label="Qty">
                <NumberInput
                  min={0}
                  value={item.quantity || ""}
                  onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label={`Rate (${symbol})`}>
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
          + Add item
        </SecondaryButton>

        <div className="mt-4">
          <Field label="Notes & terms">
            <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-muted-line/30 pt-4">
          <div className="text-sm text-muted">
            {formatMoney(totals.subtotal, currency)} + {formatMoney(totals.taxTotal, currency)} tax ={" "}
            <span className="text-lg font-bold text-ink">{formatMoney(totals.total, currency)}</span>
          </div>
          <div className="flex gap-2">
            <SecondaryButton onClick={() => printDoc()} disabled={!canSave}>
              Print / PDF
            </SecondaryButton>
            <PrimaryButton onClick={saveDoc} disabled={!canSave}>
              Save
            </PrimaryButton>
          </div>
        </div>
        {savedMsg ? <p className="mt-2 text-sm font-medium text-emerald-600">Saved ✓</p> : null}
      </Card>

      <Card className="h-fit">
        <h2 className="mb-4 text-lg font-bold text-ink">Saved documents</h2>
        {saved.length === 0 ? (
          <EmptyState
            title="Nothing saved yet"
            subtitle="Documents you save appear here — stored only in this browser, never uploaded."
          />
        ) : (
          <div className="space-y-3">
            {saved.slice(0, 20).map((docItem) => (
              <div key={docItem.id} className="rounded-lg border border-muted-line/30 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">{docItem.number}</p>
                    <p className="text-xs text-muted">
                      {docItem.partyName} · {docItem.date}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-ink">{formatMoney(docItem.total, currency)}</p>
                </div>
                <div className="mt-2 flex gap-3 text-xs font-semibold">
                  <button type="button" className="text-indigo" onClick={() => printDoc(docItem)}>
                    Print
                  </button>
                  <button type="button" className="text-red-500" onClick={() => setDeleting(docItem)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete document?"
        message={deleting ? `Delete ${deleting.number} for ${deleting.partyName}?` : ""}
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleting) setSaved((prev) => prev.filter((s) => s.id !== deleting.id));
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
