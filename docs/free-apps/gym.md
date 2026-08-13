# Free Gym & Membership Manager

### Full specification — pre-build

> Assumes the shared foundation in [`README.md`](./README.md).

---

## 1. Positioning

| | |
|---|---|
| **Route** | `/products/free-gym-software` |
| **Component root** | `components/tools/Gym/` |
| **Data layer** | `lib/gym/` |
| **Target user** | Independent neighbourhood gyms (100–600 members), fitness studios, yoga and dance classes, martial arts and swimming academies. Operated by the owner or a single front-desk person. |
| **The one job** | Know who is expiring, who has not paid, and who has stopped coming. |
| **Upsell** | New paid vertical, or bundled into the Clinic/appointments platform. |

### Why it is the cheapest of the nine

The domain is structurally the Tuition app: people, recurring money on a cycle,
attendance, and reminders. `lib/tuition/` gives us `Batch`→`Plan`,
`Student`→`Member`, `FeeCycle`→`Due`, plus attendance, receipts, the send queue
and CSV import essentially intact. Build Gym second, right after Clinic, while
that code is fresh.

### Search intent

*gym management software free*, *gym software free download*,
*gym membership management app*, *free fitness studio software India*,
*gym fees management software*, *gym attendance app*.

### What makes it win

Two features that free tools reliably lack:

1. **Membership freeze/hold** that auto-extends the expiry date. Every Indian gym
   does this — for travel, injury, exams — and every free tool forces the owner
   to fudge dates manually.
2. **The measurement log with a trend line.** It gives the member a reason to
   engage and the trainer a reason to open the app daily, which is what makes it
   sticky beyond the monthly billing run.

---

## 2. Data model

```ts
export type PlanKind = "duration" | "sessions";

export type Plan = {
  id: string;
  name: string;                 // "Quarterly – Gym only", "PT 12 sessions"
  kind: PlanKind;
  /** duration plans */
  durationDays: number | null;  // 30, 90, 180, 365
  /** session plans */
  sessionCount: number | null;
  price: number;
  admissionFee: number;         // charged once, on the first purchase
  description: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type AddOn = {
  id: string;
  name: string;                 // "Locker", "Steam", "Diet plan"
  price: number;
  durationDays: number | null;  // null = one-time
  active: boolean;
};

export type MemberStatus = "active" | "expired" | "frozen" | "cancelled";

export type Member = {
  id: string;
  code: string;                 // "GYM-0231"
  name: string;
  phone: string;
  altPhone: string;
  email: string;
  dob: string | null;           // drives the birthday list
  sex: "male" | "female" | "other";
  address: string;
  photoDataUrl: string;
  joinedOn: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  /** Free text: "asthma", "knee surgery 2023". Shown to the trainer. */
  healthNotes: string;
  goal: "weight-loss" | "weight-gain" | "fitness" | "strength" | "other" | "";
  trainerId: string | null;
  status: MemberStatus;
  customFields: { id: string; label: string; value: string }[];
  createdAt: string;
  updatedAt: string;
};

/** One purchased plan. A member can hold several (gym + PT) at once. */
export type Membership = {
  id: string;
  memberId: string;
  planId: string;
  planNameSnapshot: string;     // plans get edited; the sold terms must not move
  kind: PlanKind;
  startDate: string;
  /** duration plans: startDate + durationDays + total frozen days */
  endDate: string | null;
  /** session plans */
  sessionsTotal: number | null;
  sessionsUsed: number;
  price: number;
  admissionFee: number;
  discount: number;
  addOnIds: string[];
  /** Total price after add-ons and discount; the amount dues are raised against. */
  payable: number;
  status: "active" | "expired" | "frozen" | "cancelled";
  cancelledOn: string | null;
  cancelReason: string;
  createdAt: string;
  updatedAt: string;
};

/** A hold. endDate is pushed out by the number of days frozen. */
export type Freeze = {
  id: string;
  membershipId: string;
  fromDate: string;
  toDate: string;
  reason: string;
  /** Set when the freeze has been applied to the membership endDate. */
  appliedDays: number;
  createdAt: string;
};

export type CheckIn = {
  id: string;
  memberId: string;
  date: string;                 // "YYYY-MM-DD", indexed
  at: string;                   // full ISO timestamp
  /** Set when this check-in consumed a PT session. */
  membershipId: string | null;
  method: "qr" | "search" | "manual";
  trainerId: string | null;
};

export type Measurement = {
  id: string;
  memberId: string;
  date: string;
  weightKg: number | null;
  heightCm: number | null;
  bmi: number | null;
  chestCm: number | null;
  waistCm: number | null;
  hipsCm: number | null;
  armCm: number | null;
  thighCm: number | null;
  bodyFatPct: number | null;
  notes: string;
  createdAt: string;
};

export type Trainer = {
  id: string;
  name: string;
  phone: string;
  speciality: string;
  active: boolean;
  createdAt: string;
};

/** A scheduled amount owed, generated when a membership is sold. */
export type Due = {
  id: string;
  memberId: string;
  membershipId: string;
  label: string;                // "Quarterly – Gym only (Jan–Mar)"
  amount: number;
  dueDate: string;
  paidAmount: number;
  status: "pending" | "partial" | "paid" | "waived";
  createdAt: string;
  updatedAt: string;
};

export type Payment = {
  id: string;
  receiptNo: string;
  memberId: string;
  dueId: string | null;         // null = ad-hoc payment
  amount: number;
  date: string;
  mode: string;
  note: string;
  createdAt: string;
};

export type ReminderLog = {
  id: string;
  memberId: string;
  kind: "expiry" | "due" | "winback" | "birthday";
  /** Offset in days from the trigger date: -7, -3, 0, 3 */
  offset: number;
  sentAt: string;
};

export type GymSettings = {
  id: "main";
  memberCodePrefix: string;
  nextMemberSerial: number;
  receiptPrefix: string;
  nextReceiptNumber: number;
  paymentModes: string[];
  openTime: string;
  closeTime: string;
  /** Days before expiry the expiring list starts warning. */
  expiryWarningDays: number;    // default 7
  /** Days without a check-in before a member lands on the win-back list. */
  winbackDays: number;          // default 14
  reminderOffsets: number[];    // default [-7, -3, 0, 3]
  measurementFields: string[];  // which of the Measurement fields to show
  messageTemplates: Record<GymTemplateKey, string>;
  receiptPaperSize: "58mm" | "80mm" | "a4";
  lastBackupAt: string | null;
  sheetSyncUrl: string;
  pinHash?: string;
  pinSalt?: string;
  autoLockMinutes?: number;
};

export type GymTemplateKey =
  | "welcome"
  | "expiryReminder"
  | "expiredToday"
  | "dueReminder"
  | "winback"
  | "birthday"
  | "receipt";
```

