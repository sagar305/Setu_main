# Free Clinic Manager

### Full specification — pre-build

> Assumes the shared foundation in [`README.md`](./README.md). Only what is
> specific to this app is described here.

---

## 1. Positioning

| | |
|---|---|
| **Route** | `/products/free-clinic-software` |
| **Component root** | `components/tools/Clinic/` |
| **Data layer** | `lib/clinic/` |
| **Target user** | Single-doctor and 2–4 doctor clinics in India: GP, dentist, physio, ayurveda, homeopathy, paediatric. Also the front-desk assistant who actually operates it. |
| **The one job** | Get through today's patients without paper — and hand each one a printed prescription. |
| **Upsell** | `/products/clinic` — the paid page is already live with nothing free feeding it. This is the single biggest gap in the funnel. |

### Why this one first

`app/products/clinic/page.tsx` exists (109 lines) and sells a paid product. There
is no free clinic app, so every visitor that page attracts either converts
immediately or leaves. Every other Setu vertical has a free rung on the ladder.

`components/tools/AppointmentBook/AppointmentBookTool.tsx` (381 lines) is already
a working generic appointment tool. It is the seed, not the destination — the
Clinic app supersedes it for medical users, and the tool stays for everyone else.

### Search intent

Primary: *free clinic management software*, *clinic software free download India*,
*prescription writing software free*, *doctor appointment software free*,
*patient record software for small clinic*.

Long-tail worth dedicated FAQ answers: *how to write prescription on computer*,
*free software for dental clinic*, *OPD management software free*.

### What makes it win

Free clinic software in India is either a crippled trial of a cloud product or a
2009-era desktop `.exe`. Nothing runs in a browser, offline, with no signup and a
prescription pad that prints properly. The **protocol templates** (save an entire
Rx as "Viral fever – adult", reuse in one tap) are the retention hook — after a
doctor has built ten of them, they will not switch.

---

## 2. Data model

`lib/clinic/types.ts`. Follows the conventions in `lib/pos/types.ts`: string ids
from `generateId()`, ISO timestamps from `nowIso()`, no nested documents that
cannot be indexed.

