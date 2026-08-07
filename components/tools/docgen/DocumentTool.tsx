"use client";

// Shared engine for the accounting document generators — Credit Note, Debit
// Note, Purchase Order and Sales Order. One form + print pipeline, configured
// per document type. Business details autofill from the shared Business
// Profile; customers/suppliers/products are picked from the workspace (with
// consent). Saved documents live in the shared `documents` store, so every
// document tool sees the same history. Printing opens the browser's
// print-to-PDF dialog.

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
import { useFinanceWorkspace } from "@/lib/hooks/useFinanceWorkspace";
import { useEntityList } from "@/lib/hooks/useEntityList";
import { currencySymbol, formatMoney, generateId, nowIso } from "@/lib/pos/types";
import { toCsv, downloadCsv } from "@/lib/pos/csv";
import type { ToolSlug } from "@/lib/toolkit/registry";

export type DocType = "credit-note" | "debit-note" | "purchase-order" | "sales-order";

type PartyKind = "customer" | "supplier";

type DocConfig = {
  slug: ToolSlug;
  printTitle: string;
  numberPrefix: string;
  partyKind: PartyKind;
  partyLabel: string;
  refLabel: string | null;
  reasonLabel: string | null;
  /** Common reasons offered as quick-picks (credit/debit notes). */
  reasonOptions?: string[];
  secondDateLabel: string | null;
  footerNote: string;
  accent: string;
  workspaceMsg: string;
};

/** Units offered on line items (matches common billing practice). */
const UNITS = ["Pcs", "Kg", "g", "L", "ml", "m", "Box", "Dozen", "Hours", "Days", "Service"];

const CONFIGS: Record<DocType, DocConfig> = {
  "credit-note": {
    slug: "credit-note-generator",
    printTitle: "CREDIT NOTE",
    numberPrefix: "CN",
    partyKind: "customer",
    partyLabel: "Customer",
    refLabel: "Against invoice no.",
    reasonLabel: "Reason (return / adjustment)",
    reasonOptions: [
      "Return of goods",
      "Pricing error",
      "Duplicate payment",
      "Post-sale discount",
      "Damaged in transit",
      "Goodwill adjustment",
    ],
    secondDateLabel: null,
    footerNote: "This credit note adjusts the referenced invoice.",
    accent: "#166534",
    workspaceMsg: "Autofill your business details and pick a saved customer and products.",
  },
  "debit-note": {
    slug: "debit-note-generator",
    printTitle: "DEBIT NOTE",
    numberPrefix: "DN",
    partyKind: "supplier",
    partyLabel: "Supplier",
    refLabel: "Against bill / invoice no.",
    reasonLabel: "Reason (return / short supply / rate difference)",
    reasonOptions: [
      "Goods returned",
      "Short delivery",
      "Damaged goods",
      "Rate difference / overcharge",
      "Quality issue",
      "Wrong items supplied",
    ],
    secondDateLabel: null,
    footerNote: "This debit note is issued against the referenced purchase.",
    accent: "#9a3412",
    workspaceMsg: "Autofill your business details and pick a saved supplier and products.",
  },
  "purchase-order": {
    slug: "purchase-order-generator",
    printTitle: "PURCHASE ORDER",
    numberPrefix: "PO",
    partyKind: "supplier",
    partyLabel: "Supplier",
    refLabel: "Quotation ref (optional)",
    reasonLabel: null,
    secondDateLabel: "Expected delivery date",
    footerNote: "Please confirm acceptance of this purchase order and the delivery date.",
    accent: "#26306B",
    workspaceMsg: "Autofill your business details and pick a saved supplier and products.",
  },
  "sales-order": {
    slug: "sales-order-generator",
    printTitle: "SALES ORDER",
    numberPrefix: "SO",
    partyKind: "customer",
    partyLabel: "Customer",
    refLabel: "Customer PO ref (optional)",
    reasonLabel: null,
    secondDateLabel: "Expected delivery date",
    footerNote: "This sales order confirms the items and prices agreed before dispatch.",
    accent: "#26306B",
    workspaceMsg: "Autofill your business details and pick a saved customer and products.",
  },
};

