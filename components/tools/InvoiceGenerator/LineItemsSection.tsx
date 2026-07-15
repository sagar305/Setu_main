"use client";

import { Plus, X } from "lucide-react";
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
        {/* Column Headers */}
        <div className="hidden grid-cols-12 gap-3 sm:grid">
          <div className="col-span-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink">
              Description
            </label>
          </div>
          <div className="col-span-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink">
              Qty
            </label>
          </div>
          <div className="col-span-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink">
              Unit
            </label>
          </div>
          <div className="col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink">
              Rate (₹)
            </label>
          </div>
          <div className="col-span-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink">
              Disc %
            </label>
          </div>
          <div className="col-span-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink">
              Tax %
            </label>
          </div>
          <div className="col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink">
              Amount
            </label>
          </div>
          <div className="col-span-1"></div>
        </div>

        {/* Line Items */}
        <div className="space-y-4">
          {items.map((item) => {
            const calculated = calculateLineItem(item, taxMode);
            return (
              <div
                key={item.id}
                className="space-y-3 rounded-lg border border-muted-line/20 bg-white p-4 sm:space-y-0 sm:grid sm:grid-cols-12 sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0"
              >
                {/* Description - Full width on mobile, col-span-3 on desktop */}
                <div className="sm:col-span-3">
                  <label className="text-xs font-semibold text-ink sm:hidden">
                    Description
                  </label>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) =>
                      onUpdateItem(item.id, { description: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-muted-line/40 bg-white px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted-line focus:border-indigo sm:mt-0"
                    placeholder="Item description"
                  />
                </div>

                {/* Qty - col-span-1 */}
                <div className="sm:col-span-1">
                  <label className="text-xs font-semibold text-ink sm:hidden">
                    Quantity
                  </label>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) =>
                      onUpdateItem(item.id, {
                        quantity: Math.max(0, parseFloat(e.target.value) || 0),
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-muted-line/40 bg-white px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted-line focus:border-indigo sm:mt-0"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                  />
                </div>

                {/* Unit - col-span-1 */}
                <div className="sm:col-span-1">
                  <label className="text-xs font-semibold text-ink sm:hidden">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={item.unit}
                    onChange={(e) =>
                      onUpdateItem(item.id, { unit: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-muted-line/40 bg-white px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted-line focus:border-indigo sm:mt-0"
                    placeholder="Qty"
                    maxLength={10}
                  />
                </div>

                {/* Rate - col-span-2 */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-ink sm:hidden">
                    Rate (₹)
                  </label>
                  <input
                    type="number"
                    value={item.rate}
                    onChange={(e) =>
                      onUpdateItem(item.id, {
                        rate: Math.max(0, parseFloat(e.target.value) || 0),
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-muted-line/40 bg-white px-3 py-2.5 text-right text-sm text-ink outline-none transition placeholder:text-muted-line focus:border-indigo sm:mt-0"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                  />
                </div>

                {/* Discount % - col-span-1 */}
                <div className="sm:col-span-1">
                  <label className="text-xs font-semibold text-ink sm:hidden">
                    Disc %
                  </label>
                  <input
                    type="number"
                    value={item.discountPercent}
                    onChange={(e) =>
                      onUpdateItem(item.id, {
                        discountPercent: Math.max(
                          0,
                          Math.min(100, parseFloat(e.target.value) || 0)
                        ),
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-muted-line/40 bg-white px-3 py-2.5 text-center text-sm text-ink outline-none transition placeholder:text-muted-line focus:border-indigo sm:mt-0"
                    inputMode="decimal"
                    min="0"
                    max="100"
                    step="0.01"
                  />
                </div>

                {/* Tax % - col-span-1 */}
                <div className="sm:col-span-1">
                  <label className="text-xs font-semibold text-ink sm:hidden">
                    Tax %
                  </label>
                  <input
                    type="number"
                    value={item.taxRate}
                    onChange={(e) =>
                      onUpdateItem(item.id, {
                        taxRate: Math.max(0, parseFloat(e.target.value) || 0),
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-muted-line/40 bg-white px-3 py-2.5 text-center text-sm text-ink outline-none transition placeholder:text-muted-line focus:border-indigo sm:mt-0"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                  />
                </div>

                {/* Amount - col-span-2 */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-ink sm:hidden">
                    Amount
                  </label>
                  <div className="mt-1 flex items-center justify-between rounded-lg border border-muted-line/40 bg-cream-paper px-3 py-2.5 sm:mt-0">
                    <span className="text-sm font-semibold text-ink">
                      {formatCurrency(calculated.amount)}
                    </span>
                  </div>
                </div>

                {/* Remove Button - col-span-1 */}
                <div className="flex sm:col-span-1 sm:items-end">
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.id)}
                    disabled={items.length <= 1}
                    className="w-full rounded-lg border border-muted-line/40 bg-white p-2.5 text-muted-warm transition hover:bg-cream hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 sm:w-auto sm:bg-transparent sm:border-0 sm:p-0"
                    aria-label="Remove item"
                  >
                    <X className="h-5 w-5 sm:h-4 sm:w-4" />
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
        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-indigo/30 px-4 py-1.5 text-sm font-semibold text-indigo transition hover:bg-indigo/5"
      >
        <Plus className="h-3.5 w-3.5" /> Add Line Item
      </button>
    </div>
  );
}