```ts
/** A doctor/consultant at this clinic. The clinic itself is the workspace Business. */
export type Doctor = {
  id: string;
  name: string;
  qualifications: string;      // "MBBS, MD (Medicine)"
  registrationNo: string;      // state medical council reg. no — prints on Rx
  speciality: string;
  consultationFee: number;
  followUpFee: number;         // 0 = follow-ups are free
  /** Follow-up inside this many days bills at followUpFee. 0 = never auto. */
  followUpFreeDays: number;
  signatureDataUrl: string;    // drawn or uploaded, prints above the reg. no
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Sex = "male" | "female" | "other";

export type Patient = {
  id: string;
  /** Human-facing id, e.g. "SC-0142". Generated from settings prefix + serial. */
  code: string;
  name: string;
  /** Store dob when known; else store age at registration and derive forward. */
  dob: string | null;
  ageYearsAtRegistration: number | null;
  registeredOn: string;
  sex: Sex;
  phone: string;
  altPhone: string;
  address: string;
  bloodGroup: string;
  /** Shown as a red banner at the top of the chart. */
  allergies: string[];
  chronicConditions: string[];
  /** Links members of one household; usually the primary phone holder's id. */
  familyId: string | null;
  photoDataUrl: string;
  /** Free-form, same pattern as lib/tuition CustomField. */
  customFields: CustomField[];
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type CustomField = { id: string; label: string; value: string };

export type AppointmentStatus =
  | "booked"
  | "waiting"      // arrived, in the waiting room
  | "in-consult"
  | "done"
  | "no-show"
  | "cancelled";

export type Appointment = {
  id: string;
  patientId: string;
  doctorId: string;
  /** Local date "YYYY-MM-DD" — indexed, this is the main query key. */
  date: string;
  startTime: string;           // "18:00"
  durationMinutes: number;
  status: AppointmentStatus;
  /** Sequence within the day per doctor. Assigned on arrival, not on booking. */
  tokenNo: number | null;
  arrivedAt: string | null;
  consultStartedAt: string | null;
  consultEndedAt: string | null;
  reason: string;
  cancelReason: string;
  /** Set when this was auto-created by a "review after N days" advice. */
  createdFromVisitId: string | null;
  remindedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Vitals = {
  bp: string;                  // "120/80" — free text, too varied to model
  pulse: number | null;
  tempF: number | null;
  spo2: number | null;
  weightKg: number | null;
  heightCm: number | null;
  /** Derived, stored so historic BMI does not shift if the formula changes. */
  bmi: number | null;
};

/** One consultation. The clinical record; immutable-ish once finalised. */
export type Visit = {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentId: string | null;   // null = pure walk-in
  date: string;
  vitals: Vitals;
  complaints: string;
  findings: string;
  diagnosis: string;
  advice: string;
  /** Free-text lab/imaging advice, one per line; prints as an investigation slip. */
  investigations: string[];
  medicines: RxLine[];
  followUpDays: number | null;    // drives the "review after N days" booking
  /** Not printed. Visible only inside the app. */
  internalNotes: string;
  finalisedAt: string | null;     // null = still a draft
  createdAt: string;
  updatedAt: string;
};

export type RxLine = {
  id: string;
  medicineId: string | null;      // null = typed ad hoc, not in the master
  name: string;
  strength: string;               // "500 mg"
  form: MedicineForm;
  /** "1-0-1" morning-noon-night, or free text for odd schedules. */
  frequency: string;
  durationDays: number | null;
  timing: "before-food" | "after-food" | "with-food" | "";
  /** Auto-computed from frequency × durationDays; editable. */
  quantity: number | null;
  instructions: string;
};

export type MedicineForm =
  | "tablet" | "capsule" | "syrup" | "injection"
  | "drops" | "ointment" | "inhaler" | "sachet" | "other";

export type Medicine = {
  id: string;
  name: string;
  strength: string;
  form: MedicineForm;
  /** Generic/salt name — powers substitute search. */
  composition: string;
  defaultFrequency: string;
  defaultDurationDays: number | null;
  defaultTiming: RxLine["timing"];
  timesUsed: number;              // drives "frequently prescribed" ordering
  createdAt: string;
};

/** A saved whole-prescription template, e.g. "Viral fever – adult". */
export type Protocol = {
  id: string;
  name: string;
  doctorId: string | null;        // null = shared across doctors
  complaints: string;
  diagnosis: string;
  advice: string;
  investigations: string[];
  medicines: RxLine[];
  followUpDays: number | null;
  timesUsed: number;
  createdAt: string;
  updatedAt: string;
};

export type ClinicCharge = {
  id: string;
  name: string;                   // "Dressing", "ECG", "Nebulisation"
  amount: number;
  active: boolean;
};

export type BillLine = {
  id: string;
  label: string;
  amount: number;
  kind: "consultation" | "procedure" | "other";
};

export type Bill = {
  id: string;
  receiptNo: string;              // formatted with prefix, e.g. "RCP-0231"
  patientId: string;
  doctorId: string;
  visitId: string | null;
  date: string;
  lines: BillLine[];
  discount: number;
  total: number;
  paid: number;                   // < total leaves a due
  paymentMode: string;            // from settings.paymentModes
  createdAt: string;
  updatedAt: string;
};

export type ClinicSettings = {
  id: "main";
  patientCodePrefix: string;      // "SC-"
  nextPatientSerial: number;
  receiptPrefix: string;
  nextReceiptNumber: number;
  slotMinutes: 10 | 15 | 20 | 30;
  openTime: string;               // "09:00"
  closeTime: string;              // "21:00"
  /** Recurring closed windows, e.g. lunch. */
  breaks: { id: string; label: string; start: string; end: string }[];
  weeklyOffDays: number[];        // 0 = Sunday
  holidays: { id: string; date: string; reason: string }[];
  paymentModes: string[];
  rxPaperSize: "a4" | "a5";
  /** false = printing on pre-printed letterhead, so suppress the header. */
  printClinicHeader: boolean;
  rxFooterText: string;           // "Not valid for medico-legal purposes"
  showVitalsOnRx: boolean;
  messageTemplates: Record<ClinicTemplateKey, string>;
  receiptPaperSize: "58mm" | "80mm" | "a4";
  lastBackupAt: string | null;
  sheetSyncUrl: string;
  pinHash?: string;
  pinSalt?: string;
  autoLockMinutes?: number;
};

export type ClinicTemplateKey =
  | "appointmentConfirmed"
  | "appointmentReminder"
  | "followUpDue"
  | "reportReady"
  | "duesReminder";
```

