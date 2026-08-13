# Free Hostel & PG Manager

### Full specification — pre-build

> Assumes the shared foundation in [`README.md`](./README.md).

---

## 1. Positioning

| | |
|---|---|
| **Route** | `/products/free-pg-hostel-software` |
| **Component root** | `components/tools/Hostel/` |
| **Data layer** | `lib/hostel/` |
| **Target user** | PG (paying guest) accommodation owners and small private hostels — 10 to 150 beds, usually run by one owner with a caretaker. Student hostels near colleges, working-women's PGs, working-men's lodges. |
| **The one job** | Know which beds are free, who owes rent, and what each room's electricity came to. |
| **Upsell** | New paid vertical: multi-property, tenant app, online rent collection. |

### Search intent

*pg management software free*, *hostel management software free download*,
*paying guest management app*, *rent management software for pg*,
*hostel fees management*, *pg room rent software India*.

### What makes it win

**Bed-level occupancy with a vacancy view.** PG owners think in beds, not rooms —
a 3-sharing room with one free bed is inventory. Every free tool models rooms
only, which makes it useless for the exact question the owner asks daily: what
can I sell today?

Second: **electricity apportionment**. Meter readings split per room or per bed
is the most tedious recurring calculation in this business, and it is done on
paper everywhere.

---

## 2. Data model

