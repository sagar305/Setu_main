# Free Laundry & Dry Clean Counter

### Full specification — pre-build

> Assumes the shared foundation in [`README.md`](./README.md).

---

## 1. Positioning

| | |
|---|---|
| **Route** | `/products/free-laundry-software` |
| **Component root** | `components/tools/Laundry/` |
| **Data layer** | `lib/laundry/` |
| **Target user** | Dry cleaners, laundry shops, dhobi and ironing services, and laundry pickup-delivery operators. One counter, 1–5 staff. |
| **The one job** | Count the garments in, get them back to the right person on the right day. |
| **Upsell** | Retail POS, and a paid pickup-delivery route tier. |

### Why it is one of the cheapest to build

The domain is a small order pipeline with a rate card and a status flow. It is
structurally the Repair app minus the diagnosis and parts, or the Restaurant POS
minus the kitchen. Almost everything is reuse.

### Search intent

*laundry software free download*, *dry cleaning shop software*,
*laundry management system free*, *laundry billing software India*,
*dry cleaner billing app*, *laundry shop tag printing*.

### What makes it win

**Per-garment tagging that actually prints.** Losing a garment or returning the
wrong one is the only real failure mode in this business. An app that prints a
numbered tag for every single item, tied to the order, and reconciles them at
delivery, removes it. `components/tools/LabelPrinter/` already exists — this is
mostly wiring.

---

## 2. Data model

```ts
export type ServiceKind = "wash" | "wash-iron" | "iron" | "dry-clean" | "starch" | "premium";

export type GarmentType = {
  id: string;
  name: string;              // "Shirt", "Saree", "Blazer", "Curtain (per kg)"
  category: string;          // "Men", "Women", "Household"
  /** Per-kg items are priced by weight, not count. */
  pricedBy: "piece" | "kg";
  icon: string;              // lucide icon name
  sortOrder: number;
  active: boolean;
  createdAt: string;
};

/** The rate card: price for a garment type × service kind. */
export type Rate = {
  id: string;
  garmentTypeId: string;
  service: ServiceKind;
  price: number;
  /** Standard turnaround for this combination, in days. */
  turnaroundDays: number;
  active: boolean;
};

export type Customer = {
  id: string;
  code: string;
  name: string;
  phone: string;
  address: string;
  landmark: string;
  /** Monthly account customers are billed in a cycle instead of per order. */
  isAccountCustomer: boolean;
  accountBillingDay: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type OrderStatus =
  | "received"
  | "processing"
  | "ready"
  | "out-for-delivery"
  | "delivered"
  | "cancelled";

export type OrderItem = {
  id: string;
  garmentTypeId: string;
  name: string;
  service: ServiceKind;
  /** Count for piece items, weight for kg items. */
  quantity: number;
  unitPrice: number;
  amount: number;
  colour: string;
  brand: string;
  /** Pre-existing stains, tears, missing buttons — recorded at intake. */
  defects: string[];
  defectPhotos: string[];
  /** One tag number per physical piece; length === quantity for piece items. */
  tagNumbers: string[];
  /** Set at delivery reconciliation. */
  returnedCount: number;
  note: string;
};

export type Order = {
  id: string;
  orderNo: string;           // "LD-1043"
  customerId: string;
  receivedOn: string;
  /** Computed from the slowest item's turnaround; editable. */
  promisedOn: string;
  /** Express orders carry a surcharge and a shorter promise. */
  express: boolean;
  expressSurcharge: number;
  items: OrderItem[];
  status: OrderStatus;
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  advance: number;
  paid: number;
  paymentMode: string;
  /** Pickup/delivery scheduling. */
  pickupAddress: string;
  pickupSlot: string | null;
  deliverySlot: string | null;
  deliveredOn: string | null;
  receivedBy: string;        // who accepted delivery
  statusHistory: { id: string; to: OrderStatus; at: string; note: string; notifiedAt: string | null }[];
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type LaundrySettings = {
  id: "main";
  orderPrefix: string;
  nextOrderNumber: number;
  /** Tag numbers run continuously across orders and never reset. */
  tagPrefix: string;
  nextTagNumber: number;
  expressSurchargePct: number;
  expressTurnaroundDays: number;
  defaultTurnaroundDays: number;
  defectPresets: string[];   // "Stain", "Tear", "Button missing", "Colour fade"
  taxEnabled: boolean;
  defaultTaxRate: number;
  paymentModes: string[];
  /** Nag interval for ready-but-uncollected orders. */
  uncollectedNagDays: number;
  pickupSlots: string[];     // "9–12", "12–4", "4–8"
  messageTemplates: Record<LaundryTemplateKey, string>;
  receiptPaperSize: "58mm" | "80mm" | "a4";
  lastBackupAt: string | null;
  sheetSyncUrl: string;
  pinHash?: string;
  pinSalt?: string;
  autoLockMinutes?: number;
};

export type LaundryTemplateKey =
  | "received" | "ready" | "outForDelivery"
  | "delivered" | "uncollected" | "monthlyBill";
```

