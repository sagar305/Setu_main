# Free Pharmacy POS

### Full specification — pre-build

> Assumes the shared foundation in [`README.md`](./README.md).

---

## 1. Positioning

| | |
|---|---|
| **Route** | `/products/free-pharmacy-software` |
| **Component root** | `components/tools/Pharmacy/` |
| **Data layer** | `lib/pharmacy/` |
| **Target user** | Independent medical stores and chemist shops, 1–3 counters. Often attached to a clinic. |
| **The one job** | Sell from the right batch, and never be surprised by an expiry. |
| **Upsell** | Retail POS, and the clinic+pharmacy bundle. |

### What this actually is

A fork of the Browser Based POS (`lib/pos/`, `components/tools/FreePos/`) with
one structural change that ripples everywhere: **stock is per batch, not per
product**. Everything else — cart, billing, customers, receipts, reports — is
adapted rather than rewritten.

Be honest about the cost: batch-level stock touches the cart, the stock ledger,
purchase entry, returns and every report. This is a high-effort app despite
sharing a codebase.

### Search intent

*pharmacy software free download*, *medical store billing software free*,
*chemist shop software India*, *pharmacy billing software with expiry*,
*medical store inventory software*.

### What makes it win

**The expiry dashboard.** Expired stock is pure loss, and most Indian chemists
find out too late to return it to the distributor. A screen that says "₹18,400 of
stock expires in the next 60 days, here is the return list grouped by supplier"
is worth real money every month.

---

## 2. Data model

Extends `lib/pos/types.ts` rather than replacing it.

```ts
export type ScheduleClass = "" | "H" | "H1" | "X" | "G" | "OTC";

export type Medicine = {
  id: string;
  name: string;                  // brand name, "Crocin Advance"
  /** Salt/generic — powers substitute search. "Paracetamol 500mg" */
  composition: string;
  manufacturer: string;
  strength: string;
  form: "tablet" | "capsule" | "syrup" | "injection" | "drops"
      | "ointment" | "inhaler" | "sachet" | "other";
  /** Units in a strip/pack; billing is usually per unit but stock arrives per pack. */
  packSize: number;
  packLabel: string;             // "strip of 10", "100 ml bottle"
  hsnCode: string;
  taxRate: number;               // 0, 5, 12, 18
  schedule: ScheduleClass;
  /** Physical location in the shop — the single biggest time-saver at the counter. */
  rack: string;
  barcode: string;
  lowStockAt: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Stock is held here, never on Medicine. */
export type Batch = {
  id: string;
  medicineId: string;
  batchNo: string;
  /** "YYYY-MM" — pharma expiry is month precision. Indexed. */
  expiry: string;
  mrp: number;
  /** Purchase rate per unit, after scheme discount. Drives margin. */
  purchaseRate: number;
  sellingRate: number;
  /** Units currently in hand. */
  quantity: number;
  supplierId: string | null;
  purchaseId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Supplier = {
  id: string;
  name: string;
  phone: string;
  gstin: string;
  address: string;
  createdAt: string;
};

export type Purchase = {
  id: string;
  invoiceNo: string;             // the distributor's invoice number
  supplierId: string;
  date: string;
  lines: PurchaseLine[];
  discount: number;
  taxTotal: number;
  total: number;
  paid: number;
  createdAt: string;
};

export type PurchaseLine = {
  id: string;
  medicineId: string;
  batchNo: string;
  expiry: string;
  /** Paid-for units. */
  quantity: number;
  /** Scheme goods — added to stock, cost zero. "10+1" means free = 1. */
  freeQuantity: number;
  purchaseRate: number;
  mrp: number;
  sellingRate: number;
  discountPct: number;
  taxRate: number;
};

export type SaleLine = {
  id: string;
  medicineId: string;
  batchId: string;               // always a specific batch
  name: string;
  batchNo: string;
  expiry: string;
  quantity: number;
  mrp: number;
  rate: number;
  discountPct: number;
  taxRate: number;
  amount: number;
};

export type Sale = {
  id: string;
  invoiceNo: string;
  date: string;
  customerId: string | null;
  lines: SaleLine[];
  discount: number;
  taxTotal: number;
  total: number;
  paid: number;
  paymentMode: string;
  /** Required when any line is a Schedule H/H1 medicine. */
  prescription: PrescriptionRef | null;
  createdAt: string;
};

export type PrescriptionRef = {
  doctorName: string;
  doctorRegNo: string;
  patientName: string;
  date: string;
  photoDataUrl: string;          // optional scan of the Rx
};

export type SaleReturn = {
  id: string;
  saleId: string;
  date: string;
  lines: { saleLineId: string; batchId: string; quantity: number; amount: number }[];
  reason: string;
  total: number;
  createdAt: string;
};

/** Stock going back to the distributor — usually expiry or damage. */
export type PurchaseReturn = {
  id: string;
  supplierId: string;
  date: string;
  lines: { batchId: string; quantity: number; rate: number; amount: number }[];
  reason: "expiry" | "damage" | "wrong-supply" | "other";
  total: number;
  createdAt: string;
};

export type RefillReminder = {
  id: string;
  customerId: string;
  medicineId: string;
  /** Days of supply dispensed; the reminder fires this many days after the sale. */
  daysSupply: number;
  lastSaleId: string;
  nextDueOn: string;
  active: boolean;
  createdAt: string;
};

export type PharmacySettings = {
  id: "main";
  invoicePrefix: string;
  nextInvoiceNumber: number;
  /** Expiry dashboard buckets, in days. */
  expiryBuckets: number[];       // [30, 60, 90]
  /** Refuse to bill a batch expiring within this many days. 0 = warn only. */
  blockExpiryWithinDays: number;
  /** Force prescription capture for these classes. */
  prescriptionRequiredFor: ScheduleClass[];   // ["H", "H1", "X"]
  taxInclusive: boolean;         // pharma MRP is inclusive; default true
  paymentModes: string[];
  drugLicenceNo: string;         // prints on the invoice
  gstin: string;
  receiptPaperSize: "58mm" | "80mm" | "a4";
  messageTemplates: Record<"refillDue" | "duesReminder", string>;
  lastBackupAt: string | null;
  sheetSyncUrl: string;
  pinHash?: string;
  pinSalt?: string;
  autoLockMinutes?: number;
};
```

