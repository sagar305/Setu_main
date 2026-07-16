"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Copy,
  FolderOpen,
  Package,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { usePos, type ProductInput } from "@/lib/pos/store";
import { formatMoney, type Product } from "@/lib/pos/types";
import {
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  SearchInput,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "./ui";

const emptyForm: ProductInput = {
  name: "",
  sellingPrice: 0,
  sku: "",
  barcode: "",
  categoryId: "",
  costPrice: null,
  taxRate: null,
  taxInclusive: false,
  trackStock: false,
  stock: 0,
  unit: "",
  imageDataUrl: "",
  description: "",
};

function ProductFormModal({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: Product | null;
}) {
  const { categories, createProduct, updateProduct, createCategory, settings } = usePos();
  const [form, setForm] = useState<ProductInput>(emptyForm);
  const [priceText, setPriceText] = useState("");
  const [costText, setCostText] = useState("");
  const [taxText, setTaxText] = useState("");
  const [stockText, setStockText] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name,
        sellingPrice: editing.sellingPrice,
        sku: editing.sku,
        barcode: editing.barcode,
        categoryId: editing.categoryId,
        costPrice: editing.costPrice,
        taxRate: editing.taxRate,
        taxInclusive: editing.taxInclusive ?? false,
        trackStock: editing.trackStock,
        stock: editing.stock,
        unit: editing.unit,
        imageDataUrl: editing.imageDataUrl,
        description: editing.description,
      });
      setPriceText(String(editing.sellingPrice));
      setCostText(editing.costPrice === null ? "" : String(editing.costPrice));
      setTaxText(editing.taxRate === null ? "" : String(editing.taxRate));
      setStockText(String(editing.stock));
    } else {
      setForm(emptyForm);
      setPriceText("");
      setCostText("");
      setTaxText("");
      setStockText("");
    }
    setNewCategory("");
    setError("");
  }, [open, editing]);

  const handleSave = async () => {
    const name = form.name.trim();
    if (!name) {
      setError("Product name is required.");
      return;
    }
    const price = parseFloat(priceText);
    if (!Number.isFinite(price) || price < 0) {
      setError("Selling price must be zero or more.");
      return;
    }
    const cost = costText.trim() === "" ? null : parseFloat(costText);
    if (cost !== null && (!Number.isFinite(cost) || cost < 0)) {
      setError("Cost price must be zero or more.");
      return;
    }
    const tax = taxText.trim() === "" ? null : parseFloat(taxText);
    if (tax !== null && (!Number.isFinite(tax) || tax < 0 || tax > 100)) {
      setError("Tax must be between 0 and 100.");
      return;
    }
    let stock = 0;
    if (form.trackStock) {
      stock = stockText.trim() === "" ? 0 : parseInt(stockText, 10);
      if (!Number.isInteger(stock)) {
        setError("Stock must be a whole number.");
        return;
      }
    }

    setSaving(true);
    setError("");
    try {
      let categoryId = form.categoryId;
      if (categoryId === "__new__") {
        if (!newCategory.trim()) {
          setError("Enter a name for the new category.");
          setSaving(false);
          return;
        }
        const category = await createCategory(newCategory);
        categoryId = category.id;
      }
      const input: ProductInput = {
        ...form,
        name,
        sellingPrice: price,
        costPrice: cost,
        taxRate: tax,
        stock,
        categoryId,
        sku: form.sku.trim(),
        barcode: form.barcode.trim(),
        unit: form.unit.trim(),
        description: form.description.trim(),
      };
      if (editing) {
        await updateProduct(editing.id, input);
      } else {
        await createProduct(input);
      }
      onClose();
    } catch {
      setError("Could not save the product. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit product" : "Add product"} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Product name" required>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
              placeholder="e.g. Masala Chai"
              className={inputClass}
              autoFocus
            />
          </Field>
        </div>
        <Field label="Selling price" required>
          <input
            type="number"
            min={0}
            step="0.01"
            value={priceText}
            onChange={(event) => setPriceText(event.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
        </Field>
        <Field label="Cost price">
          <input
            type="number"
            min={0}
            step="0.01"
            value={costText}
            onChange={(event) => setCostText(event.target.value)}
            placeholder="Optional"
            className={inputClass}
          />
        </Field>
        <Field label="Category">
          <select
            value={form.categoryId}
            onChange={(event) => setForm((f) => ({ ...f, categoryId: event.target.value }))}
            className={inputClass}
          >
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
            <option value="__new__">+ New category…</option>
          </select>
        </Field>
        {form.categoryId === "__new__" ? (
          <Field label="New category name" required>
            <input
              type="text"
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value)}
              placeholder="e.g. Beverages"
              className={inputClass}
            />
          </Field>
        ) : (
          <Field label="Unit">
            <input
              type="text"
              value={form.unit}
              onChange={(event) => setForm((f) => ({ ...f, unit: event.target.value }))}
              placeholder="e.g. pcs, kg, plate"
              className={inputClass}
            />
          </Field>
        )}
        <Field label="SKU">
          <input
            type="text"
            value={form.sku}
            onChange={(event) => setForm((f) => ({ ...f, sku: event.target.value }))}
            placeholder="Optional"
            className={inputClass}
          />
        </Field>
        <Field label="Barcode">
          <input
            type="text"
            value={form.barcode}
            onChange={(event) => setForm((f) => ({ ...f, barcode: event.target.value }))}
            placeholder="Scan or type"
            className={inputClass}
          />
        </Field>
        <Field
          label="Tax %"
          hint={
            settings.taxEnabled
              ? `Blank = default ${settings.defaultTaxRate}%`
              : "Tax is disabled in Settings"
          }
        >
          <input
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={taxText}
            onChange={(event) => setTaxText(event.target.value)}
            placeholder="Optional"
            className={inputClass}
          />
        </Field>
        <Field
          label="Tax type"
          hint={
            form.taxInclusive
              ? "Tax is part of the price and shown as “Incl. tax”"
              : "Tax is added on top at checkout"
          }
        >
          <select
            value={form.taxInclusive ? "inclusive" : "exclusive"}
            onChange={(event) =>
              setForm((f) => ({ ...f, taxInclusive: event.target.value === "inclusive" }))
            }
            className={inputClass}
          >
            <option value="exclusive">Added on top (exclusive)</option>
            <option value="inclusive">Included in price (inclusive)</option>
          </select>
        </Field>
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Inventory
          </span>
          <label className="flex items-center gap-2 rounded-lg border border-muted-line/40 bg-white px-3 py-2">
            <input
              type="checkbox"
              checked={form.trackStock}
              onChange={(event) => setForm((f) => ({ ...f, trackStock: event.target.checked }))}
              className="h-4 w-4 accent-indigo"
            />
            <span className="text-sm text-ink">Track stock</span>
            {form.trackStock && (
              <input
                type="number"
                step="1"
                value={stockText}
                onChange={(event) => setStockText(event.target.value)}
                placeholder="Qty"
                aria-label="Stock quantity"
                className="ml-auto w-24 rounded-md border border-muted-line/40 px-2 py-1 text-right text-sm focus:border-indigo focus:outline-none"
              />
            )}
          </label>
        </div>
        <div className="sm:col-span-2">
          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(event) => setForm((f) => ({ ...f, description: event.target.value }))}
              rows={2}
              placeholder="Optional"
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-3">
        <button type="button" onClick={onClose} className={secondaryBtnClass}>
          Cancel
        </button>
        <button type="button" onClick={() => void handleSave()} disabled={saving} className={primaryBtnClass}>
          {saving ? "Saving…" : editing ? "Save changes" : "Add product"}
        </button>
      </div>
    </Modal>
  );
}

function CategoryManagerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { categories, products, createCategory, renameCategory, deleteCategory } = usePos();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingName, setEditingName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState("");

  const productCount = (id: string) => products.filter((p) => p.categoryId === id).length;

  return (
    <Modal open={open} onClose={onClose} title="Categories">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!newName.trim()) return;
          void createCategory(newName).then(() => setNewName(""));
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="New category name"
          className={inputClass}
        />
        <button type="submit" className={primaryBtnClass}>
          <Plus className="h-4 w-4" />
          Add
        </button>
      </form>

      {categories.length === 0 ? (
        <p className="mt-4 text-center text-sm text-muted">
          No categories yet. Categories help you filter products while billing.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-muted-line/15 rounded-xl border border-muted-line/30">
          {categories.map((category) => (
            <li key={category.id} className="flex items-center gap-2 px-4 py-2.5">
              {editingId === category.id ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (editingName.trim()) {
                      void renameCategory(category.id, editingName).then(() => setEditingId(""));
                    }
                  }}
                  className="flex flex-1 gap-2"
                >
                  <input
                    type="text"
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    className={inputClass}
                    autoFocus
                  />
                  <button type="submit" className={secondaryBtnClass}>
                    Save
                  </button>
                </form>
              ) : (
                <>
                  <span className="flex-1 text-sm font-semibold text-ink">{category.name}</span>
                  <span className="text-xs text-muted">{productCount(category.id)} products</span>
                  <button
                    type="button"
                    aria-label={`Rename ${category.name}`}
                    onClick={() => {
                      setEditingId(category.id);
                      setEditingName(category.name);
                    }}
                    className="text-muted transition hover:text-indigo"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${category.name}`}
                    onClick={() => setDeleteTarget(category.id)}
                    className="text-muted transition hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleteTarget !== ""}
        title="Delete category?"
        message="Products in this category will be kept but left uncategorised."
        onConfirm={() => {
          void deleteCategory(deleteTarget);
          setDeleteTarget("");
        }}
        onCancel={() => setDeleteTarget("")}
      />
    </Modal>
  );
}

function StockAdjustModal({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const { adjustStock } = usePos();
  const [mode, setMode] = useState<"add" | "reduce">("add");
  const [qtyText, setQtyText] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (product) {
      setMode("add");
      setQtyText("");
      setNote("");
      setError("");
    }
  }, [product]);

  if (!product) return null;

  const handleSave = async () => {
    const qty = parseInt(qtyText, 10);
    if (!Number.isInteger(qty) || qty <= 0) {
      setError("Enter a quantity greater than zero.");
      return;
    }
    await adjustStock(product.id, mode, qty, note.trim());
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`Update stock — ${product.name}`}>
      <p className="text-sm text-muted">
        Current stock:{" "}
        <strong className="text-ink">
          {product.trackStock ? `${product.stock} ${product.unit}`.trim() : "not tracked"}
        </strong>
      </p>
      <div className="mt-4 flex gap-2">
        {(["add", "reduce"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              mode === m
                ? "bg-indigo text-white"
                : "border border-muted-line/40 bg-white text-muted"
            }`}
          >
            {m === "add" ? "Add stock" : "Reduce stock"}
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-4">
        <Field label="Quantity" required>
          <input
            type="number"
            min={1}
            step="1"
            value={qtyText}
            onChange={(event) => setQtyText(event.target.value)}
            className={inputClass}
            autoFocus
          />
        </Field>
        <Field label="Note">
          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. New shipment, damage, correction"
            className={inputClass}
          />
        </Field>
      </div>
      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-5 flex justify-end gap-3">
        <button type="button" onClick={onClose} className={secondaryBtnClass}>
          Cancel
        </button>
        <button type="button" onClick={() => void handleSave()} className={primaryBtnClass}>
          Update stock
        </button>
      </div>
    </Modal>
  );
}

export function ProductsScreen({
  externalQuery,
}: {
  externalQuery: { value: string; nonce: number } | null;
}) {
  const { business, products, categories, duplicateProduct, deleteProduct } = usePos();
  const currency = business?.currency ?? "INR";

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [stockTarget, setStockTarget] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  useEffect(() => {
    if (externalQuery) setSearch(externalQuery.value);
  }, [externalQuery]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => (categoryId ? p.categoryId === categoryId : true))
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.toLowerCase().includes(q)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, search, categoryId]);

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? "";

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name, SKU or barcode…"
          />
        </div>
        <select
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          className={`${inputClass} sm:w-48`}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => setCategoriesOpen(true)} className={secondaryBtnClass}>
          <FolderOpen className="h-4 w-4" />
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
          <Plus className="h-4 w-4" />
          Add product
        </button>
      </div>

      {products.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<Package className="h-6 w-6" />}
            title="No products yet"
            message="Products you add appear here and on the billing screen."
            action={
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
                className={primaryBtnClass}
              >
                <Plus className="h-4 w-4" />
                Add your first product
              </button>
            }
          />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-muted-line/30 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-muted-line/20 text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 text-right font-semibold">Price</th>
                <th className="px-4 py-3 text-right font-semibold">Stock</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted-line/15">
              {filtered.map((product) => (
                <tr key={product.id} className="hover:bg-cream-paper/60">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink">{product.name}</p>
                    {(product.sku || product.barcode) && (
                      <p className="text-xs text-muted">
                        {[product.sku && `SKU ${product.sku}`, product.barcode]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {categoryName(product.categoryId) || "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-ink">
                    {formatMoney(product.sellingPrice, currency)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {product.trackStock ? (
                      <button
                        type="button"
                        onClick={() => setStockTarget(product)}
                        className={`font-semibold underline-offset-2 hover:underline ${
                          product.stock <= 0
                            ? "text-red-500"
                            : product.stock <= 5
                              ? "text-saffron"
                              : "text-ink"
                        }`}
                      >
                        {product.stock}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setStockTarget(product)}
                        className="text-xs text-muted underline-offset-2 hover:underline"
                      >
                        Track
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        aria-label={`Adjust stock of ${product.name}`}
                        title="Adjust stock"
                        onClick={() => setStockTarget(product)}
                        className="rounded-lg p-2 text-muted transition hover:bg-cream hover:text-indigo"
                      >
                        <Boxes className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Duplicate ${product.name}`}
                        title="Duplicate"
                        onClick={() => void duplicateProduct(product.id)}
                        className="rounded-lg p-2 text-muted transition hover:bg-cream hover:text-indigo"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Edit ${product.name}`}
                        title="Edit"
                        onClick={() => {
                          setEditing(product);
                          setFormOpen(true);
                        }}
                        className="rounded-lg p-2 text-muted transition hover:bg-cream hover:text-indigo"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${product.name}`}
                        title="Delete"
                        onClick={() => setDeleteTarget(product)}
                        className="rounded-lg p-2 text-muted transition hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">
                    No products match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ProductFormModal open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
      <CategoryManagerModal open={categoriesOpen} onClose={() => setCategoriesOpen(false)} />
      <StockAdjustModal product={stockTarget} onClose={() => setStockTarget(null)} />
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete product?"
        message={`"${deleteTarget?.name}" will be removed from your catalogue. Past orders keep their records.`}
        onConfirm={() => {
          if (deleteTarget) void deleteProduct(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
