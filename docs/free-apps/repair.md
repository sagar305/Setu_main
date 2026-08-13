# Free Repair Job Card

### Full specification — pre-build

> Assumes the shared foundation in [`README.md`](./README.md).

---

## 1. Positioning

| | |
|---|---|
| **Route** | `/products/free-repair-shop-software` |
| **Component root** | `components/tools/Repair/` |
| **Data layer** | `lib/repair/` |
| **Target user** | Mobile phone repair shops, laptop/computer service centres, home-appliance technicians, two-wheeler mechanics, watch and camera repair. One to six technicians. |
| **The one job** | Know where every device in the shop is, and prove what condition it arrived in. |
| **Upsell** | Retail POS (these shops also sell accessories) and the paid multi-user service-centre tier. |

### Search intent

*mobile repair shop software free*, *job card software free download*,
*computer service centre software*, *repair shop management software India*,
*service job card format*, *mobile shop billing software with job card*.

### What makes it win

**The condition-in checklist with photos.** Every repair shop has had the
argument: "this scratch wasn't there before." A timestamped intake record with
photos and a customer signature ends it. That is the feature owners will describe
to other owners, and no free tool offers it.

Second: **uncollected devices**. Repair shops accumulate dead capital in devices
customers never return for. A list of them, with an automatic nag cycle, is found
money.

---

## 2. Data model

```ts
export type DeviceKind =
  | "mobile" | "laptop" | "desktop" | "tablet"
  | "tv" | "appliance" | "two-wheeler" | "watch" | "other";

export type JobStatus =
  | "received"
  | "diagnosing"
  | "estimate-sent"
  | "approved"
  | "in-repair"
  | "awaiting-parts"
  | "ready"
  | "delivered"
  | "returned-unrepaired"
  | "cancelled";

export type Customer = {
  id: string;
  name: string;
  phone: string;
  altPhone: string;
  address: string;
  /** Shops that serve businesses need this; blank for walk-ins. */
  companyName: string;
  gstin: string;
  createdAt: string;
  updatedAt: string;
};

/** The condition of the device as received. Evidence, not description. */
export type ConditionItem = {
  id: string;
  label: string;              // "Screen cracked", "Dents on body", "Water damage"
  present: boolean;
  note: string;
};

export type Job = {
  id: string;
  jobNo: string;              // "JC-0412"
  customerId: string;
  deviceKind: DeviceKind;
  brand: string;
  model: string;
  /** IMEI, serial number, chassis number — whatever identifies this unit. */
  serialNo: string;
  colour: string;
  /** Ticked from a per-device-kind checklist, plus free text. */
  reportedProblems: string[];
  problemNote: string;
  conditionIn: ConditionItem[];
  /** Photos taken at intake. The evidence. */
  intakePhotos: string[];     // data URLs
  accessories: string[];      // "Charger", "Cover", "SIM", "Memory card"
  /**
   * Device unlock code. Stored locally like everything else, but the UI must
   * warn the user and allow leaving it blank. See open decision 2.
   */
  unlockCode: string;
  estimateAmount: number | null;
  estimateApprovedOn: string | null;
  promisedDate: string | null;
  status: JobStatus;
  technicianId: string | null;
  priority: "normal" | "urgent";
  /** Signature captured on a canvas at intake. */
  intakeSignatureDataUrl: string;
  /** Visible to the customer on printouts and messages. */
  customerNotes: string;
  /** Never printed, never sent. */
  internalNotes: string;
  partsUsed: PartUsage[];
  labourCharge: number;
  diagnosis: string;
  workDone: string;
  /** Warranty on this repair, in days, from delivery. 0 = none. */
  warrantyDays: number;
  deliveredOn: string | null;
  deliverySignatureDataUrl: string;
  /** Set when this job is a warranty claim against an earlier one. */
  warrantyClaimOfJobId: string | null;
  billId: string | null;
  statusHistory: StatusChange[];
  createdAt: string;
  updatedAt: string;
};

export type StatusChange = {
  id: string;
  from: JobStatus | null;
  to: JobStatus;
  at: string;
  note: string;
  notifiedAt: string | null;
};

export type PartUsage = {
  id: string;
  partId: string | null;      // null = ad-hoc part not in stock
  name: string;
  quantity: number;
  costPrice: number;          // what the shop paid — drives real margin
  sellingPrice: number;       // what the customer is charged
  /** Warranty the part supplier gives, in days. */
  supplierWarrantyDays: number;
};

export type Part = {
  id: string;
  name: string;
  sku: string;
  compatibleWith: string;     // "iPhone 11, iPhone 11 Pro"
  costPrice: number;
  sellingPrice: number;
  stock: number;
  lowStockAt: number;
  supplierName: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Technician = {
  id: string;
  name: string;
  phone: string;
  speciality: string;
  active: boolean;
  createdAt: string;
};

export type Bill = {
  id: string;
  invoiceNo: string;
  jobId: string;
  customerId: string;
  date: string;
  partLines: { label: string; quantity: number; unitPrice: number; amount: number }[];
  labourCharge: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paid: number;
  paymentMode: string;
  createdAt: string;
};

export type RepairSettings = {
  id: "main";
  jobPrefix: string;
  nextJobNumber: number;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  deviceKinds: DeviceKind[];          // which to show; a phone shop hides the rest
  /** Per device kind: the intake checklists. */
  problemPresets: Record<string, string[]>;
  conditionPresets: Record<string, string[]>;
  accessoryPresets: Record<string, string[]>;
  defaultWarrantyDays: number;        // 90
  /** Job goes amber after this many days, red after the second. */
  agingAmberDays: number;             // 3
  agingRedDays: number;               // 7
  /** Nag interval for devices ready but not collected. */
  uncollectedNagDays: number;         // 3
  taxEnabled: boolean;
  defaultTaxRate: number;
  paymentModes: string[];
  captureUnlockCode: boolean;         // default false
  messageTemplates: Record<RepairTemplateKey, string>;
  receiptPaperSize: "58mm" | "80mm" | "a4";
  lastBackupAt: string | null;
  sheetSyncUrl: string;
  pinHash?: string;
  pinSalt?: string;
  autoLockMinutes?: number;
};

export type RepairTemplateKey =
  | "received" | "estimateRequest" | "inRepair"
  | "awaitingParts" | "ready" | "uncollected" | "delivered";
```

