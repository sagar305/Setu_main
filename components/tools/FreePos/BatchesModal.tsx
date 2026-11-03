"use client";

// Batches panel for one product (shown only when batch tracking is on).
// Lists the product's batches earliest-expiry first, lets the owner correct a
// batch's number, expiry, cost or quantity (e.g. write off an expired batch by
// setting it to 0), and add a new batch of stock.

import { useEffect, useState } from "react";
import { usePos } from "@/lib/pos/store";
import { expiryStatus, sortFefo, type ExpiryStatus, type StockBatch } from "@/lib/pos/batches";
import { formatMoney, type Product } from "@/lib/pos/types";
import { Field, Modal, inputClass, primaryBtnClass, secondaryBtnClass } from "./ui";

const BADGE: Record<ExpiryStatus, { label: string; className: string } | null> = {
  expired: { label: "Expired", className: "bg-red-50 text-red-600" },
  soon: { label: "Expiring soon", className: "bg-saffron/15 text-ink" },
  ok: null,
  none: null,
};

export function ExpiryBadge({ expiry }: { expiry: string }) {
  const badge = BADGE[expiryStatus(expiry)];
  if (!badge) return null;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}>
      {badge.label}
    </span>
  );
}

function ReturnBadge({ batch }: { batch: StockBatch }) {
  if (!batch.returnBy || batch.quantity <= 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  const closed = batch.returnBy < today;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        closed ? "bg-cream-paper text-muted line-through" : "bg-indigo/10 text-indigo"
      }`}
      title="From the Purchase Register"
    >
      Returnable till {batch.returnBy}
      {batch.returnType ? ` · ${batch.returnType === "replacement" ? "replacement" : "credit note"}` : ""}
    </span>
  );
}

type Draft = {
  batchNo: string;
  expiry: string;
  cost: string;
  price: string;
  tax: string;
  inclusive: boolean;
  qty: string;
};

const EMPTY: Draft = { batchNo: "", expiry: "", cost: "", price: "", tax: "", inclusive: false, qty: "" };

/** "" = use the product's tax; otherwise 0–100. undefined = invalid. */
export function parseTax(text: string): number | null | undefined {
  if (text.trim() === "") return null;
  const n = parseFloat(text);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : undefined;
}

/** Tax % and inclusive/exclusive, shown next to a batch selling price. */
export function TaxFields({
  tax,
  inclusive,
  onTax,
  onInclusive,
  product,
}: {
  tax: string;
  inclusive: boolean;
  onTax: (v: string) => void;
  onInclusive: (v: boolean) => void;
  product: Product;
}) {
  return (
    <>
      <Field label="Tax %">
        <input
          type="number"
          min={0}
          max={100}
          step="0.01"
          value={tax}
          placeholder={product.taxRate === null ? "Default" : String(product.taxRate)}
          onChange={(e) => onTax(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Tax on price">
        <select
          value={inclusive ? "inclusive" : "exclusive"}
          onChange={(e) => onInclusive(e.target.value === "inclusive")}
          className={inputClass}
        >
          <option value="exclusive">Added on top (exclusive)</option>
          <option value="inclusive">Included in price (inclusive)</option>
        </select>
      </Field>
    </>
  );
}

const draftOf = (b: StockBatch): Draft => ({
  batchNo: b.batchNo,
  expiry: b.expiry,
  cost: b.costPrice === null ? "" : String(b.costPrice),
  price: b.sellingPrice == null ? "" : String(b.sellingPrice),
  tax: b.taxRate == null ? "" : String(b.taxRate),
  inclusive: b.taxRate == null ? false : b.taxInclusive === true,
  qty: String(Math.max(b.quantity, 0)),
});

function parseCost(text: string): number | null | undefined {
  if (text.trim() === "") return null;
  const n = parseFloat(text);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function BatchRow({ batch, product, currency }: { batch: StockBatch; product: Product; currency: string }) {
  const { updateBatch } = usePos();
  const [draft, setDraft] = useState<Draft>(() => draftOf(batch));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(draftOf(batch)), [batch]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(draftOf(batch));

  const save = async () => {
    const qty = Number(draft.qty);
    const cost = parseCost(draft.cost);
    const price = parseCost(draft.price);
    if (!Number.isInteger(qty) || qty < 0) return setError("Quantity must be a whole number, zero or more.");
    if (cost === undefined) return setError("Cost must be zero or more.");
    if (price === undefined) return setError("Selling price must be zero or more.");
    const tax = parseTax(draft.tax);
    if (tax === undefined) return setError("Tax must be between 0 and 100.");
    setSaving(true);
    setError("");
    try {
      await updateBatch(batch.id, {
        batchNo: draft.batchNo,
        expiry: draft.expiry,
        costPrice: cost,
        sellingPrice: price,
        taxRate: tax,
        taxInclusive: draft.inclusive,
        quantity: qty,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the batch.");
    } finally {
      setSaving(false);
    }
  };

  const cost = batch.costPrice ?? product.costPrice;
  return (
    <div className="rounded-xl border border-muted-line/30 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="font-semibold text-ink">
          {batch.batchNo || (batch.opening ? "Opening stock" : "No batch no.")}
        </span>
        <ExpiryBadge expiry={batch.expiry} />
        <span>Received {batch.receivedAt}</span>
        {cost !== null ? <span>· cost {formatMoney(cost, currency)}</span> : null}
        {batch.sellingPrice != null ? <span>· sells at {formatMoney(batch.sellingPrice, currency)}</span> : null}
        {batch.taxRate != null ? (
          <span>
            · {batch.taxRate}% tax {batch.taxInclusive ? "incl." : "extra"}
          </span>
        ) : null}
        <ReturnBadge batch={batch} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Batch no.">
          <input
            value={draft.batchNo}
            onChange={(e) => setDraft((d) => ({ ...d, batchNo: e.target.value }))}
            className={inputClass}
          />
        </Field>
        <Field label="Expiry">
          <input
            type="date"
            value={draft.expiry}
            onChange={(e) => setDraft((d) => ({ ...d, expiry: e.target.value }))}
            className={inputClass}
          />
        </Field>
        <Field label="Cost / unit">
          <input
            type="number"
            min={0}
            step="0.01"
            value={draft.cost}
            placeholder={product.costPrice === null ? "" : String(product.costPrice)}
            onChange={(e) => setDraft((d) => ({ ...d, cost: e.target.value }))}
            className={inputClass}
          />
        </Field>
        <Field label="Selling price">
          <input
            type="number"
            min={0}
            step="0.01"
            value={draft.price}
            placeholder={String(product.sellingPrice)}
            onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
            className={inputClass}
          />
        </Field>
        <TaxFields
          tax={draft.tax}
          inclusive={draft.inclusive}
          onTax={(v) => setDraft((d) => ({ ...d, tax: v }))}
          onInclusive={(v) => setDraft((d) => ({ ...d, inclusive: v }))}
          product={product}
        />
        <Field label="Quantity">
          <input
            type="number"
            min={0}
            step="1"
            value={draft.qty}
            onChange={(e) => setDraft((d) => ({ ...d, qty: e.target.value }))}
            className={inputClass}
          />
        </Field>
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      {dirty ? (
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={() => setDraft(draftOf(batch))} className={secondaryBtnClass}>
            Reset
          </button>
          <button type="button" onClick={() => void save()} disabled={saving} className={primaryBtnClass}>
            {saving ? "Saving…" : "Save batch"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function BatchesModal({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { business, stockBatches, adjustStock } = usePos();
  const currency = business?.currency ?? "INR";
  const [showEmpty, setShowEmpty] = useState(false);
  const [add, setAdd] = useState<Draft>(EMPTY);
  const [error, setError] = useState("");

  useEffect(() => {
    setAdd({ ...EMPTY, inclusive: product?.taxInclusive ?? false });
    setError("");
    setShowEmpty(false);
  }, [product?.id, product?.taxInclusive]);

  if (!product) return null;

  const own = sortFefo(stockBatches.filter((b) => b.productId === product.id));
  const visible = showEmpty ? own : own.filter((b) => b.quantity > 0);
  const emptyCount = own.length - own.filter((b) => b.quantity > 0).length;

  const addBatch = async () => {
    const qty = Number(add.qty);
    const cost = parseCost(add.cost);
    const price = parseCost(add.price);
    if (!Number.isInteger(qty) || qty <= 0) return setError("Enter a quantity greater than zero.");
    if (cost === undefined) return setError("Cost must be zero or more.");
    if (price === undefined) return setError("Selling price must be zero or more.");
    const tax = parseTax(add.tax);
    if (tax === undefined) return setError("Tax must be between 0 and 100.");
    setError("");
    await adjustStock(product.id, "add", qty, "New batch", {
      batchNo: add.batchNo,
      expiry: add.expiry,
      costPrice: cost,
      sellingPrice: price,
      taxRate: tax,
      taxInclusive: add.inclusive,
    });
    setAdd({ ...EMPTY, inclusive: product.taxInclusive ?? false });
  };

  return (
    <Modal open onClose={onClose} title={`Batches — ${product.name}`} wide>
      <p className="text-sm text-muted">
        In stock: <strong className="text-ink">{`${product.stock} ${product.unit}`.trim()}</strong>. Sales take
        stock from the batch that expires first unless you pick one at checkout. Set a batch to 0 to write it off.
      </p>

      <div className="mt-4 space-y-3">
        {visible.length === 0 ? (
          <p className="rounded-xl border border-dashed border-muted-line/40 p-4 text-center text-sm text-muted">
            No batches in stock.
          </p>
        ) : (
          visible.map((b) => <BatchRow key={b.id} batch={b} product={product} currency={currency} />)
        )}
        {emptyCount > 0 ? (
          <button
            type="button"
            onClick={() => setShowEmpty((v) => !v)}
            className="text-xs font-semibold text-indigo hover:underline"
          >
            {showEmpty ? "Hide used-up batches" : `Show ${emptyCount} used-up batch${emptyCount === 1 ? "" : "es"}`}
          </button>
        ) : null}
      </div>

      <div className="mt-6 rounded-xl bg-cream-paper/60 p-3">
        <p className="mb-2 text-sm font-semibold text-ink">Add a batch</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Field label="Batch no.">
            <input
              value={add.batchNo}
              onChange={(e) => setAdd((d) => ({ ...d, batchNo: e.target.value }))}
              placeholder="Optional"
              className={inputClass}
            />
          </Field>
          <Field label="Expiry">
            <input
              type="date"
              value={add.expiry}
              onChange={(e) => setAdd((d) => ({ ...d, expiry: e.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field label="Cost / unit">
            <input
              type="number"
              min={0}
              step="0.01"
              value={add.cost}
              placeholder={product.costPrice === null ? "Optional" : String(product.costPrice)}
              onChange={(e) => setAdd((d) => ({ ...d, cost: e.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field label="Selling price">
            <input
              type="number"
              min={0}
              step="0.01"
              value={add.price}
              placeholder={String(product.sellingPrice)}
              onChange={(e) => setAdd((d) => ({ ...d, price: e.target.value }))}
              className={inputClass}
            />
          </Field>
          <TaxFields
            tax={add.tax}
            inclusive={add.inclusive}
            onTax={(v) => setAdd((d) => ({ ...d, tax: v }))}
            onInclusive={(v) => setAdd((d) => ({ ...d, inclusive: v }))}
            product={product}
          />
          <Field label="Quantity" required>
            <input
              type="number"
              min={1}
              step="1"
              value={add.qty}
              onChange={(e) => setAdd((d) => ({ ...d, qty: e.target.value }))}
              className={inputClass}
            />
          </Field>
        </div>
        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={() => void addBatch()} className={primaryBtnClass}>
            Add batch
          </button>
        </div>
      </div>
    </Modal>
  );
}
