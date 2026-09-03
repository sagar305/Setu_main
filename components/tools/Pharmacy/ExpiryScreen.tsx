"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Download, Printer, RotateCcw } from "lucide-react";
import { usePharmacy } from "@/lib/pharmacy/store";
import { bySupplier, expiryBuckets } from "@/lib/pharmacy/calc";
import { downloadCsv, expiryCsv } from "@/lib/pharmacy/csv";
import { printExpiryList } from "@/lib/pharmacy/print";
import { formatMoney } from "@/lib/pos/types";
import { formatExpiry } from "@/lib/pharmacy/types";
import { PurchaseReturnModal } from "./PurchaseReturnModal";
import { EmptyState, ExpiryChip, Pill, primaryBtnClass, secondaryBtnClass } from "./ui";

/**
 * The expiry dashboard — the reason to use this app rather than a cheaper one.
 *
 * Expired stock is pure loss, and most chemists find out about it months after
 * the distributor would still have taken it back. Three things make this
 * screen useful rather than merely informative: it leads with money rather than
 * batch counts, it groups by supplier because that is who a return goes to, and
 * every group ends in a button that actually creates the return note.
 */
export function ExpiryScreen() {
  const { batches, business, medicineById, medicines, settings, suppliers, today } =
    usePharmacy();

  const [selected, setSelected] = useState(0);
  const [returnFor, setReturnFor] = useState<{ supplierId: string | null; batchIds: string[] } | null>(
    null
  );

  const currency = business?.currency ?? "INR";
  const buckets = useMemo(
    () => expiryBuckets(batches, settings.expiryBuckets, today),
    [batches, settings.expiryBuckets, today]
  );
  const bucket = buckets[selected] ?? buckets[0];
  const groups = useMemo(() => bySupplier(bucket?.batches ?? []), [bucket]);
  const anything = buckets.some((row) => row.batches.length > 0);

  return (
    <div className="grid gap-4">
      {/* The buckets, as tabs that carry their own number. */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {buckets.map((row, index) => {
          const active = index === selected;
          const expired = row.days === -1;
          return (
            <button
              key={row.label}
              type="button"
              onClick={() => setSelected(index)}
              className={`rounded-2xl border p-4 text-left transition ${
                active
                  ? expired
                    ? "border-red-400 bg-red-50"
                    : "border-indigo bg-indigo/5"
                  : "border-muted-line/30 bg-white hover:border-indigo/40"
              }`}
              aria-current={active ? "true" : undefined}
            >
              <p
                className={`text-xs font-semibold uppercase tracking-wide ${
                  expired ? "text-red-700" : "text-muted"
                }`}
              >
                {row.label}
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-ink">
                {formatMoney(row.valueAtCost, currency)}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {row.batches.length} batch{row.batches.length === 1 ? "" : "es"} · {row.units}{" "}
                units
              </p>
            </button>
          );
        })}
      </div>

      {!anything ? (
        <EmptyState
          icon={<CalendarClock className="h-6 w-6" />}
          title="Nothing near expiry"
          message="Every batch in stock is more than your longest window away from expiring. This screen is worth checking once a week."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted">
              {bucket.label} · grouped by supplier
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  printExpiryList(
                    bucket.batches,
                    medicines,
                    bucket.days === -1 ? "Expired stock — removal list" : bucket.label,
                    business,
                    settings,
                    currency
                  )
                }
                className={secondaryBtnClass}
                disabled={bucket.batches.length === 0}
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                {bucket.days === -1 ? "Print removal list" : "Print list"}
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadCsv(
                    `expiry-${bucket.days === -1 ? "expired" : `${bucket.days}d`}.csv`,
                    expiryCsv(bucket.batches, medicines, suppliers)
                  )
                }
                className={secondaryBtnClass}
                disabled={bucket.batches.length === 0}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Export
              </button>
            </div>
          </div>

          {bucket.days === -1 && bucket.batches.length > 0 && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              This stock cannot be sold. Pull it off the shelf against the printed list, then
              send it back or write it off — leaving it there is how it ends up on a bill.
            </div>
          )}

          {bucket.batches.length === 0 ? (
            <p className="text-sm text-muted">Nothing in this window.</p>
          ) : (
            <div className="grid gap-3">
              {groups.map((group) => {
                const supplier = suppliers.find((row) => row.id === group.supplierId);
                return (
                  <div
                    key={group.supplierId ?? "unknown"}
                    className="rounded-2xl border border-muted-line/30 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-ink">
                          {supplier?.name ?? "No supplier recorded"}
                        </h4>
                        <p className="text-xs text-muted">
                          {group.batches.length} batch
                          {group.batches.length === 1 ? "" : "es"} · {group.units} units ·{" "}
                          {formatMoney(group.valueAtCost, currency)} at cost
                        </p>
                      </div>
                      {group.supplierId ? (
                        <button
                          type="button"
                          onClick={() =>
                            setReturnFor({
                              supplierId: group.supplierId,
                              batchIds: group.batches.map((batch) => batch.id),
                            })
                          }
                          className={primaryBtnClass}
                        >
                          <RotateCcw className="h-4 w-4" aria-hidden="true" />
                          Create return note
                        </button>
                      ) : (
                        <Pill tone="muted">No supplier — cannot be returned</Pill>
                      )}
                    </div>

                    <div className="mt-3 grid gap-1">
                      {group.batches.map((batch) => {
                        const medicine = medicineById(batch.medicineId);
                        return (
                          <div
                            key={batch.id}
                            className="flex flex-wrap items-center justify-between gap-2 border-t border-muted-line/20 pt-2 text-sm first:border-0 first:pt-0"
                          >
                            <span className="min-w-0">
                              <strong className="text-ink">{medicine?.name ?? "—"}</strong>
                              <span className="ml-2 text-xs text-muted">
                                B/No {batch.batchNo || "—"} · Exp {formatExpiry(batch.expiry)}
                                {medicine?.rack && ` · Rack ${medicine.rack}`}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2 text-xs">
                              <ExpiryChip expiry={batch.expiry} today={today} />
                              <span className="text-muted">{batch.quantity} units</span>
                              <strong className="text-ink">
                                {formatMoney(batch.effectiveRate * batch.quantity, currency)}
                              </strong>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <PurchaseReturnModal
        open={Boolean(returnFor)}
        presetSupplierId={returnFor?.supplierId ?? null}
        presetBatchIds={returnFor?.batchIds}
        onClose={() => setReturnFor(null)}
      />
    </div>
  );
}