Object stores: `customers`, `jobs`, `parts`, `technicians`, `bills`,
`repairSettings`. Index `jobs.status`, `jobs.jobNo`, `jobs.customerId`,
`customers.phone`.

---

## 3. Screens

```ts
export type ScreenId =
  | "jobs"
  | "intake"
  | "customers"
  | "parts"
  | "billing"
  | "reports"
  | "settings";
```

### 3.1 Jobs — the board

The default screen and the shop's whole picture.

- **Status columns** on desktop (a horizontal board), **status tabs** on mobile.
  Columns: Received · Diagnosing · Estimate sent · Approved · In repair ·
  Awaiting parts · Ready · Delivered.
- Each card: job no, device (brand + model), customer name, days in shop,
  technician avatar, priority flag, estimate amount.
- **Aging colour**: cards go amber past `agingAmberDays`, red past
  `agingRedDays`. A shop full of red cards is a shop with a problem, visible at a
  glance from the doorway.
- Move a card to change status; each move offers to send the matching WhatsApp
  template and appends a `StatusChange`.
- Filters: technician, device kind, urgent only, overdue promise date.
- Search by job no, phone, IMEI/serial, customer name. IMEI search matters —
  customers call and read out the number.

### 3.2 Intake — the new-job wizard

Four steps, each a single screen on mobile. Target: 90 seconds.

1. **Customer** — phone-first search; existing customers auto-fill, new ones need
   only name and phone.
2. **Device** — kind (chips), brand, model, serial/IMEI, colour. Brand and model
   autocomplete from previously entered values.
3. **Problem & condition** —
   - Reported problems from the per-kind preset checklist, plus free text.
   - **Condition checklist**: preset items each toggled present/absent with an
     optional note.
   - **Photos**: camera capture, multiple, required by default when any condition
     item is marked present.
   - Accessories received, from presets.
   - Unlock code field, shown only when `captureUnlockCode` is on, with a plain
     warning about what is being stored.
