// The seed data that a new restaurant lands on.
//
// Setup resolves recipe lines by material *name* and silently skips any it
// cannot find, because a half-written recipe must not stop someone from
// opening the till. That is right at runtime and dangerous in the repo: a typo
// here ships a dish that costs less than it does, with nothing to notice. So
// the names are checked against the cupboard at build time instead, along with
// the prices that make the food-cost percentages mean anything.

import { SAMPLE_MATERIALS, SAMPLE_MENU, type SampleRecipeLine } from "../../lib/dine/sampleMenu";
import { costPerUnitFrom, toQty, valueOf } from "../../lib/dine/units";

let pass = 0, fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

console.log("\nsample data\n");

const names = SAMPLE_MATERIALS.map((material) => material.name);
eq("material names are unique", names.length, new Set(names).size);

eq(
  "every material has a pack size and an opening price",
  SAMPLE_MATERIALS.filter((m) => m.packSize <= 0 || m.packPrice <= 0).map((m) => m.name),
  []
);

// --- Every recipe line points at something the cupboard holds ---
const cupboard = new Set(names);
type Owner = { where: string; lines: SampleRecipeLine[] | undefined; allowNegative?: boolean };
const owners: Owner[] = [];

for (const category of SAMPLE_MENU) {
  for (const item of category.items) {
    owners.push({ where: item.name, lines: item.recipe });
    for (const variation of item.variations ?? []) {
      owners.push({ where: `${item.name} · ${variation.name}`, lines: variation.recipe });
    }
    for (const group of item.modifierGroups ?? []) {
      for (const option of group.options) {
        owners.push({
          where: `${item.name} · ${option.name}`,
          lines: option.recipe,
          allowNegative: true,
        });
      }
    }
  }
}

const unknown: string[] = [];
const zeroed: string[] = [];
const negative: string[] = [];
for (const owner of owners) {
  for (const line of owner.lines ?? []) {
    if (!cupboard.has(line.material)) unknown.push(`${owner.where}: ${line.material}`);
    if (line.qty === 0) zeroed.push(`${owner.where}: ${line.material}`);
    if (line.qty < 0 && !owner.allowNegative) negative.push(`${owner.where}: ${line.material}`);
  }
}
eq("every recipe line names a material that exists", unknown, []);
eq("no recipe line asks for nothing", zeroed, []);
eq("only add-ons may take an ingredient away", negative, []);

// --- The shapes people otherwise never discover are actually present ---
const variations = SAMPLE_MENU.flatMap((c) => c.items).flatMap((item) => item.variations ?? []);
eq("some sizes carry their own recipe", variations.some((v) => (v.recipe ?? []).length > 0), true);
eq(
  "and some inherit the base, so both halves of the feature are on show",
  variations.some((v) => (v.recipe ?? []).length === 0),
  true
);
eq(
  "at least one add-on changes what the kitchen uses",
  SAMPLE_MENU.flatMap((c) => c.items)
    .flatMap((item) => item.modifierGroups ?? [])
    .flatMap((group) => group.options)
    .some((option) => (option.recipe ?? []).length > 0),
  true
);

// --- The opening prices cost a plate to a figure worth showing ---
// Gajar Halwa: carrot 250 g, milk 100 ml, sugar 50 g, ghee 20 ml. If this
// moves, the food-cost percentage a new user sees on day one moved with it.
const priceOf = new Map(SAMPLE_MATERIALS.map((m) => [m.name, costPerUnitFrom(m.packPrice, toQty(m.packSize))]));
const costOf = (lines: SampleRecipeLine[]) =>
  lines.reduce((total, line) => total + valueOf(toQty(line.qty), priceOf.get(line.material) ?? 0), 0);

const halwa = SAMPLE_MENU.flatMap((c) => c.items).find((item) => item.name === "Gajar Halwa");
eq("Gajar Halwa is in the seed", Boolean(halwa?.recipe), true);
// carrot 12.50 + milk 6.00 + sugar 2.25 + ghee 12.00
eq("its plate costs Rs 32.75 at the opening prices", costOf(halwa?.recipe ?? []), 3275);

const biryani = SAMPLE_MENU.flatMap((c) => c.items).find((item) => item.name === "Veg Biryani");
const half = (biryani?.variations ?? []).find((v) => v.name === "Half");
eq(
  "a half plate genuinely costs less than the base it overrides",
  costOf(half?.recipe ?? []) < costOf(biryani?.recipe ?? []) && costOf(half?.recipe ?? []) > 0,
  true
);

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
