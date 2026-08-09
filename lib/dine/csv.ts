// CSV import/export for Free Dine (FR-2.6, FR-9.4).
//
// Menu round-trips through a single flat sheet: a restaurant that wants to
// rename forty dishes will do it in Excel, not in a phone form. Variations and
// modifier groups are nested data, so they travel in encoded columns rather
// than forcing a multi-file format nobody would edit by hand:
//
//   Variations   Half:180 | Full:260
//   Modifiers    Spice level[1-1]: Mild+0; Medium+0 | Add-ons[0-2]: Cheese+40
//
// Prices in the sheet are in major units (rupees), because that is what a
// person types. They are converted to paise on the way in.

import { formatPlain, parseAmount, toMajor } from "./money";
import { fromQty, formatQty } from "./units";
import {
  FOOD_TYPE_LABELS,
  STOCK_MOVE_LABELS,
  type DineMaterial,
  type DineRecipeLine,
  type DineStockMove,
  type DineBill,
  type DineBillItem,
  type DineCategory,
  type DineMenuItem,
  type DineModifier,
  type DineModifierGroup,
  type DineVariation,
  type FoodType,
} from "./types";

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.map(csvEscape).join(","), ...rows.map((row) => row.map(csvEscape).join(","))].join(
    "\r\n"
  );
}

export function downloadCsv(filename: string, csv: string): void {
  // BOM so Excel opens UTF-8 (₹, Indic scripts) correctly.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Parse CSV text into rows, handling quoted fields and embedded newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  const source = text.replace(/^﻿/, "");
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

export const MENU_CSV_HEADERS = [
  "Category",
  "Name",
  "Price",
  "Tax %",
  "Tax Type",
  "Food Type",
  "Available",
  "Description",
  "Variations",
  "Modifiers",
];

function encodeVariations(variations: DineVariation[]): string {
  return variations
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((variation) => `${variation.name}:${formatPlain(variation.price)}`)
    .join(" | ");
}

function encodeModifiers(groups: DineModifierGroup[], modifiers: DineModifier[]): string {
  return groups
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((group) => {
      const options = modifiers
        .filter((modifier) => modifier.groupId === group.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((modifier) => `${modifier.name}+${formatPlain(modifier.priceDelta)}`)
        .join("; ");
      return `${group.name}[${group.minSelect}-${group.maxSelect}]: ${options}`;
    })
    .join(" | ");
}

export function menuCsv(
  items: DineMenuItem[],
  categories: DineCategory[],
  variations: DineVariation[],
  groups: DineModifierGroup[],
  modifiers: DineModifier[]
): string {
  const categoryName = (id: string) => categories.find((category) => category.id === id)?.name ?? "";
  return toCsv(
    MENU_CSV_HEADERS,
    items.map((item) => [
      categoryName(item.categoryId),
      item.name,
      formatPlain(item.price),
      item.taxRate ?? "",
      item.taxInclusive ? "inclusive" : "exclusive",
      FOOD_TYPE_LABELS[item.foodType],
      item.available ? "yes" : "no",
      item.description,
      encodeVariations(variations.filter((variation) => variation.menuItemId === item.id)),
      encodeModifiers(
        groups.filter((group) => group.menuItemId === item.id),
        modifiers
      ),
    ])
  );
}

export type ParsedMenuRow = {
  categoryName: string;
  name: string;
  price: number;
  taxRate: number | null;
  taxInclusive: boolean;
  foodType: FoodType;
  available: boolean;
  description: string;
  variations: { name: string; price: number }[];
  modifierGroups: {
    name: string;
    minSelect: number;
    maxSelect: number;
    options: { name: string; priceDelta: number }[];
  }[];
};

export type MenuImportResult = {
  rows: ParsedMenuRow[];
  /** Human-readable problems, one per skipped row, shown before anything is written. */
  errors: string[];
};

function parseFoodType(value: string): FoodType {
  const normalised = value.trim().toLowerCase();
  if (normalised.startsWith("non")) return "nonveg";
  if (normalised.startsWith("egg")) return "egg";
  return "veg";
}

function parseVariations(value: string): { name: string; price: number }[] {
  if (!value.trim()) return [];
  return value
    .split("|")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const at = chunk.lastIndexOf(":");
      if (at === -1) return { name: chunk, price: 0 };
      return {
        name: chunk.slice(0, at).trim(),
        price: parseAmount(chunk.slice(at + 1)),
      };
    })
    .filter((variation) => variation.name !== "");
}