Object stores: `garmentTypes`, `rates`, `customers`, `orders`, `laundrySettings`.
Indexes: `orders.status`, `orders.promisedOn`, `orders.customerId`,
`customers.phone`, and a lookup on tag numbers.

---

## 3. Screens

```ts
export type ScreenId =
  | "orders"
  | "intake"
  | "customers"
  | "rates"
  | "reports"
  | "settings";
```

### 3.1 Orders

- Status tabs: Received · Processing · Ready · Out for delivery · Delivered.
- Each card: order no, customer, item count, promised date, amount, paid/unpaid.
- **Overdue highlight**: past `promisedOn` and not delivered goes red. This is the
  number that keeps customers.
- **Uncollected**: ready for more than `uncollectedNagDays`, flagged with a nag
  action.
- Search by order no, phone, customer name, or **tag number** — someone finds a
  loose tagged garment and needs to know whose it is.
- Bulk status change: select several orders, move them all to `ready`, and offer
  one send-queue run for the notifications.

### 3.2 Intake

The counter screen. Speed matters more than anything else here.

1. **Customer** — phone-first search, or new with just name and phone.
2. **Items** — a grid of garment types as tappable chips grouped by category.
   Tapping adds one; tapping again increments. A service toggle at the top
   (Wash / Wash+Iron / Iron / Dry clean) sets what subsequent taps use, so the
   common case of "12 shirts, wash and iron" is two taps and a number.
   - Per-kg items open a weight field instead of a counter.
   - Each line expands for colour, brand, defects (preset chips + free text) and
     photos.
3. **Terms** — express toggle (applies surcharge and shortens the promise),
   promised date (auto, editable), advance payment, pickup/delivery slots.
4. **Save** → tag numbers are allocated (one per physical piece), the receipt
   prints, tags print, and the `received` message is offered.

Total item count is displayed large and permanently — the customer counts along,
and a mismatch caught at the counter is a dispute avoided.

### 3.3 Order detail

- Header: order no, status, customer, promised date, days remaining or overdue.
- Item list with tags, defects and photos.
- Status actions with notification prompts.
- **Delivery reconciliation**: at delivery, the screen lists every tag number
  with a check-off. Anything unchecked blocks completion until it is explicitly
  marked missing with a note. This is the feature that prevents the shop's worst
  day.
- Payment collection, receipt reprint, tag reprint.

### 3.4 Customers

List and detail with order history, total spend, outstanding, and account-customer
settings. **Monthly account billing**: for `isAccountCustomer`, a run on
`accountBillingDay` consolidates the month's delivered orders into a single
statement, printable and sendable.

### 3.5 Rates

The rate card as a grid: garment types down, service kinds across, price and
turnaround in each cell. Inline editing. Bulk percentage increase across a
category — laundries revise prices seasonally and this saves an hour.

### 3.6 Reports

- Orders and revenue by day/month.
- Item mix: which garments and services drive volume and value.
- **On-time delivery rate** — delivered on or before `promisedOn`.
- Turnaround: average received-to-ready and ready-to-delivered.
- Uncollected orders and their value.
- Outstanding payments; account-customer balances.
- Express order share.
- CSV export.

### 3.7 Settings

Shop details · Garment types & categories · Rate card · Turnaround defaults ·
Express (surcharge %, days) · Defect presets · Tag numbering · Pickup slots ·
Tax · Billing (prefix, modes, paper) · Message templates · Uncollected nag ·
Sheet sync · Backup & restore · Screen lock · Reset.

---

## 4. Business rules