4. **Terms** — estimate amount (optional), promised date, technician,
   priority, then the **customer signature** on a canvas.

On save: print the job slip (58mm or A5), send the `received` WhatsApp, and drop
the card into the board.

### 3.3 Job detail

- Header: job no, status pill, device, customer with call/WhatsApp, days in shop.
- **Intake record** — condition checklist, photos in a lightbox, accessories,
  signature. Read-only after creation; corrections are appended, not edited.
- **Diagnosis & work done** — technician's fields.
- **Parts used** — add from stock (decrements) or ad hoc. Each line shows cost
  and selling price; the margin is visible while working, not just in reports.
- **Labour charge**.
- **Status timeline** — every change with timestamp, note, and whether the
  customer was notified.
- **Notes** — customer-visible and internal, clearly separated.
- Actions: Change status · Send update · Print slip · Create bill · Deliver ·
  Return unrepaired · Raise warranty claim.

### 3.4 Delivery

- Opens from `ready`. Shows the bill, collects payment, captures a **delivery
  signature**, sets `warrantyDays` (defaults from settings), stamps
  `deliveredOn`.
- Prints the invoice with the warranty terms and expiry date on it.
- Sends the `delivered` message with the warranty end date.

### 3.5 Warranty

Not a nav screen — a lookup and an action.

- **Warranty lookup**: enter a job number, IMEI, or phone; see whether the repair
  is still covered, and until when.
- **Raise a claim**: creates a new job with `warrantyClaimOfJobId` set,
  pre-filled with the same device, and marked so it does not count as new revenue
  in reports. The original job's card links to the claim.

### 3.6 Parts

Simple stock list: name, compatibility, cost, selling price, stock, low-stock
flag, supplier. Add/adjust stock manually. Low-stock list on the reports screen.
Deliberately not a full inventory system.

### 3.7 Reports

- **Jobs by status** — the aging picture, and the count of devices physically in
  the shop.
- **Uncollected devices** — `ready` for more than N days, with total value tied
  up. Nag send queue attached.
- **Turnaround time** — average days from received to delivered, by device kind
  and by technician.
- **Technician throughput** — jobs completed, average turnaround, revenue.
- **Margin** — revenue minus parts cost, per job and in total. The only number
  that tells these shops whether they are actually making money.
- **Repeat failures** — jobs on the same serial number within 90 days, and
  warranty claims by device model. Tells the owner which parts supplier is bad.
- **Estimate conversion** — estimates sent vs approved.
- CSV export.

### 3.8 Settings

Shop details · Device kinds shown · Problem / condition / accessory presets per
kind · Technicians · Aging thresholds · Warranty defaults · Uncollected nag
interval · Unlock-code capture toggle · Tax · Billing (prefixes, modes, paper) ·
Message templates · Sheet sync · Backup & restore · Screen lock · Reset.

---

## 4. Business rules

| Rule | Definition |
|---|---|
| **Job number** | `jobPrefix + zero-padded serial`, never reused, never reordered. |
| **Days in shop** | `today − createdAt` for anything not `delivered` / `cancelled` / `returned-unrepaired`. |
| **Aging** | Amber at `agingAmberDays`, red at `agingRedDays`, measured on days in shop. |
| **Uncollected** | `status = ready` and `today − (last status change to ready) > uncollectedNagDays`. Re-nags every interval. |
| **Margin per job** | `total − Σ(partsUsed.costPrice × quantity)`. Labour is pure margin. |
| **Warranty validity** | `deliveredOn + warrantyDays`. A claim raised inside that window is free by default; the technician can still bill parts. |
| **Warranty claims** | Excluded from revenue reports; counted in a separate rework metric. |
| **Intake record immutability** | `conditionIn`, `intakePhotos` and `intakeSignatureDataUrl` cannot be edited after the job is saved. Anything later goes in notes. This is the whole point of the feature. |
| **Status notifications** | Each `StatusChange` may be notified once; `notifiedAt` guards duplicates. |

---

## 5. Message templates

