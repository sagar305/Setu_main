"use client";

import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/translate";
import { useMemo, useState } from "react";
import {
  Boxes,
  ClipboardCheck,
  Download,
  History,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useDine, type MaterialInput } from "@/lib/dine/store";
import { formatPaise, parseAmount } from "@/lib/dine/money";
import { downloadCsv, materialsCsv, stockMovesCsv } from "@/lib/dine/csv";
import { lowStock, stockValue } from "@/lib/dine/recipe";
import {
  BASE_UNITS,
  formatQty,
  fromQty,
  packToQty,
  parseQty,
  suggestedPacks,
  valueOf,
  type BaseUnit,
} from "@/lib/dine/units";
import { stockMoveLabel, type DineMaterial } from "@/lib/dine/types";
import { printedAt } from "./printing";
import {
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  SearchInput,
  SectionHeading,
  StatCard,
  dangerBtnClass,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
  tapTargetClass,
} from "./ui";

/**
 * Raw materials, not dishes.
 *
 * A restaurant's cupboard holds rice and ghee, never "12 Gajar Halwa" — so
 * this screen counts ingredients, and the recipes on the menu are what turn a
 * sale into a deduction.
 */
export function InventoryScreen() {
  const { lang, t } = useI18n();
  const {
    materials,
    stockMoves,
    recipeLines,
    menuItems,
    business,
    settings,
    updateSettings,
    deleteMaterial,
  } = useDine();

  const currency = business?.currency ?? "INR";
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<DineMaterial | null>(null);
  const [creating, setCreating] = useState(false);
  const [stockFor, setStockFor] = useState<DineMaterial | null>(null);
  const [historyFor, setHistoryFor] = useState<DineMaterial | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DineMaterial | null>(null);

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    return materials
      .filter((material) => !search || material.name.toLowerCase().includes(search))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [materials, query]);

  const low = useMemo(() => lowStock(materials), [materials]);
  const value = useMemo(() => stockValue(materials), [materials]);
  const costedItems = useMemo(() => {
    const owners = new Set(recipeLines.map((line) => line.ownerId));
    return menuItems.filter((item) => owners.has(item.id)).length;
  }, [menuItems, recipeLines]);

  if (!settings.inventoryEnabled) {
    return (
      <EmptyState
        icon={<Boxes className="h-6 w-6" />}
        title={t("dnInStockOff")}
        message={t("dnInStockOffBody")}
        action={
          <button
            type="button"
            onClick={() => void updateSettings({ inventoryEnabled: true })}
            className={primaryBtnClass}
          >
            <Boxes className="h-4 w-4" />
            Turn on stock tracking
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeading
        title={t("stock")}
        subtitle={`${materials.length} raw material${materials.length === 1 ? "" : "s"} · ${
          costedItems
        } dish${costedItems === 1 ? "" : "es"} with a recipe`}
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={materials.length === 0}
              onClick={() => downloadCsv("materials.csv", materialsCsv(materials))}
              className={secondaryBtnClass}
            >
              <Download className="h-4 w-4" />
              Export
            </button>
            <button type="button" onClick={() => setCreating(true)} className={primaryBtnClass}>
              <Plus className="h-4 w-4" />
              Add material
            </button>
          </div>
        }
      />

      {materials.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label={t("dnInStockValue")} value={formatPaise(value, currency)} sub={t("dnInAtAvgCost")} />
          <StatCard
            label={t("dnInRunningLow")}
            value={String(low.length)}
            sub={low.length ? low.slice(0, 3).map((m) => m.name).join(", ") : t("dnInNothingToReorder")}
          />
          <StatCard
            label={t("dnInDishesCosted")}
            value={`${costedItems} / ${menuItems.length}`}
            sub={costedItems < menuItems.length ? t("dnInAddRecipesHint") : t("dnInAllCosted")}
          />
        </div>
      )}

      {low.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-saffron/50 bg-saffron/10 p-4">
          <TriangleAlert className="h-5 w-5 shrink-0 text-ink" aria-hidden="true" />
          <p className="flex-1 text-sm text-ink">
            <strong className="font-bold">
              {low.length} material{low.length === 1 ? "" : "s"} at or below the reorder level:
            </strong>{" "}
            {low.map((material) => `${material.name} (${formatQty(material.stockQty, material.baseUnit)})`).join(", ")}
          </p>
        </div>
      )}

      {materials.length === 0 ? (
        <EmptyState
          icon={<Boxes className="h-6 w-6" />}
          title={t("dnInNoMaterials")}
          message={t("dnInNoMaterialsBody")}
          action={
            <button type="button" onClick={() => setCreating(true)} className={primaryBtnClass}>
              <Plus className="h-4 w-4" />
              Add material
            </button>
          }
        />
      ) : (
        <>
          <SearchInput value={query} onChange={setQuery} placeholder={t("dnInSearchPh")} />

          <div className="overflow-x-auto rounded-2xl border border-muted-line/30 bg-white shadow-sm">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-muted-line/20 bg-cream-paper text-left">
                  <th className="px-4 py-2 font-semibold text-muted">{t("dnRcMaterial")}</th>
                  <th className="px-4 py-2 text-right font-semibold text-muted">{t("dnInColInStock")}</th>
                  <th className="px-4 py-2 text-right font-semibold text-muted">{t("dnInColReorderAt")}</th>
                  <th className="px-4 py-2 text-right font-semibold text-muted">{t("dnInColAvgCost")}</th>
                  <th className="px-4 py-2 text-right font-semibold text-muted">{t("dnInColValue")}</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {visible.map((material) => {
                  const isLow =
                    material.reorderLevel > 0 && material.stockQty <= material.reorderLevel;
                  const isOut = material.stockQty <= 0;
                  return (
                    <tr key={material.id} className="border-b border-muted-line/10 last:border-0">
                      <td className="px-4 py-2">
                        <span className="font-semibold text-ink">{material.name}</span>
                        {material.packLabel && (
                          <span className="ml-2 text-xs text-muted">
                            bought by the {material.packLabel}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span
                          className={`font-bold ${
                            isOut ? "text-red-600" : isLow ? "text-saffron" : "text-ink"
                          }`}
                        >
                          {formatQty(material.stockQty, material.baseUnit)}
                        </span>
                        {(isOut || isLow) && (
                          <span
                            className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              isOut ? "bg-red-100 text-red-700" : "bg-saffron/20 text-ink"
                            }`}
                          >
                            {isOut ? t("dnInOut") : t("dnInLow")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right text-muted">
                        {material.reorderLevel > 0
                          ? formatQty(material.reorderLevel, material.baseUnit)
                          : "—"}
                      </td>
                      <td className="px-4 py-2 text-right text-muted">
                        {material.costPerUnit > 0
                          ? `${formatPaise(valueOf(1000 * 1000, material.costPerUnit), currency)} / ${
                              material.baseUnit === "g"
                                ? "kg"
                                : material.baseUnit === "ml"
                                  ? "L"
                                  : "1000 pc"
                            }`
                          : "—"}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-ink">
                        {formatPaise(valueOf(material.stockQty, material.costPerUnit), currency)}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setStockFor(material)}
                            className="rounded-lg px-2 py-1 text-xs font-semibold text-indigo hover:bg-cream"
                          >
                            Stock
                          </button>
                          <button
                            type="button"
                            onClick={() => setHistoryFor(material)}
                            aria-label={fill(t("dnInHistoryFor"), { name: material.name })}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-cream hover:text-indigo"
                          >
                            <History className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(material)}
                            aria-label={fill(t("dnInEditMaterial"), { name: material.name })}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-cream hover:text-indigo"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(material)}
                            aria-label={fill(t("appDeleteNamed"), { name: material.name })}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">
              Stock comes out when a round is sent to the kitchen. A dish cancelled after that is
              recorded as wastage, not returned.
            </p>
            <button
              type="button"
              disabled={stockMoves.length === 0}
              onClick={() => downloadCsv("stock-movements.csv", stockMovesCsv(stockMoves))}
              className="text-xs font-semibold text-indigo disabled:opacity-40"
            >
              Export all movements
            </button>
          </div>
        </>
      )}

      {(creating || editing) && (
        <MaterialModal
          material={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {stockFor && <StockModal material={stockFor} onClose={() => setStockFor(null)} />}

      <Modal
        open={historyFor !== null}
        onClose={() => setHistoryFor(null)}
        title={fill(t("dnInMovementsTitle"), { name: historyFor?.name ?? "" })}
        wide
      >
        <MovementList materialId={historyFor?.id ?? ""} />
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={fill(t("dnInDeleteTitle"), { name: deleteTarget?.name ?? t("dnInThisMaterial") })}
        message={t("dnInDeleteBody")}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await deleteMaterial(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </div>
  );

  function MovementList({ materialId }: { materialId: string }) {
    const rows = stockMoves
      .filter((move) => move.materialId === materialId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 100);
    const material = materials.find((row) => row.id === materialId);

    if (rows.length === 0) {
      return <p className="text-sm text-muted">{t("dnInNothingMoved")}</p>;
    }

    return (
      <div className="max-h-[60vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-muted-line/20 text-left">
              <th className="py-2 font-semibold text-muted">{t("dnBlColWhen")}</th>
              <th className="py-2 font-semibold text-muted">{t("dnInColWhy")}</th>
              <th className="py-2 text-right font-semibold text-muted">{t("dnInColChange")}</th>
              <th className="py-2 text-right font-semibold text-muted">{t("dnInColBalance")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((move) => (
              <tr key={move.id} className="border-b border-muted-line/10 last:border-0">
                <td className="py-2 text-xs text-muted">{printedAt(move.createdAt)}</td>
                <td className="py-2">
                  <span className="text-ink">{stockMoveLabel(move.reason, lang)}</span>
                  {(move.refLabel || move.note) && (
                    <span className="block text-xs text-muted">
                      {[move.refLabel, move.note].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </td>
                <td
                  className={`py-2 text-right font-semibold ${
                    move.change >= 0 ? "text-green-700" : "text-red-600"
                  }`}
                >
                  {move.change >= 0 ? "+" : "−"}
                  {formatQty(Math.abs(move.change), material?.baseUnit ?? "g")}
                </td>
                <td className="py-2 text-right text-muted">
                  {formatQty(move.balanceAfter, material?.baseUnit ?? "g")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
}

const EMPTY_MATERIAL: MaterialInput = {
  name: "",
  baseUnit: "g",
  packLabel: "",
  baseUnitsPerPack: 0,
  reorderLevel: 0,
  note: "",
};

function MaterialModal({
  material,
  onClose,
}: {
  material: DineMaterial | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { createMaterial, updateMaterial } = useDine();
  const [form, setForm] = useState<MaterialInput>(() =>
    material
      ? {
          name: material.name,
          baseUnit: material.baseUnit,
          packLabel: material.packLabel,
          baseUnitsPerPack: material.baseUnitsPerPack,
          reorderLevel: material.reorderLevel,
          note: material.note,
        }
      : EMPTY_MATERIAL
  );
  const [packText, setPackText] = useState(
    material && material.baseUnitsPerPack > 0 ? String(fromQty(material.baseUnitsPerPack)) : ""
  );
  const [reorderText, setReorderText] = useState(
    material && material.reorderLevel > 0 ? String(fromQty(material.reorderLevel)) : ""
  );
  const [busy, setBusy] = useState(false);

  const patch = (updates: Partial<MaterialInput>) =>
    setForm((previous) => ({ ...previous, ...updates }));

  const submit = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      const payload: MaterialInput = {
        ...form,
        baseUnitsPerPack: parseQty(packText),
        reorderLevel: parseQty(reorderText),
      };
      if (material) await updateMaterial(material.id, payload);
      else await createMaterial(payload);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={material ? fill(t("dnInEditMaterial"), { name: material.name }) : t("dnInNewMaterial")}>
      <div className="space-y-4">
        <Field label={t("name")} required>
          <input
            value={form.name}
            onChange={(event) => patch({ name: event.target.value })}
            placeholder={t("dnInNamePh")}
            autoFocus
            className={inputClass}
          />
        </Field>

        <Field
          label={t("dnInCountedIn")}
          hint={t("dnInCountedInHint")}
        >
          <div className="flex gap-2">
            {BASE_UNITS.map((unit) => (
              <button
                key={unit.id}
                type="button"
                onClick={() => patch({ baseUnit: unit.id as BaseUnit })}
                aria-pressed={form.baseUnit === unit.id}
                disabled={Boolean(material)}
                title={material ? t("dnInUnitLocked") : t(unit.long)}
                className={`${tapTargetClass} flex-1 rounded-lg border text-sm font-semibold transition disabled:opacity-50 ${
                  form.baseUnit === unit.id
                    ? "border-indigo bg-indigo text-white"
                    : "border-muted-line/40 bg-white text-ink"
                }`}
              >
                {unit.label}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("dnInBoughtAs")} hint={t("dnInBoughtAsHint")}>
            <input
              value={form.packLabel}
              onChange={(event) => patch({ packLabel: event.target.value })}
              placeholder={t("dnInPackPh")}
              className={inputClass}
            />
          </Field>
          <Field label={fill(t("dnInOnePackIs"), { unit: form.baseUnit })}>
            <input
              inputMode="decimal"
              value={packText}
              onChange={(event) => setPackText(event.target.value)}
              placeholder="5000"
              className={inputClass}
            />
          </Field>
        </div>

        {!material && (
          <div className="flex flex-wrap gap-2">
            {suggestedPacks(form.baseUnit).map((pack) => (
              <button
                key={pack.label}
                type="button"
                onClick={() => {
                  patch({ packLabel: pack.label });
                  setPackText(String(fromQty(pack.baseUnits)));
                }}
                className="rounded-full border border-muted-line/40 bg-white px-3 py-1 text-xs font-semibold text-muted hover:border-indigo/50 hover:text-indigo"
              >
                {pack.label}
              </button>
            ))}
          </div>
        )}

        <Field
          label={fill(t("dnInWarnBelow"), { unit: form.baseUnit })}
          hint={t("dnInWarnBlank")}
        >
          <input
            inputMode="decimal"
            value={reorderText}
            onChange={(event) => setReorderText(event.target.value)}
            placeholder="1000"
            className={inputClass}
          />
        </Field>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !form.name.trim()}
            className={primaryBtnClass}
          >
            {busy ? t("clPfSaving") : material ? t("saveChanges") : t("dnInAddMaterial")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

type StockMode = "add" | "wastage" | "count";

function StockModal({ material, onClose }: { material: DineMaterial; onClose: () => void }) {
  const { t } = useI18n();
  const { addStock, recordWastage, setStockLevel, business } = useDine();
  const currency = business?.currency ?? "INR";

  const [mode, setMode] = useState<StockMode>("add");
  const [qtyText, setQtyText] = useState("");
  const [packText, setPackText] = useState("");
  const [costText, setCostText] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const hasPack = material.baseUnitsPerPack > 0 && material.packLabel !== "";
  const quantity =
    hasPack && packText.trim()
      ? packToQty(Number(packText) || 0, {
          label: material.packLabel,
          baseUnitsPerPack: material.baseUnitsPerPack,
        })
      : parseQty(qtyText);

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === "add") await addStock(material.id, quantity, parseAmount(costText), note.trim());
      else if (mode === "wastage") await recordWastage(material.id, quantity, note.trim());
      else await setStockLevel(material.id, quantity, note.trim() || t("dnSmAdjust"));
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const variance = mode === "count" ? quantity - material.stockQty : 0;

  return (
    <Modal open onClose={onClose} title={material.name}>
      <div className="space-y-4">
        <p className="rounded-xl bg-cream-paper p-3 text-sm text-ink">
          In stock now: <strong>{formatQty(material.stockQty, material.baseUnit)}</strong>
        </p>

        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: "add", label: "dnInAddStock" },
              { id: "wastage", label: "dnSmWastage" },
              { id: "count", label: "dnSmAdjust" },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setMode(option.id)}
              aria-pressed={mode === option.id}
              className={`${tapTargetClass} rounded-xl border text-sm font-semibold transition ${
                mode === option.id
                  ? "border-indigo bg-indigo text-white"
                  : "border-muted-line/40 bg-white text-ink"
              }`}
            >
              {t(option.label)}
            </button>
          ))}
        </div>

        {hasPack && mode === "add" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={fill(t("dnInHowManyPacks"), { pack: material.packLabel })}>
              <input
                inputMode="decimal"
                value={packText}
                onChange={(event) => {
                  setPackText(event.target.value);
                  setQtyText("");
                }}
                placeholder="1"
                autoFocus
                className={inputClass}
              />
            </Field>
            <Field label={fill(t("dnInOrLoose"), { unit: material.baseUnit })}>
              <input
                inputMode="decimal"
                value={qtyText}
                onChange={(event) => {
                  setQtyText(event.target.value);
                  setPackText("");
                }}
                className={inputClass}
              />
            </Field>
          </div>
        ) : (
          <Field
            label={
              mode === "count"
                ? fill(t("dnInCountedQty"), { unit: material.baseUnit })
                : fill(t("dnInQtyUnit"), { unit: material.baseUnit })
            }
          >
            <input
              inputMode="decimal"
              value={qtyText}
              onChange={(event) => setQtyText(event.target.value)}
              autoFocus
              className={inputClass}
            />
          </Field>
        )}

        {mode === "add" && (
          <Field label={t("dnInWhatItCost")} hint={t("dnInWhatItCostHint")}>
            <input
              inputMode="decimal"
              value={costText}
              onChange={(event) => setCostText(event.target.value)}
              placeholder="450.00"
              className={inputClass}
            />
          </Field>
        )}

        {mode === "count" && quantity !== 0 && (
          <p
            className={`rounded-xl p-3 text-sm ${
              variance === 0
                ? "bg-cream-paper text-ink"
                : variance < 0
                  ? "bg-red-50 text-red-700"
                  : "bg-green-50 text-green-800"
            }`}
          >
            {variance === 0
              ? t("dnInMatchesBooks")
              : fill(t("dnInVarianceNote"), {
                  direction: variance < 0 ? t("dnInShort") : t("dnInOver"),
                  amount: formatQty(Math.abs(variance), material.baseUnit),
                })}
          </p>
        )}

        <Field label={t("note")}>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={
              mode === "wastage" ? "spoiled, spilled…" : mode === "add" ? "supplier, bill no…" : ""
            }
            className={inputClass}
          />
        </Field>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || (mode !== "count" && quantity <= 0)}
            className={mode === "wastage" ? dangerBtnClass : primaryBtnClass}
          >
            {mode === "add" && <Plus className="h-4 w-4" />}
            {mode === "count" && <ClipboardCheck className="h-4 w-4" />}
            {busy
              ? t("clPfSaving")
              : mode === "add"
                ? `Add ${quantity > 0 ? formatQty(quantity, material.baseUnit) : "stock"}`
                : mode === "wastage"
                  ? t("dnInRecordWastage")
                  : t("dnInSaveCount")}
          </button>
        </div>

        {mode === "add" && quantity > 0 && parseAmount(costText) > 0 && (
          <p className="text-center text-xs text-muted">
            That works out to{" "}
            {formatPaise(Math.round((parseAmount(costText) * 1000000) / quantity), currency)} per
            1000 {material.baseUnit}.
          </p>
        )}
      </div>
    </Modal>
  );
}
