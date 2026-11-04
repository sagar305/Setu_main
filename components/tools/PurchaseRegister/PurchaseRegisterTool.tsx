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
import {
  applyPurchaseToStock,
  getSettings,
  getSuppliers,
  deleteExpense,
  updateStock,
} from "@/lib/toolkit/workspace";
import { closingSoon, returnAmount, returnWindow, returnableLines, returnedQuantities } from "@/lib/toolkit/purchaseReturns";
import { ReceiveDialog, ReturnDialog, ReturnsList, type NewReturn, type ReceiveInfo } from "./PurchaseReturns";
import type { PurchaseReturn, Purchase, PurchaseItem, Supplier } from "@/lib/toolkit/types";
import { currencySymbol, formatMoney, generateId, nowIso } from "@/lib/pos/types";
import { toCsv, downloadCsv } from "@/lib/pos/csv";
import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/translate";

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
  const {
    items: returns,
    save: saveReturn,
    remove: removeReturn,
  } = useEntityList<PurchaseReturn>("purchase_returns");
  const [returning, setReturning] = useState<Purchase | null>(null);
  const [receiving, setReceiving] = useState<PurchaseReturn | null>(null);
  const [deletingReturn, setDeletingReturn] = useState<PurchaseReturn | null>(null);
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

  // POS batch tracking on → linked items get batch number and expiry fields,
  // and applying stock creates a batch for each.
  const [batchTracking, setBatchTracking] = useState(false);
  useEffect(() => {
    if (!workspace.connected) return;
    getSettings()
      .then((s) => setBatchTracking(s.batchTracking === true))
      .catch(() => {});
  }, [workspace.connected]);

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
        ? {
            productId: p.id,
            name: p.name,
            unitCost: p.costPrice ?? 0,
            sellingTaxInclusive: p.taxInclusive ?? false,
          }
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

  // Save the purchase, optionally applying stock. A purchase is stock (cost of
  // goods), not an expense, so it is never copied into the Expense Tracker —
  // the Profit Dashboard charges its cost when the stock sells.
  const finalize = async (purchase: Purchase, applyStock: boolean) => {
    if (applyStock) {
      await applyPurchaseToStock(purchase);
      purchase.stockApplied = true;
      await workspace.reload();
    }
    await save(purchase);
    const extras = [applyStock ? t("prStockUpdated") : null].filter(Boolean);
    setMessage(
      fill(t("prRecordedToast"), {
        amount: formatMoney(purchase.total, currency),
        extras: extras.length > 0 ? `, ${extras.join(", ")}` : "",
      }),
    );
    resetForm();
  };

  const submit = async () => {
    if (!canSave) return;
    const purchase = buildPurchase();
    const hasLinked = purchase.items.some((i) => i.productId);
    if (hasLinked && workspace.connected) {
      // Stock change is a dangerous op — always confirm first (spec Q7).
      setPendingStock(purchase);
    } else {
      await finalize(purchase, false);
    }
  };

  const confirmWithStock = async (applyStock: boolean) => {
    const purchase = pendingStock;
    if (!purchase) return;
    await finalize(purchase, applyStock);
    setPendingStock(null);
  };

  // ---- Returns to suppliers ------------------------------------------------
  const stockNote = (r: { supplierName: string }) => r.supplierName || t("prUnknownSupplier");

  const createReturn = async (purchase: Purchase, input: NewReturn) => {
    // Only purchases that put units into stock take them back out.
    const stockApplied = purchase.stockApplied && workspace.connected;
    if (stockApplied) {
      for (const i of input.items) {
        if (!i.productId) continue;
        await updateStock(i.productId, -i.quantity, `${t("prReturnToSupplier")}: ${stockNote(purchase)}`, {
          purchaseId: purchase.id,
        });
      }
      await workspace.reload();
    }
    const ret: PurchaseReturn = {
      id: generateId(),
      purchaseId: purchase.id,
      supplierId: purchase.supplierId,
      supplierName: purchase.supplierName,
      billNumber: purchase.billNumber,
      date: input.date,
      mode: input.mode,
      items: input.items,
      amount: returnAmount(input.items),
      status: input.mode === "credit-note" ? "settled" : "pending",
      stockApplied,
      note: input.note,
      createdByTool: "purchase-register",
      createdAt: nowIso(),
    };
    await saveReturn(ret);
    setMessage(fill(t("prReturnSaved"), { amount: formatMoney(ret.amount, currency) }));
  };

  const receiveReplacement = async (ret: PurchaseReturn, info: ReceiveInfo) => {
    if (ret.stockApplied) {
      for (const i of ret.items) {
        if (!i.productId) continue;
        await updateStock(i.productId, i.quantity, `${t("prReturnReceived")}: ${stockNote(ret)}`, {
          batchNo: info.batchNo,
          expiry: info.expiry,
          costPrice: i.unitCost > 0 ? i.unitCost : null,
          sellingPrice: info.sellingPrice,
          taxRate: info.taxRate,
          taxInclusive: info.taxInclusive,
          receivedAt: todayIso(),
        });
      }
      await workspace.reload();
    }
    await saveReturn({ ...ret, status: "received", receivedAt: todayIso() });
  };

  const deleteReturnRecord = async (ret: PurchaseReturn) => {
    // Undo the stock it moved: units taken out go back, unless a received
    // replacement already brought them back.
    if (ret.stockApplied && ret.status !== "received") {
      for (const i of ret.items) {
        if (!i.productId) continue;
        await updateStock(i.productId, i.quantity, `${t("prDeleteReturnTitle")} (${stockNote(ret)})`);
      }
      await workspace.reload();
    }
    await removeReturn(ret.id);
  };

  const dueSoon = useMemo(() => closingSoon(purchases, returns), [purchases, returns]);

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
        message={t("prConnectHint")}
      />

      {dueSoon.length > 0 ? (
        <div className="mb-6 rounded-xl border border-saffron/40 bg-saffron/10 p-4 text-sm text-ink">
          <p className="font-semibold">{t("prReturnSoonBanner")}</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {dueSoon.map(({ purchase, line }) => (
              <li key={`${purchase.id}-${line.itemIndex}`}>
                {line.item.name} ×{line.left} — {purchase.supplierName || t("prUnknownSupplier")} ·{" "}
                {fill(t("prReturnTill"), { date: line.item.returnBy ?? "" })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card className="h-fit">
          <h2 className="mb-4 text-lg font-bold text-ink">{t("prRecordPurchase")}</h2>
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
                  <option value="">{t("prTypeNameBelow")}</option>
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
                  placeholder={t("sbNamePlaceholder")}
                />
              )}
            </Field>
            {suppliers.length > 0 && !supplierId ? (
              <Field label={t("prOrNewSupplier")}>
                <TextInput
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder={t("sbNamePlaceholder")}
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
            {paymentMode === "Credit" ? (
              <p className="text-xs text-muted sm:col-span-2">
                {t("prCreditHint")}{" "}
                <a href="/tools/supplier-ledger" className="font-semibold text-indigo hover:underline">
                  {t("prOpenSupplierLedger")} →
                </a>
              </p>
            ) : null}
          </div>

          <h3 className="mb-2 mt-6 text-sm font-bold text-ink">{t("items")}</h3>
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.key}
                className="grid grid-cols-2 items-end gap-2 rounded-lg border border-muted-line/30 p-3 sm:grid-cols-[1fr_1fr_80px_100px_auto]"
              >
                {workspace.connected && workspace.products.length > 0 ? (
                  <Field label={t("prLinkProduct")}>
                    <Select
                      value={item.productId ?? ""}
                      onChange={(e) => linkProduct(item.key, e.target.value)}
                    >
                      <option value="">{t("prNotLinked")}</option>
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
                    placeholder={t("itemPlaceholder")}
                  />
                </Field>
                <Field label={t("quantity")}>
                  <NumberInput
                    min={0}
                    value={item.quantity || ""}
                    onChange={(e) => updateItem(item.key, { quantity: Number(e.target.value) || 0 })}
                  />
                </Field>
                <Field label={fill(t("prUnitCost"), { symbol })}>
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
                {batchTracking && item.productId ? (
                  <div className="col-span-2 grid grid-cols-2 gap-2 sm:col-span-5 sm:grid-cols-5">
                    <Field label={t("prBatchNo")}>
                      <TextInput
                        value={item.batchNo ?? ""}
                        onChange={(e) => updateItem(item.key, { batchNo: e.target.value })}
                        placeholder={t("optional")}
                      />
                    </Field>
                    <Field label={t("prExpiry")}>
                      <TextInput
                        type="date"
                        value={item.expiry ?? ""}
                        onChange={(e) => updateItem(item.key, { expiry: e.target.value })}
                      />
                    </Field>
                    <Field label={t("prSellingPrice")}>
                      <NumberInput
                        min={0}
                        step="0.01"
                        value={item.sellingPrice ?? ""}
                        placeholder={t("optional")}
                        onChange={(e) =>
                          updateItem(item.key, {
                            sellingPrice: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                      />
                    </Field>
                    <Field label={t("taxPct")}>
                      <NumberInput
                        min={0}
                        max={100}
                        step="0.01"
                        value={item.sellingTaxRate ?? ""}
                        placeholder={t("optional")}
                        onChange={(e) =>
                          updateItem(item.key, {
                            sellingTaxRate:
                              e.target.value === ""
                                ? null
                                : Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                          })
                        }
                      />
                    </Field>
                    <Field label={t("prTaxOnPrice")}>
                      <Select
                        value={item.sellingTaxInclusive ? "inclusive" : "exclusive"}
                        onChange={(e) =>
                          updateItem(item.key, { sellingTaxInclusive: e.target.value === "inclusive" })
                        }
                      >
                        <option value="exclusive">{t("prTaxExclusive")}</option>
                        <option value="inclusive">{t("prTaxInclusive")}</option>
                      </Select>
                    </Field>
                  </div>
                ) : null}
                <div className="col-span-2 sm:col-span-5">
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={item.returnable === true}
                      onChange={(e) =>
                        updateItem(item.key, {
                          returnable: e.target.checked,
                          returnType: item.returnType ?? "credit-note",
                        })
                      }
                      className="h-4 w-4 accent-indigo"
                    />
                    {t("prReturnable")}
                  </label>
                  {item.returnable ? (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Field label={t("prReturnBy")}>
                        <TextInput
                          type="date"
                          value={item.returnBy ?? ""}
                          onChange={(e) => updateItem(item.key, { returnBy: e.target.value })}
                        />
                      </Field>
                      <Field label={t("prReturnAs")}>
                        <Select
                          value={item.returnType ?? "credit-note"}
                          onChange={(e) =>
                            updateItem(item.key, { returnType: e.target.value as "replacement" | "credit-note" })
                          }
                        >
                          <option value="credit-note">{t("prCreditNote")}</option>
                          <option value="replacement">{t("prReplacement")}</option>
                        </Select>
                      </Field>
                    </div>
                  ) : null}
                </div>
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
              placeholder={t("optional")}
              className="mt-1"
            />
          </Field>

          <p className="mt-4 rounded-lg border border-muted-line/30 bg-cream-paper/40 p-3 text-xs text-muted">
            {t("prCogsNote")}
          </p>

          <div className="mt-5 flex items-center justify-between border-t border-muted-line/30 pt-4">
            <p className="text-lg font-bold text-ink">{t("total")}: {formatMoney(total, currency)}</p>
            <PrimaryButton onClick={submit} disabled={!canSave}>
              {t("prSavePurchase")}
            </PrimaryButton>
          </div>
          {message ? <p className="mt-3 text-sm font-medium text-emerald-600">{message}</p> : null}
        </Card>

        <Card className="h-fit">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-ink">{t("prRecent")}</h2>
            <SecondaryButton onClick={exportCsv} disabled={purchases.length === 0}>
              {t("exportCsv")}
            </SecondaryButton>
          </div>
          {sorted.length === 0 ? (
            <EmptyState
              title={t("prNoneTitle")}
              subtitle={t("prNoneHint")}
            />
          ) : (
            <div className="space-y-3">
              {sorted.slice(0, 30).map((p) => (
                <div key={p.id} className="rounded-lg border border-muted-line/30 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-ink">{p.supplierName || t("prUnknownSupplier")}</p>
                      <p className="text-xs text-muted">
                        {p.date}
                        {p.billNumber ? ` · ${fill(t("prBillNo"), { number: p.billNumber })}` : ""} ·{" "}
                        {p.paymentMode}
                        {p.stockApplied ? ` · ${t("prStockUpdated")}` : ""}
                      </p>
                    </div>
                    <p className="font-bold text-ink">{formatMoney(p.total, currency)}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {p.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}
                  </p>
                  {(() => {
                    const returned = returnedQuantities(p.id, returns);
                    const chips = p.items
                      .map((i, idx) => ({ i, idx, w: returnWindow(i) }))
                      .filter(({ w }) => w !== "none");
                    if (chips.length === 0) return null;
                    return (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {chips.map(({ i, idx, w }) => (
                          <span
                            key={idx}
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              w === "closed"
                                ? "bg-cream-paper text-muted line-through"
                                : w === "closing"
                                  ? "bg-saffron/15 text-ink"
                                  : "bg-indigo/10 text-indigo"
                            }`}
                          >
                            {i.name}:{" "}
                            {w === "closed"
                              ? fill(t("prReturnClosed"), { date: i.returnBy ?? "" })
                              : i.returnBy
                                ? fill(t("prReturnTill"), { date: i.returnBy })
                                : t("prReturnNoDeadline")}
                            {" · "}
                            {i.returnType === "replacement" ? t("prReplacement") : t("prCreditNote")}
                            {returned.get(idx) ? ` · ${fill(t("prReturnedQty"), { qty: returned.get(idx)! })}` : ""}
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                  <div className="mt-2 flex flex-wrap gap-4">
                    {returnableLines(p, returns).length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setReturning(p)}
                        className="text-xs font-semibold text-indigo hover:underline"
                      >
                        {t("prReturnToSupplier")}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setDeleting(p)}
                      className="text-xs font-semibold text-red-500 hover:text-red-600"
                    >
                      {t("delete")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <ReturnsList
            returns={returns}
            currency={currency}
            onReceive={setReceiving}
            onDelete={setDeletingReturn}
          />
        </Card>
      </div>

      {returning ? (
        <ReturnDialog
          purchase={returning}
          returns={returns}
          currency={currency}
          onSave={(r) => createReturn(returning, r)}
          onClose={() => setReturning(null)}
        />
      ) : null}
      {receiving ? (
        <ReceiveDialog
          ret={receiving}
          batchTracking={batchTracking}
          onConfirm={(info) => receiveReplacement(receiving, info)}
          onClose={() => setReceiving(null)}
        />
      ) : null}
      <ConfirmDialog
        open={deletingReturn !== null}
        title={t("prDeleteReturnTitle")}
        message={t("prDeleteReturnMessage")}
        confirmLabel={t("delete")}
        onConfirm={async () => {
          if (deletingReturn) await deleteReturnRecord(deletingReturn);
          setDeletingReturn(null);
        }}
        onCancel={() => setDeletingReturn(null)}
      />

      <ConfirmDialog
        open={pendingStock !== null}
        title={t("prUpdateStockTitle")}
        message={t("prUpdateStockMessage")}
        confirmLabel={t("prSaveAndStock")}
        cancelLabel="Save without stock"
        danger={false}
        onConfirm={() => confirmWithStock(true)}
        onCancel={() => confirmWithStock(false)}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={t("prDeleteTitle")}
        message={
          deleting
            ? `${fill(t("prDeleteMessage"), {
                amount: formatMoney(deleting.total, currency),
                supplier: deleting.supplierName || t("prUnknownSupplier"),
              })}${deleting.expenseId ? ` ${t("prExpenseAlsoRemoved")}` : ""}`
            : ""
        }
        confirmLabel={t("delete")}
        onConfirm={async () => {
          if (deleting) {
            if (deleting.expenseId) await deleteExpense(deleting.expenseId).catch(() => {});
            await remove(deleting.id);
          }
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
