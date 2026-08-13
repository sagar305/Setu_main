# Free Salon & Spa Manager

### Full specification — pre-build

> Assumes the shared foundation in [`README.md`](./README.md).

---

## 1. Positioning

| | |
|---|---|
| **Route** | `/products/free-salon-software` |
| **Component root** | `components/tools/Salon/` |
| **Data layer** | `lib/salon/` |
| **Target user** | Unisex salons, ladies' beauty parlours, barber shops, spas and nail studios with 2–10 chairs and 2–12 staff. The owner is usually also a stylist. |
| **The one job** | Know what each stylist earned, and what was done to each client last time. |
| **Upsell** | New paid vertical (multi-branch, online booking page, staff app). |

### Search intent

*salon software free*, *beauty parlour billing software free download*,
*salon management software India*, *spa billing software free*,
*salon staff commission software*, *parlour billing app*.

### What makes it win

Two things, and they are the two things salon owners actually argue about:

1. **Colour formula memory.** What shade, what brand, what developer, how long.
   A returning client wants the same result; a stylist who was not there last
   time cannot reproduce it from memory. No free tool records it.
2. **Per-staff commission statements.** Salons run on commission and the monthly
   reconciliation is done on paper, badly, and causes fights. An app that prints
   each stylist's earnings, itemised, sells itself.

The third differentiator is **package liability** — knowing how much money the
salon has already taken for services it still owes.

---

## 2. Data model

