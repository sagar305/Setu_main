"use client";

import { useMemo, useState } from "react";
import { Download, Package, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { usePharmacy } from "@/lib/pharmacy/store";
import {
  batchesForMedicine,
  batchBlockReason,
  sellableStock,
  totalStock,
} from "@/lib/pharmacy/calc";
import { velocity } from "@/lib/pharmacy/reports";
import { downloadCsv, medicinesCsv } from "@/lib/pharmacy/csv";
import { formatMoney } from "@/lib/pos/types";
import {
  formatExpiry,
  type Batch,
  type Medicine,
  type PharmacySettings,
} from "@/lib/pharmacy/types";
import { ImportMedicines } from "./ImportMedicines";
import { MedicineFormModal } from "./MedicineForm";
import {
  ConfirmDialog,
  EmptyState,
  ExpiryChip,
  Modal,
  Pill,
  ScheduleChip,
  SearchInput,
  StockPill,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "./ui";

export function MedicinesScreen() {
  const {
    adjustBatch,
    batches,
    business,
    deleteMedicine,
    medicines,
    sales,
    settings,
    today,
  } = usePharmacy();

  const [query, setQuery] = useState("");
  const [rack, setRack] = useState("");
  const [editing, setEditing] = useState<Medicine | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [detail, setDetail] = useState<Medicine | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Medicine | null>(null);

  const currency = business?.currency ?? "INR";

  const racks = useMemo(
    () =>
      [...new Set(medicines.map((medicine) => medicine.rack).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [medicines]
  );

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return medicines.filter((medicine) => {
      if (rack && medicine.rack !== rack) return false;
      if (!text) return true;
      return (
        medicine.name.toLowerCase().includes(text) ||
        medicine.composition.toLowerCase().includes(text) ||
        medicine.manufacturer.toLowerCase().includes(text) ||
        medicine.barcode.toLowerCase() === text
      );
    });
  }, [medicines, query, rack]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[200px] flex-1">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search brand, salt or manufacturer"
          />
        </div>
        {racks.length > 0 && (
          <select
            className={`${inputClass} w-auto`}
            value={rack}
            onChange={(event) => setRack(event.target.value)}
            aria-label="Filter by rack"
          >
            <option value="">All racks</option>
            {racks.map((option) => (
              <option key={option} value={option}>
                Rack {option}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className={primaryBtnClass}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add medicine
        </button>
        <button type="button" onClick={() => setImportOpen(true)} className={secondaryBtnClass}>
          <Upload className="h-4 w-4" aria-hidden="true" />
          Import
        </button>
        <button
          type="button"
          onClick={() => downloadCsv("medicines.csv", medicinesCsv(medicines))}
          className={secondaryBtnClass}
          disabled={medicines.length === 0}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Export
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Package className="h-6 w-6" />}
          title={medicines.length === 0 ? "No medicines yet" : "Nothing matches that"}
          message={
            medicines.length === 0
              ? "Import your existing master from a CSV, or add medicines one at a time as they come in."
              : "Try the salt name, or clear the rack filter."
          }
          action={
            medicines.length === 0 ? (
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className={primaryBtnClass}
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                Import a master list
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-2">
          {filtered.map((medicine) => {
            const available = sellableStock(batches, medicine.id, settings, today);
            const held = totalStock(batches, medicine.id);
            return (
              <div
                key={medicine.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-muted-line/30 bg-white p-3"
              >
                <button
                  type="button"
                  onClick={() => setDetail(medicine)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-bold text-ink">{medicine.name}</span>
                    <ScheduleChip schedule={medicine.schedule} />
                    {!medicine.active && <Pill tone="muted">Not stocked</Pill>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {[
                      medicine.composition,
                      medicine.strength,
                      medicine.manufacturer,
                      medicine.packLabel,
                      medicine.rack && `Rack ${medicine.rack}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  <StockPill available={available} lowAt={medicine.lowStockAt} />
                  {held > available && (
                    <Pill tone="warn">{held - available} unsellable</Pill>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(medicine);
                      setFormOpen(true);
                    }}
                    className="rounded-lg border border-muted-line/40 p-2 text-muted transition hover:border-indigo/40 hover:text-indigo"
                    aria-label={`Edit ${medicine.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(medicine)}
                    className="rounded-lg border border-muted-line/40 p-2 text-muted transition hover:border-red-300 hover:text-red-600"
                    aria-label={`Delete ${medicine.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <MedicineFormModal
        open={formOpen}
        medicine={editing}
        onClose={() => setFormOpen(false)}
      />
      <ImportMedicines open={importOpen} onClose={() => setImportOpen(false)} />

      {/* ------------------------------------------------------------ */}
      {/* Per-medicine detail: every batch, and how fast it moves       */}
      {/* ------------------------------------------------------------ */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.name ?? ""}
        wide
      >
        {detail && (
          <div className="grid gap-4">
            <p className="text-sm text-muted">
              {[detail.composition, detail.strength, detail.manufacturer, detail.packLabel]
                .filter(Boolean)
                .join(" · ")}
            </p>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-muted-line/30 p-3">
                <p className="text-xs font-semibold uppercase text-muted">Sellable now</p>
                <p className="text-xl font-bold text-ink">
                  {sellableStock(batches, detail.id, settings, today)}
                </p>
              </div>
              <div className="rounded-xl border border-muted-line/30 p-3">
                <p className="text-xs font-semibold uppercase text-muted">Sold, 90 days</p>
                <p className="text-xl font-bold text-ink">
                  {velocity(sales, detail.id, 90, today)}
                </p>
              </div>
              <div className="rounded-xl border border-muted-line/30 p-3">
                <p className="text-xs font-semibold uppercase text-muted">Low stock at</p>
                <p className="text-xl font-bold text-ink">{detail.lowStockAt}</p>
              </div>
            </div>

            <h4 className="text-sm font-bold uppercase tracking-wide text-muted">Batches</h4>
            <BatchList
              medicine={detail}
              batches={batches}
              settings={settings}
              today={today}
              currency={currency}
              onAdjust={(batchId, quantity, note) => void adjustBatch(batchId, quantity, note)}
            />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title={`Delete ${confirmDelete?.name ?? ""}?`}
        message="Its batches and their stock go with it. The movement log keeps its history."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (confirmDelete) await deleteMedicine(confirmDelete.id);
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

/**
 * A medicine's batches, with an inline stock correction.
 *
 * The correction is a "counted" figure rather than a delta, because that is
 * what the person holding the box knows: they counted eleven, not "minus
 * two". A note is required, so a year later the ledger says why.
 */
function BatchList({
medicine,
batches,
settings,
today,
currency,
onAdjust,
}: {
medicine: Medicine;
batches: Batch[];
settings: PharmacySettings;
today: string;
currency: string;
onAdjust: (batchId: string, quantity: number, note: string) => void;
}) {
  const rows = batchesForMedicine(batches, medicine.id);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted">
        No batches yet. Stock arrives through Purchases, which is what records the batch
        number and expiry.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {rows.map((batch) => {
        const blocked = batchBlockReason(batch, settings, today);
        return (
          <div key={batch.id} className="rounded-xl border border-muted-line/30 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink">{batch.batchNo || "No batch no."}</p>
                <p className="text-xs text-muted">
                  Exp {formatExpiry(batch.expiry)} · MRP {formatMoney(batch.mrp, currency)} ·
                  cost {formatMoney(batch.effectiveRate, currency)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ExpiryChip expiry={batch.expiry} today={today} />
                <Pill tone={blocked ? "warn" : "good"}>{batch.quantity} in hand</Pill>
                <button
                  type="button"
                  onClick={() => {
                    setAdjusting(adjusting === batch.id ? null : batch.id);
                    setCounted(String(batch.quantity));
                    setNote("");
                  }}
                  className="rounded-lg border border-muted-line/40 px-2 py-1 text-xs font-semibold text-muted hover:border-indigo/40 hover:text-indigo"
                >
                  Correct
                </button>
              </div>
            </div>

            {adjusting === batch.id && (
              <div className="mt-3 grid gap-2 border-t border-muted-line/20 pt-3 sm:grid-cols-[100px_1fr_auto]">
                <input
                  className={inputClass}
                  value={counted}
                  inputMode="numeric"
                  onChange={(event) => setCounted(event.target.value)}
                  aria-label="Counted quantity"
                  placeholder="Counted"
                />
                <input
                  className={inputClass}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Why — stock count, breakage, entry error"
                />
                <button
                  type="button"
                  className={primaryBtnClass}
                  disabled={!note.trim()}
                  onClick={() => {
                    onAdjust(batch.id, Number(counted) || 0, note.trim());
                    setAdjusting(null);
                  }}
                >
                  Save
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
