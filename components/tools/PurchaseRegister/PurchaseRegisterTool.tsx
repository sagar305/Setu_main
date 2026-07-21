"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  NumberInput,
  PrimaryButton,
  SecondaryButton,
  Select,
  TextInput,
} from "@/components/toolkit/ui";
import { WorkspaceBanner } from "@/components/toolkit/WorkspaceBanner";
import { useWorkspaceConnection } from "@/lib/hooks/useWorkspaceConnection";
import { useEntityList } from "@/lib/hooks/useEntityList";
import { applyPurchaseToStock, getSuppliers } from "@/lib/toolkit/workspace";
import type { Purchase, PurchaseItem, Supplier } from "@/lib/toolkit/types";
import { currencySymbol, formatMoney, generateId, nowIso } from "@/lib/pos/types";
import { toCsv, downloadCsv } from "@/lib/pos/csv";
import { useI18n } from "@/lib/i18n";

type ItemRow = PurchaseItem & { key: string };

const todayIso = () => new Date().toISOString().split("T")[0];

const blankItem = (): ItemRow => ({
  key: generateId(),
  productId: null,
  name: "",
  quantity: 1,
  unitCost: 0,
});

export function PurchaseRegisterTool() {
  const workspace = useWorkspaceConnection("purchase-register");
  const { t } = useI18n();
  const { items: purchases, save, remove } = useEntityList<Purchase>("purchases");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [date, setDate] = useState(todayIso());
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemRow[]>([blankItem()]);

  const [pendingStock, setPendingStock] = useState<Purchase | null>(null);
  const [deleting, setDeleting] = useState<Purchase | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getSuppliers().then(setSuppliers).catch(() => {});
  }, []);

  const currency = workspace.business?.currency ?? "INR";
  const symbol = currencySymbol(currency);

  const total = useMemo(
    () => items.reduce((sum, i) => sum + (i.quantity || 0) * (i.unitCost || 0), 0),
    [items]
  );

  const validItems = items.filter((i) => i.name.trim() && i.quantity > 0);
  const canSave = validItems.length > 0 && (supplierId || supplierName.trim());

  const updateItem = (key: string, patch: Partial<ItemRow>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const linkProduct = (key: string, productId: string) => {
    const p = workspace.products.find((x) => x.id === productId);
    updateItem(
      key,
      p
        ? { productId: p.id, name: p.name, unitCost: p.costPrice ?? 0 }
        : { productId: null }
    );
  };

  const resetForm = () => {
    setSupplierId("");
    setSupplierName("");
    setBillNumber("");
    setDate(todayIso());
    setPaymentMode("Cash");
    setNotes("");
    setItems([blankItem()]);
  };

  const buildPurchase = (): Purchase => {
    const chosen = suppliers.find((s) => s.id === supplierId);
    return {
      id: generateId(),
      supplierId: chosen?.id ?? null,
      supplierName: chosen?.name ?? supplierName.trim(),
      billNumber: billNumber.trim(),
      date,
      items: validItems.map(({ key: _key, ...item }) => item),
      total,
      paymentMode,
      stockApplied: false,
      notes,
      createdByTool: "purchase-register",
      createdAt: nowIso(),
    };
  };

  const submit = async () => {
    if (!canSave) return;
    const purchase = buildPurchase();
    const hasLinked = purchase.items.some((i) => i.productId);
    if (hasLinked && workspace.connected) {
      // Stock change is a dangerous op — always confirm first (spec Q7).
      setPendingStock(purchase);
    } else {
      await save(purchase);
      setMessage(`Purchase of ${formatMoney(purchase.total, currency)} recorded.`);
      resetForm();
    }
  };

  const confirmWithStock = async (applyStock: boolean) => {
    const purchase = pendingStock;
    if (!purchase) return;
    if (applyStock) {
      await applyPurchaseToStock(purchase);
      purchase.stockApplied = true;
      await workspace.reload();
    }
    await save(purchase);
    setMessage(
      `Purchase of ${formatMoney(purchase.total, currency)} recorded${
        applyStock ? " and stock updated" : ""
      }.`
    );
    setPendingStock(null);
    resetForm();
  };

  const exportCsv = () =>
    downloadCsv(
      "purchases.csv",
      toCsv(
        ["Date", "Supplier", "Bill No", "Items", "Total", "Payment", "Stock updated"],
        [...purchases]
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((p) => [
            p.date,
            p.supplierName,
            p.billNumber,
            p.items.map((i) => `${i.name} x${i.quantity}`).join("; "),
            p.total.toFixed(2),
            p.paymentMode,
            p.stockApplied ? "Yes" : "No",
          ])
      )
    );

  const sorted = [...purchases].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  return (
    <div>
      <WorkspaceBanner
        connection={workspace}
        message="Link purchase lines to your saved products and update stock automatically."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card className="h-fit">
          <h2 className="mb-4 text-lg font-bold text-ink">Record purchase</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("supplier")}>
              {suppliers.length > 0 ? (
                <Select
                  value={supplierId}
                  onChange={(e) => {
                    setSupplierId(e.target.value);
                    setSupplierName("");
                  }}
                >
                  <option value="">Type name below…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <TextInput
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="Supplier name"
                />
              )}
            </Field>
            {suppliers.length > 0 && !supplierId ? (
              <Field label="Or new supplier name">
                <TextInput
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="Supplier name"
                />
              </Field>
            ) : (
              <Field label={t("billNumber")}>
                <TextInput
                  value={billNumber}
                  onChange={(e) => setBillNumber(e.target.value)}
                  placeholder="INV-1234"
                />
              </Field>
            )}
            <Field label={t("date")}>
              <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={t("paymentMode")}>
              <Select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                {["Cash", "UPI", "Card", "Bank transfer", "Credit"].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            </Field>
          </div>

          <h3 className="mb-2 mt-6 text-sm font-bold text-ink">Items</h3>
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.key}
                className="grid grid-cols-2 items-end gap-2 rounded-lg border border-muted-line/30 p-3 sm:grid-cols-[1fr_1fr_80px_100px_auto]"
              >
                {workspace.connected && workspace.products.length > 0 ? (
                  <Field label="Link product">
                    <Select
                      value={item.productId ?? ""}
                      onChange={(e) => linkProduct(item.key, e.target.value)}
                    >
                      <option value="">Not linked</option>
                      {workspace.products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
                <Field label={t("name")}>
                  <TextInput
                    value={item.name}
                    onChange={(e) => updateItem(item.key, { name: e.target.value })}
                    placeholder="Item"
                  />
                </Field>
                <Field label={t("quantity")}>
                  <NumberInput
                    min={0}
                    value={item.quantity || ""}
                    onChange={(e) => updateItem(item.key, { quantity: Number(e.target.value) || 0 })}
                  />
                </Field>
                <Field label={`Unit cost (${symbol})`}>
                  <NumberInput
                    min={0}
                    step="0.01"
                    value={item.unitCost || ""}
                    onChange={(e) => updateItem(item.key, { unitCost: Number(e.target.value) || 0 })}
                  />
                </Field>
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}
                  disabled={items.length === 1}
                  className="mb-1 justify-self-end text-sm font-semibold text-red-500 hover:text-red-600 disabled:opacity-40"
                >
                  {t("remove")}
                </button>
              </div>
            ))}
          </div>
          <SecondaryButton className="mt-3" onClick={() => setItems((p) => [...p, blankItem()])}>
            {t("addItem")}
          </SecondaryButton>

          <Field label={t("notes")}>
            <TextInput
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              className="mt-1"
            />
          </Field>

          <div className="mt-5 flex items-center justify-between border-t border-muted-line/30 pt-4">
            <p className="text-lg font-bold text-ink">{t("total")}: {formatMoney(total, currency)}</p>
            <PrimaryButton onClick={submit} disabled={!canSave}>
              Save purchase
            </PrimaryButton>
          </div>
          {message ? <p className="mt-3 text-sm font-medium text-emerald-600">{message}</p> : null}
        </Card>

        <Card className="h-fit">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-ink">Recent purchases</h2>
            <SecondaryButton onClick={exportCsv} disabled={purchases.length === 0}>
              {t("exportCsv")}
            </SecondaryButton>
          </div>
          {sorted.length === 0 ? (
            <EmptyState
              title="No purchases yet"
              subtitle="Purchase bills you record appear here, with totals per supplier."
            />
          ) : (
            <div className="space-y-3">
              {sorted.slice(0, 30).map((p) => (
                <div key={p.id} className="rounded-lg border border-muted-line/30 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-ink">{p.supplierName || "Unknown supplier"}</p>
                      <p className="text-xs text-muted">
                        {p.date}
                        {p.billNumber ? ` · Bill ${p.billNumber}` : ""} · {p.paymentMode}
                        {p.stockApplied ? " · stock updated" : ""}
                      </p>
                    </div>
                    <p className="font-bold text-ink">{formatMoney(p.total, currency)}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {p.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}
                  </p>
                  <button
                    type="button"
                    onClick={() => setDeleting(p)}
                    className="mt-2 text-xs font-semibold text-red-500 hover:text-red-600"
                  >
                    {t("delete")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={pendingStock !== null}
        title="Update stock too?"
        message="Some items are linked to saved products. Add the purchased quantities to their stock? This changes the shared workspace that the POS and Stock Register also use."
        confirmLabel="Save & update stock"
        cancelLabel="Save without stock"
        danger={false}
        onConfirm={() => confirmWithStock(true)}
        onCancel={() => confirmWithStock(false)}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Delete purchase?"
        message={
          deleting
            ? `Delete the ${formatMoney(deleting.total, currency)} purchase from ${
                deleting.supplierName || "unknown supplier"
              }? Stock already applied from it is NOT reversed.`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={async () => {
          if (deleting) await remove(deleting.id);
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