```ts
export type ServiceCategory = {
  id: string;
  name: string;                  // "Hair", "Skin", "Nails", "Spa"
  sortOrder: number;
  colour: string;
};

/** Salon prices vary by hair length; model it as explicit variants. */
export type ServiceVariant = {
  id: string;
  label: string;                 // "Short", "Medium", "Long", "" for single-price
  price: number;
  durationMinutes: number;
};

export type Service = {
  id: string;
  name: string;                  // "Global colour", "Classic pedicure"
  categoryId: string;
  variants: ServiceVariant[];    // always ≥1; single-price services have one, label ""
  /** Consumables typically used; drives stock deduction and costing. */
  consumables: { productId: string; quantity: number }[];
  active: boolean;
  /** Which staff can perform it. Empty = anyone. */
  staffIds: string[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type CommissionRule =
  | { kind: "none" }
  | { kind: "percent"; servicePct: number; productPct: number }
  | { kind: "slab"; slabs: { upto: number; pct: number }[]; productPct: number };

export type Staff = {
  id: string;
  name: string;
  phone: string;
  role: string;                  // "Senior stylist", "Beautician", "Helper"
  photoDataUrl: string;
  joinedOn: string;
  /** Weekdays worked: 0 = Sunday. */
  workingDays: number[];
  shiftStart: string;
  shiftEnd: string;
  monthlySalary: number;         // 0 = pure commission
  commission: CommissionRule;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StaffLeave = {
  id: string;
  staffId: string;
  date: string;
  kind: "leave" | "half-day" | "week-off";
  reason: string;
};

export type Client = {
  id: string;
  code: string;
  name: string;
  phone: string;
  sex: "male" | "female" | "other";
  dob: string | null;
  anniversary: string | null;
  address: string;
  /** Allergies, sensitivities, "no ammonia". Shown at billing and at booking. */
  alerts: string[];
  preferredStaffId: string | null;
  notes: string;
  photoDataUrl: string;
  createdAt: string;
  updatedAt: string;
};

/** The differentiator: what was actually done, in reproducible detail. */
export type FormulaRecord = {
  id: string;
  clientId: string;
  date: string;
  billId: string | null;
  staffId: string | null;
  kind: "colour" | "smoothening" | "perm" | "cut" | "other";
  /** "Loreal Majirel 6.66 + 20 vol, 1:1.5, 35 min" — free text on purpose. */
  formula: string;
  brand: string;
  shade: string;
  developer: string;
  processingMinutes: number | null;
  result: string;                // "slightly warm, go 1 level cooler next time"
  beforePhotoDataUrl: string;
  afterPhotoDataUrl: string;
  createdAt: string;
};

export type AppointmentStatus =
  | "booked" | "confirmed" | "arrived" | "in-service" | "done" | "no-show" | "cancelled";

export type Appointment = {
  id: string;
  clientId: string;
  staffId: string;
  date: string;
  startTime: string;
  /** Sum of the chosen services' variant durations; editable. */
  durationMinutes: number;
  /** What was booked; the bill may differ. */
  serviceRefs: { serviceId: string; variantId: string }[];
  status: AppointmentStatus;
  source: "walk-in" | "phone" | "whatsapp" | "repeat";
  note: string;
  remindedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Retail and consumable stock. Deliberately small — this is not a full POS. */
export type Product = {
  id: string;
  name: string;
  brand: string;
  sku: string;
  kind: "retail" | "consumable" | "both";
  sellingPrice: number;
  costPrice: number;
  stock: number;
  unit: string;                  // "ml", "piece"
  lowStockAt: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BillLineKind = "service" | "product" | "package-redeem" | "wallet-redeem";

export type BillLine = {
  id: string;
  kind: BillLineKind;
  refId: string;                 // serviceId | productId | packageId
  variantId: string | null;
  label: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  /** Who performed/sold this line. The whole commission model rests on it. */
  staffId: string | null;
  taxRate: number;
  amount: number;                // after discount, before tax if exclusive
};

export type Bill = {
  id: string;
  invoiceNo: string;
  clientId: string | null;       // null = quick walk-in, no client record
  appointmentId: string | null;
  date: string;
  lines: BillLine[];
  /** Bill-level discount, distributed pro-rata across lines for commission. */
  discount: number;
  subtotal: number;
  taxTotal: number;
  total: number;
  /** Tips are excluded from revenue and from commission; paid out separately. */
  tips: { staffId: string; amount: number }[];
  payments: { mode: string; amount: number }[];
  status: "paid" | "partial" | "unpaid";
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type PackageKind = "wallet" | "sessions";

export type PackageTemplate = {
  id: string;
  name: string;                  // "Pay 10,000 get 12,000", "6 facials"
  kind: PackageKind;
  price: number;
  /** wallet */
  walletValue: number | null;
  /** sessions */
  items: { serviceId: string; variantId: string; count: number }[];
  validityDays: number | null;
  active: boolean;
  createdAt: string;
};

export type ClientPackage = {
  id: string;
  clientId: string;
  templateId: string;
  nameSnapshot: string;
  kind: PackageKind;
  purchasedOn: string;
  expiresOn: string | null;
  pricePaid: number;
  /** wallet */
  walletTotal: number | null;
  walletUsed: number;
  /** sessions */
  items: { serviceId: string; variantId: string; count: number; used: number }[];
  status: "active" | "exhausted" | "expired";
  createdAt: string;
  updatedAt: string;
};

export type Voucher = {
  id: string;
  code: string;
  value: number;
  issuedTo: string;
  issuedOn: string;
  expiresOn: string | null;
  redeemedOn: string | null;
  redeemedBillId: string | null;
};

export type SalonSettings = {
  id: "main";
  clientCodePrefix: string;
  nextClientSerial: number;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  openTime: string;
  closeTime: string;
  slotMinutes: 15 | 30;
  weeklyOffDays: number[];
  holidays: { id: string; date: string; reason: string }[];
  taxEnabled: boolean;
  defaultTaxRate: number;
  taxInclusive: boolean;
  paymentModes: string[];
  /** Days after which a client is "due for a visit" if no per-client average. */
  defaultVisitGapDays: number;   // 30
  messageTemplates: Record<SalonTemplateKey, string>;
  receiptPaperSize: "58mm" | "80mm" | "a4";
  lastBackupAt: string | null;
  sheetSyncUrl: string;
  pinHash?: string;
  pinSalt?: string;
  autoLockMinutes?: number;
};

export type SalonTemplateKey =
  | "bookingConfirmed" | "bookingReminder" | "dueForVisit"
  | "birthday" | "packageExpiring" | "thankYou";
```

Object stores: `serviceCategories`, `services`, `staff`, `staffLeaves`,
`clients`, `formulas`, `appointments`, `products`, `bills`, `packageTemplates`,
`clientPackages`, `vouchers`, `salonSettings`.

---

## 3. Screens

```ts
export type ScreenId =
  | "today"
  | "appointments"
  | "clients"
  | "billing"
  | "services"
  | "staff"
  | "reports"
  | "settings";
```

### 3.1 Today

- Chair-wise strip: each active staff member as a column showing who they are
  with now and what is next.