### Object stores

`doctors`, `patients`, `appointments`, `visits`, `medicines`, `protocols`,
`charges`, `bills`, `clinicSettings`.

Indexes that matter: `appointments.date`, `appointments.patientId`,
`visits.patientId`, `bills.patientId`, `patients.phone`, `patients.code`.

---

## 3. Screens

```ts
// components/tools/Clinic/nav.ts
export type ScreenId =
  | "today"
  | "patients"
  | "appointments"
  | "consult"
  | "billing"
  | "reports"
  | "settings";
```

`consult` is entered from `today` or a patient chart rather than the nav bar on
mobile, but it is a real screen with its own URL state.

### 3.1 Today

The default screen. The front desk lives here all day.

- **Header stats:** patients seen / waiting / expected, collections so far, average
  wait time so far.
- **The list.** Every appointment for today plus every walk-in, ordered by token.
  Each row: token no, patient name + age/sex, doctor, reason, status pill,
  elapsed-wait timer for anyone `waiting`.
- **Status actions per row:** Arrived → Start consult → Done. One tap each. A
  "Start consult" opens the `consult` screen with the visit pre-created.
- **Add walk-in.** A single field that searches existing patients by name/phone
  and offers "Register new patient" inline. Assigns the next token immediately.
- **Doctor filter** when more than one doctor is active.
- **Priority flag** on a row moves it up the queue and shows a marker; used for
  emergencies and elderly patients.
- Rows for `no-show` and `cancelled` collapse to the bottom.

**Empty state:** if no appointments exist, show "No appointments today — add a
walk-in" with the walk-in field focused, not a blank page.

### 3.2 Patients

- **Register list.** Search by name, phone, or patient code; results ranked by
  last-visit recency. Infinite scroll, 50 at a time.
- **Filters:** has dues, chronic condition, not seen in 6 months, registered this
  month.
- **Patient chart** (detail view) — the most important read-only screen in the app:
  - Header: name, age (derived live from `dob` or `ageYearsAtRegistration` +
    elapsed years), sex, code, phone with tap-to-call and WhatsApp buttons.
  - **Red banner** listing allergies and chronic conditions when either is non-empty.
  - **Timeline**: every visit newest-first, each collapsed to date + diagnosis +
    doctor, expanding to the full record with a "Print again" action.
  - Tabs: Visits · Bills · Vitals trend · Files.
  - **Vitals trend**: weight and BP plotted over time. Small, but it is the thing
    that makes a doctor keep using it for chronic patients.
  - Family members strip when `familyId` is set — one tap to switch to a sibling
    or parent's chart.
  - Actions: Book appointment · Start consult now · Add bill · Edit · Export chart PDF.
- **Add/edit patient form.** Name and phone required; everything else optional.
  Age accepts either a DOB or a plain number of years. Photo capture uses
  `getUserMedia` with a file-input fallback.
- **CSV import** with column mapping, modelled on `Tuition/ImportStudents.tsx`.

### 3.3 Appointments

- **Day view** (default on mobile): a vertical time axis from `openTime` to
  `closeTime` in `slotMinutes` steps. Booked slots show patient + reason. Breaks,
  weekly offs and holidays render as hatched blocks and reject drops.
- **Week view** (desktop): seven columns, compressed.
- **Doctor columns** when multiple doctors are active — each doctor gets a column
  in day view.
- **Booking** a slot: patient search-or-create, reason, duration (defaults to
  `slotMinutes`, editable), doctor. On save, offer to send the confirmation
  WhatsApp immediately.
- **Drag to reschedule** on desktop; on mobile, a "Move" action that opens a slot
  picker. Rescheduling offers to send an update message.
