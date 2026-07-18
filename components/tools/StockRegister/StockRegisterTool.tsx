"use client";

// Stock Register — a richer standalone view over the SAME workspace inventory
// the POS uses (one source of truth; spec Q6). Stock changes are a dangerous
// op and always go through a confirmation.

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
import { getInventory, updateStock } from "@/lib/toolkit/workspace";
import type { InventoryLog } from "@/lib/pos/types";
import { toCsv, downloadCsv } from "@/lib/pos/csv";

export function StockRegisterTool() {
  const workspace = useWorkspaceConnection("stock-register");
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [tab, setTab] = useState<"stock" | "history">("stock");
  const [search, setSearch] = useState("");

  // Adjustment form
  const [productId, setProductId] = useState("");
  const [direction, setDirection] = useState<"add" | "reduce">("add");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (workspace.connected) {
      getInventory().then(setLogs).catch(() => {});
    }
  }, [workspace.connected]);

  const products = workspace.products;
  const tracked = useMemo(
    () =>
      products
        .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [products, search]
  );

  const selected = products.find((p) => p.id === productId);
  const qtyNum = Number(qty);
  const canAdjust = selected && Number.isFinite(qtyNum) && qtyNum > 0;

  const applyAdjustment = async () => {
    if (!selected || !canAdjust) return;
    const change = direction === "add" ? qtyNum : -qtyNum;
    await updateStock(selected.id, change, note || (direction === "add" ? "Stock in" : "Stock out"));
    await workspace.reload();
    setLogs(await getInventory());
    setMessage(
      `${selected.name}: ${direction === "add" ? "+" : "−"}${qtyNum} ${selected.unit || "units"}`
    );
    setConfirming(false);
    setQty("");
    setNote("");
  };

  const exportCsv = () => {
    const csv = toCsv(
      ["Product", "SKU", "Stock", "Unit", "Tracked"],
      tracked.map((p) => [p.name, p.sku, p.trackStock ? p.stock : "", p.unit, p.trackStock ? "Yes" : "No"])
    );
    downloadCsv("stock-register.csv", csv);
  };

  const sortedLogs = useMemo(
    () => [...logs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200),
    [logs]
  );

  if (workspace.ready && !workspace.exists) {
    return (
      <EmptyState
        title="No business workspace on this device yet"
        subtitle="The Stock Register works on the products saved in your Setu workspace. Set up your products in the free Browser POS first — they'll appear here automatically."
        action={
          <a
            href="/products/browser-based-pos"
            className="rounded-lg bg-indigo px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo/90"
          >
            Open Browser POS
          </a>
        }
      />
    );
  }

  return (
    <div>
      <WorkspaceBanner
        connection={workspace}
        message="View live stock levels and record adjustments for your saved products."
      />

      {!workspace.connected ? null : (
        <>
          <div className="mb-6 grid gap-6 lg:grid-cols-[1fr_320px]">
            <Card>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                  <SecondaryButton
                    onClick={() => setTab("stock")}
                    className={tab === "stock" ? "bg-indigo/10" : ""}
                  >
                    Current stock
                  </SecondaryButton>
                  <SecondaryButton
                    onClick={() => setTab("history")}
                    className={tab === "history" ? "bg-indigo/10" : ""}
                  >
                    Movement history
                  </SecondaryButton>
                </div>
                <SecondaryButton onClick={exportCsv}>Export CSV</SecondaryButton>
              </div>

              {tab === "stock" ? (
                <>
                  <TextInput
                    placeholder="Search products…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="mb-4"
                  />
                  {tracked.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted">
                      No products found. Add products in the Browser POS.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-muted-line/30 text-left text-muted">
                            <th className="py-2 pr-4 font-semibold">Product</th>
                            <th className="py-2 pr-4 font-semibold">SKU</th>
                            <th className="py-2 pr-4 text-right font-semibold">Stock</th>
                            <th className="py-2 font-semibold">Unit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tracked.map((p) => (
                            <tr key={p.id} className="border-b border-muted-line/20">
                              <td className="py-2.5 pr-4 font-medium text-ink">{p.name}</td>
                              <td className="py-2.5 pr-4 text-muted">{p.sku || "—"}</td>
                              <td
                                className={`py-2.5 pr-4 text-right font-semibold ${
                                  !p.trackStock
                                    ? "text-muted"
                                    : p.stock <= 0
                                      ? "text-red-600"
                                      : p.stock <= 5
                                        ? "text-amber-600"
                                        : "text-ink"
                                }`}
                              >
                                {p.trackStock ? p.stock : "not tracked"}
                              </td>
                              <td className="py-2.5 text-muted">{p.unit || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : sortedLogs.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">No stock movements recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-muted-line/30 text-left text-muted">
                        <th className="py-2 pr-4 font-semibold">When</th>
                        <th className="py-2 pr-4 font-semibold">Product</th>
                        <th className="py-2 pr-4 font-semibold">Type</th>
                        <th className="py-2 pr-4 text-right font-semibold">Change</th>
                        <th className="py-2 pr-4 text-right font-semibold">After</th>
                        <th className="py-2 font-semibold">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedLogs.map((log) => (
                        <tr key={log.id} className="border-b border-muted-line/20">
                          <td className="py-2.5 pr-4 text-muted">
                            {new Date(log.createdAt).toLocaleString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-2.5 pr-4 font-medium text-ink">{log.productName}</td>
                          <td className="py-2.5 pr-4 text-muted">{log.type}</td>
                          <td
                            className={`py-2.5 pr-4 text-right font-semibold ${
                              log.change >= 0 ? "text-emerald-600" : "text-red-600"
                            }`}
                          >
                            {log.change >= 0 ? `+${log.change}` : log.change}
                          </td>
                          <td className="py-2.5 pr-4 text-right text-ink">{log.stockAfter}</td>
                          <td className="py-2.5 text-muted">{log.note || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card className="h-fit">
              <h2 className="mb-4 text-lg font-bold text-ink">Record adjustment</h2>
              <div className="space-y-4">
                <Field label="Product">
                  <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
                    <option value="">Choose…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Direction">
                  <Select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value as "add" | "reduce")}
                  >
                    <option value="add">Stock in (+)</option>
                    <option value="reduce">Stock out (−)</option>
                  </Select>
                </Field>
                <Field label="Quantity">
                  <NumberInput min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
                </Field>
                <Field label="Note (optional)">
                  <TextInput
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. New delivery, damage, audit"
                  />
                </Field>
                <PrimaryButton
                  className="w-full"
                  disabled={!canAdjust}
                  onClick={() => setConfirming(true)}
                >
                  Apply adjustment
                </PrimaryButton>
                {message ? (
                  <p className="text-sm font-medium text-emerald-600">Saved: {message}</p>
                ) : null}
              </div>
            </Card>
          </div>

          <ConfirmDialog
            open={confirming}
            title="Change stock?"
            message={
              selected
                ? `${selected.name}: ${direction === "add" ? "add" : "remove"} ${qtyNum} ${
                    selected.unit || "units"
                  }. This updates the shared workspace — the POS and every other Setu tool will see the new stock level.`
                : ""
            }
            confirmLabel="Yes, update stock"
            onConfirm={applyAdjustment}
            onCancel={() => setConfirming(false)}
          />
        </>
      )}
    </div>
  );
}
