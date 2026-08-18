// Units and quantities for raw-material stock.
//
// Quantities are integers in thousandths of a base unit, for the same reason
// money is paise: a recipe consumes 250 g out of a 5 kg sack a hundred times a
// week, and float grams drift until the sack is mysteriously 4.9997 kg. One
// scale, fixed at the boundary, and nothing in between ever sees a fraction.
//
// The unit trap this exists to close: a shopkeeper buys in kilos and cooks in
// grams. If the two are not converted at the edge, buying 5 "kg" and consuming
// 250 "g" leaves stock at −245 and nobody can explain it.

/** What a material is counted in once it is in the store cupboard. */
export type BaseUnit = "g" | "ml" | "pc";

export const BASE_UNITS: { id: BaseUnit; label: string; long: string }[] = [
  { id: "g", label: "g", long: "Grams (weight)" },
  { id: "ml", label: "ml", long: "Millilitres (volume)" },
  { id: "pc", label: "pc", long: "Pieces (count)" },
];

/** Quantities are stored as integer thousandths of the base unit. */
export const QTY_SCALE = 1000;

/** Convert a typed amount in base units ("0.25") to stored units. */
export function toQty(baseUnits: number): number {
  if (!Number.isFinite(baseUnits)) return 0;
  return Math.round(baseUnits * QTY_SCALE);
}

/** Convert stored units back to base units, for display and export. */
export function fromQty(qty: number): number {
  return Math.round(qty) / QTY_SCALE;
}

/** Parse a typed quantity, tolerating stray unit text ("250 g", "1,5"). */
export function parseQty(input: string): number {
  const cleaned = String(input).replace(/,/g, ".").replace(/[^0-9.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return 0;
  const value = Number(cleaned);
  return Number.isFinite(value) ? toQty(value) : 0;
}

/**
 * Render a quantity in the unit a person would say it in.
 *
 * 250000 thousandths of a gram is "250 g", but 5000000 is "5 kg" — a stock
 * list that reads "5000 g of rice" makes an owner do arithmetic to check their
 * own cupboard.
 */
export function formatQty(qty: number, unit: BaseUnit): string {
  const base = fromQty(qty);
  const abs = Math.abs(base);

  if (unit === "pc") {
    return `${trim(base)} pc`;
  }
  if (unit === "g") {
    return abs >= 1000 ? `${trim(base / 1000)} kg` : `${trim(base)} g`;
  }
  return abs >= 1000 ? `${trim(base / 1000)} L` : `${trim(base)} ml`;
}

/** Plain number in base units, for CSV and spreadsheet columns. */
export function qtyToPlain(qty: number): number {
  return fromQty(qty);
}

function trim(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded);
}

/**
 * A pack is how the material is bought — a 5 kg sack, a 15 L tin, a tray of 30.
 *
 * `baseUnitsPerPack` is stored in the same thousandths scale, so a 5 kg sack of
 * a material whose base unit is grams holds 5,000,000. Stock-in accepts either
 * packs or loose base units and converts here, which is the one place the
 * kilo/gram mismatch can be got wrong.
 */
export type Pack = {
  label: string;
  baseUnitsPerPack: number;
};

export function packToQty(packs: number, pack: Pack | null): number {
  if (!pack || pack.baseUnitsPerPack <= 0) return 0;
  return Math.round(packs * pack.baseUnitsPerPack);
}

/** Common pack sizes offered as shortcuts when adding a material. */
export function suggestedPacks(unit: BaseUnit): { label: string; baseUnits: number }[] {
  if (unit === "g") {
    return [
      { label: "kg", baseUnits: toQty(1000) },
      { label: "500 g pack", baseUnits: toQty(500) },
      { label: "5 kg sack", baseUnits: toQty(5000) },
    ];
  }
  if (unit === "ml") {
    return [
      { label: "litre", baseUnits: toQty(1000) },
      { label: "500 ml bottle", baseUnits: toQty(500) },
      { label: "15 L tin", baseUnits: toQty(15000) },
    ];
  }
  return [
    { label: "dozen", baseUnits: toQty(12) },
    { label: "tray of 30", baseUnits: toQty(30) },
  ];
}

/**
 * Cost per base unit, in paise per thousandth of a base unit.
 *
 * Kept at this resolution deliberately: rice at ₹60/kg is 0.006 paise per
 * thousandth of a gram, and rounding that to whole paise would price a 250 g
 * portion at zero.
 */
export const COST_SCALE = 1_000_000;

/** Cost per base unit from a purchase: total paise for this many stored units. */
export function costPerUnitFrom(totalPaise: number, qty: number): number {
  if (qty <= 0) return 0;
  return Math.round((totalPaise * COST_SCALE) / qty);
}

/** Money value of a quantity, in paise. */
export function valueOf(qty: number, costPerUnit: number): number {
  return Math.round((qty * costPerUnit) / COST_SCALE);
}

/**
 * Weighted-average cost after receiving more stock.
 *
 * Last-purchase-price is simpler but lies after a price rise: every portion
 * cooked from the old cheap sack suddenly costs what the new one did, and the
 * margin report moves for a reason that never happened in the kitchen.
 */
export function blendCost(
  currentQty: number,
  currentCost: number,
  addedQty: number,
  addedCost: number
): number {
  const totalQty = currentQty + addedQty;
  if (totalQty <= 0) return addedCost || currentCost;
  if (currentQty <= 0) return addedCost;
  if (addedQty <= 0) return currentCost;
  return Math.round((currentQty * currentCost + addedQty * addedCost) / totalQty);
}