Object stores: `plans`, `addOns`, `members`, `memberships`, `freezes`,
`checkIns`, `measurements`, `trainers`, `dues`, `payments`, `reminderLogs`,
`gymSettings`.

Indexes: `checkIns.date`, `checkIns.memberId`, `memberships.endDate`,
`dues.dueDate`, `dues.status`, `members.phone`, `members.code`.

---

## 3. Screens

```ts
export type ScreenId =
  | "today"
  | "members"
  | "plans"
  | "attendance"
  | "payments"
  | "reports"
  | "settings";
```

### 3.1 Today

The owner's morning screen. Four action lists, each with a count badge and a
send queue.

- **In the gym now** — today's check-ins, live count, most recent first.
- **Expiring soon** — memberships ending within `expiryWarningDays`, sorted by
  date, each with a one-tap `Remind` and `Renew`.
- **Payments overdue** — dues past `dueDate` and not `paid`, with the amount and
  days late.
- **Birthdays today** — with a one-tap wish. Cheap, and it visibly works.
- **Not seen in `winbackDays`** — active members with no recent check-in. The
  most valuable list in the app and the one nobody else surfaces.

Header stats: active members, expiring this week, collected this month,
outstanding.

### 3.2 Members

- Searchable list: name, phone, or code. Status chips (active / expiring /
  expired / frozen) colour-coded.
- Filters: status, plan, trainer, goal, joined this month, has dues.
- **Member detail:**
  - Header: photo, name, code, status pill, membership end date with days
    remaining, phone with call/WhatsApp buttons.
  - **Memberships** — current and past, each with plan, dates, amount, sessions
    used for PT plans, and actions: `Renew`, `Freeze`, `Cancel`.
  - **Payments** — dues and receipts, outstanding total.
  - **Attendance** — a 90-day calendar heat strip and a streak count.
  - **Measurements** — table plus a trend chart. Default series is weight; a
    picker switches to waist, body fat, etc.
  - **Health notes and emergency contact**, always one tap away.
  - Actions: `Add measurement`, `Check in`, `Collect payment`, `Print card`,
    `Edit`.
