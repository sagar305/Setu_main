# Free Rental & Hire Book

### Full specification — pre-build

> Assumes the shared foundation in [`README.md`](./README.md).

---

## 1. Positioning

| | |
|---|---|
| **Route** | `/products/free-rental-software` |
| **Component root** | `components/tools/Rental/` |
| **Data layer** | `lib/rental/` |
| **Target user** | Tent houses and event decorators, party equipment and furniture hire, camera and lighting rental, construction tool and scaffolding hire, sound systems, crockery and utensil rental. |
| **The one job** | Never promise the same item to two customers on the same date. |
| **Upsell** | New paid vertical: multi-godown, driver/delivery app, online availability. |

### Search intent

*rental management software free*, *tent house software*,
*equipment rental software free download*, *rental booking software India*,
*camera rental management*, *furniture rental billing software*.

### What makes it win

**The availability calendar.** Rental is the only one of the nine where the core
problem is a scheduling constraint on inventory, not a transaction. A tent house
owner's entire risk is double-booking 200 chairs for a wedding date. Every free
tool models rentals as invoices with dates and does not answer "how many chairs
are actually free on the 14th?" — which is the only question that matters.

Second: **damage and shortage settlement at return**, which is where the margin
in this business is won or lost.

---

## 2. Data model

```ts
export type ItemCategory = {
  id: string;
  name: string;              // "Seating", "Lighting", "Cameras", "Scaffolding"
  sortOrder: number;
};

export type RateBasis = "per-day" | "per-event" | "per-hour";

export type RentalItem = {
  id: string;
  name: string;              // "Plastic chair – white", "Canon R6 body"
  categoryId: string;
  /** Bulk items are fungible and counted; serialised items are individually tracked. */
  tracking: "bulk" | "serialised";
  /** Total units owned. For serialised items this equals the unit count. */
  totalQuantity: number;
  rateBasis: RateBasis;
  rate: number;
  /** Deposit taken per unit, refunded at return. */
  depositPerUnit: number;
  /** Charged per unit per day when returned late. */
  lateFeePerUnitPerDay: number;
  /** What a lost unit costs the customer. */
  replacementValue: number;
  purchaseCost: number;
  purchasedOn: string;
  imageDataUrl: string;
  active: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

/** Individually tracked units, for serialised items only. */
export type ItemUnit = {
  id: string;
  itemId: string;
  serialNo: string;
  condition: "good" | "needs-repair" | "retired";
  /** Set when out on a booking. */
  currentBookingId: string | null;
  createdAt: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  altPhone: string;
  address: string;
  idProofKind: string;
  idProofNumber: string;
  idProofPhoto: string;
  /** Repeat event customers: caterers, decorators, production houses. */
  isTrade: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type BookingStatus =
  | "enquiry"
  | "confirmed"
  | "dispatched"
  | "returned"
  | "closed"
  | "cancelled";

export type BookingLine = {
  id: string;
  itemId: string;
  name: string;
  /** Requested count for bulk items; unit count for serialised. */
  quantity: number;
  /** Serialised items only — which physical units are allocated. */
  unitIds: string[];
  rateBasis: RateBasis;
  rate: number;
  /** Chargeable days/hours/events, computed from the booking window. */
  chargeableUnits: number;
  amount: number;
  depositPerUnit: number;
  /** Filled at return. */
  returnedQuantity: number;
  damagedQuantity: number;
  lostQuantity: number;
  damageCharge: number;
  lossCharge: number;
  returnNote: string;
};

export type Booking = {
  id: string;
  bookingNo: string;         // "BK-0231"
  customerId: string;
  status: BookingStatus;
  /** The window the stock is committed for — this is what the calendar reserves. */
  fromDate: string;
  toDate: string;
  fromTime: string;
  toTime: string;
  /** Event context, for the delivery team. */
  eventName: string;
  venue: string;
  venueContact: string;
  lines: BookingLine[];
  transportCharge: number;
  labourCharge: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  /** Rent + charges, before deposits. */
  total: number;
  depositTotal: number;
  advancePaid: number;
  /** Filled at return/settlement. */
  actualReturnedOn: string | null;
  lateDays: number;
  lateFee: number;
  damageTotal: number;
  lossTotal: number;
  depositRefunded: number;
  finalPayable: number;
  paid: number;
  paymentMode: string;
  dispatchedOn: string | null;
  dispatchSignature: string;
  returnSignature: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type MaintenanceLog = {
  id: string;
  itemId: string;
  unitId: string | null;
  date: string;
  kind: "repair" | "service" | "cleaning" | "retired";
  description: string;
  cost: number;
  /** Days the item was unavailable — excluded from availability. */
  outOfServiceFrom: string | null;
  outOfServiceTo: string | null;
  createdAt: string;
};

export type RentalSettings = {
  id: "main";
  bookingPrefix: string;
  nextBookingNumber: number;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  /** Buffer days after a booking before the stock is available again — cleaning, transport. */
  bufferDays: number;
  /** Whether the return day is chargeable. */
  countReturnDay: boolean;
  defaultLateFeeBasis: "item-rate" | "fixed";
  taxEnabled: boolean;
  defaultTaxRate: number;
  paymentModes: string[];
  damagePresets: string[];   // "Torn", "Stained", "Broken leg", "Missing part"
  messageTemplates: Record<RentalTemplateKey, string>;
  receiptPaperSize: "58mm" | "80mm" | "a4";
  lastBackupAt: string | null;
  sheetSyncUrl: string;
  pinHash?: string;
  pinSalt?: string;
  autoLockMinutes?: number;
};

export type RentalTemplateKey =
  | "quotation" | "confirmed" | "dispatchReminder"
  | "returnDue" | "overdue" | "settlement";
```

