"use client";

import { Plus, Trash2 } from "lucide-react";
import type { Fee } from "@/lib/types/invoice";

interface FeesSectionProps {
  fees: Fee[];
  onAddFee: () => void;
  onRemoveFee: (id: string) => void;
  onUpdateFee: (id: string, updates: Partial<Fee>) => void;
}

const parseNumericInput = (value: string): number => {
  if (!value || value === "." || value === "-") return 0;
  const num = parseFloat(value);
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : 0;
};

const formatNumericDisplay = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "";
  if (value === 0) return "";
  return value.toString();
};

export function FeesSection({
  fees,
  onAddFee,
  onRemoveFee,
  onUpdateFee,
}: FeesSectionProps) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-ink">
          Fees (Optional)
        </h3>
        <button
          onClick={onAddFee}
          className="inline-flex items-center gap-2 rounded-lg border border-indigo/30 bg-indigo/5 px-3 py-2 text-xs font-semibold text-indigo transition hover:bg-indigo/10"
        >
          <Plus className="h-4 w-4" />
          Add Fee
        </button>
      </div>

      {fees.length === 0 ? (
        <div className="rounded-lg border border-muted-line/20 bg-cream/30 p-4 text-center text-sm text-muted">
          No fees added. Click "Add Fee" to add shipping, packaging, or other charges.
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-muted-line/20 bg-cream/30 p-4 sm:p-6">
          {fees.map((fee) => (
            <div
              key={fee.id}
              className="rounded-lg border border-muted-line/20 bg-white p-3 sm:p-4 space-y-3"
            >
              {/* Line 1: Fee Name */}
              <div>
                <label className="mb-2 block text-xs font-semibold text-ink">
                  Fee Name
                </label>
                <input
                  type="text"
                  value={fee.name}
                  onChange={(e) =>
                    onUpdateFee(fee.id, { name: e.target.value })
                  }
                  placeholder="e.g., Shipping, Packaging, Discount"
                  className="w-full rounded-lg border border-muted-line/40 bg-white px-3 py-2 text-xs sm:text-sm text-ink outline-none transition placeholder:text-muted-line focus:border-indigo"
                />
              </div>

              {/* Line 2: Type, Amount, Delete Button */}
              <div className="flex gap-2 items-end">
                {/* Fee Type */}
                <div className="flex-1">
                  <label className="mb-2 block text-xs font-semibold text-ink">
                    Type
                  </label>
                  <select
                    value={fee.type}
                    onChange={(e) =>
                      onUpdateFee(fee.id, {
                        type: e.target.value as "percentage" | "fixed",
                      })
                    }
                    className="w-full rounded-lg border border-muted-line/40 bg-white px-3 py-2 text-xs sm:text-sm text-ink outline-none transition focus:border-indigo"
                  >
                    <option value="fixed">Fixed (₹)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </div>

                {/* Fee Amount */}
                <div className="flex-1">
                  <label className="mb-2 block text-xs font-semibold text-ink">
                    Amount
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-ink flex-shrink-0">
                      {fee.type === "percentage" ? "%" : "₹"}
                    </span>
                    <input
                      key={`${fee.id}-amount-${fee.amount}`}
                      type="text"
                      inputMode="decimal"
                      defaultValue={formatNumericDisplay(fee.amount)}
                      onChange={(e) => {
                        const val = e.target.value;
                        const cleaned = val.replace(/[^0-9.-]/g, "");
                        const parts = cleaned.split(".");
                        let valid =
                          parts.length > 2
                            ? parts[0] + "." + parts.slice(1).join("")
                            : cleaned;
                        if (
                          valid.endsWith(".") &&
                          valid.lastIndexOf(".") !==
                            cleaned.lastIndexOf(".")
                        ) {
                          valid = valid.slice(0, -1);
                        }
                        e.currentTarget.value = valid;
                      }}
                      onBlur={(e) => {
                        const val = e.target.value;
                        const cleaned = val.replace(/[^0-9.-]/g, "");

                        if (cleaned === "" || cleaned === "." || cleaned === "-") {
                          onUpdateFee(fee.id, { amount: 0 });
                          e.currentTarget.value = "";
                        } else {
                          const num = parseNumericInput(cleaned);
                          onUpdateFee(fee.id, { amount: num });
                          e.currentTarget.value =
                            formatNumericDisplay(num);
                        }
                      }}
                      className="flex-1 rounded-lg border border-muted-line/40 bg-white px-2 py-2 text-xs sm:text-sm text-ink outline-none transition placeholder:text-muted-line focus:border-indigo"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Delete Button */}
                <button
                  onClick={() => onRemoveFee(fee.id)}
                  className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-600 transition hover:bg-red-100"
                  title="Remove fee"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
