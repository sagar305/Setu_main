import { describe, expect, it } from "vitest";
import {
  allocateFefo,
  batchBlockReason,
  billTotals,
  bySupplier,
  committedByBatch,
  effectiveRate,
  expiryBuckets,
  purchaseTotals,
  saleDue,
  sellableStock,
  stockValue,
  substitutesFor,
} from "@/lib/pharmacy/calc";
import { gstSummary, marginByMedicine, scheduleRegister } from "@/lib/pharmacy/reports";
import { parseMedicineImport } from "@/lib/pharmacy/csv";
import { saleDoc, shareLineName } from "@/lib/pharmacy/share";
import {
  DEFAULT_PHARMACY_SETTINGS,
  daysToExpiry,
  expiryLastDay,
  isExpired,
  type Batch,
  type Medicine,
  type PharmacyCartLine,
  type PharmacySettings,
  type PurchaseLine,
  type Sale,
} from "@/lib/pharmacy/types";

const TODAY = "2026-09-03";

function medicine(overrides: Partial<Medicine> = {}): Medicine {
  return {
    id: "m1",
    name: "Crocin Advance",
    composition: "Paracetamol 500mg",
    manufacturer: "GSK",
    strength: "500 mg",
    form: "tablet",
    packSize: 15,
    packLabel: "strip of 15",
    hsnCode: "30049099",
    taxRate: 12,
    schedule: "",
    rack: "A1",
    barcode: "",
    lowStockAt: 10,
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function batch(overrides: Partial<Batch> = {}): Batch {
  return {
    id: "b1",
    medicineId: "m1",
    batchNo: "J4213",
    expiry: "2027-06",
    mrp: 20,
    purchaseRate: 14,
    effectiveRate: 14,
    sellingRate: 20,
    quantity: 30,
    supplierId: "s1",
    purchaseId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function cartLine(overrides: Partial<PharmacyCartLine> = {}): PharmacyCartLine {
  return {
    id: "l1",
    medicineId: "m1",
    batchId: "b1",
    name: "Crocin Advance",
    batchNo: "J4213",
    expiry: "2027-06",
    quantity: 1,
    mrp: 20,
    rate: 20,
    discountPct: 0,
    taxRate: 12,
    schedule: "",
    packSize: 15,
    daysSupply: 0,
    ...overrides,
  };
}

const settings: PharmacySettings = { ...DEFAULT_PHARMACY_SETTINGS };

// ---------------------------------------------------------------------------

describe("expiry, at month precision", () => {
  it("keeps a batch sellable through the last day of its month", () => {
    expect(expiryLastDay("2026-08")).toBe("2026-08-31");
    expect(expiryLastDay("2026-02")).toBe("2026-02-28");
    // 2028 is a leap year — the naive "day 28" shortcut would lose a day.
    expect(expiryLastDay("2028-02")).toBe("2028-02-29");
  });

  it("expires from the first of the following month, not before", () => {
    expect(isExpired("2026-09", "2026-09-30")).toBe(false);
    expect(isExpired("2026-09", "2026-10-01")).toBe(true);
  });

  it("counts days remaining to the end of the expiry month", () => {
    expect(daysToExpiry("2026-09", TODAY)).toBe(27);
    expect(daysToExpiry("2026-08", TODAY)).toBeLessThan(0);
  });
});

describe("what a batch may be billed from", () => {
  it("never sells expired stock, whatever the blocking rule says", () => {
    const expired = batch({ expiry: "2026-08" });
    expect(batchBlockReason(expired, { ...settings, blockExpiryWithinDays: 0 }, TODAY)).toBe(
      "expired"
    );
  });

  it("blocks near-expiry stock only when a rule asks it to", () => {
    const soon = batch({ expiry: "2026-09" });
    expect(batchBlockReason(soon, settings, TODAY)).toBe("");
    expect(batchBlockReason(soon, { ...settings, blockExpiryWithinDays: 60 }, TODAY)).toBe(
      "near-expiry"
    );
  });

  it("treats an empty batch as unsellable rather than expired", () => {
    expect(batchBlockReason(batch({ quantity: 0 }), settings, TODAY)).toBe("empty");
  });
});

describe("FEFO allocation", () => {
  const batches = [
    batch({ id: "late", batchNo: "K1180", expiry: "2027-02", quantity: 28 }),
    batch({ id: "early", batchNo: "J4213", expiry: "2026-11", quantity: 12 }),
    batch({ id: "dead", batchNo: "H0021", expiry: "2026-08", quantity: 40 }),
  ];

  it("takes the earliest-expiring batch that still has stock", () => {
    const result = allocateFefo(batches, "m1", 5, settings, new Map(), TODAY);
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0].batch.id).toBe("early");
    expect(result.shortfall).toBe(0);
  });

  it("cascades across batches when the first cannot cover the quantity", () => {
    const result = allocateFefo(batches, "m1", 20, settings, new Map(), TODAY);
    expect(result.allocations.map((a) => [a.batch.id, a.quantity])).toEqual([
      ["early", 12],
      ["late", 8],
    ]);
    expect(result.shortfall).toBe(0);
  });

  it("skips expired stock entirely, even though it is oldest", () => {
    const result = allocateFefo(batches, "m1", 40, settings, new Map(), TODAY);
    expect(result.allocations.some((a) => a.batch.id === "dead")).toBe(false);
    // 12 + 28 sellable; the other 40 are expired and unavailable.
    expect(result.shortfall).toBe(0);
    const over = allocateFefo(batches, "m1", 45, settings, new Map(), TODAY);
    expect(over.shortfall).toBe(5);
  });

  it("does not promise the same units to two lines of one cart", () => {
    const committed = committedByBatch([cartLine({ batchId: "early", quantity: 12 })]);
    const result = allocateFefo(batches, "m1", 5, settings, committed, TODAY);
    expect(result.allocations[0].batch.id).toBe("late");
  });

  it("breaks an expiry tie with the older batch", () => {
    const tied = [
      batch({ id: "newer", expiry: "2027-01", createdAt: "2026-06-01T00:00:00.000Z" }),
      batch({ id: "older", expiry: "2027-01", createdAt: "2026-02-01T00:00:00.000Z" }),
    ];
    const result = allocateFefo(tied, "m1", 1, settings, new Map(), TODAY);
    expect(result.allocations[0].batch.id).toBe("older");
  });

  it("counts only sellable units as stock on hand", () => {
    expect(sellableStock(batches, "m1", settings, TODAY)).toBe(40);
  });
});

describe("bill totals", () => {
  it("backs tax out of an inclusive price rather than adding it", () => {
    const totals = billTotals([cartLine({ quantity: 10, rate: 20, taxRate: 12 })], 0, true);
    expect(totals.total).toBe(200);
    expect(totals.taxTotal).toBeCloseTo(21.43, 2);
    expect(totals.byRate[0].taxable).toBeCloseTo(178.57, 2);
  });

  it("adds tax on top when prices exclude it", () => {
    const totals = billTotals([cartLine({ quantity: 10, rate: 20, taxRate: 12 })], 0, false);
    expect(totals.taxTotal).toBe(24);
    expect(totals.total).toBe(224);
  });

  it("splits tax into CGST and SGST that add back to the printed figure", () => {
    const totals = billTotals(
      [
        cartLine({ id: "a", quantity: 3, rate: 33.33, taxRate: 5 }),
        cartLine({ id: "b", quantity: 1, rate: 19.99, taxRate: 12 }),
      ],
      0,
      true
    );
    expect(totals.cgst + totals.sgst).toBeCloseTo(totals.taxTotal, 10);
  });

  it("spreads a flat bill discount across tax rates in proportion to value", () => {
    const totals = billTotals(
      [
        cartLine({ id: "a", quantity: 10, rate: 10, taxRate: 5 }),
        cartLine({ id: "b", quantity: 10, rate: 10, taxRate: 12 }),
      ],
      100,
      true
    );
    expect(totals.total).toBe(100);
    const five = totals.byRate.find((row) => row.rate === 5)!;
    const twelve = totals.byRate.find((row) => row.rate === 12)!;
    // Half the discount landed on each line, so each rate is taxed on 50.
    expect(five.taxable + five.tax).toBeCloseTo(50, 2);
    expect(twelve.taxable + twelve.tax).toBeCloseTo(50, 2);
  });

  it("never discounts below zero, however large the figure typed", () => {
    const totals = billTotals([cartLine({ quantity: 1, rate: 20 })], 9999, true);
    expect(totals.total).toBe(0);
    expect(totals.discount).toBe(20);
  });

  it("applies a line discount before the bill discount", () => {
    const totals = billTotals([cartLine({ quantity: 10, rate: 20, discountPct: 10 })], 0, true);
    expect(totals.subtotal).toBe(180);
  });
});

describe("purchase costing", () => {
  const line: PurchaseLine = {
    id: "p1",
    medicineId: "m1",
    batchNo: "J4213",
    expiry: "2027-06",
    quantity: 100,
    freeQuantity: 10,
    purchaseRate: 11,
    mrp: 20,
    sellingRate: 20,
    discountPct: 0,
    taxRate: 12,
  };

  it("blends scheme goods into the effective cost", () => {
    // 100 paid at 11 = 1100, spread over 110 units on the shelf.
    expect(effectiveRate(line)).toBeCloseTo(10, 5);
  });

  it("counts a line discount before blending", () => {
    expect(effectiveRate({ ...line, discountPct: 10 })).toBeCloseTo(9, 5);
  });

  it("adds purchase tax on top, however the shop prices its own sales", () => {
    const totals = purchaseTotals([line], 0);
    expect(totals.subtotal).toBe(1100);
    expect(totals.taxTotal).toBe(132);
    expect(totals.total).toBe(1232);
    expect(totals.units).toBe(110);
  });

  it("survives a line with no paid units", () => {
    expect(effectiveRate({ ...line, quantity: 0, freeQuantity: 0 })).toBe(0);
  });
});

describe("the expiry dashboard", () => {
  const batches = [
    batch({ id: "gone", expiry: "2026-07", quantity: 10, effectiveRate: 10, supplierId: "s1" }),
    batch({ id: "soon", expiry: "2026-09", quantity: 5, effectiveRate: 20, supplierId: "s1" }),
    batch({ id: "later", expiry: "2026-11", quantity: 5, effectiveRate: 30, supplierId: "s2" }),
    batch({ id: "safe", expiry: "2028-01", quantity: 5, effectiveRate: 40, supplierId: "s2" }),
    batch({ id: "empty", expiry: "2026-09", quantity: 0, effectiveRate: 50, supplierId: "s1" }),
  ];

  it("puts each batch in exactly one bucket", () => {
    const buckets = expiryBuckets(batches, [30, 60, 90], TODAY);
    const ids = buckets.flatMap((bucket) => bucket.batches.map((row) => row.id));
    expect(ids).toEqual([...new Set(ids)]);
  });

  it("values a bucket at what the stock cost, not at MRP", () => {
    const buckets = expiryBuckets(batches, [30, 60, 90], TODAY);
    expect(buckets[0].label).toBe("Already expired");
    expect(buckets[0].valueAtCost).toBe(100);
    const thirty = buckets.find((bucket) => bucket.days === 30)!;
    expect(thirty.batches.map((row) => row.id)).toEqual(["soon"]);
    expect(thirty.valueAtCost).toBe(100);
  });

  it("leaves stock beyond the longest window out altogether", () => {
    const buckets = expiryBuckets(batches, [30, 60, 90], TODAY);
    expect(buckets.flatMap((b) => b.batches.map((r) => r.id))).not.toContain("safe");
  });

  it("ignores empty batches — there is nothing at risk", () => {
    const buckets = expiryBuckets(batches, [30, 60, 90], TODAY);
    expect(buckets.flatMap((b) => b.batches.map((r) => r.id))).not.toContain("empty");
  });

  it("groups a bucket by supplier, because that is who takes it back", () => {
    const groups = bySupplier(batches.filter((row) => row.quantity > 0));
    expect(groups.map((group) => group.supplierId).sort()).toEqual(["s1", "s2"]);
  });

  it("keeps expired stock out of stock value", () => {
    const value = stockValue(batches, TODAY);
    expect(value.expiredAtCost).toBe(100);
    expect(value.atCost).toBe(5 * 20 + 5 * 30 + 5 * 40);
  });
});

describe("substitutes", () => {
  const medicines = [
    medicine({ id: "m1", name: "Crocin", composition: "Paracetamol 500mg" }),
    medicine({ id: "m2", name: "Dolo 650", composition: "paracetamol 500mg " }),
    medicine({ id: "m3", name: "Combiflam", composition: "Ibuprofen + Paracetamol" }),
    medicine({ id: "m4", name: "Calpol", composition: "Paracetamol 500mg", active: false }),
  ];
  const batches = [batch({ id: "b2", medicineId: "m2", quantity: 4, mrp: 30 })];

  it("matches on the salt, ignoring case and stray spacing", () => {
    const found = substitutesFor(medicines[0], medicines, batches, settings, TODAY);
    expect(found.map((row) => row.medicine.id)).toEqual(["m2"]);
    expect(found[0].available).toBe(4);
  });

  it("leaves out medicines the shop no longer stocks", () => {
    const found = substitutesFor(medicines[0], medicines, batches, settings, TODAY);
    expect(found.map((row) => row.medicine.id)).not.toContain("m4");
  });

  it("offers nothing when a medicine has no composition recorded", () => {
    const blank = medicine({ id: "mx", composition: "" });
    expect(substitutesFor(blank, medicines, batches, settings, TODAY)).toEqual([]);
  });
});

describe("reports", () => {
  const sale: Sale = {
    id: "sale1",
    invoiceNo: "PH-00001",
    date: "2026-09-01",
    customerId: null,
    lines: [
      {
        id: "sl1",
        medicineId: "m1",
        batchId: "b1",
        name: "Crocin Advance",
        batchNo: "J4213",
        expiry: "2027-06",
        quantity: 10,
        mrp: 20,
        rate: 20,
        discountPct: 0,
        taxRate: 12,
        amount: 200,
      },
    ],
    discount: 0,
    taxTotal: 21.43,
    total: 200,
    paid: 150,
    paymentMode: "Credit",
    prescription: null,
    createdAt: "2026-09-01T10:00:00.000Z",
  };
  const range = { from: "2026-08-01", to: "2026-09-30" };

  it("reads margin off the batch the line actually sold from", () => {
    const rows = marginByMedicine([sale], [batch({ effectiveRate: 12 })], range);
    expect(rows[0].revenue).toBe(200);
    expect(rows[0].cost).toBe(120);
    expect(rows[0].margin).toBe(80);
  });

  it("reports no cost rather than dropping a sale whose batch was deleted", () => {
    const rows = marginByMedicine([sale], [], range);
    expect(rows[0].revenue).toBe(200);
    expect(rows[0].cost).toBe(0);
  });

  it("rebuilds the GST summary from the bill's own lines", () => {
    const rows = gstSummary([sale], range, true);
    expect(rows[0].rate).toBe(12);
    expect(rows[0].cgst + rows[0].sgst).toBeCloseTo(rows[0].tax, 10);
  });

  it("leaves a bill outside the range out of every figure", () => {
    expect(gstSummary([sale], { from: "2026-10-01", to: "2026-10-31" }, true)).toEqual([]);
  });

  it("tracks what is still owed on a part-paid bill", () => {
    expect(saleDue(sale)).toBe(50);
  });

  it("shows a scheduled sale with no prescription rather than hiding the gap", () => {
    const rows = scheduleRegister([sale], [medicine({ schedule: "H" })], range, ["H", "H1", "X"]);
    expect(rows).toHaveLength(1);
    expect(rows[0].doctorName).toBe("");
  });

  it("leaves unscheduled medicines out of the register", () => {
    expect(scheduleRegister([sale], [medicine({ schedule: "" })], range, ["H"])).toEqual([]);
  });
});

describe("the medicine importer", () => {
  it("reads a header row and its usual aliases", () => {
    const { rows } = parseMedicineImport(
      "Medicine Name,Salt,Company,Packing,GST %,Schedule\nCrocin Advance,Paracetamol 500mg,GSK,strip of 15,12,H"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Crocin Advance",
      composition: "Paracetamol 500mg",
      manufacturer: "GSK",
      packLabel: "strip of 15",
      taxRate: 12,
      schedule: "H",
    });
  });

  it("falls back to positional columns without a header", () => {
    const { rows } = parseMedicineImport("Crocin,Paracetamol 500mg,GSK,500 mg,15");
    expect(rows[0]).toMatchObject({ name: "Crocin", manufacturer: "GSK", packSize: 15 });
  });

  it("reads tab-separated text pasted out of a spreadsheet", () => {
    const { rows } = parseMedicineImport("Name\tComposition\nDolo 650\tParacetamol 650mg");
    expect(rows[0].composition).toBe("Paracetamol 650mg");
  });

  it("normalises the forms a price list actually uses", () => {
    const { rows } = parseMedicineImport("Name,Form\nA,TAB\nB,Syp\nC,Inj\nD,Cream");
    expect(rows.map((row) => row.form)).toEqual(["tablet", "syrup", "injection", "ointment"]);
  });

  it("leaves an unrecognised schedule blank rather than guessing at one", () => {
    const { rows } = parseMedicineImport("Name,Schedule\nA,Sch. H1\nB,narcotic\nC,X");
    expect(rows.map((row) => row.schedule)).toEqual(["H1", "", "X"]);
  });

  it("reports rows it skipped instead of dropping them quietly", () => {
    const { rows, errors } = parseMedicineImport("Name,Composition\n,orphan salt\nCrocin,Para");
    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("no medicine name");
  });

  it("drops a repeat of the same name and strength", () => {
    const { rows, errors } = parseMedicineImport("Name,Strength\nCrocin,500 mg\nCrocin,500 mg");
    expect(rows).toHaveLength(1);
    expect(errors[0]).toContain("repeats");
  });

  it("handles quoted commas inside a field", () => {
    const { rows } = parseMedicineImport('Name,Composition\n"Combiflam","Ibuprofen, Paracetamol"');
    expect(rows[0].composition).toBe("Ibuprofen, Paracetamol");
  });
});

describe("the shared bill link", () => {
  const sale: Sale = {
    id: "s1",
    invoiceNo: "PH-00001",
    date: "2026-09-01",
    customerId: "c1",
    lines: [
      {
        id: "sl1",
        medicineId: "m1",
        batchId: "b1",
        name: "Crocin Advance",
        batchNo: "J4213",
        expiry: "2027-06",
        quantity: 1,
        mrp: 20,
        rate: 20,
        discountPct: 0,
        taxRate: 12,
        amount: 20,
      },
    ],
    discount: 0,
    taxTotal: 2.14,
    total: 20,
    paid: 20,
    paymentMode: "Cash",
    prescription: null,
    createdAt: "2026-09-01T10:00:00.000Z",
  };
  const customer = {
    id: "c1",
    name: "Ramesh Verma",
    phone: "9876543210",
    email: "",
    address: "",
    notes: "",
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  it("puts the batch and expiry where the viewer will show them", () => {
    expect(shareLineName({ name: "Crocin Advance", batchNo: "J4213", expiry: "2027-06" })).toBe(
      "Crocin Advance · B/No J4213 · Exp Jun 2027"
    );
  });

  /**
   * The shared viewer prices a line as qty × rate × (1 + tax/100). Sending a
   * tax rate on an inclusive bill would show ₹22.40 against a ₹20 total, so an
   * inclusive bill must travel without one.
   */
  it("sends no per-line tax on an inclusive bill, so the line matches the total", () => {
    const doc = saleDoc(null, sale, customer, settings);
    if (doc.t !== "inv") throw new Error("expected an invoice");
    expect(settings.taxInclusive).toBe(true);
    expect(doc.it[0].x).toBeUndefined();
    expect(doc.tax).toBeUndefined();
    const shownLine = doc.it[0].q * doc.it[0].r * (1 + (doc.it[0].x ?? 0) / 100);
    expect(shownLine).toBe(doc.tot);
    expect(doc.sub).toBe(doc.tot);
  });

  it("keeps per-line tax when the shop prices tax-exclusive", () => {
    const doc = saleDoc(null, sale, customer, { ...settings, taxInclusive: false });
    if (doc.t !== "inv") throw new Error("expected an invoice");
    expect(doc.it[0].x).toBe(12);
    expect(doc.tax).toBe(2.14);
  });

  it("carries the customer's number so the share sheet can reach them", () => {
    const doc = saleDoc(null, sale, customer, settings);
    expect(doc.t === "inv" && doc.cp).toBe("9876543210");
  });

  it("spells out the balance on a part-paid bill", () => {
    const doc = saleDoc(null, { ...sale, paid: 15 }, customer, settings);
    expect(doc.t === "inv" && doc.pm).toContain("balance due");
  });
});