Object stores: `itemCategories`, `items`, `itemUnits`, `customers`, `bookings`,
`maintenanceLogs`, `rentalSettings`.
Indexes: `bookings.fromDate`, `bookings.toDate`, `bookings.status`,
`bookings.customerId`.

---

## 3. Screens

```ts
export type ScreenId =
  | "today"
  | "availability"
  | "bookings"
  | "items"
  | "customers"
  | "reports"
  | "settings";
```

### 3.1 Today

- **Dispatching today** — bookings whose `fromDate` is today, with the picking
  list and venue.
- **Returning today** — bookings due back.
- **Overdue** — out past `toDate`, with days late and accruing late fee.
- **Enquiries pending** — quotes not yet confirmed, ageing.
- Stats: items out, value out on rent, deposits held, collections today.

### 3.2 Availability — the core screen

Answers "what can I promise, and when?"

- **Date-range picker** at the top; everything below reflects it.
- **Item availability table**: item, total owned, committed in that range, out for
  maintenance, **free**. Sorted with the tightest availability first.
- A **calendar strip** per item (or per category) showing commitment day by day
  across the next 60 days, so the owner sees where the pinch points are.
- **Check availability from a booking**: while adding a line, the quantity field
  shows "12 of 200 free on these dates" live, and refuses to over-commit without
  an explicit override (which is sometimes right — the owner may be planning to
  sub-hire).
- **Conflict list**: any booking that currently over-commits an item, so mistakes
  surface rather than sitting silent.

### 3.3 Bookings

- Status tabs: Enquiry · Confirmed · Dispatched · Returned · Closed.
- Card: booking no, customer, event and venue, date range, item count, value,
  balance due.
- **New booking**:
  1. Customer (search or create), event name, venue, venue contact.
  2. Date and time window.
  3. Items — category grid, availability shown live per item for the window.
  4. Transport, labour, discount.
  5. Deposit total computed; advance collected.
  6. Save as enquiry (a quotation) or confirm (commits the stock).
- **Dispatch**: a picking list printed for the loading crew; for serialised items,
  specific units are allocated and scanned or ticked; a delivery challan prints;
  `dispatchSignature` captured.
- **Return**: the settlement screen — for each line, returned / damaged / lost
  counts, damage charge per preset, loss charge defaulting to
  `replacementValue`, late days computed automatically. Deposit refund and final
  payable resolve at the bottom. Signature captured.
- **Quotation** printable and shareable from the enquiry state.

### 3.4 Items

- Category-grouped list with photo, total owned, currently out, free today,
  rate, deposit.
- Item detail: rates, deposit, replacement value, purchase cost and date,
  utilisation percentage, revenue earned to date, maintenance history.
- Serialised items list their units with condition and current location.
- **Maintenance**: log a repair with cost and an out-of-service window that
  removes the units from availability for that period.

### 3.5 Reports

- **Utilisation per item** — days out ÷ days in the period. Tells the owner what
  to buy more of and what to sell off. The most valuable report in the app.
- **Revenue per item** and return on purchase cost.
- Bookings and revenue by month; enquiry-to-confirmed conversion.
- Damage and loss recovered vs written off.
- Late returns and late fees collected.
- Deposits currently held.
- Customer ranking by revenue; trade vs retail split.
- Maintenance spend per item.
- CSV export.

### 3.6 Settings

Business details · Categories & items · Buffer days · Return-day charging rule ·
Late fee basis · Damage presets · Tax · Billing (prefixes, modes, paper) ·
Message templates · Sheet sync · Backup & restore · Screen lock · Reset.

---

## 4. Business rules