| Key | Default |
|---|---|
| `received` | `{{shopName}}: received your {{device}} — job {{jobNo}}. We will update you. Est. ready {{promisedDate}}.` |
| `estimateRequest` | `{{shopName}}: your {{device}} ({{jobNo}}) needs {{workSummary}}. Estimate ₹{{amount}}. Reply YES to approve.` |
| `inRepair` | `{{shopName}}: repair started on your {{device}} ({{jobNo}}).` |
| `awaitingParts` | `{{shopName}}: we are waiting for a part for your {{device}} ({{jobNo}}). New estimated date: {{promisedDate}}.` |
| `ready` | `{{shopName}}: your {{device}} is ready for pickup. Job {{jobNo}}, amount ₹{{amount}}. Pay by UPI: {{upiId}}` |
| `uncollected` | `{{shopName}}: your {{device}} ({{jobNo}}) has been ready since {{readyDate}}. Please collect it.` |
| `delivered` | `{{shopName}}: thank you. Your {{device}} is covered by warranty until {{warrantyEnd}}. Invoice {{invoiceNo}}.` |

Variables: `shopName`, `device`, `jobNo`, `promisedDate`, `amount`,
`workSummary`, `readyDate`, `warrantyEnd`, `invoiceNo`, `upiId`, `customerName`.

---

## 6. Print outputs

| Output | Paper | Contents |
|---|---|---|
| Job slip (customer copy) | 58mm or A5 | Job no, date, device, serial, reported problem, condition summary, accessories, estimate, promised date, terms, shop details |
| Job slip (shop copy / device tag) | 58mm | Job no + device + customer name, sized to tape to the device |
| Estimate | A5 | Itemised parts and labour, validity |
| Invoice | 58mm / 80mm / A4 | Parts, labour, tax, total, warranty terms and expiry |

The device tag should also be printable via the existing
`components/tools/LabelPrinter/`.

---

## 7. Reuse map

| Need | Reuse |
|---|---|
| Board / status-flow UI | `FreeDine/KitchenScreen.tsx` (ticket states) |
| Customer register | `FreePos/CustomersScreen.tsx` |
| Parts stock | `lib/pos/types.ts` Product, `FreePos/ProductsScreen.tsx` |
| Invoice & receipt | `lib/pos/receiptPdf.ts`, `components/tools/InvoiceGenerator/` |
| Device tag printing | `components/tools/LabelPrinter/` |
| Photo capture & data-URL handling | `lib/toolkit/logo.ts` (resize/compress helpers) |
| Send queue & templates | `Tuition/SendQueue.tsx`, `lib/tuition/messages.ts` |
| Settings accordion | `Tuition/SettingsScreen.tsx` |

---

## 8. Build phases

**Phase 1** — intake wizard with condition checklist, photos and signature; the
jobs board; status changes with WhatsApp updates; job slip printing. This alone
is the differentiator and is shippable.

**Phase 2** — parts, labour, billing, delivery with signature, invoice printing.

**Phase 3** — warranty tracking, claims, uncollected nag cycle.

**Phase 4** — reports (margin, turnaround, repeat failures), technicians,
presets management, marketing page.

---

## 9. Open decisions

1. **Which device kinds do we ship presets for at launch?** Presets are what make
   intake fast, and they are per-trade. Recommendation: mobile and laptop at
   launch (largest search volume), appliance and two-wheeler in Phase 4.
2. **The unlock-code field.** It is genuinely useful — technicians need to test
   the device — and it is the single most sensitive thing this app would store.
   The model defaults `captureUnlockCode` to **false** and warns when enabled.
   Confirm that is the right posture, or drop the field entirely and let shops
   keep using paper for it.
3. **Signature capture** — is a canvas signature on a phone screen acceptable to
   shop owners as evidence, or do they only trust a printed slip the customer
   signs on paper? Ask two shops before building the canvas.
4. **Photo storage.** Intake photos are the bulk of the data. Cap at, say, 4
   photos per job at 1024px/0.7 quality, and decide whether backups include them.
   A 500-job backup with photos will be very large.
5. **Do we need a customer-facing status page** ("track your repair")? It needs a
   server, so it is a paid feature — but it is the most requested thing in this
   category. Flag it as the headline upsell.
6. **Estimate approval by WhatsApp reply** cannot be read back by the app. The
   technician marks approval manually. Confirm that is acceptable, or whether
   approval should just be a verbal-and-tick flow with no message at all.