function parseModifierGroups(value: string): ParsedMenuRow["modifierGroups"] {
  if (!value.trim()) return [];
  return value
    .split("|")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const at = chunk.indexOf(":");
      const head = at === -1 ? chunk : chunk.slice(0, at);
      const body = at === -1 ? "" : chunk.slice(at + 1);
      const bounds = head.match(/\[(\d+)\s*-\s*(\d+)\]/);
      const name = head.replace(/\[[^\]]*\]/, "").trim();
      const options = body
        .split(";")
        .map((option) => option.trim())
        .filter(Boolean)
        .map((option) => {
          const plus = option.lastIndexOf("+");
          if (plus === -1) return { name: option, priceDelta: 0 };
          return {
            name: option.slice(0, plus).trim(),
            priceDelta: parseAmount(option.slice(plus + 1)),
          };
        })
        .filter((option) => option.name !== "");
      return {
        name: name || "Options",
        minSelect: bounds ? Number(bounds[1]) : 0,
        maxSelect: bounds ? Math.max(Number(bounds[2]), 1) : 1,
        options,
      };
    })
    .filter((group) => group.options.length > 0);
}

/**
 * Read a menu sheet. Nothing is written until the caller acts on the result,
 * so a file with three bad rows can be reported in full rather than importing
 * halfway and stopping.
 */
export function parseMenuCsv(text: string): MenuImportResult {
  const rows = parseCsv(text);
  const errors: string[] = [];
  if (rows.length === 0) return { rows: [], errors: ["The file is empty."] };

  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const columnOf = (label: string) => header.indexOf(label.toLowerCase());
  const nameAt = columnOf("Name");
  const priceAt = columnOf("Price");
  if (nameAt === -1 || priceAt === -1) {
    return {
      rows: [],
      errors: [`The sheet needs at least "Name" and "Price" columns. Found: ${rows[0].join(", ")}`],
    };
  }

  const cell = (row: string[], label: string) => {
    const at = columnOf(label);
    return at === -1 ? "" : (row[at] ?? "").trim();
  };

  const parsed: ParsedMenuRow[] = [];
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const name = (row[nameAt] ?? "").trim();
    if (!name) {
      errors.push(`Row ${i + 1}: skipped, no item name.`);
      continue;
    }
    const price = parseAmount(row[priceAt] ?? "");
    if (price < 0) {
      errors.push(`Row ${i + 1} (${name}): skipped, price cannot be negative.`);
      continue;
    }
    const rateText = cell(row, "Tax %");
    const availableText = cell(row, "Available").toLowerCase();
    parsed.push({
      categoryName: cell(row, "Category") || "Uncategorised",
      name,
      price,
      taxRate: rateText === "" ? null : Number(rateText) || 0,
      taxInclusive: cell(row, "Tax Type").toLowerCase() !== "exclusive",
      foodType: parseFoodType(cell(row, "Food Type")),
      available: availableText !== "no" && availableText !== "false",
      description: cell(row, "Description"),
      variations: parseVariations(cell(row, "Variations")),
      modifierGroups: parseModifierGroups(cell(row, "Modifiers")),
    });
  }
  return { rows: parsed, errors };
}

export function billsCsv(bills: DineBill[]): string {
  return toCsv(
    [
      "Bill",
      "Date",
      "Business Date",
      "Order Type",
      "Table",
      "Customer",
      "Subtotal",
      "Discount",
      "Service Charge",
      "Tax",
      "Included Tax",
      "Total",
      "Status",
    ],
    bills.map((bill) => [
      bill.billLabel,
      new Date(bill.createdAt).toLocaleString(),
      bill.businessDate,
      bill.orderType,
      bill.tableName,
      bill.customerName || "Walk-in",
      toMajor(bill.subtotal),
      toMajor(bill.discountAmount),
      toMajor(bill.serviceCharge + bill.serviceChargeTax),
      toMajor(bill.addedTax),
      toMajor(bill.includedTax),
      toMajor(bill.total),
      bill.status,
    ])
  );
}

