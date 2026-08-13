# Free App Specs

### Nine candidate offline apps, specified before building

> **Status:** Pre-build specifications. Nothing here is implemented yet.
> These are decision documents — read the *Open decisions* section at the end
> of each spec before starting work on that app.

Setu already ships three **free apps**, which are a different class of thing
from the ~45 single-purpose tools under `app/tools/`:

| Free app | Route | Component root | Data layer |
|---|---|---|---|
| Browser Based POS | `/products/browser-based-pos` | `components/tools/FreePos/` | `lib/pos/` |
| Free Restaurant POS | `/products/free-restaurant-pos` | `components/tools/FreeDine/` | `lib/dine/` |
| Tuition Class Manager | `/products/free-tuition-software` | `components/tools/Tuition/` | `lib/tuition/` |

A **tool** generates one document or report. An **app** runs a business: a setup
wizard, a daily operating screen, a register, reports, settings, backup, and a
lock screen. Apps are what pull organic traffic and feed the paid products;
tools mostly serve long-tail search.

These nine specs are all apps.

---

## The nine

| # | App | Spec | Paid upsell | Effort |
|---|---|---|---|---|
| 1 | Clinic Manager | [`clinic.md`](./clinic.md) | Setu Clinic (page already live) | High |
| 2 | Token & Queue System | [`queue.md`](./queue.md) | Setu Queue (page already live) | Medium |
| 3 | Gym & Membership Manager | [`gym.md`](./gym.md) | Setu Clinic / new | Low |
| 4 | Salon & Spa Manager | [`salon.md`](./salon.md) | New vertical | High |
| 5 | Repair Job Card | [`repair.md`](./repair.md) | Retail POS | Medium |
| 6 | Pharmacy POS | [`pharmacy.md`](./pharmacy.md) | Retail POS | High |
| 7 | Hostel & PG Manager | [`hostel.md`](./hostel.md) | New vertical | Medium |
| 8 | Laundry & Dry Clean Counter | [`laundry.md`](./laundry.md) | Retail POS | Low |
| 9 | Rental & Hire Book | [`rental.md`](./rental.md) | New vertical | Medium |

**Recommended build order:** Clinic → Gym → Queue → Repair → Salon, then
re-evaluate. Clinic first because `/products/clinic` is already a live paid page
with no free counterpart feeding it. Gym second because its data model is
close to a rename of `lib/tuition/`. Queue third because `FreeDine/KitchenApp.tsx`
already proved the two-surface (operator + display) pattern.

---

## The shared foundation

Every spec in this folder assumes the baseline below and does **not** re-specify
it. Build it once per app by reusing the existing modules; do not reinvent.

### Storage

- Single IndexedDB database, `POS_DATABASE`, via `lib/pos/db.ts` (`dbGetAll`, `dbBatch`).
  Each app adds its own object stores; it never forks the database.
- Business identity comes from the shared workspace (`lib/workspace/index.ts`),
  so a user who already ran another Setu tool does not retype their name, phone,
  logo, address or UPI ID.
- IDs and timestamps from `generateId()` / `nowIso()` in `lib/pos/types.ts`.

### Screens every app has

| Screen | Reuse pattern |
|---|---|
| Welcome | `FreePos/WelcomeScreen.tsx` — value pitch, "Start free", restore-backup entry |
| Setup | `FreePos/SetupScreen.tsx` — business details, then the app's own minimum config |
| Lock | `FreePos/LockScreen.tsx` + `lib/pos/pin.ts` — salted SHA-256 PIN, auto-lock after N idle minutes |
| Reports | Date-range picker, stat row, CSV export |
| Settings | Sectioned accordion, as in `Tuition/SettingsScreen.tsx` |

Navigation is a `ScreenId` string-union in `components/tools/<App>/nav.ts`, with
a `NavigateFn = (screen: ScreenId, query?: string) => void`. Follow it exactly.

### Capabilities inherited

- **Backup & restore** — JSON download and validated restore (`lib/pos/backup.ts`,
  `lib/tuition/backup.ts` as the shape reference).
- **CSV import/export** — `lib/pos/csv.ts`; import UI modelled on
  `Tuition/ImportStudents.tsx` (column mapping + preview + error rows).
- **Google Sheet sync** — `lib/*/sheetSync.ts`: user pastes an Apps Script web-app
  URL, app pushes tab payloads and can pull back. Per-slice dirty tracking.
- **WhatsApp / SMS** — `lib/tuition/messages.ts` (`fillTemplate`, `whatsAppLink`,
  `smsLink`). Every app defines its own template set; all are user-editable in
  Settings with a variable legend.
- **Bulk send queue** — `Tuition/SendQueue.tsx`: WhatsApp deep links can only be
  opened one at a time, so bulk reminders become a walk-through queue with
  sent/skipped state, resumable.
- **UPI** — `lib/upi.ts` builds the payment string; a "Pay now" button and QR
  appear on receipts and payment reminders when a UPI ID is set.
- **Receipt printing** — `lib/pos/receiptPdf.ts`, paper sizes `58mm | 80mm | a4`.
- **Reset** — destructive, double-confirmed, clears only that app's stores.

### Non-negotiables

1. **Offline-first.** If a feature cannot work offline, it belongs in the paid
   tier, not the free app.
2. **No login.** Identity is the device.
3. **No data leaves the device** unless the user explicitly shares or syncs.
4. **Mobile-first.** Assume a ₹8,000 Android phone on a slow connection.
5. **Instant start.** Usable within 60 seconds of landing, with sample data
   available so the app is never an empty shell.

### Launch checklist per app

Every app ships with all of the following, or it does not ship:

- [ ] `app/products/<slug>/page.tsx` — marketing page with `generateMetadata`,
      `freeOffer` JSON-LD from `lib/schema.ts`, FAQ block, feature grid
- [ ] Entry in `lib/toolkit/registry.ts`
- [ ] Entry in `app/sitemap.ts` and the `/sitemap` page
- [ ] Nav link under Products
- [ ] Cross-links from at least three related calculators/tools
- [ ] OG image in `public/og/`
- [ ] Sample-data seed so the app demos itself
- [ ] Backup/restore round-trip tested
- [ ] Tested at 360px width