```ts
export type Property = {
  id: string;
  name: string;              // "Sai PG – Kothrud"
  address: string;
  /** Free tier supports one; the field exists so paid multi-property is additive. */
  active: boolean;
  createdAt: string;
};

export type RoomKind = "single" | "double" | "triple" | "quad" | "dorm" | "other";

export type Room = {
  id: string;
  propertyId: string;
  number: string;            // "101", "A-3"
  floor: string;
  kind: RoomKind;
  /** Number of beds; beds are generated from this. */
  capacity: number;
  /** Default rent per bed for this room. Overridable per tenant. */
  rentPerBed: number;
  /** Amenities affect price and are worth filtering on. */
  hasAc: boolean;
  hasAttachedBath: boolean;
  hasBalcony: boolean;
  /** Separate sub-meter for this room, if any. */
  meterNo: string;
  active: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type Bed = {
  id: string;
  roomId: string;
  label: string;             // "101-A"
  status: "vacant" | "occupied" | "blocked";
  blockedReason: string;
  createdAt: string;
};

export type TenantStatus = "active" | "notice" | "vacated";

export type Tenant = {
  id: string;
  code: string;              // "T-0042"
  name: string;
  phone: string;
  altPhone: string;
  email: string;
  photoDataUrl: string;
  /** KYC document images — the thing every PG owner is legally expected to hold. */
  idProofKind: "aadhaar" | "pan" | "passport" | "driving-licence" | "voter-id" | "other";
  idProofNumber: string;
  idProofPhotos: string[];
  guardianName: string;
  guardianPhone: string;
  guardianAddress: string;
  permanentAddress: string;
  occupation: string;        // "Student – MIT COE" / "Infosys"
  emergencyContactName: string;
  emergencyContactPhone: string;
  vehicleNo: string;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
};

/** A tenant's stay in a specific bed. A tenant may have several over time. */
export type Allotment = {
  id: string;
  tenantId: string;
  bedId: string;
  roomIdSnapshot: string;
  joinedOn: string;
  /** Agreed monthly rent for this tenant; may differ from the room default. */
  rent: number;
  /** Day of month rent falls due. */
  rentDueDay: number;
  securityDeposit: number;
  depositPaid: number;
  depositRefunded: number;
  depositDeductions: { id: string; reason: string; amount: number }[];
  /** Opted into the mess/food plan. */
  messOptIn: boolean;
  messChargeMonthly: number;
  /** Notice given, expected to leave. */
  noticeGivenOn: string | null;
  expectedVacateOn: string | null;
  vacatedOn: string | null;
  agreementEndsOn: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MeterReading = {
  id: string;
  /** Room-level, or property-level when a room has no sub-meter. */
  roomId: string | null;
  propertyId: string;
  /** "YYYY-MM" the reading closes. */
  month: string;
  previousReading: number;
  currentReading: number;
  units: number;             // current − previous
  ratePerUnit: number;
  amount: number;
  /** How the amount is divided among that room's occupants. */
  splitBy: "bed" | "room";
  readOn: string;
  createdAt: string;
};

export type ChargeKind = "rent" | "electricity" | "mess" | "deposit" | "other";

/** One billable line for one tenant for one month. */
export type Charge = {
  id: string;
  tenantId: string;
  allotmentId: string;
  month: string;             // "YYYY-MM"
  kind: ChargeKind;
  label: string;
  amount: number;
  dueDate: string;
  paidAmount: number;
  status: "pending" | "partial" | "paid" | "waived";
  /** Mess leave days deducted from this charge. */
  adjustmentNote: string;
  createdAt: string;
  updatedAt: string;
};

export type Payment = {
  id: string;
  receiptNo: string;
  tenantId: string;
  /** Payment can settle several charges at once. */
  allocations: { chargeId: string; amount: number }[];
  amount: number;
  date: string;
  mode: string;
  note: string;
  createdAt: string;
};

/** Days a tenant was away and does not pay mess for. */
export type MessLeave = {
  id: string;
  tenantId: string;
  fromDate: string;
  toDate: string;
  days: number;
  createdAt: string;
};

export type Complaint = {
  id: string;
  tenantId: string | null;
  roomId: string | null;
  category: "electrical" | "plumbing" | "wifi" | "cleaning" | "furniture" | "other";
  description: string;
  photoDataUrl: string;
  status: "open" | "in-progress" | "resolved" | "closed";
  raisedOn: string;
  resolvedOn: string | null;
  resolutionNote: string;
  createdAt: string;
  updatedAt: string;
};

export type Notice = {
  id: string;
  title: string;
  body: string;
  postedOn: string;
  /** Tenants it was sent to, for the send queue's resume state. */
  sentTo: string[];
};

export type HostelSettings = {
  id: "main";
  tenantCodePrefix: string;
  nextTenantSerial: number;
  receiptPrefix: string;
  nextReceiptNumber: number;
  defaultRentDueDay: number;      // 5
  /** Grace days before a charge counts as overdue. */
  graceDays: number;
  defaultElectricityRate: number;
  defaultSplitBy: "bed" | "room";
  messEnabled: boolean;
  defaultMessCharge: number;
  /** Per-day deduction for mess leave; usually messCharge ÷ 30. */
  messLeaveRateOverride: number | null;
  noticePeriodDays: number;       // 30
  paymentModes: string[];
  messageTemplates: Record<HostelTemplateKey, string>;
  receiptPaperSize: "58mm" | "80mm" | "a4";
  lastBackupAt: string | null;
  sheetSyncUrl: string;
  pinHash?: string;
  pinSalt?: string;
  autoLockMinutes?: number;
};

export type HostelTemplateKey =
  | "welcome" | "rentDue" | "rentOverdue"
  | "electricityBill" | "receipt" | "notice";
```

Object stores: `properties`, `rooms`, `beds`, `tenants`, `allotments`,
`meterReadings`, `charges`, `payments`, `messLeaves`, `complaints`, `notices`,
`hostelSettings`.

---

## 3. Screens

```ts
export type ScreenId =
  | "today"
  | "rooms"
  | "tenants"
  | "billing"
  | "electricity"
  | "complaints"
  | "reports"
  | "settings";
```

### 3.1 Today

- Occupancy headline: occupied / total beds, and the occupancy percentage.
- **Vacant beds** list — room, bed, rent, free since when. The sales list.
- **Rent overdue** — tenants past `dueDate + graceDays`, with amount and days late.
- **Due this week**.
- **Notice period ending** — tenants vacating soon, so the bed can be re-let.
- **Open complaints** count.
- Collections this month vs expected.

### 3.2 Rooms — the occupancy map

The signature screen. A floor-by-floor grid of rooms; each room shows its beds as
small blocks, coloured vacant / occupied / blocked. Tapping a bed shows the
occupant or offers to allot it.

- Filter by floor, AC/non-AC, sharing type, vacant only.
- **Vacancy forecast**: a date picker showing which beds will be free by then,
  accounting for notices given. This answers "can I promise a bed from the 1st?"
