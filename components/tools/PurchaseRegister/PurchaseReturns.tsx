"use client";

// Returns to suppliers, for the Purchase Register: the "Return to supplier"
// dialog, the "replacement received" dialog, and the list of returns.
// Stock and storage are handled by the parent through the callbacks.

import { useEffect, useState, type ReactNode } from "react";
import {
  Field,
  NumberInput,
  PrimaryButton,
  SecondaryButton,
  Select,
  TextInput,
} from "@/components/toolkit/ui";
import { returnAmount, returnableLines } from "@/lib/toolkit/purchaseReturns";
import type { Purchase, PurchaseReturn, PurchaseReturnItem, ReturnType } from "@/lib/toolkit/types";
import { formatMoney } from "@/lib/pos/types";
import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/translate";

const todayIso = () => new Date().toISOString().split("T")[0];

function Sheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <h3 className="text-lg font-bold text-ink">{title}</h3>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export type NewReturn = {
  items: PurchaseReturnItem[];
  mode: ReturnType;
  date: string;
  note: string;
};

export function ReturnDialog({
  purchase,
  returns,
  currency,
  onSave,
  onClose,
}: {
  purchase: Purchase;
  returns: PurchaseReturn[];
  currency: string;
  onSave: (r: NewReturn) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const lines = returnableLines(purchase, returns);
  const [qty, setQty] = useState<Record<number, string>>({});
  const [mode, setMode] = useState<ReturnType>(lines[0]?.item.returnType ?? "credit-note");
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const chosen: PurchaseReturnItem[] = lines
    .map((l) => ({
      itemIndex: l.itemIndex,
      productId: l.item.productId,
      name: l.item.name,
      quantity: Number(qty[l.itemIndex] || 0),
      unitCost: l.item.unitCost,
    }))
    .filter((i) => i.quantity > 0);

  const save = async () => {
    for (const l of lines) {
      const n = Number(qty[l.itemIndex] || 0);
      if (!Number.isFinite(n) || n < 0 || n > l.left) {
        setError(fill(t("prReturnLeft"), { left: l.left, qty: l.item.quantity }) + ` — ${l.item.name}`);
        return;
      }
    }
    if (chosen.length === 0) {
      setError(t("prReturnQty"));
      return;
    }
    setSaving(true);
    try {
      await onSave({ items: chosen, mode, date, note: note.trim() });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet title={fill(t("prReturnTitle"), { supplier: purchase.supplierName || t("prUnknownSupplier") })} onClose={onClose}>
      <div className="space-y-3">
        {lines.map((l) => (
          <div key={l.itemIndex} className="grid grid-cols-[1fr_90px] items-end gap-3 rounded-lg border border-muted-line/30 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{l.item.name}</p>
              <p className="text-xs text-muted">
                {fill(t("prReturnLeft"), { left: l.left, qty: l.item.quantity })} ·{" "}
                {formatMoney(l.item.unitCost, currency)}
                {l.item.returnBy ? ` · ${fill(t("prReturnTill"), { date: l.item.returnBy })}` : ""}
              </p>
            </div>
            <Field label={t("prReturnQty")}>
              <NumberInput
                min={0}
                max={l.left}
                value={qty[l.itemIndex] ?? ""}
                onChange={(e) => setQty((q) => ({ ...q, [l.itemIndex]: e.target.value }))}
              />
            </Field>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("prReturnAs")}>
            <Select value={mode} onChange={(e) => setMode(e.target.value as ReturnType)}>
              <option value="credit-note">{t("prCreditNote")}</option>
              <option value="replacement">{t("prReplacement")}</option>
            </Select>
          </Field>
          <Field label={t("date")}>
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label={t("notes")}>
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("optional")} />
        </Field>
        <p className="text-xs text-muted">{t("prReturnStockNote")}</p>
        <p className="text-sm font-bold text-ink">
          {t("prReturnValue")}: {formatMoney(returnAmount(chosen), currency)}
        </p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
      <div className="mt-5 flex justify-end gap-3">
        <SecondaryButton onClick={onClose}>{t("cancel")}</SecondaryButton>
        <PrimaryButton onClick={() => void save()} disabled={saving || chosen.length === 0}>
          {t("prSaveReturn")}
        </PrimaryButton>
      </div>
    </Sheet>
  );
}

export type ReceiveInfo = { batchNo: string; expiry: string; sellingPrice: number | null };

export function ReceiveDialog({
  ret,
  batchTracking,
  onConfirm,
  onClose,
}: {
  ret: PurchaseReturn;
  batchTracking: boolean;
  onConfirm: (info: ReceiveInfo) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [batchNo, setBatchNo] = useState("");
  const [expiry, setExpiry] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const confirm = async () => {
    setSaving(true);
    try {
      const sp = price.trim() === "" ? null : Number(price);
      await onConfirm({ batchNo, expiry, sellingPrice: sp !== null && Number.isFinite(sp) && sp >= 0 ? sp : null });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet title={fill(t("prReceiveTitle"), { supplier: ret.supplierName || t("prUnknownSupplier") })} onClose={onClose}>
      <p className="text-sm text-ink">{ret.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}</p>
      <p className="mt-1 text-xs text-muted">{t("prReceiveHint")}</p>
      {batchTracking ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={t("prBatchNo")}>
            <TextInput value={batchNo} onChange={(e) => setBatchNo(e.target.value)} placeholder={t("optional")} />
          </Field>
          <Field label={t("prExpiry")}>
            <TextInput type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </Field>
          <Field label={t("prSellingPrice")}>
            <NumberInput min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={t("optional")} />
          </Field>
        </div>
      ) : null}
      <div className="mt-5 flex justify-end gap-3">
        <SecondaryButton onClick={onClose}>{t("cancel")}</SecondaryButton>
        <PrimaryButton onClick={() => void confirm()} disabled={saving}>
          {t("prMarkReceived")}
        </PrimaryButton>
      </div>
    </Sheet>
  );
}

export function ReturnsList({
  returns,
  currency,
  onReceive,
  onDelete,
}: {
  returns: PurchaseReturn[];
  currency: string;
  onReceive: (r: PurchaseReturn) => void;
  onDelete: (r: PurchaseReturn) => void;
}) {
  const { t } = useI18n();
  if (returns.length === 0) return null;
  const sorted = [...returns].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const status = (r: PurchaseReturn) =>
    r.status === "pending"
      ? { label: t("prReturnPending"), className: "bg-saffron/15 text-ink" }
      : r.status === "received"
        ? { label: t("prReturnReceived"), className: "bg-emerald-50 text-emerald-700" }
        : { label: t("prReturnSettled"), className: "bg-indigo/10 text-indigo" };
  return (
    <div className="mt-6 border-t border-muted-line/30 pt-4">
      <h3 className="mb-3 text-sm font-bold text-ink">{t("prReturns")}</h3>
      <div className="space-y-2">
        {sorted.map((r) => {
          const s = status(r);
          return (
            <div key={r.id} className="rounded-lg border border-muted-line/30 p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{r.supplierName || t("prUnknownSupplier")}</p>
                  <p className="text-xs text-muted">
                    {r.date} · {r.mode === "credit-note" ? t("prCreditNote") : t("prReplacement")}
                  </p>
                </div>
                <p className="font-bold text-ink">{formatMoney(r.amount, currency)}</p>
              </div>
              <p className="mt-1 text-xs text-muted">{r.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.className}`}>{s.label}</span>
                {r.status === "pending" ? (
                  <button type="button" onClick={() => onReceive(r)} className="text-xs font-semibold text-indigo hover:underline">
                    {t("prMarkReceived")}
                  </button>
                ) : null}
                <button type="button" onClick={() => onDelete(r)} className="text-xs font-semibold text-red-500 hover:text-red-600">
                  {t("delete")}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
