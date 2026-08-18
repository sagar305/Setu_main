// Recipes: turning "one Chicken Biryani (Full) with extra raita" into a list of
// raw materials to take out of stock.
//
// The whole reason this is not a single list per dish is that consumption
// follows what the guest chose. A half plate uses less rice but the same raita;
// extra cheese is thirty more grams of cheese; "no onion" is ten fewer. So a
// recipe resolves in three layers:
//
//   1. the dish's base recipe
//   2. replaced wholesale if the chosen variation has its own recipe
//   3. plus each chosen modifier's delta, which may be negative
//
// Step 2 is an override rather than a multiplier on purpose. A "Half = 0.6x"
// factor is tempting and wrong: it scales the garnish and the raita along with
// the rice, so the numbers drift in a way nobody can trace back to a dish.

import { valueOf } from "./units";
import type {
  DineMaterial,
  DineRecipeLine,
  DineTicketItem,
  RecipeOwnerType,
} from "./types";

/** One material and how much of it a dish consumes. */
export type Consumption = {
  materialId: string;
  quantity: number;
};

export type RecipeIndex = {
  /** Lines grouped by "<ownerType>:<ownerId>". */
  byOwner: Map<string, DineRecipeLine[]>;
};

function ownerKey(ownerType: RecipeOwnerType, ownerId: string): string {
  return `${ownerType}:${ownerId}`;
}

/** Group recipe lines once, so resolving a whole round is not quadratic. */
export function indexRecipes(lines: DineRecipeLine[]): RecipeIndex {
  const byOwner = new Map<string, DineRecipeLine[]>();
  for (const line of lines) {
    const key = ownerKey(line.ownerType, line.ownerId);
    const list = byOwner.get(key);
    if (list) list.push(line);
    else byOwner.set(key, [line]);
  }
  return { byOwner };
}

export function linesFor(
  index: RecipeIndex,
  ownerType: RecipeOwnerType,
  ownerId: string
): DineRecipeLine[] {
  return index.byOwner.get(ownerKey(ownerType, ownerId)) ?? [];
}

export type RecipeSubject = {
  menuItemId: string;
  variationId: string | null;
  modifiers: { id: string }[];
  quantity: number;
};

/**
 * What one ticket line takes out of stock.
 *
 * Totals are clamped at zero per material: a modifier that removes more than
 * the base recipe contains ("no onion" on a dish that never had much) must not
 * end up *adding* onions back to the cupboard.
 */
export function consumptionFor(subject: RecipeSubject, index: RecipeIndex): Consumption[] {
  const totals = new Map<string, number>();

  const add = (lines: DineRecipeLine[]) => {
    for (const line of lines) {
      totals.set(line.materialId, (totals.get(line.materialId) ?? 0) + line.quantity);
    }
  };

  // A variation with its own recipe replaces the base entirely; one without
  // falls back to it, so "Full" can simply inherit and only "Half" needs typing.
  const variationLines = subject.variationId
    ? linesFor(index, "variation", subject.variationId)
    : [];
  add(variationLines.length > 0 ? variationLines : linesFor(index, "item", subject.menuItemId));

  for (const modifier of subject.modifiers) {
    add(linesFor(index, "modifier", modifier.id));
  }

  const quantity = Math.max(subject.quantity, 0);
  const out: Consumption[] = [];
  for (const [materialId, perUnit] of totals) {
    const total = Math.max(perUnit, 0) * quantity;
    if (total > 0) out.push({ materialId, quantity: total });
  }
  return out;
}

/** Consumption for a ticket item, which already carries its chosen options. */
export function consumptionForTicketItem(
  item: DineTicketItem,
  index: RecipeIndex
): Consumption[] {
  return consumptionFor(
    {
      menuItemId: item.menuItemId,
      variationId: item.variationId,
      modifiers: item.modifiers,
      quantity: item.quantity,
    },
    index
  );
}

/** Merge several lines' consumption into one list per material. */
export function mergeConsumption(all: Consumption[][]): Consumption[] {
  const totals = new Map<string, number>();
  for (const list of all) {
    for (const entry of list) {
      totals.set(entry.materialId, (totals.get(entry.materialId) ?? 0) + entry.quantity);
    }
  }
  return Array.from(totals.entries()).map(([materialId, quantity]) => ({ materialId, quantity }));
}

/** What a dish costs to make, in paise, at current weighted-average costs. */
export function recipeCost(
  consumption: Consumption[],
  materials: Map<string, DineMaterial>
): number {
  let total = 0;
  for (const entry of consumption) {
    const material = materials.get(entry.materialId);
    if (!material) continue;
    total += valueOf(entry.quantity, material.costPerUnit);
  }
  return total;
}

/** Whether a dish has any recipe at all, for the "not costed yet" warning. */
export function hasRecipe(
  menuItemId: string,
  variationIds: string[],
  index: RecipeIndex
): boolean {
  if (linesFor(index, "item", menuItemId).length > 0) return true;
  return variationIds.some((id) => linesFor(index, "variation", id).length > 0);
}

export type StockWarning = "out" | "low" | null;

/**
 * How a dish stands against the cupboard right now.
 *
 * Reported, never enforced. Blocking a sale because a number in a database
 * says the paneer ran out is how a POS loses a restaurant's trust — the cook
 * can see the fridge and the app cannot.
 */
export function stockWarningFor(
  consumption: Consumption[],
  materials: Map<string, DineMaterial>
): StockWarning {
  let worst: StockWarning = null;
  for (const entry of consumption) {
    const material = materials.get(entry.materialId);
    if (!material || entry.quantity <= 0) continue;
    if (material.stockQty <= 0 || material.stockQty < entry.quantity) return "out";
    if (material.reorderLevel > 0 && material.stockQty <= material.reorderLevel) {
      worst = "low";
    }
  }
  return worst;
}

/** Portions still makeable from stock, or null when the dish has no recipe. */
export function portionsAvailable(
  consumption: Consumption[],
  materials: Map<string, DineMaterial>
): number | null {
  if (consumption.length === 0) return null;
  let smallest = Infinity;
  for (const entry of consumption) {
    const material = materials.get(entry.materialId);
    if (!material || entry.quantity <= 0) continue;
    smallest = Math.min(smallest, Math.floor(material.stockQty / entry.quantity));
  }
  return Number.isFinite(smallest) ? Math.max(smallest, 0) : null;
}

/** Materials at or below their reorder level, worst first. */
export function lowStock(materials: DineMaterial[]): DineMaterial[] {
  return materials
    .filter((material) => material.reorderLevel > 0 && material.stockQty <= material.reorderLevel)
    .sort((a, b) => {
      const aRatio = a.reorderLevel > 0 ? a.stockQty / a.reorderLevel : 1;
      const bRatio = b.reorderLevel > 0 ? b.stockQty / b.reorderLevel : 1;
      return aRatio - bRatio;
    });
}

/** Total value of everything on hand, in paise. */
export function stockValue(materials: DineMaterial[]): number {
  return materials.reduce(
    (sum, material) => sum + valueOf(material.stockQty, material.costPerUnit),
    0
  );
}