- **Cancel** requires a reason (stored, reported on).
- **Double-booking** is allowed but warned — real clinics overbook deliberately.
- **Tomorrow's reminders**: a button that opens the send queue for every
  appointment tomorrow that has not been reminded.

### 3.4 Consult — the prescription pad

This screen is the product. It must work on a laptop at a desk and on a tablet.

Layout: left column the input pad, right column a live A4/A5 preview of what will
print. On mobile the preview collapses to a "Preview" toggle.

**Sections, in order:**

1. **Patient strip** — name, age, sex, allergies banner, last visit date and its
   diagnosis, one tap to open the full chart in a drawer.
2. **Vitals** — BP, pulse, temp, SpO2, weight, height. BMI computes live from
   weight and height and is read-only. Each field remembers the last value for
   this patient as a placeholder so the assistant can see change at a glance.
3. **Complaints / Findings / Diagnosis / Advice** — four autosizing textareas.
   Each offers autocomplete from the doctor's own previously typed values
   (ranked by frequency), which is how the app gets faster the more it is used.
4. **Medicines** — the core interaction:
   - A single search box matching `Medicine.name` and `Medicine.composition`.
     Results show name + strength + form. "Frequently prescribed" list shows
     when the box is empty, ordered by `timesUsed`.
   - Selecting one appends an `RxLine` pre-filled with that medicine's defaults.
   - Each line is an editable row: name, strength, frequency, duration, timing,
     quantity, instructions.
   - **Frequency** uses a compact picker: tap 1-0-1, 1-1-1, 0-0-1, SOS, or type.
   - **Quantity auto-computes**: sum of the dose digits in `frequency` ×
     `durationDays`, rounded up. Editable — syrups and injections will not match.
   - Lines reorder by drag; delete by swipe on mobile.
   - Typing a name with no match still works: it is prescribed ad hoc and offered
     for adding to the master afterwards.
5. **Investigations** — one per line, printed as a separate slip.
6. **Follow-up** — "Review after ___ days". On finalise, this offers to book an
   appointment at the same time of day, `followUpDays` out.

**Protocols.** A "Load protocol" button at the top opens the saved list, filtered
to this doctor plus shared ones, searchable, ordered by `timesUsed`. Loading one
fills complaints, diagnosis, advice, investigations, medicines and follow-up —
all still editable. A "Save as protocol" button at the bottom captures the
current state, prompting for a name. This is the retention loop; make it two taps
in each direction.

**Finalise** sets `finalisedAt`, then presents: Print Rx · Share on WhatsApp ·
Print investigation slip · Add bill · Book follow-up. Editing a finalised visit
is allowed but stamps `updatedAt` and shows an "edited" marker on the chart.

**Draft safety.** The visit row is created the moment the consult opens and
written on every field blur. Closing the tab mid-consult must never lose the
record; on reopening, `today` shows the patient as still `in-consult` with a
"Resume" action.

### 3.5 Billing

- **New bill** from a visit (pre-filled with the consultation fee) or standalone.
- Fee logic: if this patient has a finalised visit with the same doctor within
  `followUpFreeDays`, the consultation line defaults to `followUpFee` and shows
  "Follow-up — within N days" as its label. Overridable.
- Add procedure lines from `ClinicCharge` presets or ad hoc.
- Discount as amount or percent.
- Partial payment allowed; the shortfall becomes a due against the patient.
- **Print** via `lib/pos/receiptPdf.ts` at 58mm/80mm/A4, with UPI QR when a UPI
  ID is set.
- **Dues list**: every patient with `sum(total) > sum(paid)`, with a reminder
  send queue.

### 3.6 Reports

Date-range picker at the top, CSV export on each block.

- **Footfall** — patients seen per day/week/month; new vs repeat split.
- **Revenue** — total, by doctor, by payment mode, by charge type.
- **Top diagnoses** — ranked list. Genuinely useful, and shareable.
- **No-show rate** — booked vs attended, by day of week.
- **Follow-ups due this week** — a call list with send queue. This is the report
  that pays for the app.
- **Outstanding dues** — patient-wise ageing.
- **Peak hours** — arrivals by hour, to fix staffing and slot lengths.