type LineItem = {
  id: string;
  description: string;
  unit?: string;
  quantity: number;
  rate: number;
  taxRate: number;
};

type SavedDoc = {
  id: string;
  docType: DocType;
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
  /** Flat discount applied after the subtotal (older records lack it). */
  discount?: number;
  taxTotal: number;
  total: number;
  createdByTool: ToolSlug;
  createdAt: string;
};

const blankItem = (): LineItem => ({
  id: generateId(),
  description: "",
  unit: "Pcs",
  quantity: 1,
  rate: 0,
  taxRate: 0,
});

const todayIso = () => new Date().toISOString().split("T")[0];

export function DocumentTool({ docType }: { docType: DocType }) {
  const cfg = CONFIGS[docType];
  const workspace = useFinanceWorkspace(cfg.slug);
  const { items: allDocs, save, remove } = useEntityList<SavedDoc>("documents");

  const biz = workspace.business;
  const currency = biz?.currency ?? "INR";
  const symbol = currencySymbol(currency);

  const [number, setNumber] = useState(`${cfg.numberPrefix}-${String(Date.now()).slice(-5)}`);
  const [date, setDate] = useState(todayIso());
  const [secondDate, setSecondDate] = useState("");
  const [partyId, setPartyId] = useState("");
  const [partyName, setPartyName] = useState("");
  const [partyAddress, setPartyAddress] = useState("");
  const [partyGstin, setPartyGstin] = useState("");
  const [refNumber, setRefNumber] = useState("");
  const [reason, setReason] = useState("");
  const [items, setItems] = useState<LineItem[]>([blankItem()]);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [savedMsg, setSavedMsg] = useState(false);
  const [deleting, setDeleting] = useState<SavedDoc | null>(null);

  const savedDocs = useMemo(
    () =>
      allDocs
        .filter((d) => d.docType === docType)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [allDocs, docType]
  );

  const totals = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;
    for (const item of items) {
      const line = (item.quantity || 0) * (item.rate || 0);
      subtotal += line;
      taxTotal += line * ((item.taxRate || 0) / 100);
    }
    const disc = Math.min(discount || 0, subtotal);
    return { subtotal, discount: disc, taxTotal, total: subtotal - disc + taxTotal };
  }, [items, discount]);

  const validItems = items.filter((i) => i.description.trim() && i.quantity > 0);
  const canSave = partyName.trim().length > 0 && validItems.length > 0;

  const pickParty = (id: string) => {
    setPartyId(id);
    if (cfg.partyKind === "customer") {
      const c = workspace.customers.find((x) => x.id === id);
      if (c) {
        setPartyName(c.name);
        setPartyAddress(c.address);
      }
    } else {
      const s = workspace.suppliers.find((x) => x.id === id);
      if (s) {
        setPartyName(s.name);
        setPartyAddress(s.address);
        setPartyGstin(s.gstin);
      }
    }
  };

  const pickProduct = (itemId: string, productId: string) => {
    const p = workspace.products.find((x) => x.id === productId);
    if (!p) return;
    const rate = cfg.partyKind === "supplier" ? p.costPrice ?? p.sellingPrice : p.sellingPrice;
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, description: p.name, rate: rate ?? 0, taxRate: p.taxRate ?? 0 }
          : i
      )
    );
  };

  const updateItem = (id: string, patch: Partial<LineItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const buildDoc = (): SavedDoc => ({
    id: generateId(),
    docType,
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
    discount: totals.discount,
    taxTotal: totals.taxTotal,
    total: totals.total,
    createdByTool: cfg.slug,
    createdAt: nowIso(),
  });

  const saveDoc = () => {
    if (!canSave) return;
    void save(buildDoc());
    setSavedMsg(true);
  };

  /** Clear the form for a fresh document (business details stay). */
  const resetForm = () => {
    setNumber(`${cfg.numberPrefix}-${String(Date.now()).slice(-5)}`);
    setDate(todayIso());
    setSecondDate("");
    setPartyId("");
    setPartyName("");
    setPartyAddress("");
    setPartyGstin("");
    setRefNumber("");
    setReason("");
    setItems([blankItem()]);
    setDiscount(0);
    setNotes("");
    setSavedMsg(false);
  };

  /** Export the current document as CSV (opens in Excel / Google Sheets). */
  const exportCsv = () => {
    const d = buildDoc();
    const rows: unknown[][] = [
      ["Date", d.date],
      [cfg.partyLabel, d.partyName],
      ...(d.refNumber ? [["Ref", d.refNumber]] : []),
      ...(d.reason ? [["Reason", d.reason]] : []),
      [],
      ["#", "Description", "Unit", "Qty", "Rate", "Tax %", "Amount"],
      ...d.items.map((i, n) => [
        n + 1,
        i.description,
        i.unit ?? "",
        i.quantity,
        i.rate.toFixed(2),
        i.taxRate || 0,
        (i.quantity * i.rate * (1 + i.taxRate / 100)).toFixed(2),
      ]),
      [],
      ["Subtotal", d.subtotal.toFixed(2)],
      ...(d.discount ? [["Discount", `-${d.discount.toFixed(2)}`]] : []),
      ["Tax", d.taxTotal.toFixed(2)],
      ["Total", d.total.toFixed(2)],
    ];
    downloadCsv(`${d.number}.csv`, toCsv([cfg.printTitle, d.number], rows));
  };

  const printDoc = (doc?: SavedDoc) => {
    const d = doc ?? buildDoc();
    const money = (v: number) => formatMoney(v, currency);
    const rows = d.items
      .map(
        (i, n) => `<tr>
          <td class="c">${n + 1}</td>
          <td>${esc(i.description)}</td>
          <td class="r">${i.quantity}${i.unit ? " " + esc(i.unit) : ""}</td>
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
          <p class="bn">${esc(biz?.name ?? "")}</p>
          ${biz?.address ? `<p>${esc(biz.address)}</p>` : ""}
          ${biz?.phone ? `<p>${esc(biz.phone)}</p>` : ""}
          ${biz?.taxNumber ? `<p>GSTIN: ${esc(biz.taxNumber)}</p>` : ""}
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
          ${d.discount ? `<div><span>Discount</span><span>−${money(d.discount)}</span></div>` : ""}
          <div><span>Tax</span><span>${money(d.taxTotal)}</span></div>
          <div class="grand"><span>Total</span><span>${money(d.total)}</span></div>
        </div>
        ${d.notes ? `<div class="notes"><p class="lbl">Notes & terms</p><p>${esc(d.notes)}</p></div>` : ""}
        <div class="sign"><div class="box"><div class="line"></div>Authorised signatory</div></div>
        <div class="foot">
          <span>${esc(cfg.footerNote)}</span>
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

  const partyOptions = cfg.partyKind === "customer" ? workspace.customers : workspace.suppliers;

  return (
    <div>
      <WorkspaceBanner connection={workspace} message={cfg.workspaceMsg} />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="h-fit">
          {biz ? (
            <div className="mb-5 rounded-xl bg-cream-paper/60 px-4 py-3 text-sm">
              <span className="text-muted">Issuing as </span>
              <span className="font-semibold text-ink">{biz.name || "your business"}</span>
              {biz.taxNumber ? <span className="text-muted"> · GSTIN {biz.taxNumber}</span> : null}
            </div>
          ) : (
            <div className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Set up your{" "}
              <a href="/tools/business-profile" className="font-semibold underline">
                Business Profile
              </a>{" "}
              once to put your name, address and GSTIN on every document automatically.
            </div>
          )}

          <h2 className="mb-4 text-lg font-bold text-ink">Document details</h2>
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
            {workspace.connected && partyOptions.length > 0 ? (
              <Field label={`Pick a saved ${cfg.partyLabel.toLowerCase()}`}>
                <Select value={partyId} onChange={(e) => pickParty(e.target.value)}>
                  <option value="">Type details below…</option>
                  {partyOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label={`${cfg.partyLabel} name *`}>
              <TextInput
                value={partyName}
                onChange={(e) => {
                  setPartyName(e.target.value);
                  setPartyId("");
                }}
              />
            </Field>
            <Field label="Address">
              <TextInput value={partyAddress} onChange={(e) => setPartyAddress(e.target.value)} />
            </Field>
            <Field label="GSTIN (optional)">
              <TextInput value={partyGstin} onChange={(e) => setPartyGstin(e.target.value)} />
            </Field>
          </div>

          {cfg.reasonLabel ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Common reasons">
                <Select value="" onChange={(e) => e.target.value && setReason(e.target.value)}>
                  <option value="">Pick a reason…</option>
                  {(cfg.reasonOptions ?? []).map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={cfg.reasonLabel}>
                <TextInput
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Or type your own reason"
                />
              </Field>
            </div>
          ) : null}

          <h3 className="mb-2 mt-5 text-sm font-bold text-ink">Items</h3>
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-2 items-end gap-2 rounded-lg border border-muted-line/30 p-3 sm:grid-cols-[1fr_1fr_90px_70px_100px_70px_auto]"
              >
                {workspace.connected && workspace.products.length > 0 ? (
                  <Field label="Product">
                    <Select
                      value=""
                      onChange={(e) => e.target.value && pickProduct(item.id, e.target.value)}
                    >
                      <option value="">Choose…</option>
                      {workspace.products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
                <Field label="Description">
                  <TextInput
                    value={item.description}
                    onChange={(e) => updateItem(item.id, { description: e.target.value })}
                  />
                </Field>
                <Field label="Unit">
                  <Select
                    value={item.unit ?? "Pcs"}
                    onChange={(e) => updateItem(item.id, { unit: e.target.value })}
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </Select>
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

          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_180px]">
            <Field label="Notes & terms">
              <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <Field label={`Discount (${symbol})`}>
              <NumberInput
                min={0}
                step="0.01"
                value={discount || ""}
                onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                placeholder="0.00"
              />
            </Field>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-muted-line/30 pt-4">
            <div className="text-sm text-muted">
              {formatMoney(totals.subtotal, currency)}
              {totals.discount > 0 ? ` − ${formatMoney(totals.discount, currency)} discount` : ""} +{" "}
              {formatMoney(totals.taxTotal, currency)} tax ={" "}
              <span className="text-lg font-bold text-ink">{formatMoney(totals.total, currency)}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <SecondaryButton onClick={resetForm}>Reset</SecondaryButton>
              <SecondaryButton onClick={exportCsv} disabled={!canSave}>
                Export CSV
              </SecondaryButton>
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
          {savedDocs.length === 0 ? (
            <EmptyState
              title="Nothing saved yet"
              subtitle="Documents you save appear here — stored in your private workspace on this device, never uploaded."
            />
          ) : (
            <div className="space-y-3">
              {savedDocs.slice(0, 20).map((docItem) => (
                <div key={docItem.id} className="rounded-lg border border-muted-line/30 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-ink">{docItem.number}</p>
                      <p className="text-xs text-muted">
                        {docItem.partyName} · {docItem.date}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-ink">
                      {formatMoney(docItem.total, currency)}
                    </p>
                  </div>
                  <div className="mt-2 flex gap-3 text-xs font-semibold">
                    <button type="button" className="text-indigo" onClick={() => printDoc(docItem)}>
                      Print
                    </button>
                    <button
                      type="button"
                      className="text-red-500"
                      onClick={() => setDeleting(docItem)}
                    >
                      Delete
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
        title="Delete document?"
        message={deleting ? `Delete ${deleting.number} for ${deleting.partyName}?` : ""}
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleting) void remove(deleting.id);
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
