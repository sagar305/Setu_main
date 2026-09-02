"use client";

// One item, in full: what it earns, what it costs to keep, which units exist
// and what has been repaired.
//
// The utilisation figure at the top is the one an owner buys and sells stock
// on, so it is stated in unit-days over the last ninety days rather than as a
// count of bookings — twenty of two hundred chairs out for three days is not
// "the chairs were busy".

import { useMemo, useState } from "react";
import { Trash2, Wrench } from "lucide-react";
import { formatMoney } from "@/lib/pos/types";
import { useRental } from "@/lib/rental/store";
import { availabilityFor } from "@/lib/rental/availability";
import { utilisationByItem } from "@/lib/rental/reports";
import {
  MAINTENANCE_KIND_LABELS,
  RATE_BASIS_SUFFIX,
  UNIT_CONDITION_LABELS,
  addDays,
  formatDate,
  type ItemUnit,
  type MaintenanceLog,
  type RentalItem,
} from "@/lib/rental/types";
import {
  Field,
  Modal,
  Pill,
  StatCard,
  chipBtnClass,
  inputClass,
  primaryBtnClass,
} from "./ui";

export function ItemDetail({ item, onClose }: { item: RentalItem | null; onClose: () => void }) {
  const {
    bookings,
    business,
    deleteMaintenance,
    deleteUnit,
    index,
    items,
    maintenanceLogs,
    saveMaintenance,
    saveUnit,
    settings,
    today,
    units,
  } = useRental();

  const [logOpen, setLogOpen] = useState(false);
  const currency = business?.currency ?? "INR";

  const period = useMemo(() => ({ from: addDays(today, -89), to: today }), [today]);

  const stats = useMemo(() => {
    if (!item) return null;
    return utilisationByItem([item], bookings, maintenanceLogs, period, settings)[0] ?? null;
  }, [bookings, item, maintenanceLogs, period, settings]);

  const itemUnits = useMemo(
    () => (item ? units.filter((unit) => unit.itemId === item.id) : []),
    [item, units]
  );

  const logs = useMemo(
    () =>
      item
        ? maintenanceLogs
            .filter((log) => log.itemId === item.id)
            .sort((a, b) => b.date.localeCompare(a.date))
        : [],
    [item, maintenanceLogs]
  );

  if (!item) return null;

  const retired = itemUnits.filter((unit) => unit.condition === "retired").length;
  const availability = availabilityFor(index, item, today, today, retired);

  const cycleCondition = (unit: ItemUnit) => {
    const next: ItemUnit["condition"] =
      unit.condition === "good" ? "needs-repair" : unit.condition === "needs-repair" ? "retired" : "good";
    void saveUnit({ ...unit, condition: next });
  };

  return (
    <Modal open onClose={onClose} title={item.name} wide>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Free today"
            value={`${availability.free}`}
            sub={`of ${availability.total} owned`}
          />
          <StatCard
            label="Utilisation"
            value={`${Math.round((stats?.utilisation ?? 0) * 100)}%`}
            sub="last 90 days, unit-days"
          />
          <StatCard
            label="Revenue"
            value={formatMoney(stats?.revenue ?? 0, currency)}
            sub={`${stats?.bookings ?? 0} bookings`}
          />
          <StatCard
            label="Return on cost"
            value={
              stats?.returnOnCost === null || stats?.returnOnCost === undefined
                ? "—"
                : `${Math.round(stats.returnOnCost * 100)}%`
            }
            sub={
              item.purchaseCost
                ? `cost ${formatMoney(item.purchaseCost * item.totalQuantity, currency)}`
                : "add a purchase cost"
            }
          />
        </div>

        <section className="rounded-xl bg-cream-paper/70 p-4 text-sm">
          <dl className="grid gap-1 sm:grid-cols-2">
            <Row
              label="Rate"
              value={`${formatMoney(item.rate, currency)}${RATE_BASIS_SUFFIX[item.rateBasis]}`}
            />
            <Row label="Deposit per unit" value={formatMoney(item.depositPerUnit, currency)} />
            <Row
              label="Late fee"
              value={`${formatMoney(item.lateFeePerUnitPerDay, currency)} / unit / day`}
            />
            <Row label="Replacement value" value={formatMoney(item.replacementValue, currency)} />
            <Row
              label="Purchased"
              value={item.purchasedOn ? formatDate(item.purchasedOn) : "—"}
            />
            <Row
              label="Maintenance spend"
              value={formatMoney(stats?.maintenanceSpend ?? 0, currency)}
            />
          </dl>
          {item.notes ? <p className="mt-2 whitespace-pre-wrap text-xs text-muted">{item.notes}</p> : null}
        </section>

        {item.tracking === "serialised" ? (
          <section>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
              Units · {itemUnits.length}
            </h4>
            {itemUnits.length === 0 ? (
              <p className="text-sm text-muted">
                No units yet — add serial numbers by editing this item.
              </p>
            ) : (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {itemUnits.map((unit) => {
                  const holder = unit.currentBookingId
                    ? bookings.find((booking) => booking.id === unit.currentBookingId)
                    : null;
                  return (
                    <div
                      key={unit.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-muted-line/30 bg-white px-3 py-2"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">
                          {unit.serialNo || unit.id.slice(0, 8)}
                        </span>
                        <span className="text-xs text-muted">
                          {holder ? `Out on ${holder.bookingNo}` : "In the godown"}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => cycleCondition(unit)}
                          title="Change condition"
                        >
                          <Pill
                            tone={
                              unit.condition === "good"
                                ? "good"
                                : unit.condition === "needs-repair"
                                  ? "warn"
                                  : "danger"
                            }
                          >
                            {UNIT_CONDITION_LABELS[unit.condition]}
                          </Pill>
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteUnit(unit.id)}
                          className="text-muted hover:text-red-600"
                          aria-label={`Delete unit ${unit.serialNo}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wide text-muted">
              Maintenance · {logs.length}
            </h4>
            <button type="button" onClick={() => setLogOpen(true)} className={chipBtnClass}>
              <Wrench className="h-4 w-4" aria-hidden="true" />
              Log a repair
            </button>
          </div>

          {logs.length === 0 ? (
            <p className="text-sm text-muted">Nothing logged yet.</p>
          ) : (
            <div className="grid gap-1.5">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between gap-2 rounded-lg border border-muted-line/30 bg-white px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-ink">
                      <strong>{MAINTENANCE_KIND_LABELS[log.kind]}</strong>
                      {log.quantity > 1 ? ` × ${log.quantity}` : ""} · {formatDate(log.date)}
                    </p>
                    {log.description ? (
                      <p className="text-xs text-muted">{log.description}</p>
                    ) : null}
                    {log.outOfServiceFrom ? (
                      <p className="text-xs text-amber-700">
                        Out of service {formatDate(log.outOfServiceFrom)}
                        {log.outOfServiceTo ? ` – ${formatDate(log.outOfServiceTo)}` : " onwards"}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold text-ink">
                      {formatMoney(log.cost, currency)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void deleteMaintenance(log.id)}
                      className="text-muted hover:text-red-600"
                      aria-label="Delete log"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <MaintenanceForm
        open={logOpen}
        item={item}
        today={today}
        onClose={() => setLogOpen(false)}
        onSave={saveMaintenance}
        knownItems={items}
      />
    </Modal>
  );
}

function MaintenanceForm({
  open,
  item,
  today,
  onClose,
  onSave,
  knownItems,
}: {
  open: boolean;
  item: RentalItem;
  today: string;
  onClose: () => void;
  onSave: (input: Omit<MaintenanceLog, "id" | "createdAt">) => Promise<MaintenanceLog>;
  knownItems: RentalItem[];
}) {
  const [kind, setKind] = useState<MaintenanceLog["kind"]>("repair");
  const [quantity, setQuantity] = useState("1");
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [outFrom, setOutFrom] = useState(today);
  const [outTo, setOutTo] = useState("");
  const [blocks, setBlocks] = useState(true);
  const [saving, setSaving] = useState(false);

  void knownItems;

  const submit = async () => {
    setSaving(true);
    try {
      await onSave({
        itemId: item.id,
        unitId: null,
        quantity: Math.max(1, Number(quantity) || 1),
        date,
        kind,
        description: description.trim(),
        cost: Number(cost) || 0,
        outOfServiceFrom: blocks ? outFrom : null,
        outOfServiceTo: blocks && outTo ? outTo : null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Maintenance · ${item.name}`}>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Kind">
            <select
              className={inputClass}
              value={kind}
              onChange={(event) => setKind(event.target.value as MaintenanceLog["kind"])}
            >
              {(Object.keys(MAINTENANCE_KIND_LABELS) as MaintenanceLog["kind"][]).map((option) => (
                <option key={option} value={option}>
                  {MAINTENANCE_KIND_LABELS[option]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="How many units">
            <input
              className={inputClass}
              inputMode="numeric"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </Field>
          <Field label="Date">
            <input
              type="date"
              className={inputClass}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
        </div>

        <Field label="What was done">
          <input
            className={inputClass}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Welded frame, replaced canvas"
          />
        </Field>

        <Field label="Cost">
          <input
            className={inputClass}
            inputMode="decimal"
            value={cost}
            onChange={(event) => setCost(event.target.value)}
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={blocks}
            onChange={(event) => setBlocks(event.target.checked)}
            className="h-4 w-4 accent-indigo"
          />
          Take these units out of availability
        </label>

        {blocks ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Out from">
              <input
                type="date"
                className={inputClass}
                value={outFrom}
                onChange={(event) => setOutFrom(event.target.value)}
              />
            </Field>
            <Field label="Back by" hint="Leave blank if you do not know yet.">
              <input
                type="date"
                className={inputClass}
                value={outTo}
                min={outFrom}
                onChange={(event) => setOutTo(event.target.value)}
              />
            </Field>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void submit()}
          className={`${primaryBtnClass} w-full`}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save log"}
        </button>
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold text-ink">{value}</dd>
    </div>
  );
}
