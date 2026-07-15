"use client";

import { Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { calculateLineItem } from "@/lib/invoice";
import type { LineItem } from "@/lib/types/invoice";

interface LineItemsSectionProps {
  items: LineItem[];
  taxMode: "inclusive" | "exclusive";
  onAddItem: () => void;
  onRemoveItem: (id: string) => void;
  onUpdateItem: (id: string, updates: Partial<LineItem>) => void;
}

const parseNumericInput = (value: string): number => {
  const num = parseFloat(value);
  return Number.isFinite(num) && num >= 0 ? num : 0;
};

export function LineItemsSection({
  items,
  taxMode,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
}: LineItemsSectionProps) {
  return (
    <div>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink">
        Line Items
      </h3>

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
                {/* First Row: Description (Full Width) */}
                <div className="mb-4">
                  <label className="mb-2 block text-xs font-semibold text-ink">
                    Description *
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
                      value={item.quantity}
                      onChange={(e) => {
                        const num = parseNumericInput(e.target.value);
                        onUpdateItem(item.id, { quantity: num });
                      }}
                      className="w-full rounded-lg border border-muted-line/40 bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-muted-line focus:border-indigo"
                      placeholder="1"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-ink">
                      Rate (₹)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.rate}
                      onChange={(e) => {
                        const num = parseNumericInput(e.target.value);
                        onUpdateItem(item.id, { rate: num });
                      }}
                      className="w-full rounded-lg border border-muted-line/40 bg-white px-3 py-2 text-right text-sm text-ink outline-none transition placeholder:text-muted-line focus:border-indigo"
                      placeholder="0"
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
                      value={item.discountPercent}
                      onChange={(e) => {
                        let num = parseNumericInput(e.target.value);
                        num = Math.min(100, num);
                        onUpdateItem(item.id, { discountPercent: num });
                      }}
                      className="w-full rounded-lg border border-muted-line/40 bg-white px-3 py-2 text-center text-sm text-ink outline-none transition placeholder:text-muted-line focus:border-indigo"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-ink">
                      Tax %
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.taxRate}
                      onChange={(e) => {
                        const num = parseNumericInput(e.target.value);
                        onUpdateItem(item.id, { taxRate: num });
                      }}
                      className="w-full rounded-lg border border-muted-line/40 bg-white px-3 py-2 text-center text-sm text-ink outline-none transition placeholder:text-muted-line focus:border-indigo"
                      placeholder="18"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-ink">
                      Amount
                    </label>
                    <div className="flex items-center justify-end rounded-lg border border-indigo/40 bg-indigo/5 px-4 py-2">
                      <span className="font-bold text-indigo">
                        {formatCurrency(calculated.amount)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.id)}
                    disabled={items.length <= 1}
                    className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 transition hover:border-red-400 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
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