- **Add member** → immediately flows into selling a plan; the two are one wizard,
  because a member without a membership is not a member.
- **Membership card**: printable / downloadable PNG with photo, name, code, QR
  encoding the member code, validity, gym name and logo.
- CSV import.

### 3.3 Plans

- Plan list with price, duration or session count, admission fee, active toggle,
  and a live count of members currently on each.
- Add/edit plan. Editing never mutates sold memberships — `planNameSnapshot` and
  the stored price protect history.
- Add-ons list.
- Discount codes: code, percent or amount, valid until, usage count.

### 3.4 Attendance

- **Check-in bar** at the top, always focused: type a code, phone, or name.
  Exact code match checks in immediately with a confirmation toast; partial
  matches show a pick list.
- **QR scan** button using the device camera, reading the membership card QR.
- Expired or frozen members are checked in but flagged loudly — the front desk
  should see "Membership expired 4 days ago — renew?" rather than a hard block.
- PT session plans decrement `sessionsUsed` on check-in, with a confirm, and warn
  at the last session.
- Today's list below with time and method; manual add for someone who forgot.
- Date picker to review or backfill a past day.

### 3.5 Payments

- **Due list** with filters: overdue, due this week, unpaid, partial.
- **Collect payment**: pick member → outstanding dues listed → amount (defaults
  to full, editable for part payment) → mode → receipt.
- Receipt printing at 58/80mm/A4 with UPI QR.
- **Reminder run**: select a filter, open the send queue, walk through WhatsApp
  messages. `ReminderLog` prevents sending the same offset twice.
- Ad-hoc payment for anything not tied to a due.

### 3.6 Reports

- **Members**: active / expired / frozen / cancelled counts over time; new
  joins per month.
- **Revenue**: collected per month, by plan, by payment mode; admission fees
  separately.
- **Renewal rate**: memberships expiring in a period vs renewed within 30 days.
- **Churn**: cancelled + lapsed, monthly.
- **Peak hours heatmap**: check-ins by hour × weekday. Drives staffing and
  equipment decisions; also a great screenshot for the marketing page.
- **Trainer load**: members per trainer, PT sessions delivered.
- **Outstanding**: total receivable, aged.
- CSV export on each.

### 3.7 Settings

Gym details · Plans & add-ons · Trainers · Membership (code prefix, expiry
warning days, win-back days) · Attendance (open/close time, QR on/off) ·
Measurements (which fields to show) · Payments (receipt prefix, modes, paper
size) · Reminder schedule (`reminderOffsets`) · Message templates ·
Sheet sync · Backup & restore · Screen lock · Reset.

---

## 4. Key flows

### Selling a membership

1. Members → `Add member` → name, phone, photo, DOB, emergency contact.
2. Plan step: pick plan → start date defaults to today → add-ons → discount →
   payable computed.
3. Payment step: full or part; part payment creates a `Due` for the balance.
4. Receipt printed or shared; welcome WhatsApp offered.
5. Membership card offered for print.

### Freezing

1. Member detail → membership → `Freeze` → from/to dates + reason.
2. On save, `Freeze` is stored, membership status becomes `frozen`, and
   `endDate` is pushed out by the frozen day count.
3. On `toDate`, status returns to `active` automatically on next app open.
4. The extension is visible on the member's card: "Extended 12 days (freeze)".

### Monthly renewal run

1. Today → Expiring soon → `Remind all`.
2. Send queue walks through WhatsApp reminders, logging each.
3. As members come in, `Renew` on their row pre-fills the same plan with a start
   date continuing from the old `endDate`, not from today — no lost days, no
   free days.

---

## 5. Business rules

| Rule | Definition |
|---|---|
| **Expiry** | `endDate = startDate + durationDays + Σ freeze days`, exclusive of the end date's own day. |
| **Renewal start** | If renewing on or before `endDate`, the new membership starts at `endDate + 1`. If after, it starts today. Shown explicitly at renewal. |
| **Status derivation** | `cancelled` > `frozen` (today within a freeze) > `expired` (`endDate < today`) > `active`. Recomputed on app open, not stored as truth. |
| **Session plans** | No `endDate` unless one is set; `sessionsUsed` increments only on an explicit consume. Expire when `sessionsUsed >= sessionsTotal`. |
| **BMI** | `weightKg / (heightCm/100)²`, one decimal, computed at measurement time and stored. |
| **Win-back list** | Active membership, no `CheckIn` in `winbackDays`, not frozen. |
| **Admission fee** | Charged only when the member has no prior membership of any kind. |
| **Reminder dedupe** | One send per `(memberId, kind, offset)` per membership cycle, tracked in `ReminderLog`. |

