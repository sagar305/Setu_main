"use client";

import { useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  Layers,
  Minus,
  PauseCircle,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { usePharmacy } from "@/lib/pharmacy/store";
import {
  allocateFefo,
  batchBlockReason,
  cartTotals,
  committedByBatch,
  lineAmount,
  sellableStock,
  substitutesFor,
  totalStock,
} from "@/lib/pharmacy/calc";
import { formatMoney } from "@/lib/pos/types";
import {
  daysToExpiry,
  formatExpiry,
  generateId,
  needsPrescription,
  type Batch,
  type Medicine,
  type PharmacyCartLine,
  type PrescriptionRef,
  type Sale,
} from "@/lib/pharmacy/types";
import { BatchPicker } from "./BatchPicker";
import { BillModal } from "./BillModal";
import { CustomerPicker } from "./CustomerPicker";
import { PrescriptionModal } from "./PrescriptionModal";
import {
  EmptyState,
  ExpiryChip,
  Pill,
  ScheduleChip,
  StockPill,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "./ui";

export function SellScreen() {
  const {
    batches,
    business,
    completeSale,
    heldCarts,
    holdCart,
    medicines,
    removeHeldCart,
    settings,
    today,
  } = usePharmacy();

  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<PharmacyCartLine[]>([]);
  const [discount, setDiscount] = useState("");
  const [paymentMode, setPaymentMode] = useState(settings.paymentModes[0] ?? "Cash");
  const [paid, setPaid] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [prescription, setPrescription] = useState<PrescriptionRef | null>(null);
  const [expandedSubstitutes, setExpandedSubstitutes] = useState<string | null>(null);
  const [batchPickerFor, setBatchPickerFor] = useState<string | null>(null);
  const [rxOpen, setRxOpen] = useState(false);
  const [completed, setCompleted] = useState<Sale | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const currency = business?.currency ?? "INR";
  const totals = cartTotals(lines, Number(discount) || 0, settings);

  /**
   * One search box over brand, salt and barcode at once.
   *
   * A chemist is handed a doctor's chit and reads whatever is on it — a brand
   * they stock, a brand they do not, or the salt. Making them choose which field
   * they are searching first would be an extra decision at the worst possible
   * moment.
   */
  const results = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return [];
    return medicines
      .filter((medicine) => {
        if (!medicine.active) return false;
        return (
          medicine.name.toLowerCase().includes(text) ||
          medicine.composition.toLowerCase().includes(text) ||
          (medicine.barcode && medicine.barcode.toLowerCase() === text)
        );
      })
      .slice(0, 25);
  }, [medicines, query]);

  const scheduledInCart = lines
    .filter((line) => needsPrescription(line.schedule, settings.prescriptionRequiredFor))
    .map((line) => line.name);
  const rxRequired = scheduledInCart.length > 0;

  const resetBill = () => {
    setLines([]);
    setDiscount("");
    setPaid("");
    setCustomerId(null);
    setPrescription(null);
    setQuery("");
    setError("");
  };

  /**
   * Add a quantity, spread down the FEFO order.
   *
   * The cascade is the whole point: asking for 20 when the oldest batch has 12
   * left produces two lines, 12 and 8, each carrying its own batch number and
   * expiry — because that is what has to print on the bill and what has to come
   * off the right shelf.
   */
  const addMedicine = (medicine: Medicine, quantity: number) => {
    setError("");
    const result = allocateFefo(
      batches,
      medicine.id,
      quantity,
      settings,
      committedByBatch(lines),
      today
    );

    if (result.allocations.length === 0) {
      const anyStock = totalStock(batches, medicine.id) > 0;
      setError(
        anyStock
          ? `${medicine.name} has stock, but no batch of it can be sold right now — check expiry.`
          : `${medicine.name} is out of stock.`
      );
      return;
    }

    setLines((previous) => {
      const next = [...previous];
      for (const allocation of result.allocations) {
        const existing = next.find((line) => line.batchId === allocation.batch.id);
        if (existing) {
          existing.quantity += allocation.quantity;
        } else {
          next.push({
            id: generateId(),
            medicineId: medicine.id,
            batchId: allocation.batch.id,
            name: medicine.name,
            batchNo: allocation.batch.batchNo,
            expiry: allocation.batch.expiry,
            quantity: allocation.quantity,
            mrp: allocation.batch.mrp,
            rate: allocation.batch.sellingRate || allocation.batch.mrp,
            discountPct: 0,
            taxRate: medicine.taxRate,
            schedule: medicine.schedule,
            packSize: medicine.packSize,
            daysSupply: 0,
          });
        }
      }
      return next;
    });

    if (result.shortfall > 0) {
      setError(
        `Only ${quantity - result.shortfall} of ${quantity} ${medicine.name} could be billed — that is all the sellable stock there is.`
      );
    }
    setQuery("");
    searchRef.current?.focus();
  };

  const updateLine = (id: string, updates: Partial<PharmacyCartLine>) => {
    setLines((previous) =>
      previous.map((line) => (line.id === id ? { ...line, ...updates } : line))
    );
  };

  /**
   * Set a line's quantity, cascading past the batch when it will not cover it.
   *
   * Typing "20" into the quantity box is how a counter enters twenty tablets,
   * and it has to behave the same way as adding twenty did: fill this batch,
   * then spill the rest down the FEFO order as further lines. Capping silently
   * at the batch would under-bill the customer, and capping loudly would make
   * the operator do the split by hand for no reason.
   */
  const setLineQuantity = (line: PharmacyCartLine, quantity: number) => {
    if (quantity <= 0) {
      setLines((previous) => previous.filter((row) => row.id !== line.id));
      setError("");
      return;
    }

    const batch = batches.find((row) => row.id === line.batchId);
    const otherClaims = lines
      .filter((row) => row.batchId === line.batchId && row.id !== line.id)
      .reduce((sum, row) => sum + row.quantity, 0);
    const ceiling = Math.max(0, (batch?.quantity ?? 0) - otherClaims);

    if (quantity <= ceiling) {
      setError("");
      updateLine(line.id, { quantity });
      return;
    }

    const medicine = medicines.find((row) => row.id === line.medicineId);
    if (!medicine) {
      updateLine(line.id, { quantity: ceiling });
      return;
    }

    // This line takes everything its batch has; the overflow is allocated from
    // the batches after it, excluding what the rest of the cart already holds.
    const overflow = quantity - ceiling;
    const filled = lines.map((row) =>
      row.id === line.id ? { ...row, quantity: ceiling } : row
    );
    const result = allocateFefo(
      batches,
      medicine.id,
      overflow,
      settings,
      committedByBatch(filled),
      today
    );

    const next = [...filled];
    for (const allocation of result.allocations) {
      const existing = next.find((row) => row.batchId === allocation.batch.id);
      if (existing) {
        existing.quantity += allocation.quantity;
      } else {
        next.push({
          ...line,
          id: generateId(),
          batchId: allocation.batch.id,
          batchNo: allocation.batch.batchNo,
          expiry: allocation.batch.expiry,
          mrp: allocation.batch.mrp,
          rate: allocation.batch.sellingRate || allocation.batch.mrp,
          quantity: allocation.quantity,
        });
      }
    }
    setLines(next.filter((row) => row.quantity > 0));

    setError(
      result.shortfall > 0
        ? `Only ${quantity - result.shortfall} of ${quantity} ${medicine.name} could be billed — that is all the sellable stock there is.`
        : ""
    );
  };

  const swapBatch = (line: PharmacyCartLine, batch: Batch) => {
    updateLine(line.id, {
      batchId: batch.id,
      batchNo: batch.batchNo,
      expiry: batch.expiry,
      mrp: batch.mrp,
      rate: batch.sellingRate || batch.mrp,
      quantity: Math.min(line.quantity, batch.quantity),
    });
  };

  const finish = async () => {
    if (lines.length === 0) return;
    if (rxRequired && !prescription) {
      setRxOpen(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const sale = await completeSale({
        lines,
        discount: Number(discount) || 0,
        paymentMode,
        paid: paid === "" ? totals.total : Number(paid) || 0,
        customerId,
        prescription,
      });
      setCompleted(sale);
      resetBill();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not complete the bill.");
    } finally {
      setBusy(false);
    }
  };

  const recall = (id: string) => {
    const held = heldCarts.find((cart) => cart.id === id);
    if (!held) return;
    setLines(held.lines);
    setDiscount(held.discount ? String(held.discount) : "");
    setCustomerId(held.customerId);
    void removeHeldCart(id);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
      {/* ---------------------------------------------------------------- */}
      {/* Search and results                                                */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid gap-4">
        <div className="rounded-2xl border border-muted-line/30 bg-white p-4">
          <label htmlFor="pharmacy-search" className="sr-only">
            Search medicines
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              id="pharmacy-search"
              ref={searchRef}
              className={`${inputClass} pl-9`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Brand, salt or barcode — e.g. Crocin, paracetamol"
              autoComplete="off"
            />
          </div>

          {query.trim() && results.length === 0 && (
            <p className="mt-3 text-sm text-muted">
              Nothing matches “{query.trim()}”. Add it under Medicines, or check the spelling of
              the salt.
            </p>
          )}

          <div className="mt-3 grid gap-2">
            {results.map((medicine) => {
              const available = sellableStock(batches, medicine.id, settings, today);
              const substitutes = substitutesFor(medicine, medicines, batches, settings, today);
              const expanded = expandedSubstitutes === medicine.id;
              return (
                <div
                  key={medicine.id}
                  className="rounded-xl border border-muted-line/30 bg-white p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-bold text-ink">{medicine.name}</p>
                        <ScheduleChip schedule={medicine.schedule} />
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {[
                          medicine.composition,
                          medicine.strength,
                          medicine.packLabel,
                          medicine.rack && `Rack ${medicine.rack}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StockPill available={available} lowAt={medicine.lowStockAt} />
                      <button
                        type="button"
                        onClick={() => addMedicine(medicine, 1)}
                        className="inline-flex h-9 items-center gap-1 rounded-lg bg-indigo px-3 text-sm font-semibold text-white transition hover:bg-indigo/90 disabled:opacity-40"
                        disabled={available <= 0}
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Add
                      </button>
                      {medicine.packSize > 1 && (
                        <button
                          type="button"
                          onClick={() => addMedicine(medicine, medicine.packSize)}
                          className={secondaryBtnClass}
                          disabled={available <= 0}
                          title={`Add a whole ${medicine.packLabel || "pack"}`}
                        >
                          ×{medicine.packSize}
                        </button>
                      )}
                    </div>
                  </div>

                  {substitutes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setExpandedSubstitutes(expanded ? null : medicine.id)}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo hover:underline"
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
                      {expanded ? "Hide" : `${substitutes.length} same-salt`} alternative
                      {substitutes.length > 1 ? "s" : ""}
                    </button>
                  )}

                  {expanded && (
                    <div className="mt-2 grid gap-1 border-t border-muted-line/20 pt-2">
                      {substitutes.map((substitute) => (
                        <div
                          key={substitute.medicine.id}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="truncate text-ink">
                            {substitute.medicine.name}
                            <span className="ml-2 text-muted">
                              {substitute.medicine.manufacturer}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="text-muted">
                              MRP {formatMoney(substitute.mrp, currency)}
                            </span>
                            <button
                              type="button"
                              onClick={() => addMedicine(substitute.medicine, 1)}
                              className="rounded border border-indigo/40 px-2 py-0.5 font-semibold text-indigo disabled:opacity-40"
                              disabled={substitute.available <= 0}
                            >
                              {substitute.available > 0 ? "Add" : "None"}
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {heldCarts.length > 0 && (
          <div className="rounded-2xl border border-muted-line/30 bg-white p-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Held bills</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {heldCarts.map((cart) => (
                <div key={cart.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => recall(cart.id)}
                    className="rounded-lg border border-indigo/30 bg-indigo/5 px-3 py-1.5 text-sm font-semibold text-indigo"
                  >
                    {cart.label} · {cart.lines.length} items
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeHeldCart(cart.id)}
                    className="rounded p-1 text-muted hover:text-red-600"
                    aria-label={`Discard ${cart.label}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* The bill                                                          */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid content-start gap-3 rounded-2xl border border-muted-line/30 bg-white p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted">This bill</h3>
          {lines.length > 0 && (
            <button
              type="button"
              onClick={resetBill}
              className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Clear
            </button>
          )}
        </div>

        {lines.length === 0 ? (
          <EmptyState
            icon={<Layers className="h-6 w-6" />}
            title="Nothing on the bill yet"
            message="Search above and add a medicine. The oldest-expiring batch is picked for you."
          />
        ) : (
          <div className="grid gap-2">
            {lines.map((line) => {
              const batch = batches.find((row) => row.id === line.batchId);
              const blocked = batch ? batchBlockReason(batch, settings, today) : "";
              const near = batch ? daysToExpiry(batch.expiry, today) <= 90 : false;
              return (
                <div
                  key={line.id}
                  className={`rounded-xl border p-3 ${
                    blocked && blocked !== "empty"
                      ? "border-red-300 bg-red-50/40"
                      : near
                        ? "border-saffron/50 bg-saffron/5"
                        : "border-muted-line/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-bold text-ink">{line.name}</p>
                        <ScheduleChip schedule={line.schedule} />
                      </div>
                      <button
                        type="button"
                        onClick={() => setBatchPickerFor(line.id)}
                        className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted hover:text-indigo"
                      >
                        <span className="font-semibold">
                          B/No {line.batchNo || "—"} · Exp {formatExpiry(line.expiry)}
                        </span>
                        <ArrowLeftRight className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLineQuantity(line, 0)}
                      className="rounded p-1 text-muted hover:text-red-600"
                      aria-label={`Remove ${line.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setLineQuantity(line, line.quantity - 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-muted-line/40"
                        aria-label="One less"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        className="h-8 w-14 rounded-lg border border-muted-line/40 text-center text-sm font-bold"
                        value={line.quantity}
                        inputMode="numeric"
                        onChange={(event) =>
                          setLineQuantity(line, Math.max(0, Number(event.target.value) || 0))
                        }
                        aria-label={`Quantity of ${line.name}`}
                      />
                      <button
                        type="button"
                        onClick={() => setLineQuantity(line, line.quantity + 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-muted-line/40"
                        aria-label="One more"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      {line.packSize > 1 && (
                        <button
                          type="button"
                          onClick={() => setLineQuantity(line, line.quantity + line.packSize)}
                          className="ml-1 rounded-lg border border-muted-line/40 px-2 text-xs font-semibold text-muted"
                          title={`Add ${line.packSize} more`}
                        >
                          ×{line.packSize}
                        </button>
                      )}
                    </div>
                    <span className="text-sm font-bold text-ink">
                      {formatMoney(lineAmount(line), currency)}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <ExpiryChip expiry={line.expiry} today={today} />
                    <span className="text-muted">
                      MRP {formatMoney(line.mrp, currency)}
                    </span>
                    <label className="ml-auto flex items-center gap-1 text-muted">
                      Rate
                      <input
                        className="h-7 w-20 rounded border border-muted-line/40 px-1.5 text-right"
                        value={line.rate}
                        inputMode="decimal"
                        onChange={(event) => {
                          const value = Number(event.target.value) || 0;
                          // Never above MRP: the printed price is the legal
                          // ceiling, and a counter typing 90 for 9.0 should be
                          // caught here rather than on a customer's bill.
                          updateLine(line.id, { rate: Math.min(value, line.mrp || value) });
                        }}
                        aria-label={`Rate for ${line.name}`}
                      />
                    </label>
                    <label className="flex items-center gap-1 text-muted">
                      Disc %
                      <input
                        className="h-7 w-14 rounded border border-muted-line/40 px-1.5 text-right"
                        value={line.discountPct}
                        inputMode="decimal"
                        onChange={(event) =>
                          updateLine(line.id, {
                            discountPct: Math.min(100, Math.max(0, Number(event.target.value) || 0)),
                          })
                        }
                        aria-label={`Discount on ${line.name}`}
                      />
                    </label>
                  </div>

                  {customerId && (
                    <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                      Days of supply
                      <input
                        className="h-7 w-16 rounded border border-muted-line/40 px-1.5 text-right"
                        value={line.daysSupply || ""}
                        inputMode="numeric"
                        placeholder="—"
                        onChange={(event) =>
                          updateLine(line.id, { daysSupply: Math.max(0, Number(event.target.value) || 0) })
                        }
                      />
                      <span className="text-[11px]">sets a refill reminder</span>
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="border-t border-muted-line/20 pt-3">
          <CustomerPicker value={customerId} onChange={setCustomerId} />
        </div>

        {rxRequired && (
          <button
            type="button"
            onClick={() => setRxOpen(true)}
            className={`w-full rounded-lg border p-2.5 text-left text-xs font-semibold ${
              prescription
                ? "border-green-300 bg-green-50 text-green-800"
                : "border-red-300 bg-red-50 text-red-700"
            }`}
          >
            {prescription
              ? `Rx recorded — ${prescription.patientName}, Dr ${prescription.doctorName}`
              : `Prescription required for ${scheduledInCart.join(", ")} — tap to record`}
          </button>
        )}

        <div className="grid gap-2 border-t border-muted-line/20 pt-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted">Subtotal</span>
            <span className="font-semibold text-ink">
              {formatMoney(totals.subtotal, currency)}
            </span>
          </div>
          <label className="flex items-center justify-between gap-2">
            <span className="text-muted">Bill discount</span>
            <input
              className="h-8 w-24 rounded-lg border border-muted-line/40 px-2 text-right text-sm"
              value={discount}
              inputMode="decimal"
              placeholder="0"
              onChange={(event) => setDiscount(event.target.value)}
            />
          </label>
          {totals.byRate
            .filter((bucket) => bucket.rate > 0)
            .map((bucket) => (
              <div key={bucket.rate} className="flex items-center justify-between text-xs">
                <span className="text-muted">
                  CGST {bucket.rate / 2}% + SGST {bucket.rate / 2}%
                </span>
                <span className="text-muted">{formatMoney(bucket.tax, currency)}</span>
              </div>
            ))}
          {settings.taxInclusive && totals.taxTotal > 0 && (
            <p className="text-[11px] text-muted">Tax is included in the prices above.</p>
          )}
          <div className="flex items-center justify-between border-t border-muted-line/20 pt-2">
            <span className="font-bold text-ink">Total</span>
            <span className="text-lg font-bold text-ink">
              {formatMoney(totals.total, currency)}
            </span>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold text-muted">
            Payment
            <select
              className={inputClass}
              value={paymentMode}
              onChange={(event) => setPaymentMode(event.target.value)}
            >
              {settings.paymentModes.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-muted">
            Collected
            <input
              className={inputClass}
              value={paid}
              inputMode="decimal"
              placeholder={String(totals.total)}
              onChange={(event) => setPaid(event.target.value)}
            />
          </label>
        </div>
        {paid !== "" && Number(paid) < totals.total && (
          <Pill tone="warn">
            {formatMoney(totals.total - (Number(paid) || 0), currency)} will stay due
            {customerId ? "" : " — attach a customer to track it"}
          </Pill>
        )}

        {error && (
          <p className="text-sm font-semibold text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void finish()}
            className={`${primaryBtnClass} sm:flex-1`}
            disabled={lines.length === 0 || busy}
          >
            {busy ? "Saving…" : `Complete · ${formatMoney(totals.total, currency)}`}
          </button>
          <button
            type="button"
            onClick={async () => {
              await holdCart("", lines, Number(discount) || 0, customerId);
              resetBill();
            }}
            className={secondaryBtnClass}
            disabled={lines.length === 0}
          >
            <PauseCircle className="h-4 w-4" aria-hidden="true" />
            Hold
          </button>
        </div>
      </div>

      {batchPickerFor && (
        <BatchPicker
          open
          medicineId={lines.find((line) => line.id === batchPickerFor)?.medicineId ?? ""}
          currentBatchId={lines.find((line) => line.id === batchPickerFor)?.batchId ?? ""}
          onPick={(batch) => {
            const line = lines.find((row) => row.id === batchPickerFor);
            if (line) swapBatch(line, batch);
          }}
          onClose={() => setBatchPickerFor(null)}
        />
      )}

      <PrescriptionModal
        open={rxOpen}
        initial={prescription}
        scheduledNames={scheduledInCart}
        onSave={(record) => {
          setPrescription(record);
          setRxOpen(false);
        }}
        onClose={() => setRxOpen(false)}
      />

      <BillModal sale={completed} justSold onClose={() => setCompleted(null)} />
    </div>
  );
}
