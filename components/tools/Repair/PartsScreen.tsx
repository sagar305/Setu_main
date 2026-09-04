"use client";

// Parts stock — §3.6, and deliberately not a full inventory system.
//
// A repair shop's parts are a shelf of screens and batteries, not a warehouse.
// What it needs is a price to charge, a cost to measure margin against, and a
// number that goes down when a part is fitted. Purchase orders, suppliers'
// ledgers and multi-location stock are what the retail POS is for, and pulling
// them in here would make the one screen a technician touches slower.

import { useMemo, useState } from "react";
import { AlertTriangle, Boxes, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { useRepair } from "@/lib/repair/store";
import { isLowStock } from "@/lib/repair/calc";
import type { Part } from "@/lib/repair/types";
import { formatMoney } from "@/lib/pos/types";
import {
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  Pill,
  SearchInput,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "./ui";

const BLANK = {
  name: "",
  sku: "",
  compatibleWith: "",
  costPrice: "0",
  sellingPrice: "0",
  stock: "0",
  lowStockAt: "2",
  supplierName: "",
  active: true,
};

export function PartsScreen() {
  const { parts, business, savePart, adjustStock, deletePart } = useRepair();
  const currency = business?.currency ?? "INR";
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Part | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [confirm, setConfirm] = useState<Part | null>(null);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = needle
      ? parts.filter(
          (part) =>
            part.name.toLowerCase().includes(needle) ||
            part.sku.toLowerCase().includes(needle) ||
            part.compatibleWith.toLowerCase().includes(needle)
        )
      : parts;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [parts, search]);

  const lowCount = parts.filter(isLowStock).length;
  const money = (value: number) => formatMoney(value, currency);

  const openEditor = (part: Part | null) => {
    setError("");
    setEditing(part);
    setCreating(part === null);
    setForm(
      part
        ? {
            name: part.name,
            sku: part.sku,
            compatibleWith: part.compatibleWith,
            costPrice: String(part.costPrice),
            sellingPrice: String(part.sellingPrice),
            stock: String(part.stock),
            lowStockAt: String(part.lowStockAt),
            supplierName: part.supplierName,
            active: part.active,
          }
        : BLANK
    );
  };

  const closeEditor = () => {
    setEditing(null);
    setCreating(false);
  };

  const submit = async () => {
    if (!form.name.trim()) {
      setError("A part needs a name.");
      return;
    }
    try {
      await savePart(
        {
          name: form.name.trim(),
          sku: form.sku.trim(),
          compatibleWith: form.compatibleWith.trim(),
          costPrice: Number(form.costPrice) || 0,
          sellingPrice: Number(form.sellingPrice) || 0,
          stock: Number(form.stock) || 0,
          lowStockAt: Number(form.lowStockAt) || 0,
          supplierName: form.supplierName.trim(),
          active: form.active,
        },
        editing?.id
      );
      closeEditor();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this part.");
    }
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[200px] flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Part, SKU or model" />
        </div>
        <button type="button" onClick={() => openEditor(null)} className={primaryBtnClass}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          New part
        </button>
      </div>

      {lowCount > 0 && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {lowCount} {lowCount === 1 ? "part is" : "parts are"} at or below the low-stock mark.
        </p>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Boxes className="h-6 w-6" />}
          title={parts.length === 0 ? "No parts yet" : "Nothing matches"}
          message={
            parts.length === 0
              ? "Add the screens and batteries you keep on the shelf. Anything you fit once and never again can be added straight onto a job instead."
              : "No part matches that search."
          }
          action={
            parts.length === 0 ? (
              <button type="button" onClick={() => openEditor(null)} className={primaryBtnClass}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add a part
              </button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-2">
          {filtered.map((part) => (
            <li
              key={part.id}
              className={`rounded-2xl border bg-white p-4 ${
                isLowStock(part) ? "border-amber-300" : "border-muted-line/30"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink">
                    {part.name}
                    {!part.active && <Pill tone="muted">Inactive</Pill>}
                    {isLowStock(part) && <Pill tone="warn">Low stock</Pill>}
                  </p>
                  {part.compatibleWith && (
                    <p className="text-xs text-muted">Fits {part.compatibleWith}</p>
                  )}
                  <p className="mt-1 text-xs text-muted">
                    Cost {money(part.costPrice)} · sells {money(part.sellingPrice)} · margin{" "}
                    <strong className="text-ink">
                      {money(part.sellingPrice - part.costPrice)}
                    </strong>
                    {part.supplierName ? ` · ${part.supplierName}` : ""}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void adjustStock(part.id, -1)}
                    className="rounded-lg border border-muted-line/40 p-2 text-muted transition hover:text-indigo"
                    aria-label={`One fewer ${part.name}`}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="min-w-[3rem] text-center text-lg font-bold text-ink">
                    {part.stock}
                  </span>
                  <button
                    type="button"
                    onClick={() => void adjustStock(part.id, 1)}
                    className="rounded-lg border border-muted-line/40 p-2 text-muted transition hover:text-indigo"
                    aria-label={`One more ${part.name}`}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditor(part)}
                    className="rounded-lg p-2 text-muted transition hover:text-indigo"
                    aria-label={`Edit ${part.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirm(part)}
                    className="rounded-lg p-2 text-muted transition hover:text-red-600"
                    aria-label={`Delete ${part.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={editing !== null || creating}
        onClose={closeEditor}
        title={editing ? `Edit ${editing.name}` : "New part"}
      >
        <div className="grid gap-3">
          <Field label="Part name" required>
            <input
              className={inputClass}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="iPhone 11 display"
              autoFocus
            />
          </Field>
          <Field label="Fits which models" hint="Free text — “iPhone 11, iPhone 11 Pro”.">
            <input
              className={inputClass}
              value={form.compatibleWith}
              onChange={(event) => setForm({ ...form, compatibleWith: event.target.value })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cost price" hint="What you paid. This is what margin is measured against.">
              <input
                className={inputClass}
                value={form.costPrice}
                onChange={(event) => setForm({ ...form, costPrice: event.target.value })}
                inputMode="decimal"
              />
            </Field>
            <Field label="Selling price">
              <input
                className={inputClass}
                value={form.sellingPrice}
                onChange={(event) => setForm({ ...form, sellingPrice: event.target.value })}
                inputMode="decimal"
              />
            </Field>
            <Field label="In stock">
              <input
                className={inputClass}
                value={form.stock}
                onChange={(event) => setForm({ ...form, stock: event.target.value })}
                inputMode="numeric"
              />
            </Field>
            <Field label="Warn at">
              <input
                className={inputClass}
                value={form.lowStockAt}
                onChange={(event) => setForm({ ...form, lowStockAt: event.target.value })}
                inputMode="numeric"
              />
            </Field>
            <Field label="SKU">
              <input
                className={inputClass}
                value={form.sku}
                onChange={(event) => setForm({ ...form, sku: event.target.value })}
              />
            </Field>
            <Field label="Supplier">
              <input
                className={inputClass}
                value={form.supplierName}
                onChange={(event) => setForm({ ...form, supplierName: event.target.value })}
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-muted-line/50 text-indigo focus:ring-indigo"
              checked={form.active}
              onChange={(event) => setForm({ ...form, active: event.target.checked })}
            />
            Show this part when adding parts to a job
          </label>

          {error && (
            <p className="text-sm font-semibold text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void submit()}
              className={`${primaryBtnClass} sm:flex-1`}
            >
              Save
            </button>
            <button type="button" onClick={closeEditor} className={secondaryBtnClass}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirm !== null}
        title={`Delete ${confirm?.name ?? ""}?`}
        message="Jobs keep their own copy of what this part cost and sold for, so past margins stay correct. Only the shelf entry goes."
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (!confirm) return;
          await deletePart(confirm.id);
          setConfirm(null);
        }}
      />
    </div>
  );
}
