"use client";

import type { InvoiceDetails } from "@/lib/types/invoice";
import { useI18n } from "@/lib/i18n";

interface InvoiceDetailsSectionProps {
  data: InvoiceDetails;
  onChange: (data: Partial<InvoiceDetails>) => void;
}

const DUE_DATE_PRESETS = [
  { label: "Net 15", days: 15 },
  { label: "Net 30", days: 30 },
  { label: "Net 45", days: 45 },
];

export function InvoiceDetailsSection({
  data,
  onChange,
}: InvoiceDetailsSectionProps) {
  const { t } = useI18n();
  const setDueDate = (days: number) => {
    const date = new Date(data.date);
    date.setDate(date.getDate() + days);
    onChange({ dueDate: date.toISOString().split("T")[0] });
  };

  return (
    <div>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink">
        {t("igInvoiceDetails")}
      </h3>

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-ink">{t("igInvoiceNumberReq")}</label>
            <input
              type="text"
              value={data.number}
              onChange={(e) => onChange({ number: e.target.value })}
              className="mt-2 w-full rounded-xl border border-muted-line/40 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted-line focus-within:border-indigo"
              placeholder="INV-001"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-ink">{t("igPoNumber")}</label>
            <input
              type="text"
              value={data.poNumber || ""}
              onChange={(e) => onChange({ poNumber: e.target.value })}
              className="mt-2 w-full rounded-xl border border-muted-line/40 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted-line focus-within:border-indigo"
              placeholder={t("igOptional")}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-ink">{t("igDateReq")}</label>
            <input
              type="date"
              value={data.date}
              onChange={(e) => {
                onChange({ date: e.target.value });
                // Auto-update due date if it's before invoice date
                if (new Date(data.dueDate) < new Date(e.target.value)) {
                  const newDueDate = new Date(e.target.value);
                  newDueDate.setDate(newDueDate.getDate() + 15);
                  onChange({
                    date: e.target.value,
                    dueDate: newDueDate.toISOString().split("T")[0],
                  });
                }
              }}
              className="mt-2 w-full rounded-xl border border-muted-line/40 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted-line focus-within:border-indigo"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-ink">{t("igDueDate")}</label>
            <input
              type="date"
              value={data.dueDate}
              onChange={(e) => onChange({ dueDate: e.target.value })}
              className="mt-2 w-full rounded-xl border border-muted-line/40 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted-line focus-within:border-indigo"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-ink mb-2">
            {t("igDueDatePresets")}
          </label>
          <div className="flex gap-2">
            {DUE_DATE_PRESETS.map(({ label, days }) => (
              <button
                key={days}
                type="button"
                onClick={() => setDueDate(days)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  Math.floor(
                    (new Date(data.dueDate).getTime() -
                      new Date(data.date).getTime()) /
                      (1000 * 60 * 60 * 24)
                  ) === days
                    ? "border-indigo bg-indigo text-cream-paper"
                    : "border-muted-line/40 text-muted hover:border-indigo/40"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-ink">{t("igEwayBill")}</label>
          <input
            type="text"
            value={data.ewayBillNumber || ""}
            onChange={(e) => onChange({ ewayBillNumber: e.target.value })}
            className="mt-2 w-full rounded-xl border border-muted-line/40 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted-line focus-within:border-indigo"
            placeholder={t("igEwayHint")}
          />
        </div>
      </div>
    </div>
  );
}
