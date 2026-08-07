"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useDine, type AddItemInput } from "@/lib/dine/store";
import { formatPaise } from "@/lib/dine/money";
import type { AppliedModifier, DineMenuItem } from "@/lib/dine/types";
import { Field, Modal, inputClass, primaryBtnClass, tapTargetClass } from "./ui";

/**
 * Chooser for an item that needs a decision before it can go on the ticket —
 * a variation (FR-2.2) or a modifier group (FR-2.3). Items with neither skip
 * this entirely and land on the ticket in one tap, which is the common case
 * during a rush.
 */
export function ItemChooserModal({
  item,
  open,
  onClose,
  onAdd,
}: {
  item: DineMenuItem | null;
  open: boolean;
  onClose: () => void;
  onAdd: (input: AddItemInput) => void;
}) {
  const { variations, modifierGroups, modifiers, business } = useDine();
  const currency = business?.currency ?? "INR";

  const itemVariations = useMemo(
    () =>
      item
        ? variations
            .filter((variation) => variation.menuItemId === item.id)
            .sort((a, b) => a.sortOrder - b.sortOrder)
        : [],
    [item, variations]
  );

  const groups = useMemo(
    () =>
      item
        ? modifierGroups
            .filter((group) => group.menuItemId === item.id)
            .sort((a, b) => a.sortOrder - b.sortOrder)
        : [],
    [item, modifierGroups]
  );

  const [variationId, setVariationId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");

  // Reset every time a different item is opened.
  useEffect(() => {
    if (!open || !item) return;
    setVariationId(itemVariations[0]?.id ?? null);
    setQuantity(1);
    setNote("");
    setSelected(
      Object.fromEntries(
        groups.map((group) => {
          // A required single-select starts on its first option, so the common
          // case is one tap rather than two.
          const first = modifiers
            .filter((modifier) => modifier.groupId === group.id)
            .sort((a, b) => a.sortOrder - b.sortOrder)[0];
          return [group.id, group.minSelect > 0 && first ? [first.id] : []];
        })
      )
    );
  }, [groups, item, itemVariations, modifiers, open]);

  if (!item) return null;

  const toggle = (groupId: string, modifierId: string, maxSelect: number) => {
    setSelected((previous) => {
      const current = previous[groupId] ?? [];
      if (current.includes(modifierId)) {
        return { ...previous, [groupId]: current.filter((id) => id !== modifierId) };
      }
      if (maxSelect === 1) return { ...previous, [groupId]: [modifierId] };
      if (current.length >= maxSelect) return previous;
      return { ...previous, [groupId]: [...current, modifierId] };
    });
  };

  const chosenModifiers: AppliedModifier[] = groups.flatMap((group) =>
    (selected[group.id] ?? []).flatMap((modifierId) => {
      const modifier = modifiers.find((row) => row.id === modifierId);
      return modifier
        ? [{ id: modifier.id, name: modifier.name, priceDelta: modifier.priceDelta }]
        : [];
    })
  );

  const basePrice = variationId
    ? (itemVariations.find((variation) => variation.id === variationId)?.price ?? item.price)
    : item.price;
  const unitPrice =
    basePrice + chosenModifiers.reduce((sum, modifier) => sum + modifier.priceDelta, 0);

  const unmetGroup = groups.find(
    (group) => (selected[group.id] ?? []).length < group.minSelect
  );

  const submit = () => {
    if (unmetGroup) return;
    onAdd({
      menuItemId: item.id,
      variationId,
      quantity,
      modifiers: chosenModifiers,
      note: note.trim(),
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={item.name}>
      <div className="space-y-5">
        {itemVariations.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Size <span className="text-red-500">*</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {itemVariations.map((variation) => (
                <button
                  key={variation.id}
                  type="button"
                  onClick={() => setVariationId(variation.id)}
                  aria-pressed={variationId === variation.id}
                  className={`${tapTargetClass} rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                    variationId === variation.id
                      ? "border-indigo bg-indigo text-white"
                      : "border-muted-line/40 bg-white text-ink hover:border-indigo/50"
                  }`}
                >
                  {variation.name}
                  <span className="ml-2 font-normal opacity-80">
                    {formatPaise(variation.price, currency)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {groups.map((group) => {
          const options = modifiers
            .filter((modifier) => modifier.groupId === group.id)
            .sort((a, b) => a.sortOrder - b.sortOrder);
          const chosen = selected[group.id] ?? [];
          return (
            <div key={group.id}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                {group.name}
                {group.minSelect > 0 && <span className="text-red-500"> *</span>}
                <span className="ml-2 font-normal normal-case tracking-normal text-muted/70">
                  {group.maxSelect === 1 ? "pick one" : `pick up to ${group.maxSelect}`}
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {options.map((modifier) => (
                  <button
                    key={modifier.id}
                    type="button"
                    onClick={() => toggle(group.id, modifier.id, group.maxSelect)}
                    aria-pressed={chosen.includes(modifier.id)}
                    className={`${tapTargetClass} rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                      chosen.includes(modifier.id)
                        ? "border-indigo bg-indigo text-white"
                        : "border-muted-line/40 bg-white text-ink hover:border-indigo/50"
                    }`}
                  >
                    {modifier.name}
                    {modifier.priceDelta !== 0 && (
                      <span className="ml-1.5 font-normal opacity-80">
                        +{formatPaise(modifier.priceDelta, currency)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        <Field label="Note for the kitchen" hint="Rides along to the KOT, e.g. “less spicy”.">
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="less spicy, no onion…"
            className={inputClass}
          />
        </Field>

        <div className="flex items-center justify-between gap-4 border-t border-muted-line/20 pt-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQuantity((previous) => Math.max(previous - 1, 1))}
              aria-label="Reduce quantity"
              className={`${tapTargetClass} flex items-center justify-center rounded-lg border border-muted-line/40 bg-white text-ink`}
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-10 text-center text-lg font-bold text-ink" aria-live="polite">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((previous) => previous + 1)}
              aria-label="Increase quantity"
              className={`${tapTargetClass} flex items-center justify-center rounded-lg border border-muted-line/40 bg-white text-ink`}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={Boolean(unmetGroup)}
            className={`${primaryBtnClass} ${tapTargetClass}`}
          >
            {unmetGroup ? `Choose ${unmetGroup.name}` : `Add · ${formatPaise(unitPrice * quantity, currency)}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
