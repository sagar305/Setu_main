"use client";

import { useMemo, useState } from "react";
import { Boxes, Plus, X } from "lucide-react";
import { useDine } from "@/lib/dine/store";
import { formatPaise } from "@/lib/dine/money";
import { consumptionFor, recipeCost } from "@/lib/dine/recipe";
import { formatQty, fromQty, parseQty } from "@/lib/dine/units";
import type { DineMenuItem, DineRecipeLine, RecipeOwnerType } from "@/lib/dine/types";
import { Field, Modal, inputClass, primaryBtnClass, secondaryBtnClass } from "./ui";

type DraftLine = { materialId: string; text: string };

/**
 * The recipe for one dish, across all three layers.
 *
 * Laid out as base → sizes → add-ons because that is the order the decisions
 * happen in a kitchen, and because the two rules that trip people up need to
 * be visible rather than documented: a size with its own lines *replaces* the
 * base, and an add-on's lines are *added* to whatever came before.
 */
export function RecipeModal({ item, onClose }: { item: DineMenuItem; onClose: () => void }) {
  const {
    materials,
    recipeLines,
    variations,
    modifierGroups,
    modifiers,
    business,
    setRecipe,
  } = useDine();

  const currency = business?.currency ?? "INR";
  const itemVariations = useMemo(
    () =>
      variations
        .filter((variation) => variation.menuItemId === item.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [item.id, variations]
  );
  const itemGroups = useMemo(
    () =>
      modifierGroups
        .filter((group) => group.menuItemId === item.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [item.id, modifierGroups]
  );
  const itemModifiers = useMemo(
    () =>
      modifiers
        .filter((modifier) => itemGroups.some((group) => group.id === modifier.groupId))
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [itemGroups, modifiers]
  );

  const linesOf = (ownerType: RecipeOwnerType, ownerId: string): DraftLine[] =>
    recipeLines
      .filter((line) => line.ownerType === ownerType && line.ownerId === ownerId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((line) => ({ materialId: line.materialId, text: String(fromQty(line.quantity)) }));

  const [draft, setDraft] = useState<Record<string, DraftLine[]>>(() => {
    const initial: Record<string, DraftLine[]> = { [`item:${item.id}`]: linesOf("item", item.id) };
    for (const variation of itemVariations) {
      initial[`variation:${variation.id}`] = linesOf("variation", variation.id);
    }
    for (const modifier of itemModifiers) {
      initial[`modifier:${modifier.id}`] = linesOf("modifier", modifier.id);
    }
    return initial;
  });
  const [busy, setBusy] = useState(false);

  const key = (ownerType: RecipeOwnerType, ownerId: string) => `${ownerType}:${ownerId}`;
  const get = (ownerType: RecipeOwnerType, ownerId: string) => draft[key(ownerType, ownerId)] ?? [];
  const set = (ownerType: RecipeOwnerType, ownerId: string, lines: DraftLine[]) =>
    setDraft((previous) => ({ ...previous, [key(ownerType, ownerId)]: lines }));

  /** Live cost of the base dish, so the effort has an immediate payoff. */
  const preview = useMemo(() => {
    const asLines: DineRecipeLine[] = [];
    for (const [ownerKey, lines] of Object.entries(draft)) {
      const [ownerType, ownerId] = ownerKey.split(":") as [RecipeOwnerType, string];
      lines.forEach((line, index) => {
        if (!line.materialId) return;
        asLines.push({
          id: `${ownerKey}-${index}`,
          ownerType,
          ownerId,
          materialId: line.materialId,
          quantity: parseQty(line.text),
          sortOrder: index,
        });
      });
    }
    const index = { byOwner: new Map<string, DineRecipeLine[]>() };
    for (const line of asLines) {
      const mapKey = `${line.ownerType}:${line.ownerId}`;
      const list = index.byOwner.get(mapKey);
      if (list) list.push(line);
      else index.byOwner.set(mapKey, [line]);
    }
    const materialsById = new Map(materials.map((material) => [material.id, material]));
    return itemVariations.length > 0
      ? itemVariations.map((variation) => ({
          label: variation.name,
          price: variation.price,
          cost: recipeCost(
            consumptionFor(
              { menuItemId: item.id, variationId: variation.id, modifiers: [], quantity: 1 },
              index
            ),
            materialsById
          ),
        }))
      : [
          {
            label: "One portion",
            price: item.price,
            cost: recipeCost(
              consumptionFor(
                { menuItemId: item.id, variationId: null, modifiers: [], quantity: 1 },
                index
              ),
              materialsById
            ),
          },
        ];
  }, [draft, item, itemVariations, materials]);

  const save = async () => {
    setBusy(true);
    try {
      for (const [ownerKey, lines] of Object.entries(draft)) {
        const [ownerType, ownerId] = ownerKey.split(":") as [RecipeOwnerType, string];
        await setRecipe(
          ownerType,
          ownerId,
          lines
            .filter((line) => line.materialId)
            .map((line) => ({ materialId: line.materialId, quantity: parseQty(line.text) }))
        );
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  if (materials.length === 0) {
    return (
      <Modal open onClose={onClose} title={`Recipe · ${item.name}`}>
        <p className="text-sm text-muted">
          Add some raw materials first — rice, paneer, ghee — on the Stock screen. A recipe is a
          list of those, so there is nothing to choose from yet.
        </p>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className={primaryBtnClass}>
            Got it
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={`Recipe · ${item.name}`} wide>
      <div className="space-y-5">
        <p className="rounded-xl bg-cream-paper p-3 text-xs leading-relaxed text-ink">
          Quantities are for <strong>one portion</strong>. Sending a round to the kitchen takes them
          out of stock.
        </p>

        <LineEditor
          title={itemVariations.length > 0 ? "Base recipe" : "Recipe"}
          hint={
            itemVariations.length > 0
              ? "Used by any size that does not have its own recipe below."
              : undefined
          }
          lines={get("item", item.id)}
          onChange={(lines) => set("item", item.id, lines)}
        />

        {itemVariations.map((variation) => {
          const lines = get("variation", variation.id);
          const overriding = lines.length > 0;
          return (
            <div
              key={variation.id}
              className="rounded-xl border border-muted-line/40 bg-cream/30 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-ink">
                  {variation.name}
                  <span className="ml-2 text-xs font-normal text-muted">
                    {formatPaise(variation.price, currency)}
                  </span>
                </p>
                {overriding ? (
                  <button
                    type="button"
                    onClick={() => set("variation", variation.id, [])}
                    className="text-xs font-semibold text-indigo"
                  >
                    Use the base recipe instead
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      set("variation", variation.id, get("item", item.id).map((line) => ({ ...line })))
                    }
                    className="text-xs font-semibold text-indigo"
                  >
                    Give this size its own recipe
                  </button>
                )}
              </div>

              {overriding ? (
                <div className="mt-3">
                  <LineEditor
                    title=""
                    hint="Replaces the base recipe entirely for this size."
                    lines={lines}
                    onChange={(next) => set("variation", variation.id, next)}
                  />
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted">
                  Uses the base recipe. Half plates usually need their own — less rice, but the same
                  raita.
                </p>
              )}
            </div>
          );
        })}

        {itemGroups.map((group) => {
          const options = itemModifiers.filter((modifier) => modifier.groupId === group.id);
          if (options.length === 0) return null;
          return (
            <div key={group.id} className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {group.name}
                <span className="ml-2 font-normal normal-case tracking-normal text-muted/70">
                  added on top of whichever recipe applies — use a minus for &ldquo;no onion&rdquo;
                </span>
              </p>
              {options.map((modifier) => (
                <div
                  key={modifier.id}
                  className="rounded-xl border border-muted-line/40 bg-white p-3"
                >
                  <p className="text-sm font-bold text-ink">
                    {modifier.name}
                    {modifier.priceDelta !== 0 && (
                      <span className="ml-2 text-xs font-normal text-muted">
                        +{formatPaise(modifier.priceDelta, currency)}
                      </span>
                    )}
                  </p>
                  <div className="mt-2">
                    <LineEditor
                      title=""
                      lines={get("modifier", modifier.id)}
                      onChange={(next) => set("modifier", modifier.id, next)}
                      allowNegative
                      compact
                    />
                  </div>
                </div>
              ))}
            </div>
          );
        })}

        <div className="rounded-xl border border-indigo/30 bg-indigo/5 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo">Cost check</p>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {preview.map((row) => {
                const margin = row.price - row.cost;
                const pct = row.price > 0 ? Math.round((row.cost / row.price) * 100) : 0;
                return (
                  <tr key={row.label}>
                    <td className="py-1 text-ink">{row.label}</td>
                    <td className="py-1 text-right text-muted">
                      costs {formatPaise(row.cost, currency)}
                    </td>
                    <td className="py-1 text-right text-muted">sells {formatPaise(row.price, currency)}</td>
                    <td
                      className={`py-1 text-right font-bold ${
                        row.cost === 0 ? "text-muted" : pct > 40 ? "text-red-600" : "text-green-700"
                      }`}
                    >
                      {row.cost === 0 ? "—" : `${pct}% food cost`}
                    </td>
                    <td className="py-1 text-right text-muted">
                      {row.cost === 0 ? "" : `${formatPaise(margin, currency)} margin`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-muted">
            At current average costs. Add-ons are not included here — they vary per order.
          </p>
        </div>

        <div className="flex justify-end gap-3 border-t border-muted-line/20 pt-4">
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className={primaryBtnClass}
          >
            {busy ? "Saving…" : "Save recipe"}
          </button>
        </div>
      </div>
    </Modal>
  );

  function LineEditor({
    title,
    hint,
    lines,
    onChange,
    allowNegative,
    compact,
  }: {
    title: string;
    hint?: string;
    lines: DraftLine[];
    onChange: (lines: DraftLine[]) => void;
    allowNegative?: boolean;
    compact?: boolean;
  }) {
    const used = new Set(lines.map((line) => line.materialId));
    return (
      <div>
        {(title || hint) && (
          <div className="mb-2">
            {title && (
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
            )}
            {hint && <p className="text-[11px] text-muted/80">{hint}</p>}
          </div>
        )}

        <div className="space-y-2">
          {lines.map((line, index) => {
            const material = materials.find((row) => row.id === line.materialId);
            return (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <select
                  value={line.materialId}
                  onChange={(event) =>
                    onChange(
                      lines.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, materialId: event.target.value } : row
                      )
                    )
                  }
                  aria-label="Material"
                  className={`${inputClass} min-w-[140px] flex-1`}
                >
                  <option value="">Choose a material…</option>
                  {materials
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((row) => (
                      <option
                        key={row.id}
                        value={row.id}
                        disabled={used.has(row.id) && row.id !== line.materialId}
                      >
                        {row.name}
                      </option>
                    ))}
                </select>

                <input
                  inputMode="decimal"
                  value={line.text}
                  onChange={(event) =>
                    onChange(
                      lines.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, text: event.target.value } : row
                      )
                    )
                  }
                  placeholder={allowNegative ? "30 or −10" : "250"}
                  aria-label="Quantity"
                  className={`${inputClass} w-24`}
                />
                <span className="w-8 text-xs text-muted">{material?.baseUnit ?? ""}</span>

                {material && parseQty(line.text) !== 0 && (
                  <span className="text-xs text-muted">
                    {formatQty(Math.abs(parseQty(line.text)), material.baseUnit)}
                    {parseQty(line.text) < 0 ? " removed" : ""}
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => onChange(lines.filter((_, rowIndex) => rowIndex !== index))}
                  aria-label="Remove line"
                  className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-red-50 hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onChange([...lines, { materialId: "", text: "" }])}
          className={`mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo ${
            compact ? "" : ""
          }`}
        >
          <Plus className="h-3.5 w-3.5" />
          {lines.length === 0 ? "Add an ingredient" : "Add another"}
        </button>
      </div>
    );
  }
}

/** Small badge for the menu card, showing whether a dish is costed. */
export function RecipeBadge({ item }: { item: DineMenuItem }) {
  const { recipeLines, variations, settings } = useDine();
  if (!settings.inventoryEnabled) return null;

  const variationIds = variations
    .filter((variation) => variation.menuItemId === item.id)
    .map((variation) => variation.id);
  const costed = recipeLines.some(
    (line) =>
      (line.ownerType === "item" && line.ownerId === item.id) ||
      (line.ownerType === "variation" && variationIds.includes(line.ownerId))
  );

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        costed ? "bg-green-100 text-green-800" : "bg-cream text-muted"
      }`}
    >
      <Boxes className="h-2.5 w-2.5" aria-hidden="true" />
      {costed ? "Costed" : "No recipe"}
    </span>
  );
}