- Appointment list with status actions: Confirm → Arrived → Start → Done → Bill.
- Walk-in add.
- Stats: clients served, revenue so far, tips collected, staff on leave.
- Alerts: packages expiring this week, low stock, birthdays today.

### 3.2 Appointments

- **Staff-column day view.** Columns are stylists, rows are time. This is the
  correct mental model for a salon and differs from Clinic's doctor columns only
  in density — a salon books 15-minute slots and long services span many.
- Booking: client search-or-create → services (multi-select, each with a variant)
  → duration auto-summed → staff (defaults to `preferredStaffId`) → time.
- Client alerts surface at booking time, not just at billing.
- Drag to move between times and staff columns.
- Overlap is warned, not blocked.
- Leave and week-offs render as blocked columns.
- Reminder run for tomorrow, via the send queue.

### 3.3 Clients

- List with search, sorted by last visit.
- Filters: due for a visit, has active package, birthday this month, new this
  month, no visit in 90 days.
- **Client detail:**
  - Header: name, code, phone, preferred stylist, total spend to date, visit
    count, average gap between visits.
  - **Alerts banner** when `alerts` is non-empty.
  - **Visit history** — each bill with services, staff and amount.
  - **Formula history** — the colour/chemical record, newest first, each with
    before/after photos and the "result" note. Copy-to-new-record action so the
    stylist can repeat last time's formula with one edit.
  - **Packages** — active packages with remaining balance or sessions.
  - Actions: Book · Bill now · Add formula record · WhatsApp · Edit.

### 3.4 Billing

The most-used screen after Today.

- Start from an appointment (pre-filled) or blank.
- Client search-or-create, or "walk-in, no record".
- **Add service lines**: category tabs → service → variant → **staff picker per
  line**. The per-line staff assignment is mandatory and must be one tap, because
  every commission report depends on it.
- **Add product lines** for retail sales, with their own staff attribution.
- **Package redemption**: if the client has an active package covering a service,
  the line offers "Redeem from package" and bills at zero, decrementing the
  package. Wallet packages deduct the service value from the wallet balance.
- Voucher code entry.
- Line and bill-level discounts.
- **Tips**: entered per staff at the end, excluded from revenue and commission.
- Payment split across modes (cash + UPI is common).
- Print/share invoice; consumables deduct from stock on save.

### 3.5 Services

Category-grouped service list with variants and durations, inline price editing,
drag to reorder, active toggles, and the consumable mapping per service.

### 3.6 Staff

- Staff list with today's status (in, on leave, off).
- **Staff detail:**
  - Profile, shift, working days, leave calendar.
  - Commission rule editor: none / percent / slab, with separate product percent.
  - **Earnings statement** for a chosen month: services performed, revenue
    generated, commission earned, product sales and their commission, tips,
    salary, total payable. Printable and shareable — this is the artifact the
    owner hands over on payday.
  - Performance: clients served, repeat-client share, average bill value.

### 3.7 Reports

- Revenue by day / service / category / staff.
- **Staff commission summary** for the month, all staff on one page.
- **Package liability** — money collected for services not yet delivered.
  Outstanding wallet balances + unredeemed sessions valued at current price.
- Client retention: new vs repeat, per month.
- Due-for-a-visit list.
- Product stock: consumed vs sold, low stock, retail margin.
- Peak hours and peak days.
- CSV export.

### 3.8 Settings

Salon details · Services & categories · Products · Staff & commission ·
Packages & vouchers · Schedule (hours, slot length, offs, holidays) ·
Tax · Billing (prefix, modes, paper) · Message templates · Sheet sync ·
Backup & restore · Screen lock · Reset.

---

## 4. Business rules

| Rule | Definition |
|---|---|
| **Bill discount distribution** | A bill-level discount is spread across lines pro-rata by `amount`, so commission is computed on the net each staff member actually generated. |
| **Commission — percent** | `servicePct × net service amount` per line, `productPct × net product amount`. |
| **Commission — slab** | Slabs apply to the staff member's total monthly net service revenue; the matching slab's percent applies to the whole amount (not marginal). Confirm — see open decision 3. |
| **Tips** | Never in revenue, never in commission, always paid through in full. |
| **Package redemption value** | A session redemption bills at 0 and decrements `used`. A wallet redemption deducts the service's current price from `walletUsed`. |
| **Package liability** | `Σ (walletTotal − walletUsed)` + `Σ (remaining sessions × current variant price)` for all `active` packages. |
| **Due for a visit** | Client's own mean gap between visits (needs ≥3 visits), else `defaultVisitGapDays`. Due when `today − lastVisit > gap × 1.2`. |
| **Service duration** | Sum of chosen variants' `durationMinutes`; editable per appointment. |
| **Consumable deduction** | On bill save, each service line deducts its mapped consumables × line quantity. |

