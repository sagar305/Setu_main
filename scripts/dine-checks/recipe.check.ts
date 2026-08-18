// Recipe resolution and raw-material costing.
//
// Pure-function checks: no browser, no database. They exist because the three
// layer resolution (base / variation override / modifier delta) and the
// weighted-average costing are both easy to change in a way that still
// compiles and still renders, while quietly costing a dish wrong.

import { consumptionFor, indexRecipes, recipeCost, portionsAvailable, stockWarningFor } from "../../lib/dine/recipe";
import { toQty, costPerUnitFrom, valueOf, blendCost, formatQty } from "../../lib/dine/units";
import type { DineMaterial, DineRecipeLine } from "../../lib/dine/types";

let pass = 0, fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

const L = (ownerType: any, ownerId: string, materialId: string, base: number): DineRecipeLine =>
  ({ id: `${ownerId}-${materialId}`, ownerType, ownerId, materialId, quantity: toQty(base), sortOrder: 0 });

// Chicken Biryani: base 250g rice, Half override 150g rice, add-ons raita/onion.
const lines: DineRecipeLine[] = [
  L("item", "biryani", "rice", 250),
  L("item", "biryani", "onion", 20),
  L("variation", "half", "rice", 150),
  L("variation", "half", "onion", 20),
  L("modifier", "raita", "curd", 30),
  L("modifier", "noonion", "onion", -10),
  L("modifier", "noonion2", "onion", -50),
];
const idx = indexRecipes(lines);
const q = (n: number) => toQty(n);

eq("base recipe x1", consumptionFor({ menuItemId: "biryani", variationId: null, modifiers: [], quantity: 1 }, idx),
   [{ materialId: "rice", quantity: q(250) }, { materialId: "onion", quantity: q(20) }]);

eq("base recipe x2 scales", consumptionFor({ menuItemId: "biryani", variationId: null, modifiers: [], quantity: 2 }, idx),
   [{ materialId: "rice", quantity: q(500) }, { materialId: "onion", quantity: q(40) }]);

eq("variation with own recipe overrides base", consumptionFor({ menuItemId: "biryani", variationId: "half", modifiers: [], quantity: 1 }, idx),
   [{ materialId: "rice", quantity: q(150) }, { materialId: "onion", quantity: q(20) }]);

eq("variation without a recipe inherits base", consumptionFor({ menuItemId: "biryani", variationId: "full", modifiers: [], quantity: 1 }, idx),
   [{ materialId: "rice", quantity: q(250) }, { materialId: "onion", quantity: q(20) }]);

eq("modifier adds its own material", consumptionFor({ menuItemId: "biryani", variationId: null, modifiers: [{ id: "raita" }], quantity: 1 }, idx),
   [{ materialId: "rice", quantity: q(250) }, { materialId: "onion", quantity: q(20) }, { materialId: "curd", quantity: q(30) }]);

eq("negative modifier subtracts", consumptionFor({ menuItemId: "biryani", variationId: null, modifiers: [{ id: "noonion" }], quantity: 1 }, idx),
   [{ materialId: "rice", quantity: q(250) }, { materialId: "onion", quantity: q(10) }]);

eq("negative beyond base clamps to zero, never adds stock",
   consumptionFor({ menuItemId: "biryani", variationId: null, modifiers: [{ id: "noonion2" }], quantity: 1 }, idx),
   [{ materialId: "rice", quantity: q(250) }]);

eq("variation override + modifier delta together",
   consumptionFor({ menuItemId: "biryani", variationId: "half", modifiers: [{ id: "raita" }, { id: "noonion" }], quantity: 2 }, idx),
   [{ materialId: "rice", quantity: q(300) }, { materialId: "onion", quantity: q(20) }, { materialId: "curd", quantity: q(60) }]);

// --- Costing: rice at Rs 60/kg ---
const ricePerUnit = costPerUnitFrom(6000, toQty(1000)); // 6000 paise for 1 kg
eq("cost per unit from a purchase", ricePerUnit, 6000);
eq("250 g of rice costs Rs 15.00", valueOf(q(250), ricePerUnit), 1500);

const materials = new Map<string, DineMaterial>([
  ["rice", { id: "rice", name: "Rice", baseUnit: "g", packLabel: "kg", baseUnitsPerPack: toQty(1000), stockQty: q(2000), reorderLevel: q(1000), costPerUnit: ricePerUnit, note: "", createdAt: "", updatedAt: "" }],
  ["onion", { id: "onion", name: "Onion", baseUnit: "g", packLabel: "", baseUnitsPerPack: 0, stockQty: q(500), reorderLevel: 0, costPerUnit: costPerUnitFrom(3000, toQty(1000)), note: "", createdAt: "", updatedAt: "" }],
]);
const oneBase = consumptionFor({ menuItemId: "biryani", variationId: null, modifiers: [], quantity: 1 }, idx);
eq("dish cost = rice 15.00 + onion 0.60", recipeCost(oneBase, materials), 1500 + 60);
eq("portions available limited by scarcest material", portionsAvailable(oneBase, materials), 8);
eq("comfortable stock raises nothing", stockWarningFor(oneBase, materials), null);

// At the reorder level exactly: warn, but still enough for the dish.
materials.get("rice")!.stockQty = q(1000);
eq("at the reorder level it warns without blocking", stockWarningFor(oneBase, materials), "low");
eq("still makeable while low", portionsAvailable(oneBase, materials), 4);

materials.get("rice")!.stockQty = q(100);
eq("not enough for one portion reads as out", stockWarningFor(oneBase, materials), "out");

// --- Weighted average survives a price rise ---
// 1 kg at Rs 60, then 1 kg at Rs 80 -> Rs 70/kg, not Rs 80.
eq("weighted average blends", blendCost(toQty(1000), 6000, toQty(1000), 8000), 7000);
eq("first purchase into empty stock takes its own cost", blendCost(0, 0, toQty(1000), 8000), 8000);

eq("formats grams as kg when large", formatQty(q(5000), "g"), "5 kg");
eq("formats small grams as grams", formatQty(q(250), "g"), "250 g");
eq("formats pieces", formatQty(q(12), "pc"), "12 pc");

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
