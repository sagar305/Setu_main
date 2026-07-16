"use client";

import { useMemo, useRef, useState } from "react";
import {
  Minus,
  PackageSearch,
  Plus,
  ShoppingCart,
  Trash2,
  UserRound,
} from "lucide-react";
import { usePos } from "@/lib/pos/store";
import { calculateCartTotals } from "@/lib/pos/calc";
import { formatMoney, type CartLine, type Order, type Product } from "@/lib/pos/types";
import type { NavigateFn } from "./nav";
import { ReceiptModal } from "./ReceiptModal";
import { EmptyState, inputClass, primaryBtnClass } from "./ui";

export function BillingScreen({ onNavigate }: { onNavigate: NavigateFn }) {
  const { business, settings, products, categories, customers, payments, checkout } = usePos();
  const currency = business?.currency ?? "INR";

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [discountType, setDiscountType] = useState<"flat" | "percent">("flat");
  const [discountValue, setDiscountValue] = useState(0);
  const [customerId, setCustomerId] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [error, setError] = useState("");
  const [charging, setCharging] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const effectiveTaxRate = (product: Product) =>
    settings.taxEnabled ? product.taxRate ?? settings.defaultTaxRate : 0;

  const filteredProducts = useMemo(() => {
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

  const addToCart = (product: Product) => {
    setError("");
    setLines((prev) => {
      const existing = prev.find((line) => line.productId === product.id);
      if (existing) {
        return prev.map((line) =>
          line.productId === product.id ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: product.sellingPrice,
          quantity: 1,
          unit: product.unit,
          taxRate: effectiveTaxRate(product),
          taxInclusive: product.taxInclusive ?? false,
        },
      ];
    });
  };

  const handleSearchEnter = () => {
    const q = search.trim().toLowerCase();
    if (!q) return;
    // Barcode-scanner friendly: exact barcode/SKU match adds instantly.
    const exact = products.find(
      (p) => p.barcode.toLowerCase() === q || p.sku.toLowerCase() === q
    );
    const target = exact ?? (filteredProducts.length === 1 ? filteredProducts[0] : null);
    if (target) {
      addToCart(target);
      setSearch("");
      searchRef.current?.focus();
    }
  };

  const setQuantity = (productId: string, quantity: number) => {
    if (!Number.isInteger(quantity) || quantity < 1) return;
    setLines((prev) =>
      prev.map((line) => (line.productId === productId ? { ...line, quantity } : line))
    );
  };

  const removeLine = (productId: string) => {
    setLines((prev) => prev.filter((line) => line.productId !== productId));
  };

  const totals = calculateCartTotals(lines, discountType, discountValue, settings.taxEnabled);

  const stockWarnings = lines.filter((line) => {
    const product = products.find((p) => p.id === line.productId);
    return product?.trackStock && line.quantity > product.stock;
  });

  const handleCharge = async () => {
    setError("");
    const methodId = paymentMethodId || payments[0]?.id || "";
    if (!methodId) {
      setError("Add a payment method in Settings first.");
      return;
    }
    setCharging(true);
    try {
      const order = await checkout({
        lines,
        discountType,
        discountValue,
        customerId: customerId || null,
        paymentMethodId: methodId,
      });
      setCompletedOrder(order);
      setLines([]);
      setDiscountValue(0);
      setCustomerId("");
      setSearch("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete the sale.");
    } finally {
      setCharging(false);
    }
  };

  const selectedPaymentId = paymentMethodId || payments[0]?.id || "";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      {/* Product picker */}
      <div className="min-w-0">
        <input
          ref={searchRef}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleSearchEnter();
            }
          }}
          placeholder="Search or scan — name, SKU, barcode…"
          className={`${inputClass} py-3`}
        />

        {categories.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategoryId("")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                categoryId === ""
                  ? "bg-indigo text-white"
                  : "border border-muted-line/40 bg-white text-muted hover:text-indigo"
              }`}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setCategoryId(category.id === categoryId ? "" : category.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  categoryId === category.id
                    ? "bg-indigo text-white"
                    : "border border-muted-line/40 bg-white text-muted hover:text-indigo"
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        )}

        {products.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={<PackageSearch className="h-6 w-6" />}
              title="No products yet"
              message="Add your first product to start billing."
              action={
                <button
                  type="button"
                  onClick={() => onNavigate("products")}
                  className={primaryBtnClass}
                >
                  Add product
                </button>
              }
            />
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => {
              const out = product.trackStock && product.stock <= 0;
              const low = product.trackStock && product.stock > 0 && product.stock <= 5;
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addToCart(product)}
                  className="flex flex-col rounded-xl border border-muted-line/30 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo/40 hover:shadow"
                >
                  <span className="line-clamp-2 text-sm font-semibold text-ink">
                    {product.name}
                  </span>
                  <span className="mt-auto pt-2 text-sm font-bold text-indigo">
                    {formatMoney(product.sellingPrice, currency)}
                  </span>
                  {product.trackStock && (
                    <span
                      className={`text-xs font-semibold ${
                        out ? "text-red-500" : low ? "text-saffron" : "text-muted"
                      }`}
                    >
                      {out ? "Out of stock" : `${product.stock} ${product.unit || "in stock"}`}
                    </span>
                  )}
                </button>
              );
            })}
            {filteredProducts.length === 0 && (
              <p className="col-span-full rounded-xl border border-dashed border-muted-line/40 px-4 py-8 text-center text-sm text-muted">
                No products match &ldquo;{search}&rdquo;.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Cart */}
      <div className="pos-cart-sticky min-w-0 h-fit rounded-2xl border border-muted-line/30 bg-white p-5 shadow-sm lg:sticky lg:top-24">
        <h3 className="flex items-center gap-2 text-base font-bold text-ink">
          <ShoppingCart className="h-5 w-5 text-indigo" />
          Cart
          {totals.itemCount > 0 && (
            <span className="rounded-full bg-indigo/10 px-2 py-0.5 text-xs font-semibold text-indigo">
              {totals.itemCount} item{totals.itemCount === 1 ? "" : "s"}
            </span>
          )}
        </h3>

        {lines.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-muted-line/40 px-4 py-8 text-center text-sm text-muted">
            Tap a product to add it to the cart.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {lines.map((line) => (
              <li key={line.productId} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{line.name}</p>
                  <p className="text-xs text-muted">
                    {formatMoney(line.price, currency)}
                    {line.taxRate > 0 &&
                      ` · ${line.taxRate}% tax${line.taxInclusive ? " incl." : ""}`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Decrease quantity of ${line.name}`}
                    onClick={() =>
                      line.quantity > 1
                        ? setQuantity(line.productId, line.quantity - 1)
                        : removeLine(line.productId)
                    }
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-muted-line/40 text-muted hover:border-indigo hover:text-indigo"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-8 text-center text-sm font-bold text-ink">
                    {line.quantity}
                  </span>
                  <button
                    type="button"
                    aria-label={`Increase quantity of ${line.name}`}
                    onClick={() => setQuantity(line.productId, line.quantity + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-muted-line/40 text-muted hover:border-indigo hover:text-indigo"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="w-20 text-right text-sm font-semibold text-ink">
                  {formatMoney(line.price * line.quantity, currency)}
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${line.name}`}
                  onClick={() => removeLine(line.productId)}
                  className="text-muted/60 transition hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {stockWarnings.length > 0 && (
          <p className="mt-3 rounded-lg border border-saffron/40 bg-saffron/10 px-3 py-2 text-xs text-ink">
            Not enough stock for: {stockWarnings.map((w) => w.name).join(", ")}. The sale can
            still go through — stock will go negative.
          </p>
        )}

        {lines.length > 0 && (
          <>
            {/* Discount */}
            <div className="mt-4 flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                Discount
              </span>
              <div className="ml-auto flex overflow-hidden rounded-lg border border-muted-line/40">
                {(["flat", "percent"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setDiscountType(type)}
                    className={`px-2.5 py-1 text-xs font-bold ${
                      discountType === type ? "bg-indigo text-white" : "bg-white text-muted"
                    }`}
                  >
                    {type === "flat" ? formatMoney(0, currency).replace(/[\d.,]/g, "") : "%"}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={0}
                max={discountType === "percent" ? 100 : undefined}
                value={discountValue || ""}
                onChange={(event) => {
                  const n = parseFloat(event.target.value);
                  setDiscountValue(Number.isFinite(n) && n >= 0 ? n : 0);
                }}
                placeholder="0"
                size={4}
                className="w-24 shrink-0 rounded-lg border border-muted-line/40 bg-white px-3 py-2 text-right text-sm text-ink placeholder:text-muted/60 focus:border-indigo focus:outline-none focus:ring-1 focus:ring-indigo"
              />
            </div>

            {/* Customer */}
            <div className="mt-3 flex items-center gap-2">
              <UserRound className="h-4 w-4 shrink-0 text-muted" />
              <select
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                className={`${inputClass} min-w-0`}
              >
                <option value="">Walk-in customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                    {customer.phone ? ` (${customer.phone})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Totals */}
            <dl className="mt-4 space-y-1.5 border-t border-muted-line/20 pt-4 text-sm">
              <div className="flex justify-between text-muted">
                <dt>Subtotal</dt>
                <dd>{formatMoney(totals.subtotal, currency)}</dd>
              </div>
              {totals.discountAmount > 0 && (
                <div className="flex justify-between text-muted">
                  <dt>Discount</dt>
                  <dd>-{formatMoney(totals.discountAmount, currency)}</dd>
                </div>
              )}
              {settings.taxEnabled && totals.taxAmount > 0 && (
                <div className="flex justify-between text-muted">
                  <dt>Tax</dt>
                  <dd>{formatMoney(totals.taxAmount, currency)}</dd>
                </div>
              )}
              {totals.includedTaxAmount > 0 && (
                <div className="flex justify-between text-muted">
                  <dt>Incl. tax</dt>
                  <dd>{formatMoney(totals.includedTaxAmount, currency)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-muted-line/20 pt-2 text-base font-bold text-ink">
                <dt>Total</dt>
                <dd>{formatMoney(totals.total, currency)}</dd>
              </div>
            </dl>

            {/* Payment method */}
            <div className="mt-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                Payment
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {payments.map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setPaymentMethodId(method.id)}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      selectedPaymentId === method.id
                        ? "bg-indigo text-white"
                        : "border border-muted-line/40 bg-white text-muted hover:text-indigo"
                    }`}
                  >
                    {method.name}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={() => void handleCharge()}
              disabled={charging || lines.length === 0}
              className={`${primaryBtnClass} mt-4 w-full py-3 text-base`}
            >
              {charging ? "Saving…" : `Charge ${formatMoney(totals.total, currency)}`}
            </button>
          </>
        )}
      </div>

      <ReceiptModal
        order={completedOrder}
        open={completedOrder !== null}
        onClose={() => setCompletedOrder(null)}
        title="Sale complete"
      />
    </div>
  );
}