| Rule | Definition |
|---|---|
| **Promised date** | `receivedOn + max(turnaroundDays across items)`, or `expressTurnaroundDays` when express. Skips the shop's weekly off if one is set. |
| **Express surcharge** | `subtotal × expressSurchargePct`, added as its own line. |
| **Tag allocation** | One tag per physical piece for `pricedBy: "piece"` items; one tag per kg-item line. Numbers come from `nextTagNumber` and never reset or repeat. |
| **Delivery completion** | Blocked until every tag is checked off or explicitly marked missing. |
| **Uncollected** | `status = ready` for more than `uncollectedNagDays`; re-nags each interval. |
| **On-time** | `deliveredOn <= promisedOn`. |
| **Account billing** | Delivered orders in the cycle, unpaid, consolidated into one statement; individual orders are then marked settled against it. |

---

## 5. Message templates

| Key | Default |
|---|---|
| `received` | `{{shopName}}: received {{itemCount}} items — order {{orderNo}}. Ready by {{promisedDate}}. Total ₹{{amount}}.` |
| `ready` | `{{shopName}}: order {{orderNo}} ({{itemCount}} items) is ready. Amount ₹{{amount}}. Pay by UPI: {{upiId}}` |
| `outForDelivery` | `{{shopName}}: order {{orderNo}} is out for delivery today, {{slot}}.` |
| `delivered` | `{{shopName}}: order {{orderNo}} delivered. Thank you!` |
| `uncollected` | `{{shopName}}: order {{orderNo}} has been ready since {{readyDate}}. Please collect it.` |
| `monthlyBill` | `{{shopName}}: your bill for {{month}} is ₹{{amount}} across {{orderCount}} orders. Pay by UPI: {{upiId}}` |

---

## 6. Print outputs

| Output | Paper |
|---|---|
| Customer receipt | 58mm / 80mm — order no, itemised list with counts, promised date, total, advance, balance |
| Garment tags | Label roll via `components/tools/LabelPrinter/` — tag number, order no, customer surname, service |
| Delivery challan | A5 — for pickup/delivery routes |
| Monthly statement | A4 — for account customers |

---

## 7. Reuse map

| Need | Reuse |
|---|---|
| Tag/label printing | `components/tools/LabelPrinter/`, `components/tools/BarcodeGenerator/` |
| Category-tabbed item picker | `FreeDine/ItemChooserModal.tsx` — the closest analogue to the garment grid |
| Order pipeline & status board | `FreeDine/KitchenScreen.tsx`, and the Repair app's board if built first |
| Cart totals, tax | `lib/pos/calc.ts` |
| Receipts | `lib/pos/receiptPdf.ts` |
| Customer register & ledger | `FreePos/CustomersScreen.tsx`, `components/tools/CustomerLedger/` |
| Statements | `components/tools/CustomerStatement/` |
| Send queue & templates | `Tuition/SendQueue.tsx`, `lib/tuition/messages.ts` |

---

## 8. Build phases

**Phase 1** — garment types, rate card, intake with counts, receipt printing,
order pipeline with status and WhatsApp updates. Shippable immediately.

**Phase 2** — tag numbering and printing, delivery reconciliation.

**Phase 3** — defects with photos, express handling, uncollected nag, pickup and
delivery slots.

**Phase 4** — account customers with monthly statements, reports, marketing page.

---

## 9. Open decisions

1. **One tag per piece, or one tag per line?** Per piece is correct and is what
   prevents losses, but a 20-shirt order then prints 20 labels — real cost, real
   time. Recommendation: per piece by default with a per-line option in Settings;
   confirm against what a shop actually does today.
2. **Do these shops own a label printer?** If most do not, tags need a fallback:
   printing a numbered strip on the 58mm receipt printer that gets cut manually,
   or handwritten numbers the app merely allocates. Check before building Phase 2.
3. **Weight-based items** — are curtains and bedsheets priced by kg widely enough
   to justify the dual pricing model, or is per-piece enough for launch?
4. **Defect photos** — useful for disputes, but is the counter really going to
   photograph a stain during a rush? Recommendation: keep it, default it off, and
   let the shop decide.
5. **Does the shop have a weekly off** that should shift promised dates? Add a
   `weeklyOffDays` setting if yes.
6. **Pickup-delivery routes** — the model has slots but no route planning. Is
   route sequencing a paid feature worth flagging, or out of scope entirely?