export function itemReportCsv(
  rows: { name: string; quantity: number; revenue: number }[]
): string {
  return toCsv(
    ["Item", "Quantity", "Revenue"],
    rows.map((row) => [row.name, row.quantity, toMajor(row.revenue)])
  );
}

export function hourlySalesCsv(rows: { hour: number; bills: number; revenue: number }[]): string {
  return toCsv(
    ["Hour", "Bills", "Revenue"],
    rows.map((row) => [
      `${String(row.hour).padStart(2, "0")}:00`,
      row.bills,
      toMajor(row.revenue),
    ])
  );
}

export function billItemsCsv(bills: DineBill[], items: DineBillItem[]): string {
  const byBill = new Map(bills.map((bill) => [bill.id, bill]));
  const rows: unknown[][] = [];
  for (const item of items) {
    const bill = byBill.get(item.billId);
    if (!bill) continue;
    rows.push([
      bill.billLabel,
      new Date(bill.createdAt).toLocaleString(),
      bill.tableName,
      item.name,
      item.variationName,
      item.modifiers.map((modifier) => modifier.name).join(", "),
      item.quantity,
      toMajor(item.unitPrice),
      toMajor(item.lineTotal),
      bill.status,
    ]);
  }
  return toCsv(
    [
      "Bill",
      "Date",
      "Table",
      "Item",
      "Variation",
      "Modifiers",
      "Quantity",
      "Unit Price",
      "Line Total",
      "Status",
    ],
    rows
  );
}


export function materialsCsv(materials: DineMaterial[]): string {
  return toCsv(
    [
      "Material",
      "Unit",
      "In Stock",
      "Reorder At",
      "Bought As",
      "Units Per Pack",
      "Cost Per 1000 Units",
      "Stock Value",
      "Note",
    ],
    materials.map((material) => [
      material.name,
      material.baseUnit,
      fromQty(material.stockQty),
      material.reorderLevel > 0 ? fromQty(material.reorderLevel) : "",
      material.packLabel,
      material.baseUnitsPerPack > 0 ? fromQty(material.baseUnitsPerPack) : "",
      toMajor(material.costPerUnit),
      toMajor(Math.round((material.stockQty * material.costPerUnit) / 1_000_000)),
      material.note,
    ])
  );
}

export function stockMovesCsv(moves: DineStockMove[]): string {
  return toCsv(
    ["Date", "Business Date", "Material", "Why", "Change", "Balance After", "Reference", "Note"],
    moves
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((move) => [
        new Date(move.createdAt).toLocaleString(),
        move.businessDate,
        move.materialName,
        STOCK_MOVE_LABELS[move.reason],
        fromQty(move.change),
        fromQty(move.balanceAfter),
        move.refLabel,
        move.note,
      ])
  );
}

/**
 * Recipes, one row per line, with the owner named rather than referenced.
 *
 * A spreadsheet of "ownerId 8f3c-..." helps nobody, so the export says
 * "Chicken Biryani / Half" and the import is not expected to round-trip — this
 * is for an owner checking their own recipes, and for the accountant.
 */
export function recipesCsv(
  lines: DineRecipeLine[],
  labelFor: (line: DineRecipeLine) => { dish: string; applies: string },
  materials: DineMaterial[]
): string {
  const byId = new Map(materials.map((material) => [material.id, material]));
  return toCsv(
    ["Dish", "Applies To", "Material", "Quantity", "Unit"],
    lines.map((line) => {
      const label = labelFor(line);
      const material = byId.get(line.materialId);
      return [
        label.dish,
        label.applies,
        material?.name ?? "(deleted)",
        fromQty(line.quantity),
        material?.baseUnit ?? "",
      ];
    })
  );
}

/** Material usage over a period, for the usage and variance report. */
export function materialUsageCsv(
  rows: { name: string; unit: DineMaterial["baseUnit"]; used: number; wasted: number; cost: number }[]
): string {
  return toCsv(
    ["Material", "Used", "Wasted", "Cost"],
    rows.map((row) => [
      row.name,
      formatQty(row.used, row.unit),
      formatQty(row.wasted, row.unit),
      toMajor(row.cost),
    ])
  );
}