| Rule | Definition |
|---|---|
| **Committed stock** | For a date range, an item's committed quantity is the maximum overlap across all `confirmed` and `dispatched` bookings on any single day in that range — not the sum, and not the average. Getting this wrong is the whole app. |
| **Availability** | `totalQuantity − committed − outForMaintenance` on the tightest day in the range. |
| **Buffer** | A booking's commitment extends `bufferDays` past `toDate` before the stock frees up. |
| **Chargeable days** | `toDate − fromDate`, plus one if `countReturnDay`. Minimum one. `per-event` charges once; `per-hour` uses the time fields. |
| **Late days** | `actualReturnedOn − toDate`, floor zero. |
| **Late fee** | `Σ lines (quantity × lateFeePerUnitPerDay × lateDays)` for `item-rate`, or a flat figure for `fixed`. |
| **Damage charge** | Entered per line, defaulting to a percentage of `replacementValue` chosen at return. |
| **Loss charge** | `lostQuantity × replacementValue`. |
| **Final settlement** | `total + lateFee + damageTotal + lossTotal − advancePaid`, then deposit applied: `depositRefunded = depositTotal − (charges not otherwise paid)`. Negative refund becomes an amount payable. |
| **Serialised allocation** | A unit can be on only one `dispatched` booking at a time; enforced. |

---

## 5. Message templates

| Key | Default |
|---|---|
| `quotation` | `{{businessName}}: quote for {{eventName}} on {{fromDate}} — ₹{{amount}}. Valid 7 days. Booking no {{bookingNo}}.` |
| `confirmed` | `{{businessName}}: booking {{bookingNo}} confirmed for {{fromDate}} to {{toDate}}, {{venue}}. Advance ₹{{advance}} received.` |
| `dispatchReminder` | `{{businessName}}: your order for {{eventName}} dispatches on {{fromDate}}. Venue contact: {{venueContact}}.` |
| `returnDue` | `{{businessName}}: items for booking {{bookingNo}} are due back on {{toDate}}. Please arrange return.` |
| `overdue` | `{{businessName}}: booking {{bookingNo}} is {{lateDays}} days overdue. Late fee ₹{{lateFee}} is accruing.` |
| `settlement` | `{{businessName}}: booking {{bookingNo}} settled. Deposit refunded ₹{{refund}}. Thank you.` |

---

## 6. Print outputs

| Output | Paper |
|---|---|
| Quotation | A4 — itemised with rates, dates, terms |
| Picking list | A4 — items and counts for the loading crew, no prices |
| Delivery challan | A5 / A4 — items dispatched, venue, signature blocks |
| Return / settlement note | A4 — returned, damaged, lost, late fee, deposit, net |
| Invoice / receipt | 58mm / 80mm / A4 |

---

## 7. Reuse map

| Need | Reuse |
|---|---|
| Item catalogue & categories | `FreePos/ProductsScreen.tsx`, `lib/pos/types.ts` Product/Category |
| Category-tabbed picker | `FreeDine/ItemChooserModal.tsx` |
| Booking/date scheduling | `components/tools/AppointmentBook/AppointmentBookTool.tsx` |
| Challan & quotation PDFs | `components/tools/QuotationGenerator/`, `components/tools/docgen/` |
| Invoice | `components/tools/InvoiceGenerator/` |
| Customer register | `FreePos/CustomersScreen.tsx` |
| Signature capture | shared with the Repair app |
| Send queue & templates | `Tuition/SendQueue.tsx`, `lib/tuition/messages.ts` |

---

## 8. Build phases

**Phase 1** — items, customers, bookings with date windows, and the availability
engine. Nothing ships without the availability engine; it is the product.

**Phase 2** — dispatch with picking list and challan, return with damage/loss/late
settlement, deposits.

**Phase 3** — quotations and the enquiry pipeline, serialised unit tracking,
maintenance logs.

**Phase 4** — utilisation and revenue reports, marketing page.

---

## 9. Open decisions

1. **Bulk vs serialised in the free tier.** Serialised tracking roughly doubles
   the booking and dispatch complexity, and only camera/tool rental really needs
   it — tent houses do not track individual chairs. Recommendation: launch
   bulk-only, add serialised in Phase 3, and confirm which trade we are actually
   targeting first. **This changes the data model, so decide before Phase 1.**
2. **Availability across a range — max overlap or per-day?** The rule above uses
   the tightest single day. It is correct and slightly expensive to compute.
   Confirm performance is fine for 60-day views with a few hundred bookings, or
   precompute a daily commitment index.
3. **Sub-hire.** Tent houses routinely borrow stock from a peer to cover a
   shortfall. Do we model sub-hired items (with a cost) or just allow the
   over-commit override? Recommendation: override for launch, sub-hire later.
4. **Deposit handling** — is a deposit actually collected in cash, or is it
   notional in most of these trades? If notional, the settlement maths simplifies
   considerably.
5. **Per-hour rate basis** — is it used enough to justify the time fields, or is
   per-day and per-event sufficient for launch?
6. **Which trade leads the marketing page?** Tent house and event rental has the
   most search volume in India; camera rental has the most software-literate
   owners. The app is the same but the page's language, examples and FAQ are not.