### 3.7 Settings

Sections, in the accordion style of `Tuition/SettingsScreen.tsx`:

1. **Clinic details** — from the workspace Business; name, phone, address, logo,
   UPI ID, currency.
2. **Doctors** — add/edit/deactivate; fee, follow-up fee and free-days window,
   registration number, signature pad.
3. **Schedule** — open/close times, slot length, breaks, weekly offs, holidays.
4. **Prescription** — paper size, print header toggle, show-vitals toggle,
   footer text.
5. **Charges** — the procedure preset list.
6. **Medicines** — master list, searchable, with CSV import and a "seed common
   Indian medicines" button.
7. **Protocols** — manage saved templates.
8. **Billing** — receipt prefix, next number, payment modes, receipt paper size.
9. **Message templates** — the five `ClinicTemplateKey` strings with a variable legend.
10. **Google Sheet sync**, **Backup & restore**, **Screen lock**, **Reset**.

---

## 4. Key flows

### Walk-in patient, start to finish

1. Front desk types the phone number in Today's walk-in box → no match →
   "Register new patient" → name + phone + age + sex → saved, code `SC-0143`
   assigned, token 7 issued, status `waiting`.
2. Doctor taps the row → "Start consult" → consult screen, visit created,
   `consultStartedAt` stamped, status `in-consult`.
3. Doctor loads protocol "Acidity – adult", edits one medicine, sets follow-up 5 days.
4. Finalise → Print Rx (A5, no header — pre-printed letterhead).
5. "Add bill" → consultation ₹300 pre-filled → paid cash → 80mm receipt printed.
6. "Book follow-up" → appointment created 5 days out at the same time →
   WhatsApp confirmation offered.

Target: under 90 seconds of app interaction for the whole loop.

### Evening reminder run

1. Front desk opens Appointments → "Send tomorrow's reminders".
2. Send queue lists 14 appointments not yet reminded.
3. Each entry opens WhatsApp with the filled template; the queue advances on
   return and marks `remindedAt`. Skip is available per row.
4. The queue is resumable — closing the tab does not lose position.

---

## 5. Business rules

| Rule | Definition |
|---|---|
| **Age display** | `dob` present → floor of elapsed years. Else `ageYearsAtRegistration + ` elapsed years since `registeredOn`. Under 2 years, display in months. |
| **BMI** | `weightKg / (heightCm/100)²`, one decimal. Blank unless both present. |
| **Token numbers** | Per doctor, per day, assigned on arrival (not booking), starting at 1. Priority flags reorder display only; the number does not change. |
| **Follow-up fee** | Applies when a finalised visit exists for the same `patientId` + `doctorId` within `followUpFreeDays` days. |
| **Rx quantity** | Sum of numeric parts of `frequency` × `durationDays`, `Math.ceil`. `frequency` that does not parse leaves quantity blank. |
| **Wait time** | `consultStartedAt − arrivedAt`. Excluded from averages when either is null. |
| **No-show** | Auto-set at end of day for anything left `booked`. Reversible. |
| **Patient code** | `patientCodePrefix + zero-padded nextPatientSerial`, padded to 4. Serial never reused. |

---

## 6. Message templates

Defaults, all editable, variables in `{{ }}` resolved by `fillTemplate`:

| Key | Default |
|---|---|
| `appointmentConfirmed` | `Namaste {{patientName}}, your appointment at {{clinicName}} is confirmed for {{date}} at {{time}} with {{doctorName}}. — {{clinicPhone}}` |
| `appointmentReminder` | `Reminder: your appointment at {{clinicName}} is tomorrow, {{date}} at {{time}}. Reply here to reschedule.` |
| `followUpDue` | `Namaste {{patientName}}, {{doctorName}} advised a review around {{date}}. Shall we book you in?` |
| `reportReady` | `Your reports are ready for collection at {{clinicName}}.` |
| `duesReminder` | `Namaste {{patientName}}, ₹{{amount}} is pending at {{clinicName}}. Pay by UPI: {{upiId}}` |

Available variables: `patientName`, `patientCode`, `doctorName`, `clinicName`,
`clinicPhone`, `date`, `time`, `amount`, `upiId`.