---

## 6. Message templates

| Key | Default |
|---|---|
| `welcome` | `Welcome to {{gymName}}, {{memberName}}! Your {{planName}} is active till {{endDate}}. Member ID: {{memberCode}}.` |
| `expiryReminder` | `Hi {{memberName}}, your {{gymName}} membership ends on {{endDate}} ({{daysLeft}} days). Renew to keep your streak going.` |
| `expiredToday` | `Hi {{memberName}}, your membership at {{gymName}} expired today. Renew now: {{upiId}}` |
| `dueReminder` | `Hi {{memberName}}, ₹{{amount}} is pending at {{gymName}} (due {{dueDate}}). Pay by UPI: {{upiId}}` |
| `winback` | `Hi {{memberName}}, we have not seen you at {{gymName}} in {{days}} days. Everything alright? Your membership is valid till {{endDate}}.` |
| `birthday` | `Happy birthday, {{memberName}}! — Team {{gymName}} 🎉` |
| `receipt` | `Received ₹{{amount}} from {{memberName}}. Receipt {{receiptNo}}. Thank you — {{gymName}}` |

Variables: `memberName`, `memberCode`, `gymName`, `planName`, `endDate`,
`daysLeft`, `amount`, `dueDate`, `days`, `receiptNo`, `upiId`.

---

## 7. Reuse map

| Need | Reuse |
|---|---|
| Nearly the entire domain shape | `lib/tuition/` — `Batch`→`Plan`, `Student`→`Member`, fee cycles→`Due`, attendance, receipts |
| Fee/due generation logic | `lib/tuition/calc.ts`, `lib/tuition/batchRules.ts` |
| Send queue | `Tuition/SendQueue.tsx` |
| CSV import UI | `Tuition/ImportStudents.tsx` |
| Attendance screen shape | `Tuition/AttendanceScreen.tsx` |
| Settings accordion | `Tuition/SettingsScreen.tsx` |
| Receipt PDF + UPI QR | `lib/pos/receiptPdf.ts`, `lib/upi.ts` |
| QR generate/scan | `components/tools/UpiQrGenerator/`, `components/tools/BarcodeGenerator/` |
| Backup, Sheet sync, PIN | `lib/tuition/backup.ts`, `lib/tuition/sheetSync.ts`, `lib/pos/pin.ts` |

---

## 8. Build phases

**Phase 1** — members, plans, sell membership, dues, payments, receipts, the
Today lists. Shippable as "free gym membership and fees software".

**Phase 2** — attendance with QR, freeze/hold, renewal flow with date continuity.

**Phase 3** — measurements with trend chart, membership cards, win-back and
birthday lists, reminder scheduling with dedupe.

**Phase 4** — reports incl. peak-hour heatmap, trainers, add-ons and discount
codes, Sheet sync, marketing page.

---

## 9. Open decisions

1. **Is Gym a separate app or a re-skin of Tuition?** Sharing one codebase with a
   vertical config would halve the work but compromise both — gyms need freeze
   and sessions, tuition needs tests and syllabus diary. Recommendation: separate
   app, shared `lib/` helpers extracted where they are genuinely identical
   (dues, send queue, CSV, backup).
2. **Do we handle multi-branch gyms?** Not in the free tier — one device, one
   branch. Confirm that is acceptable, since even small chains have two locations.
3. **PT session consumption** — does a PT session always coincide with a gym
   check-in, or is it logged separately by the trainer? Affects whether check-in
   decrements sessions or a separate log does.
4. **Body-fat percentage** — do we compute it (from skinfold or a Navy-tape
   formula) or only accept a number from a machine? Recommendation: accept only,
   to avoid implying medical accuracy.
5. **Biometric/RFID check-in** is what mid-size gyms actually use. Browser access
   to those devices is not realistic. Is a CSV import of the biometric machine's
   daily log a good enough bridge, and should it be free or paid?
6. **Photo storage size.** Member photos as data URLs will dominate the backup
   file for a 500-member gym. Decide on a max dimension and JPEG quality
   (suggest 400px, 0.7) and whether backups include photos by default.
