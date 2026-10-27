"use client";

import { useI18n } from "@/lib/i18n";
import { fill, type TKey } from "@/lib/i18n/translate";
import { useMemo, useRef, useState } from "react";
import {
  Download,
  Pencil,
  Plus,
  Trash2,
  Upload,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useDine, type MenuItemInput } from "@/lib/dine/store";
import { formatPaise, formatPlain, parseAmount } from "@/lib/dine/money";
import { downloadCsv, menuCsv, parseMenuCsv } from "@/lib/dine/csv";
import { FOOD_TYPE_ORDER, foodTypeLabel, type DineMenuItem } from "@/lib/dine/types";
import { RecipeBadge, RecipeModal } from "./RecipeModal";
import {
  ConfirmDialog,
  EmptyState,
  Field,
  FoodDot,
  Modal,
  SearchInput,
  SectionHeading,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
  tapTargetClass,
} from "./ui";

export function MenuScreen({ externalQuery }: { externalQuery?: string }) {
  const { lang, t } = useI18n();
  const {
    menuItems,
    categories,
    variations,
    modifierGroups,
    modifiers,
    business,
    settings,
    setItemAvailable,
    deleteMenuItem,
    createCategory,
    renameCategory,
    deleteCategory,
    importMenu,
  } = useDine();

  const currency = business?.currency ?? "INR";
  const [query, setQuery] = useState(externalQuery ?? "");
  const [categoryId, setCategoryId] = useState("all");
  const [editing, setEditing] = useState<DineMenuItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DineMenuItem | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [importReport, setImportReport] = useState<string[]>([]);
  const [recipeFor, setRecipeFor] = useState<DineMenuItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const orderedCategories = useMemo(
    () => categories.slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [categories]
  );

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    return menuItems
      .filter((item) => categoryId === "all" || item.categoryId === categoryId)
      .filter((item) => !search || item.name.toLowerCase().includes(search))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }, [categoryId, menuItems, query]);

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    const result = parseMenuCsv(await file.text(), lang);
    if (result.rows.length > 0) {
      const added = await importMenu(result.rows, false);
      setImportReport([
        fill(t(added === 1 ? "dnMnAdded1" : "dnMnAddedN"), { n: added }),
        ...result.errors,
      ]);
    } else {
      setImportReport(result.errors.length ? result.errors : [t("dnMnNothingToImport")]);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-5">
      <SectionHeading
        title={t("dnNavMenu")}
        subtitle={fill(t("dnMnSubtitle"), {
          items: fill(t(menuItems.length === 1 ? "dnMnItemCount1" : "dnMnItemCountN"), {
            n: menuItems.length,
          }),
          categories: fill(t(categories.length === 1 ? "dnMnCatCount1" : "dnMnCatCountN"), {
            n: categories.length,
          }),
        })}
        action={
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => void onImport(event.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() =>
                downloadCsv(
                  "menu.csv",
                  menuCsv(menuItems, categories, variations, modifierGroups, modifiers)
                )
              }
              className={secondaryBtnClass}
            >
              <Download className="h-4 w-4" />
              {t("appExport")}
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={secondaryBtnClass}
            >
              <Upload className="h-4 w-4" />
              {t("appImport")}
            </button>
            <button type="button" onClick={() => setCreating(true)} className={primaryBtnClass}>
              <Plus className="h-4 w-4" />
              Add item
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[200px] flex-1">
          <SearchInput value={query} onChange={setQuery} placeholder={t("dnMnSearchPh")} />
        </div>
        <button
          type="button"
          onClick={() => setCategoriesOpen(true)}
          className="text-sm font-semibold text-indigo"
        >
          {t("dnMnManageCategories")}
        </button>
      </div>

      <div className="-mx-1 flex gap-1 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setCategoryId("all")}
          aria-pressed={categoryId === "all"}
          className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
            categoryId === "all" ? "bg-indigo text-white" : "text-muted hover:bg-white"
          }`}
        >
          All
        </button>
        {orderedCategories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setCategoryId(category.id)}
            aria-pressed={categoryId === category.id}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
              categoryId === category.id ? "bg-indigo text-white" : "text-muted hover:bg-white"
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<UtensilsCrossed className="h-6 w-6" />}
          title={t("dnMnNoDishes")}
          message={t("dnMnNoDishesBody")}
          action={
            <button type="button" onClick={() => setCreating(true)} className={primaryBtnClass}>
              <Plus className="h-4 w-4" />
              Add item
            </button>
          }
        />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => {
            const itemVariations = variations.filter(
              (variation) => variation.menuItemId === item.id
            );
            const groupCount = modifierGroups.filter(
              (group) => group.menuItemId === item.id
            ).length;
            return (
              <div
                key={item.id}
                className={`rounded-2xl border p-3 shadow-sm transition ${
                  item.available
                    ? "border-muted-line/30 bg-white"
                    : "border-muted-line/30 bg-cream/60"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
                      <FoodDot type={item.foodType} />
                      <span className={item.available ? "" : "text-muted line-through"}>
                        {item.name}
                      </span>
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-indigo">
                      {itemVariations.length > 0
                        ? `${formatPaise(
                            Math.min(...itemVariations.map((v) => v.price)),
                            currency
                          )} – ${formatPaise(
                            Math.max(...itemVariations.map((v) => v.price)),
                            currency
                          )}`
                        : formatPaise(item.price, currency)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {item.taxRate === null
                        ? `${settings.defaultTaxRate}% (default)`
                        : `${item.taxRate}%`}{" "}
                      · {item.taxInclusive ? t("dnMnInclusive") : t("dnMnExclusive")}
                      {itemVariations.length > 0 && ` · ${itemVariations.length} sizes`}
                      {groupCount > 0 && ` · ${groupCount} option group`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => setEditing(item)}
                      aria-label={fill(t("dnMnEditDish"), { name: item.name })}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-cream hover:text-indigo"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      aria-label={fill(t("appDeleteNamed"), { name: item.name })}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {settings.inventoryEnabled && (
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <RecipeBadge item={item} />
                    <button
                      type="button"
                      onClick={() => setRecipeFor(item)}
                      className="text-xs font-semibold text-indigo"
                    >
                      Recipe
                    </button>
                  </div>
                )}

                {/* FR-2.5: sold out at 8pm, back on the menu tomorrow. */}
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs font-semibold text-muted">
                  <input
                    type="checkbox"
                    checked={item.available}
                    onChange={(event) => void setItemAvailable(item.id, event.target.checked)}
                    className="h-4 w-4 accent-[#26306B]"
                  />
                  {item.available ? t("dnMnAvailable") : t("dnMnSoldOut")}
                </label>
              </div>
            );
          })}
        </div>
      )}

      {(creating || editing) && (
        <MenuItemModal
          item={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={fill(t("dnInDeleteTitle"), { name: deleteTarget?.name ?? t("dnMnThisDish") })}
        message={t("dnMnDeleteBody")}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await deleteMenuItem(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />

      {recipeFor && <RecipeModal item={recipeFor} onClose={() => setRecipeFor(null)} />}

      <CategoriesModal
        open={categoriesOpen}
        onClose={() => setCategoriesOpen(false)}
        onCreate={createCategory}
        onRename={renameCategory}
        onDelete={deleteCategory}
      />

      <Modal
        open={importReport.length > 0}
        onClose={() => setImportReport([])}
        title={t("dnMnImportTitle")}
      >
        <ul className="space-y-1 text-sm text-ink">
          {importReport.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}

const EMPTY_ITEM: MenuItemInput = {
  name: "",
  categoryId: "",
  price: 0,
  taxRate: null,
  taxInclusive: true,
  foodType: "veg",
  available: true,
  description: "",
  imageDataUrl: "",
  variations: [],
  modifierGroups: [],
};

function MenuItemModal({ item, onClose }: { item: DineMenuItem | null; onClose: () => void }) {
  const { lang, t } = useI18n();
  const {
    categories,
    variations,
    modifierGroups,
    modifiers,
    settings,
    createMenuItem,
    updateMenuItem,
    createCategory,
  } = useDine();

  const [form, setForm] = useState<MenuItemInput>(() => {
    if (!item) {
      return {
        ...EMPTY_ITEM,
        categoryId: categories[0]?.id ?? "",
        taxInclusive: settings.pricesIncludeTaxByDefault,
      };
    }
    return {
      name: item.name,
      categoryId: item.categoryId,
      price: item.price,
      taxRate: item.taxRate,
      taxInclusive: item.taxInclusive,
      foodType: item.foodType,
      available: item.available,
      description: item.description,
      imageDataUrl: item.imageDataUrl,
      variations: variations
        .filter((variation) => variation.menuItemId === item.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((variation) => ({ id: variation.id, name: variation.name, price: variation.price })),
      modifierGroups: modifierGroups
        .filter((group) => group.menuItemId === item.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((group) => ({
          id: group.id,
          name: group.name,
          minSelect: group.minSelect,
          maxSelect: group.maxSelect,
          options: modifiers
            .filter((modifier) => modifier.groupId === group.id)
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((modifier) => ({
              id: modifier.id,
              name: modifier.name,
              priceDelta: modifier.priceDelta,
            })),
        })),
    };
  });

  const [priceText, setPriceText] = useState(item ? formatPlain(item.price) : "");
  const [busy, setBusy] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  const patch = (updates: Partial<MenuItemInput>) =>
    setForm((previous) => ({ ...previous, ...updates }));

  const submit = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      let categoryId = form.categoryId;
      if (!categoryId && newCategory.trim()) {
        categoryId = (await createCategory(newCategory.trim())).id;
      }
      const payload: MenuItemInput = {
        ...form,
        categoryId,
        price: parseAmount(priceText),
      };
      if (item) {
        await updateMenuItem(item.id, payload);
      } else {
        await createMenuItem(payload);
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={item ? fill(t("dnMnEditDish"), { name: item.name }) : t("dnMnNewDish")}
      wide
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("name")} required>
            <input
              value={form.name}
              onChange={(event) => patch({ name: event.target.value })}
              className={inputClass}
              autoFocus
            />
          </Field>
          <Field label={t("category")}>
            {categories.length > 0 ? (
              <select
                value={form.categoryId}
                onChange={(event) => patch({ categoryId: event.target.value })}
                className={inputClass}
              >
                {categories
                  .slice()
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
            ) : (
              <input
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
                placeholder={t("dnMnCategoryPh")}
                className={inputClass}
              />
            )}
          </Field>
          <Field
            label={t("price")}
            hint={form.variations.length > 0 ? t("dnMnSizesOverride") : undefined}
          >
            <input
              inputMode="decimal"
              value={priceText}
              onChange={(event) => setPriceText(event.target.value)}
              placeholder="240.00"
              className={inputClass}
            />
          </Field>
          <Field label={t("typeLabel")}>
            <div className="flex gap-2">
              {FOOD_TYPE_ORDER.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => patch({ foodType: type })}
                  aria-pressed={form.foodType === type}
                  className={`${tapTargetClass} flex flex-1 items-center justify-center gap-1.5 rounded-lg border text-sm font-semibold transition ${
                    form.foodType === type
                      ? "border-indigo bg-indigo/5 text-ink"
                      : "border-muted-line/40 bg-white text-muted"
                  }`}
                >
                  <FoodDot type={type} />
                  {foodTypeLabel(type, lang)}
                </button>
              ))}
            </div>
          </Field>
          <Field label={t("dnMnTaxRatePct")} hint={fill(t("dnMnBlankDefault"), { rate: settings.defaultTaxRate })}>
            <input
              inputMode="decimal"
              value={form.taxRate === null ? "" : String(form.taxRate)}
              onChange={(event) =>
                patch({ taxRate: event.target.value === "" ? null : Number(event.target.value) || 0 })
              }
              placeholder={String(settings.defaultTaxRate)}
              className={inputClass}
            />
          </Field>
          <Field label={t("dnMnPriceIncludesTax")}>
            <div className="flex gap-2">
              {[true, false].map((inclusive) => (
                <button
                  key={String(inclusive)}
                  type="button"
                  onClick={() => patch({ taxInclusive: inclusive })}
                  aria-pressed={form.taxInclusive === inclusive}
                  className={`${tapTargetClass} flex-1 rounded-lg border text-sm font-semibold transition ${
                    form.taxInclusive === inclusive
                      ? "border-indigo bg-indigo text-white"
                      : "border-muted-line/40 bg-white text-ink"
                  }`}
                >
                  {inclusive ? t("dnMnInclusive") : t("dnMnExclusive")}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <Field label={t("description")}>
          <textarea
            value={form.description}
            onChange={(event) => patch({ description: event.target.value })}
            rows={2}
            className={inputClass}
          />
        </Field>

        <ChildEditor
          title="dnMnSizes"
          hint="dnMnSizesHint"
          rows={form.variations.map((variation) => ({
            id: variation.id,
            name: variation.name,
            value: formatPlain(variation.price),
          }))}
          valueLabel="price"
          onChange={(rows) =>
            patch({
              variations: rows.map((row) => ({
                id: row.id,
                name: row.name,
                price: parseAmount(row.value),
              })),
            })
          }
        />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Option groups
            </p>
            <button
              type="button"
              onClick={() =>
                patch({
                  modifierGroups: [
                    ...form.modifierGroups,
                    { name: t("dnMnAddOns"), minSelect: 0, maxSelect: 2, options: [] },
                  ],
                })
              }
              className="text-xs font-semibold text-indigo"
            >
              {t("dnMnAddAGroup")}
            </button>
          </div>

          {form.modifierGroups.map((group, groupIndex) => (
            <div
              key={groupIndex}
              className="space-y-3 rounded-xl border border-muted-line/40 bg-cream/40 p-3"
            >
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[140px] flex-1">
                  <Field label={t("dnMnGroupName")}>
                    <input
                      value={group.name}
                      onChange={(event) =>
                        patch({
                          modifierGroups: form.modifierGroups.map((row, index) =>
                            index === groupIndex ? { ...row, name: event.target.value } : row
                          ),
                        })
                      }
                      className={inputClass}
                    />
                  </Field>
                </div>
                <div className="w-20">
                  <Field label={t("dnMnMin")}>
                    <input
                      inputMode="numeric"
                      value={String(group.minSelect)}
                      onChange={(event) =>
                        patch({
                          modifierGroups: form.modifierGroups.map((row, index) =>
                            index === groupIndex
                              ? { ...row, minSelect: Number(event.target.value) || 0 }
                              : row
                          ),
                        })
                      }
                      className={inputClass}
                    />
                  </Field>
                </div>
                <div className="w-20">
                  <Field label={t("dnMnMax")}>
                    <input
                      inputMode="numeric"
                      value={String(group.maxSelect)}
                      onChange={(event) =>
                        patch({
                          modifierGroups: form.modifierGroups.map((row, index) =>
                            index === groupIndex
                              ? { ...row, maxSelect: Math.max(Number(event.target.value) || 1, 1) }
                              : row
                          ),
                        })
                      }
                      className={inputClass}
                    />
                  </Field>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      modifierGroups: form.modifierGroups.filter(
                        (_, index) => index !== groupIndex
                      ),
                    })
                  }
                  aria-label={t("dnMnRemoveGroup")}
                  className="mb-1 flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-red-50 hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-[11px] text-muted">
                {group.minSelect > 0 ? t("dnMnRequired") : t("dnMnOptional")} ·{" "}
                {group.maxSelect === 1
                  ? t("dnIcPickOne")
                  : fill(t("dnIcPickUpTo"), { n: group.maxSelect })}
              </p>

              <ChildEditor
                title="dnMnOptions"
                rows={group.options.map((option) => ({
                  id: option.id,
                  name: option.name,
                  value: formatPlain(option.priceDelta),
                }))}
                valueLabel="dnMnExtra"
                onChange={(rows) =>
                  patch({
                    modifierGroups: form.modifierGroups.map((row, index) =>
                      index === groupIndex
                        ? {
                            ...row,
                            options: rows.map((option) => ({
                              id: option.id,
                              name: option.name,
                              priceDelta: parseAmount(option.value),
                            })),
                          }
                        : row
                    ),
                  })
                }
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 border-t border-muted-line/20 pt-4">
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !form.name.trim()}
            className={primaryBtnClass}
          >
            {busy ? t("clPfSaving") : item ? t("saveChanges") : t("dnMnAddToMenu")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

type ChildRow = { id?: string; name: string; value: string };

/**
 * Small repeated name/price editor used for sizes and for option lists.
 *
 * `rows` seeds it once; after that it keeps the text as typed. Echoing a
 * parsed-and-reformatted amount back into the box on every keystroke turned
 * "2" into "2.00" before the "0" of "20" could land, so the amount is only
 * tidied to two decimals when the box loses focus. Row ids travel with their
 * row, so removing one from the middle never hands its id to its neighbour.
 */
function ChildEditor({
  title,
  hint,
  rows: initialRows,
  valueLabel,
  onChange,
}: {
  title: TKey;
  hint?: TKey;
  rows: ChildRow[];
  valueLabel: TKey;
  onChange: (rows: ChildRow[]) => void;
}) {
  const { t } = useI18n();
  const [rows, setRows] = useState(initialRows);

  const update = (next: ChildRow[]) => {
    setRows(next);
    onChange(next);
  };
  const updateRow = (index: number, changes: Partial<ChildRow>) =>
    update(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...changes } : row)));

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t(title)}</p>
        <button
          type="button"
          onClick={() => update([...rows, { name: "", value: "" }])}
          className="text-xs font-semibold text-indigo"
        >
          {t("dnMnAddRow")}
        </button>
      </div>
      {hint && <p className="mt-0.5 text-[11px] text-muted/80">{t(hint)}</p>}
      <div className="mt-2 space-y-2">
        {rows.map((row, index) => (
          <div key={row.id ?? `new-${index}`} className="flex items-center gap-2">
            {/* min-w-0 so the name can shrink; inputClass's w-full would
                otherwise let the price box claim the whole row. */}
            <input
              value={row.name}
              onChange={(event) => updateRow(index, { name: event.target.value })}
              placeholder={t("name")}
              aria-label={fill(t("dnMnRowNameAria"), { title: t(title) })}
              className={`${inputClass} min-w-0 flex-1`}
            />
            <div className="w-24 shrink-0 sm:w-28">
              <input
                inputMode="decimal"
                value={row.value}
                onChange={(event) => updateRow(index, { value: event.target.value })}
                onBlur={() => {
                  if (row.value.trim()) updateRow(index, { value: formatPlain(parseAmount(row.value)) });
                }}
                placeholder="0.00"
                aria-label={t(valueLabel)}
                className={inputClass}
              />
            </div>
            <button
              type="button"
              onClick={() => update(rows.filter((_, rowIndex) => rowIndex !== index))}
              aria-label={t("remove")}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-red-50 hover:text-red-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoriesModal({
  open,
  onClose,
  onCreate,
  onRename,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<unknown>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const { categories, menuItems } = useDine();
  const [name, setName] = useState("");

  return (
    <Modal open={open} onClose={onClose} title={t("dnMnCategories")}>
      <div className="space-y-3">
        {categories
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((category) => {
            const count = menuItems.filter((item) => item.categoryId === category.id).length;
            return (
              <div key={category.id} className="flex items-center gap-2">
                <input
                  value={category.name}
                  onChange={(event) => void onRename(category.id, event.target.value)}
                  className={`${inputClass} flex-1`}
                  aria-label={t("dnMnCategoryName")}
                />
                <span className="w-16 shrink-0 text-right text-xs text-muted">{count} items</span>
                <button
                  type="button"
                  onClick={() => void onDelete(category.id)}
                  aria-label={fill(t("appDeleteNamed"), { name: category.name })}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}

        <div className="flex gap-2 border-t border-muted-line/20 pt-3">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("dnMnNewCategoryPh")}
            className={`${inputClass} flex-1`}
          />
          <button
            type="button"
            onClick={async () => {
              if (!name.trim()) return;
              await onCreate(name.trim());
              setName("");
            }}
            className={primaryBtnClass}
          >
            {t("add")}
          </button>
        </div>
        <p className="text-xs text-muted">
          {t("dnMnDeletingCategory")}
        </p>
      </div>
    </Modal>
  );
}