- Room detail: occupants, rent, meter number, amenities, complaint history.
- Add/edit room; changing `capacity` adds or removes beds, refusing to remove an
  occupied one.

### 3.3 Tenants

- List with search by name, phone, code, or room. Status chips.
- Filters: active, on notice, vacated, has dues, agreement expiring.
- **Tenant detail:**
  - Header: photo, name, code, room/bed, joined date, status, phone with
    call/WhatsApp.
  - **KYC** — ID proof images in a lightbox, guardian details, permanent address.
  - **Ledger** — every charge and payment, running balance, deposit held.
  - **Mess leave** log.
  - Actions: Collect payment · Add charge · Transfer bed · Give notice · Vacate ·
    Print agreement · Edit.
- **Allot a bed**: pick tenant (new or existing) → bed → rent (defaults to the
  room's) → due day → deposit → mess opt-in → joining date. Generates the first
  month's charges immediately.
- **Transfer bed**: moves the allotment, frees the old bed, keeps the ledger
  continuous.
- **Vacate**: settles dues, computes deposit refund after deductions, prints a
  settlement statement, frees the bed.

### 3.4 Billing

- **Monthly run** — one button that generates rent, mess and electricity charges
  for every active allotment for the chosen month. Idempotent: running it twice
  never duplicates.
- The run shows a preview table before committing, with per-tenant totals and any
  mess-leave adjustments applied.
- **Collect payment**: pick tenant → outstanding charges listed oldest first →
  amount (allocates automatically, editable) → mode → receipt.
- Partial payments allocate oldest-first by default.
- Receipt print with UPI QR.
- **Reminder run** via the send queue for due and overdue tenants.

### 3.5 Electricity

- Per month, per room: previous reading (auto-filled from last month), current
  reading, rate, split basis.
- Units and amount compute live.
- The amount divides among that room's current occupants — equally per bed, or
  charged to the room and split among however many are in it.
- A tenant who joined mid-month is charged pro-rata by days occupied.
- Bulk entry: a single list of all rooms for the month, tab through readings.
- On save, creates `electricity` charges for the month.

### 3.6 Complaints

Simple register: raise (tenant, room, category, description, photo), assign
status, resolve with a note. List filtered by open/resolved. Ageing on open ones.

### 3.7 Reports

- **Occupancy** over time, and average occupancy for the period.
- **Revenue**: rent, mess, electricity, other — collected vs billed per month.
- **Outstanding** — aged, tenant-wise.
- **Deposits held** — total liability, and refunds due for tenants on notice.
- **Electricity consumption** by room, month over month. Spots a faulty geyser or
  an unauthorised appliance.
- **Tenant churn**: joins and vacates per month, average length of stay.
- **Complaint stats** by category and resolution time.
- CSV export.

### 3.8 Settings

Property details · Rooms & beds · Rent defaults (due day, grace days) ·
Electricity (rate, split basis) · Mess (enabled, charge, leave rate) ·
Notice period · Payments (receipt prefix, modes, paper) · Message templates ·
Notices · Sheet sync · Backup & restore · Screen lock · Reset.

---

## 4. Business rules

| Rule | Definition |
|---|---|
| **Pro-rata rent** | Joining or vacating mid-month charges `rent × occupiedDays ÷ daysInMonth`, rounded to the rupee. |
| **Rent due date** | `rentDueDay` of the month; overdue after `+ graceDays`. |
| **Electricity split — bed** | `amount ÷ occupied beds in the room`, pro-rated by days occupied for partial months. |
| **Electricity split — room** | Same, but vacant beds absorb nothing; the occupants carry the whole amount. |
| **Mess leave deduction** | `days × (messLeaveRateOverride ?? messChargeMonthly ÷ 30)`, capped at the month's mess charge. |
| **Payment allocation** | Oldest unpaid charge first, across kinds, unless the user overrides. |
| **Deposit settlement** | `depositPaid − Σ deductions − outstanding dues`. A negative result is a balance payable by the tenant. |
| **Bed status** | Derived from active allotments, not stored as truth. `blocked` is the only manually set state. |
| **Monthly run idempotency** | Keyed on `(allotmentId, month, kind)`; existing rows are updated, never duplicated. |

---

## 5. Message templates

| Key | Default |
|---|---|
| `welcome` | `Welcome to {{propertyName}}, {{tenantName}}. Room {{room}}, bed {{bed}}. Rent ₹{{rent}} due on the {{dueDay}} of each month.` |
| `rentDue` | `Hi {{tenantName}}, rent for {{month}} — ₹{{amount}} — is due on {{dueDate}}. Pay by UPI: {{upiId}}` |
| `rentOverdue` | `Hi {{tenantName}}, ₹{{amount}} for {{month}} is overdue by {{daysLate}} days at {{propertyName}}. Please clear it.` |
| `electricityBill` | `{{propertyName}} — room {{room}} electricity for {{month}}: {{units}} units × ₹{{rate}} = ₹{{amount}}. Your share: ₹{{share}}.` |
| `receipt` | `Received ₹{{amount}} from {{tenantName}}. Receipt {{receiptNo}}. — {{propertyName}}` |
| `notice` | `{{propertyName}} notice: {{title}}\n{{body}}` |

---

## 6. Print outputs

| Output | Paper |
|---|---|
| Rent receipt | 58mm / 80mm / A4 |
| Electricity statement | A5 — room, readings, units, rate, split, per-tenant share |
| Tenant agreement | A4 — a fillable template with tenant, guardian, rent, deposit, notice period and house rules |
| Vacate settlement | A4 — dues, deposit, deductions, net payable |
| Tenant register | A4 — the KYC list, which is what a police verification request asks for |

---

## 7. Reuse map

| Need | Reuse |
|---|---|
| Recurring dues + collection | `lib/tuition/calc.ts` fee cycles — the closest existing analogue |
| Ledger view | `components/tools/CustomerLedger/` |
| Receipts + UPI QR | `lib/pos/receiptPdf.ts`, `lib/upi.ts` |
| Send queue & templates | `Tuition/SendQueue.tsx`, `lib/tuition/messages.ts` |
| CSV import | `Tuition/ImportStudents.tsx` |
| Document/photo capture | `lib/toolkit/logo.ts` resize helpers |
| Statement PDFs | `components/tools/statements/`, `components/tools/CustomerStatement/` |
| Settings accordion | `Tuition/SettingsScreen.tsx` |

---

## 8. Build phases

**Phase 1** — rooms and beds, tenants with KYC, allotment, monthly rent charges,
payments and receipts, the occupancy map. Shippable as "free PG rent management".

**Phase 2** — electricity readings and apportionment, mess charges and leave.

**Phase 3** — notice/vacate flow with deposit settlement, transfers, agreement
and settlement printing.

**Phase 4** — complaints, notices broadcast, full reports, marketing page.

---

## 9. Open decisions

1. **One property or many in the free tier?** The schema carries `propertyId`
   throughout so multi-property is additive. Recommendation: free = one property,
   multi-property is the first paid feature.
2. **Storing Aadhaar images.** PG owners are expected to collect ID, and the data
   never leaves the device — but Aadhaar specifically carries handling
   expectations beyond ordinary personal data. Decide whether to (a) store images
   at all, (b) store only the last four digits and a non-Aadhaar photo ID, or
   (c) store with a masking helper. **Resolve before Phase 1** — it is a schema
   decision, and it is the most sensitive data in any of the nine apps.
3. **Is the agreement template something we should ship?** A rent agreement is a
   legal document. Recommendation: ship a plainly-labelled *sample format* the
   owner edits, with no claim of legal sufficiency — or skip it and print only
   the tenant/room/rent facts.
4. **Mess leave rate** — `monthlyCharge ÷ 30` is the common convention but some
   PGs use a per-meal rate. Confirm whether per-meal tracking is needed or the
   daily rate is enough.
5. **Do tenants need any access at all** (view dues, raise a complaint)? That
   needs a server, so it is paid — but confirm it is the right upsell versus
   multi-property.
6. **Electricity pro-rata** adds real complexity for mid-month joiners. Confirm
   whether owners actually pro-rate electricity or just charge whoever is in the
   room at month end. Simpler is better if it matches practice.
