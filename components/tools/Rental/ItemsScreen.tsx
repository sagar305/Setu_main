"use client";

// The stock: what is owned, what it costs to hire, and what it is worth if it
// does not come back.
//
// Grouped by category, because that is how a yard is laid out and how an owner
// thinks about it. Each row carries the one figure that matters at a glance —
// how many are free today — so this screen answers a phone call on its own,
// without going to Availability for a single item.

import { useMemo, useRef, useState } from "react";
import { Boxes, Image as ImageIcon, Pencil, Plus, Trash2 } from "lucide-react";
import { formatMoney } from "@/lib/pos/types";
import { useRental } from "@/lib/rental/store";
import { availabilityFor } from "@/lib/rental/availability";
import {
  RATE_BASIS_LABELS,
  RATE_BASIS_SUFFIX,
  type ItemCategory,
  type RateBasis,
  type RentalItem,
} from "@/lib/rental/types";
import { ItemDetail } from "./ItemDetail";
import {
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  SearchInput,
  chipBtnClass,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "./ui";

export function ItemsScreen() {
  const { business, categories, deleteItem, index, items, saveCategory, today, units } =
    useRental();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<RentalItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detailFor, setDetailFor] = useState<RentalItem | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<RentalItem | null>(null);
  const [error, setError] = useState("");

  const currency = business?.currency ?? "INR";

  const grouped = useMemo(() => {
    const search = query.trim().toLowerCase();
    const matching = items.filter(
      (item) => !search || item.name.toLowerCase().includes(search)
    );
    const buckets = new Map<string, RentalItem[]>();
    for (const item of matching) {
      const list = buckets.get(item.categoryId) ?? [];
      list.push(item);
      buckets.set(item.categoryId, list);
    }
    return categories
      .map((category) => ({
        category,
        rows: (buckets.get(category.id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .concat(
        buckets.has("")
          ? [
              {
                category: { id: "", name: "Uncategorised", sortOrder: 999, createdAt: "" },
                rows: buckets.get("") ?? [],
              },
            ]
          : []
      )
      .filter((group) => group.rows.length > 0);
  }, [categories, items, query]);

  const freeToday = (item: RentalItem) => {
    const retired = units.filter(
      (unit) => unit.itemId === item.id && unit.condition === "retired"
    ).length;
    return availabilityFor(index, item, today, today, retired);
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[200px] flex-1">
          <SearchInput value={query} onChange={setQuery} placeholder="Search stock" />
        </div>
        <button type="button" onClick={() => setCategoryOpen(true)} className={chipBtnClass}>
          Categories
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className={primaryBtnClass}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add item
        </button>
      </div>

      {error ? (
        <p className="text-sm font-semibold text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {grouped.length === 0 ? (
        <EmptyState
          icon={<Boxes className="h-6 w-6" />}
          title="Nothing on the books yet"
          message="Add the items you hire out — chairs, lights, cameras, scaffolding — with how many you own."
          action={
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className={primaryBtnClass}
            >
              Add your first item
            </button>
          }
        />
      ) : (
        grouped.map((group) => (
          <section key={group.category.id || "none"}>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
              {group.category.name}
            </h3>
            <div className="grid gap-2">
              {group.rows.map((item) => {
                const availability = freeToday(item);
                return (
                  <article
                    key={item.id}
                    className={`flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-3 ${
                      item.active ? "border-muted-line/30" : "border-dashed border-muted-line/40 opacity-60"
                    }`}
                  >
                    {item.imageDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageDataUrl}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-cream text-muted">
                        <ImageIcon className="h-5 w-5" aria-hidden="true" />
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => setDetailFor(item)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-sm font-bold text-ink">
                        {item.name}
                        {item.tracking === "serialised" ? (
                          <span className="ml-2 rounded-full border border-muted-line/40 px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                            serialised
                          </span>
                        ) : null}
                        {!item.active ? (
                          <span className="ml-2 text-xs font-normal text-muted">(inactive)</span>
                        ) : null}
                      </span>
                      <span className="block text-xs text-muted">
                        {formatMoney(item.rate, currency)}
                        {RATE_BASIS_SUFFIX[item.rateBasis]}
                        {item.depositPerUnit
                          ? ` · deposit ${formatMoney(item.depositPerUnit, currency)}`
                          : ""}
                        {item.replacementValue
                          ? ` · replace ${formatMoney(item.replacementValue, currency)}`
                          : ""}
                      </span>
                    </button>

                    <div className="text-right">
                      <p className="text-sm font-bold text-ink">
                        {availability.free}
                        <span className="ml-1 text-xs font-normal text-muted">
                          of {availability.total} free today
                        </span>
                      </p>
                      {availability.committed > 0 ? (
                        <p className="text-xs text-muted">{availability.committed} out</p>
                      ) : null}
                    </div>

                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(item);
                          setFormOpen(true);
                        }}
                        className={chipBtnClass}
                        aria-label={`Edit ${item.name}`}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(item)}
                        className={chipBtnClass}
                        aria-label={`Delete ${item.name}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}

      <ItemForm
        open={formOpen}
        item={editing}
        categories={categories}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />

      <ItemDetail item={detailFor} onClose={() => setDetailFor(null)} />

      <CategoryManager
        open={categoryOpen}
        onClose={() => setCategoryOpen(false)}
        onSave={saveCategory}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete this item?"
        message="Past bookings keep their record of it, but it disappears from the catalogue and from availability."
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          const target = confirmDelete;
          setConfirmDelete(null);
          if (!target) return;
          setError("");
          try {
            await deleteItem(target.id);
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Could not delete that item.");
          }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

const RATE_BASES: RateBasis[] = ["per-day", "per-event", "per-hour"];

function ItemForm({
  open,
  item,
  categories,
  onClose,
}: {
  open: boolean;
  item: RentalItem | null;
  categories: ItemCategory[];
  onClose: () => void;
}) {
  const { saveItem, addUnits, settings } = useRental();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(() => blankItem(categories[0]?.id ?? ""));
  const [serials, setSerials] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reset whenever the modal is opened for a different item.
  const key = `${open}-${item?.id ?? "new"}`;
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setForm(
      item
        ? {
            name: item.name,
            categoryId: item.categoryId,
            tracking: item.tracking,
            totalQuantity: String(item.totalQuantity),
            rateBasis: item.rateBasis,
            rate: String(item.rate),
            minOrderQuantity: String(item.minOrderQuantity || 1),
            minAdvancePercent:
              item.minAdvancePercent === null ? "" : String(item.minAdvancePercent),
            depositPerUnit: String(item.depositPerUnit || ""),
            lateFeePerUnitPerDay: String(item.lateFeePerUnitPerDay || ""),
            replacementValue: String(item.replacementValue || ""),
            purchaseCost: String(item.purchaseCost || ""),
            purchasedOn: item.purchasedOn,
            imageDataUrl: item.imageDataUrl,
            active: item.active,
            notes: item.notes,
          }
        : blankItem(categories[0]?.id ?? "")
    );
    setSerials("");
    setError("");
  }

  const patch = (updates: Partial<typeof form>) =>
    setForm((current) => ({ ...current, ...updates }));

  const submit = async () => {
    if (!form.name.trim()) {
      setError("Give the item a name.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await saveItem(
        {
          name: form.name.trim(),
          categoryId: form.categoryId,
          tracking: form.tracking,
          totalQuantity: Math.max(0, Number(form.totalQuantity) || 0),
          rateBasis: form.rateBasis,
          rate: Number(form.rate) || 0,
          minOrderQuantity: Math.max(1, Number(form.minOrderQuantity) || 1),
          minAdvancePercent:
            form.minAdvancePercent.trim() === ""
              ? null
              : Math.min(100, Math.max(0, Number(form.minAdvancePercent) || 0)),
          depositPerUnit: Number(form.depositPerUnit) || 0,
          lateFeePerUnitPerDay: Number(form.lateFeePerUnitPerDay) || 0,
          replacementValue: Number(form.replacementValue) || 0,
          purchaseCost: Number(form.purchaseCost) || 0,
          purchasedOn: form.purchasedOn,
          imageDataUrl: form.imageDataUrl,
          active: form.active,
          notes: form.notes,
        },
        item?.id
      );

      const lines = serials
        .split(/[\n,]/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length > 0) await addUnits(saved.id, lines);

      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the item.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={item ? `Edit ${item.name}` : "Add item"} wide>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required>
            <input
              className={inputClass}
              value={form.name}
              onChange={(event) => patch({ name: event.target.value })}
              placeholder="Plastic chair – white"
              autoFocus
            />
          </Field>
          <Field label="Category">
            <select
              className={inputClass}
              value={form.categoryId}
              onChange={(event) => patch({ categoryId: event.target.value })}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="How many owned" required>
            <input
              className={inputClass}
              inputMode="numeric"
              value={form.totalQuantity}
              onChange={(event) => patch({ totalQuantity: event.target.value })}
            />
          </Field>
          <Field label="Rate">
            <input
              className={inputClass}
              inputMode="decimal"
              value={form.rate}
              onChange={(event) => patch({ rate: event.target.value })}
            />
          </Field>
          <Field label="Charged">
            <select
              className={inputClass}
              value={form.rateBasis}
              onChange={(event) => patch({ rateBasis: event.target.value as RateBasis })}
            >
              {RATE_BASES.map((basis) => (
                <option key={basis} value={basis}>
                  {RATE_BASIS_LABELS[basis]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Minimum order quantity"
            hint="Nobody sends a lorry out with one chair on it."
          >
            <input
              className={inputClass}
              inputMode="numeric"
              value={form.minOrderQuantity}
              onChange={(event) => patch({ minOrderQuantity: event.target.value })}
            />
          </Field>
          <Field
            label="Minimum advance %"
            hint="Leave blank to use the figure in Settings."
          >
            <input
              className={inputClass}
              inputMode="decimal"
              value={form.minAdvancePercent}
              onChange={(event) => patch({ minAdvancePercent: event.target.value })}
              placeholder={`${settings.minAdvancePercent}% (from Settings)`}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Deposit per unit" hint="Refunded at return.">
            <input
              className={inputClass}
              inputMode="decimal"
              value={form.depositPerUnit}
              onChange={(event) => patch({ depositPerUnit: event.target.value })}
            />
          </Field>
          <Field label="Late fee / unit / day">
            <input
              className={inputClass}
              inputMode="decimal"
              value={form.lateFeePerUnitPerDay}
              onChange={(event) => patch({ lateFeePerUnitPerDay: event.target.value })}
            />
          </Field>
          <Field label="Replacement value" hint="What a lost unit costs the customer.">
            <input
              className={inputClass}
              inputMode="decimal"
              value={form.replacementValue}
              onChange={(event) => patch({ replacementValue: event.target.value })}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Purchase cost per unit">
            <input
              className={inputClass}
              inputMode="decimal"
              value={form.purchaseCost}
              onChange={(event) => patch({ purchaseCost: event.target.value })}
            />
          </Field>
          <Field label="Purchased on">
            <input
              type="date"
              className={inputClass}
              value={form.purchasedOn}
              onChange={(event) => patch({ purchasedOn: event.target.value })}
            />
          </Field>
          <Field label="Tracking" hint="Serialised items are ticked off by unit at dispatch.">
            <select
              className={inputClass}
              value={form.tracking}
              onChange={(event) =>
                patch({ tracking: event.target.value as RentalItem["tracking"] })
              }
            >
              <option value="bulk">Bulk — counted</option>
              <option value="serialised">Serialised — tracked individually</option>
            </select>
          </Field>
        </div>

        {form.tracking === "serialised" ? (
          <Field
            label="Add serial numbers"
            hint="One per line, or comma-separated. Existing units are kept."
          >
            <textarea
              className={inputClass}
              rows={3}
              value={serials}
              onChange={(event) => setSerials(event.target.value)}
              placeholder={"CAM-001\nCAM-002"}
            />
          </Field>
        ) : null}

        <div className="flex items-center gap-3">
          {form.imageDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={form.imageDataUrl}
              alt=""
              className="h-16 w-16 rounded-lg object-cover"
            />
          ) : null}
          <button type="button" onClick={() => fileRef.current?.click()} className={secondaryBtnClass}>
            <ImageIcon className="h-4 w-4" aria-hidden="true" />
            {form.imageDataUrl ? "Change photo" : "Add photo"}
          </button>
          {form.imageDataUrl ? (
            <button
              type="button"
              onClick={() => patch({ imageDataUrl: "" })}
              className="text-xs font-semibold text-muted hover:text-red-600"
            >
              Remove
            </button>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              patch({ imageDataUrl: await downscaleImage(file) });
            }}
          />
        </div>

        <Field label="Notes">
          <textarea
            className={inputClass}
            rows={2}
            value={form.notes}
            onChange={(event) => patch({ notes: event.target.value })}
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(event) => patch({ active: event.target.checked })}
            className="h-4 w-4 accent-indigo"
          />
          Active — offer this on new bookings
        </label>

        {error ? (
          <p className="text-sm font-semibold text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void submit()}
            className={`${primaryBtnClass} flex-1`}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save item"}
          </button>
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CategoryManager({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (input: { name: string; sortOrder: number }, id?: string) => Promise<ItemCategory>;
}) {
  const { categories, deleteCategory } = useRental();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  return (
    <Modal open={open} onClose={onClose} title="Categories">
      <div className="space-y-3">
        {categories.map((category) => (
          <div
            key={category.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-muted-line/30 px-3 py-2"
          >
            <span className="text-sm text-ink">{category.name}</span>
            <button
              type="button"
              onClick={async () => {
                setError("");
                try {
                  await deleteCategory(category.id);
                } catch (caught) {
                  setError(caught instanceof Error ? caught.message : "Could not delete that.");
                }
              }}
              className="text-muted hover:text-red-600"
              aria-label={`Delete ${category.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        <div className="flex gap-2">
          <input
            className={inputClass}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New category"
          />
          <button
            type="button"
            className={primaryBtnClass}
            onClick={async () => {
              if (!name.trim()) return;
              await onSave({ name: name.trim(), sortOrder: categories.length });
              setName("");
            }}
          >
            Add
          </button>
        </div>

        {error ? (
          <p className="text-sm font-semibold text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

function blankItem(categoryId: string) {
  return {
    name: "",
    categoryId,
    tracking: "bulk" as RentalItem["tracking"],
    totalQuantity: "",
    rateBasis: "per-day" as RateBasis,
    rate: "",
    minOrderQuantity: "1",
    minAdvancePercent: "",
    depositPerUnit: "",
    lateFeePerUnitPerDay: "",
    replacementValue: "",
    purchaseCost: "",
    purchasedOn: "",
    imageDataUrl: "",
    active: true,
    notes: "",
  };
}

/**
 * Photos live as data URLs inside the item record, so they have to be small — a
 * 4MB phone photo per item would fill the origin's storage quota inside a few
 * hundred items, and the picture is only ever shown at thumbnail size.
 */
async function downscaleImage(file: File, maxSize = 480): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.readAsDataURL(file);
  });

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Could not decode the image."));
      element.src = dataUrl;
    });
    const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return dataUrl;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.78);
  } catch {
    // A format the canvas cannot decode still deserves to be stored as-is.
    return dataUrl;
  }
}
