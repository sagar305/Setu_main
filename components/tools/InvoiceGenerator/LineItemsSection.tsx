"use client";

import { Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { calculateLineItem } from "@/lib/invoice";
import type { LineItem } from "@/lib/types/invoice";

interface LineItemsSectionProps {
  items: LineItem[];
  taxMode: "inclusive" | "exclusive";
  onTaxModeChange: (mode: "inclusive" | "exclusive") => void;
  onAddItem: () => void;
  onRemoveItem: (id: string) => void;
  onUpdateItem: (id: string, updates: Partial<LineItem>) => void;
}

const parseNumericInput = (value: string): number => {
  if (!value || value === ".") return 0;
  const num = parseFloat(value);
  return Number.isFinite(num) && num >= 0 ? Math.round(num * 100) / 100 : 0;
};

const formatNumericDisplay = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "";
  if (value === 0) return "";
  return value.toString();
};

export function LineItemsSection({
  items,
  taxMode,
  onTaxModeChange,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
}: LineItemsSectionProps) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-ink">
          Line Items
        </h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={taxMode === "inclusive"}
            onChange={(e) => onTaxModeChange(e.target.checked ? "inclusive" : "exclusive")}
            className="h-4 w-4 rounded border-muted-line/40 text-indigo accent-indigo"
          />
          <span className="text-sm font-medium text-ink">Tax Inclusive</span>
        </label>
      </div>

      <div className="space-y-4 rounded-xl border border-muted-line/20 bg-cream/30 p-4 sm:p-6">
        {/* Line Items */}
        <div className="space-y-5">
          {items.map((item) => {
            const calculated = calculateLineItem(item, taxMode);
            return (
              <div
                key={item.id}
                className="rounded-lg border border-muted-line/20 bg-white p-4 sm:p-6"
              >
                {/* First Row: Item Description (Full Width) */}
                <div className="mb-4">
                  <label className="mb-2 block text-xs font-semibold text-ink">
                    Item Description
                  </label>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) =>
                      onUpdateItem(item.id, { description: e.target.value })
                    }
                    className="w-full rounded-lg border border-muted-line/40 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted-line focus:border-indigo"
                    placeholder="What are you billing for?"
                  />
                </div>

                {/* Second Row: Qty, Rate */}
                <div className="mb-3 grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-ink">
                      Quantity
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      defaultValue={formatNumericDisplay(item.quantity)}
                      onChange={(e) => {
                        const val = e.target.value;
                        const cleaned = val.replace(/[^0-9.]/g, "");
                        const parts = cleaned.split(".");
                        let valid = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : cleaned;
                        if (valid.endsWith(".") && valid.lastIndexOf(".") !== cleaned.lastIndexOf(".")) {
                          valid = valid.slice(0, -1);
                        }
                        e.currentTarget.value = valid;
                      }}
                      onBlur={(e) => {
                        const val = e.target.value;
                        const cleaned = val.replace(/[^0-9.]/g, "");

                        if (cleaned === "" || cleaned === ".") {
                          onUpdateItem(item.id, { quantity: 0 });
                          e.currentTarget.value = "";
                        } else {
                          const num = parseNumericInput(cleaned);
                          onUpdateItem(item.id, { quantity: num });
                          e.currentTarget.value = formatNumericDisplay(num);
                        }
                      }}
                      className="w-full rounded-lg border border-muted-line/40 bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-muted-line focus:border-indigo"
                      placeholder="1.00"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-ink">
                      Rate (₹)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      defaultValue={formatNumericDisplay(item.rate)}
                      onChange={(e) => {
                        const val = e.target.value;
                        const cleaned = val.replace(/[^0-9.]/g, "");
                        const parts = cleaned.split(".");
                        let valid = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : cleaned;
                        if (valid.endsWith(".") && valid.lastIndexOf(".") !== cleaned.lastIndexOf(".")) {
                          valid = valid.slice(0, -1);
                        }
                        e.currentTarget.value = valid;
                      }}
                      onBlur={(e) => {
                        const val = e.target.value;
                        const cleaned = val.replace(/[^0-9.]/g, "");

                        if (cleaned === "" || cleaned === ".") {
                          onUpdateItem(item.id, { rate: 0 });
                          e.currentTarget.value = "";
                        } else {
                          const num = parseNumericInput(cleaned);
                          onUpdateItem(item.id, { rate: num });
                          e.currentTarget.value = formatNumericDisplay(num);
                        }
                      }}
                      className="w-full rounded-lg border border-muted-line/40 bg-white px-3 py-2 text-right text-sm text-ink outline-none transition placeholder:text-muted-line focus:border-indigo"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Third Row: Discount %, Tax %, Amount, Remove */}
                <div className="grid gap-2 sm:grid-cols-5 sm:items-end">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-ink">
                      Discount %
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      defaultValue={formatNumericDisplay(item.discountPercent)}
                      onChange={(e) => {
                        const val = e.target.value;
                        const cleaned = val.replace(/[^0-9.]/g, "");
                        const parts = cleaned.split(".");
                        let valid = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : cleaned;
                        if (valid.endsWith(".") && valid.lastIndexOf(".") !== cleaned.lastIndexOf(".")) {
                          valid = valid.slice(0, -1);
                        }
                        e.currentTarget.value = valid;
                      }}
                      onBlur={(e) => {
                        const val = e.target.value;
                        const cleaned = val.replace(/[^0-9.]/g, "");

                        if (cleaned === "" || cleaned === ".") {
                          onUpdateItem(item.id, { discountPercent: 0 });
                          e.currentTarget.value = "";
                        } else {
                          let num = parseNumericInput(cleaned);
                          num = Math.min(100, num);
                          onUpdateItem(item.id, { discountPercent: num });
                          e.currentTarget.value = formatNumericDisplay(num);
                        }
                      }}
                      className="w-full rounded-lg border border-muted-line/40 bg-white px-3 py-2 text-center text-sm text-ink outline-none transition placeholder:text-muted-line focus:border-indigo"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-ink">
                      Tax %
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      defaultValue={formatNumericDisplay(item.taxRate)}
                      onChange={(e) => {
                        const val = e.target.value;
                        const cleaned = val.replace(/[^0-9.]/g, "");
                        const parts = cleaned.split(".");
                        let valid = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : cleaned;
                        if (valid.endsWith(".") && valid.lastIndexOf(".") !== cleaned.lastIndexOf(".")) {
                          valid = valid.slice(0, -1);
                        }
                        e.currentTarget.value = valid;
                      }}
                      onBlur={(e) => {
                        const val = e.target.value;
                        const cleaned = val.replace(/[^0-9.]/g, "");

                        if (cleaned === "" || cleaned === ".") {
                          onUpdateItem(item.id, { taxRate: 0 });
                          e.currentTarget.value = "";
                        } else {
                          const num = parseNumericInput(cleaned);
                          onUpdateItem(item.id, { taxRate: num });
                          e.currentTarget.value = formatNumericDisplay(num);
                        }
                      }}
                      className="w-full rounded-lg border border-muted-line/40 bg-white px-3 py-2 text-center text-sm text-ink outline-none transition placeholder:text-muted-line focus:border-indigo"
                      placeholder="18.00"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-ink">
                      Amount
                    </label>
                    <div className="flex items-center justify-end rounded-lg border border-indigo/40 bg-indigo/5 px-3 py-2">
                      <span className="font-bold text-indigo">
                        {formatCurrency(calculated.amount)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.id)}
                    disabled={items.length <= 1}
                    className="flex items-center justify-center rounded-lg border border-red-200 bg-red-50 h-8 w-8 text-red-600 transition hover:border-red-400 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={onAddItem}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo px-4 py-2 font-semibold text-white transition hover:bg-indigo-700"
      >
        <Plus className="h-4 w-4" /> Add Line Item
      </button>
    </div>
  );
}