Object stores: `medicines`, `batches`, `suppliers`, `purchases`, `sales`,
`saleReturns`, `purchaseReturns`, `refillReminders`, `customers` (reuses the POS
Customer), `pharmacySettings`.

Indexes: `batches.medicineId`, `batches.expiry`, `medicines.name`,
`medicines.composition`, `medicines.barcode`, `sales.date`.

---

## 3. Screens

```ts
export type ScreenId =
  | "sell"
  | "medicines"
  | "purchases"
  | "expiry"
  | "customers"
  | "reports"
  | "settings";
```

### 3.1 Sell

- **Search** matches brand name, composition and barcode simultaneously. Results
  show name, strength, pack, rack location, and total available stock.
- **Substitute search**: a result row expands to "same composition" alternatives
  with their MRPs. This is the counter's most common question and the reason to
  index `composition`.
- **Batch selection**: adding a medicine picks the batch by **FEFO** — first
  expiry, first out — among batches with stock. The chosen batch and expiry are
  shown on the line and can be changed with one tap.
- **Expiry guard**: a batch expiring within `blockExpiryWithinDays` is either
  blocked or flagged red depending on settings. Already-expired batches are never
  sellable.
- Quantity in units, with a "×pack" shortcut for whole strips.
- **Prescription capture**: if any line's medicine has a schedule in
  `prescriptionRequiredFor`, the bill cannot be completed without doctor name,
  registration number and patient name; a photo of the Rx is optional.
- Customer attach (optional) for ledger and refill reminders.
- Discount, payment mode, print.
- **Held bills** — a customer sends someone back to the car for money;
  reuse `HeldCart` from `lib/pos/types.ts`.

### 3.2 Medicines

Master list with search and rack filter. Add/edit medicine. Per-medicine detail
shows every batch in stock with expiry and quantity, plus sales velocity over the
last 90 days. CSV import for the master; a seed list ships with the app.

### 3.3 Purchases

Distributor invoice entry — the second-heaviest screen after Sell.

- Header: supplier, invoice no, date.
- Lines: medicine (search-or-create) → batch no → expiry → quantity → free
  quantity → purchase rate → MRP → selling rate → discount % → tax.
- Running totals matching the distributor's invoice, so the operator can verify
  against paper before saving.
- On save, each line creates or tops up a `Batch`.
- Purchase list with supplier-wise outstanding.
- **Purchase returns**: pick expired or damaged batches, generate a return note.

### 3.4 Expiry — the differentiator

- Bucketed by `expiryBuckets`: expiring in 30 / 60 / 90 days, plus already
  expired.
- Each bucket shows total value at purchase rate — the actual money at risk.
- Grouped by supplier, because returns go back supplier-wise.
- One-tap "Create return note" per supplier group.
- Already-expired stock is flagged for physical removal with a printable list.

### 3.5 Reports

