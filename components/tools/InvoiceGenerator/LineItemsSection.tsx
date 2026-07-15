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

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-muted-line/20">
              <th className="px-3 py-2 text-left text-xs font-semibold text-ink">
                Description
              </th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-ink">
                Qty
              </th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-ink">
                Unit
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-ink">
                Rate (₹)
              </th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-ink">
                Disc %
              </th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-ink">
                Tax %
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-ink">
                Amount
              </th>
              <th className="px-3 py-2 w-9"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const calculated = calculateLineItem(item, taxMode);
              return (
                <tr key={item.id} className="border-b border-muted-line/10">
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) =>
                        onUpdateItem(item.id, { description: e.target.value })
                      }
                      className="w-full rounded-lg border border-muted-line/40 bg-white px-2 py-1.5 text-sm text-ink outline-none transition placeholder:text-muted-line focus:border-indigo"
                      placeholder="Item description"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        onUpdateItem(item.id, {
                          quantity: Math.max(0, parseFloat(e.target.value) || 0),
                        })
                      }
                      className="w-full rounded-lg border border-muted-line/40 bg-white px-2 py-1.5 text-sm text-ink outline-none transition placeholder:text-muted-line focus:border-indigo"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={item.unit}
                      onChange={(e) =>
                        onUpdateItem(item.id, { unit: e.target.value })
                      }
                      className="w-full rounded-lg border border-muted-line/40 bg-white px-2 py-1.5 text-sm text-ink outline-none transition placeholder:text-muted-line focus:border-indigo"
                      placeholder="Unit"
                      maxLength={10}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={item.rate}
                      onChange={(e) =>
                        onUpdateItem(item.id, {
                          rate: Math.max(0, parseFloat(e.target.value) || 0),
                        })
                      }
                      className="w-full rounded-lg border border-muted-line/40 bg-white px-2 py-1.5 text-right text-sm text-ink outline-none transition placeholder:text-muted-line focus:border-indigo"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                    />
                  </td>
                  <td className="px-3 py-2">
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
                      className="w-full rounded-lg border border-muted-line/40 bg-white px-2 py-1.5 text-center text-sm text-ink outline-none transition placeholder:text-muted-line focus:border-indigo"
                      inputMode="decimal"
                      min="0"
                      max="100"
                      step="0.01"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={item.taxRate}
                      onChange={(e) =>
                        onUpdateItem(item.id, {
                          taxRate: Math.max(0, parseFloat(e.target.value) || 0),
                        })
                      }
                      className="w-full rounded-lg border border-muted-line/40 bg-white px-2 py-1.5 text-center text-sm text-ink outline-none transition placeholder:text-muted-line focus:border-indigo"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                    />
                  </td>
                  <td className="px-3 py-2 text-right text-sm font-semibold text-ink">
                    {formatCurrency(calculated.amount)}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.id)}
                      disabled={items.length <= 1}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-warm transition hover:bg-cream hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="Remove item"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