---

## 5. Message templates

| Key | Default |
|---|---|
| `bookingConfirmed` | `Hi {{clientName}}, your appointment at {{salonName}} is confirmed for {{date}} at {{time}} with {{staffName}}.` |
| `bookingReminder` | `See you tomorrow at {{salonName}}, {{time}}. Reply to reschedule.` |
| `dueForVisit` | `Hi {{clientName}}, it has been {{days}} days since your last visit to {{salonName}}. Shall we book your usual with {{staffName}}?` |
| `birthday` | `Happy birthday {{clientName}}! Enjoy a treat on us this month at {{salonName}} 🎉` |
| `packageExpiring` | `Hi {{clientName}}, your {{packageName}} at {{salonName}} expires on {{date}} with {{remaining}} left. Book soon.` |
| `thankYou` | `Thank you for visiting {{salonName}}, {{clientName}}. Invoice {{invoiceNo}} — ₹{{amount}}.` |

---

## 6. Reuse map

| Need | Reuse |
|---|---|
| Cart/billing mechanics, tax handling | `lib/pos/calc.ts`, `FreePos/BillingScreen.tsx` |
| Products & stock | `lib/pos/types.ts` Product, `FreePos/ProductsScreen.tsx` |
| Invoice/receipt printing | `lib/pos/receiptPdf.ts`, `components/tools/InvoiceGenerator/` |
| Day-view scheduling | `components/tools/AppointmentBook/AppointmentBookTool.tsx` |
| Client register patterns | `FreePos/CustomersScreen.tsx` |
| Send queue, templates | `Tuition/SendQueue.tsx`, `lib/tuition/messages.ts` |
| Category-tabbed item picker | `FreeDine/ItemChooserModal.tsx` |
| Settings accordion | `Tuition/SettingsScreen.tsx` |

`FreeDine/ItemChooserModal.tsx` is the closest existing analogue to the salon
service picker — category tabs, fast tap targets, quantity. Start there.

---

## 7. Build phases

**Phase 1** — services, staff, clients, billing with per-line staff attribution,
invoice printing. Shippable as "free salon billing software".

**Phase 2** — commission rules and the per-staff earnings statement. This is the
feature that makes people switch; do not defer it past Phase 2.

**Phase 3** — appointments day view, reminders, client detail with formula
records and photos.

**Phase 4** — packages, wallets, vouchers, liability report; products and
consumable deduction.

**Phase 5** — full reports, due-for-a-visit engine, marketing page.

---

## 8. Open decisions

1. **Is per-line staff attribution mandatory?** It is what makes commission work,
   but it is friction on every bill. Recommendation: mandatory, with a default of
   "the staff on the appointment" and a one-tap override, so the common case
   costs nothing.
2. **Do we need a full inventory module, or is a light product list enough?**
   Salons do track shampoo and colour tubes, but a full POS inventory would
   double the app. Recommendation: light list with manual stock adjustments and
   consumable deduction; anyone needing more can run the Browser POS alongside.
3. **Slab commission — cumulative or marginal?** The model above applies the
   matched slab to the whole amount. Real salons vary. Confirm with an actual
   owner before building; getting this wrong makes the statement useless.
4. **Do tips get split with helpers?** Some salons pool tips. Recommendation:
   free tier attributes tips to one person; pooling is a paid feature.
5. **Colour formula as free text or structured fields?** Structured
   (brand/shade/developer/time) is queryable but never covers every technique;
   free text always works but cannot be reported on. The model above stores both.
   Confirm the stylist-facing form does not feel like data entry.
6. **Before/after photos** will dominate storage. Cap dimensions and quality, and
   decide whether backups include them (suggest: an option, default off).
7. **GST** — do small salons bill with GST at all? Many are under the threshold.
   Recommendation: tax off by default, easily switched on.