- Sales by day / month, by payment mode.
- **Margin**: selling rate minus purchase rate, per medicine and overall.
- Fast and slow movers over a chosen window.
- Stock value on hand, at purchase rate and at MRP.
- Low stock and out of stock, with a suggested order list by supplier.
- **Schedule H / H1 register** — a printable, date-ranged register of every
  scheduled sale with prescription details, in the format the drug inspector
  expects.
- GST summary by tax rate for return filing.
- Supplier-wise purchase and outstanding.
- CSV export on all.

### 3.6 Settings

Shop details incl. drug licence and GSTIN · Expiry buckets and blocking rule ·
Prescription rules by schedule class · Tax mode · Suppliers · Medicine master
import · Billing (prefix, modes, paper) · Message templates · Sheet sync ·
Backup & restore · Screen lock · Reset.

---

## 4. Business rules

| Rule | Definition |
|---|---|
| **FEFO** | Default batch = lowest `expiry` among batches with `quantity > 0`, tie-broken by oldest `createdAt`. |
| **Expiry date meaning** | A batch expiring "2026-08" is sellable through 2026-08-31 and expired from 2026-09-01. |
| **Stock movement** | Only sales, sale returns, purchases, purchase returns and explicit adjustments change `Batch.quantity`. Every change writes a log row. |
| **Free goods** | `freeQuantity` adds to stock at zero cost, which lowers the blended purchase rate. Store the rate as paid, and compute effective cost as `total paid ÷ (quantity + freeQuantity)` for margin reporting. |
| **Tax** | Pharma MRP is tax-inclusive by default; tax is backed out for the GST summary. |
| **Prescription requirement** | Enforced at bill completion, not at line add, so the operator is not interrupted mid-sale. |
| **Refill due** | `lastSale.date + daysSupply − 3` days, so the reminder lands before the patient runs out. |

---

## 5. Reuse map

| Need | Reuse |
|---|---|
| Nearly all of the POS shell | `components/tools/FreePos/` — Billing, Customers, Reports, Settings, Setup, Welcome, Lock |
| Cart, tax, totals | `lib/pos/calc.ts` |
| Held bills | `HeldCart` in `lib/pos/types.ts` |
| Receipt PDF | `lib/pos/receiptPdf.ts` |
| Barcode scan/generate | `components/tools/BarcodeGenerator/`, `components/tools/LabelPrinter/` |
| Supplier & purchase patterns | `components/tools/SupplierBook/`, `components/tools/PurchaseRegister/` |
| Stock ledger patterns | `components/tools/StockRegister/`, `InventoryLog` in `lib/pos/types.ts` |
| Send queue | `Tuition/SendQueue.tsx` |

---

## 6. Build phases

**Phase 1** — medicines master, batches, purchase entry, FEFO selling, invoice
printing. The app is useless without batch-level stock, so this is the minimum.

**Phase 2** — expiry dashboard and purchase returns.

**Phase 3** — schedule H/H1 prescription capture and the printable register;
substitute search.

**Phase 4** — reports incl. margin and GST summary, refill reminders, customer
ledger, marketing page.

---

## 7. Open decisions

1. **Do we ship a medicine master at all?** A seed of a few thousand Indian
   medicines with composition would make the app instantly usable, but it is a
   dataset to source, licence and maintain, and errors in a drug list are not
   like errors in a product list. Options: (a) ship nothing, rely on CSV import
   and as-you-go creation; (b) ship a small OTC-only seed; (c) source a licensed
   dataset. Recommendation: (a) for launch with a strong CSV importer, revisit
   after real usage.
2. **Is a free pharmacy app a liability risk?** Dispensing records, schedule H
   registers and drug-inspector expectations put this app closer to regulated
   territory than the others. Get a view on what disclaimers are needed and
   whether the register output can be described as compliance-ready. **This
   decision gates the whole app** — resolve it before Phase 1.
3. **Unit vs pack selling.** Chemists sell loose tablets from a cut strip.
   Modelling stock in units handles it, but purchase arrives in packs and the
   operator thinks in strips. Confirm the input convention with a real shop.
4. **GST invoice compliance** — do we need to produce a fully compliant tax
   invoice (place of supply, HSN summary, reverse charge line)? If yes, this is
   materially more work than the other apps' billing.
5. **Is this a fork or a mode of the existing POS?** A fork duplicates ~6k lines
   that will then drift. A mode adds batch complexity to a currently simple app.
   Recommendation: fork the components, share `lib/pos/calc.ts` and the receipt
   layer, accept the duplication.
6. **Priority check.** Given the effort and the regulatory questions, confirm
   Pharmacy should be built at all before Hostel, Laundry and Rental, which are
   smaller and cleaner.