---

## 7. Print outputs

| Output | Paper | Notes |
|---|---|---|
| Prescription | A4 or A5 | Header block (clinic name, address, phone, doctor name + qualifications + reg. no) suppressed when `printClinicHeader` is false. Patient line, vitals row (optional), Rx body, advice, follow-up date, signature image, footer disclaimer. |
| Investigation slip | A5 | Patient, date, doctor, the investigation list, signature. |
| Bill / receipt | 58mm, 80mm, A4 | Via `lib/pos/receiptPdf.ts`. UPI QR when configured. |
| Patient chart export | A4 | Full visit history for referral or handover. |

Print via a dedicated print stylesheet on a hidden render node — not
`html2canvas` — so prescription text stays selectable and sharp. Use jsPDF only
for the share-as-PDF path.

---

## 8. Reuse map

| Need | Reuse |
|---|---|
| IndexedDB access | `lib/pos/db.ts` |
| Business profile | `lib/workspace/index.ts` |
| ids / timestamps | `lib/pos/types.ts` |
| PIN lock | `lib/pos/pin.ts`, `FreePos/LockScreen.tsx` |
| Receipt PDF | `lib/pos/receiptPdf.ts` |
| UPI string + QR | `lib/upi.ts`, `components/tools/UpiQrGenerator/` |
| WhatsApp/SMS links | `lib/tuition/messages.ts` |
| Bulk send | `Tuition/SendQueue.tsx` |
| CSV import UI | `Tuition/ImportStudents.tsx` |
| Sheet sync | `lib/tuition/sheetSync.ts` |
| Backup shape | `lib/tuition/backup.ts` |
| Store/context pattern | `lib/tuition/store.tsx` |
| Settings accordion, Field, Modal | `Tuition/SettingsScreen.tsx`, `FreePos/ui.tsx` |
| Day-view scheduling logic | `components/tools/AppointmentBook/AppointmentBookTool.tsx` |
| Marketing page structure | `app/products/free-tuition-software/page.tsx` |

---

## 9. Build phases

**Phase 1 — usable clinic day.** Setup, patients register + chart, Today screen
with walk-ins and status flow, consult screen with medicines and printing,
simple billing. Ships as "free prescription + patient record software".

**Phase 2 — the schedule.** Appointments day/week view, booking, reminders,
follow-up auto-booking, no-show handling.

**Phase 3 — memory and money.** Protocols, autocomplete from history, vitals
trend, dues, full reports.

**Phase 4 — polish.** Multi-doctor columns, family grouping, chart export,
Sheet sync, sample-data seed, marketing page and FAQ.

---

## 10. Open decisions

Answer these before Phase 1 starts — each one changes the schema or the screens:

1. **Does the free tier include multiple doctors, or is that the paid line?**
   The schema supports it; the question is whether to gate it. Gating it is the
   cleanest upsell in the whole product, but it weakens the free offer for the
   3-doctor clinics that are the best paid leads.
2. **Do we store a device password/pattern field for the patient at all?** No —
   this is the repair app's feature, not clinic's. Confirm we are not adding any
   field that would make the data more sensitive than it already is.
3. **Medicine master seed.** Ship a starter list of common Indian medicines? It
   makes the app instantly useful but means maintaining a drug list, with the
   accuracy expectations that implies. Recommendation: ship ~200 very common
   generics with composition, clearly labelled as a starting point the doctor
   edits, no dosing guidance.
4. **Is there any medico-legal disclaimer we must show** on first run and on
   printed prescriptions? Default footer text assumes yes; confirm the wording.
5. **A5 vs A4 default** for prescriptions — A5 is the Indian norm on pads, A4 is
   what home printers hold. Recommendation: default A4, prominent A5 option.
6. **Does the paid Clinic product already define a patient schema** we should
   align to, so migration free → paid is a straight import? If so, that schema
   wins over this one.
7. **Vitals fields** — is BP-as-free-text acceptable, or do we need systolic and
   diastolic as separate numbers for the trend chart? Recommendation: store both
   the raw string and parsed numbers when it parses.
