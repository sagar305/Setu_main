# Free Token & Queue System

### Full specification — pre-build

> Assumes the shared foundation in [`README.md`](./README.md).

---

## 1. Positioning

| | |
|---|---|
| **Route** | `/products/free-queue-system` |
| **Component root** | `components/tools/Queue/` |
| **Data layer** | `lib/queue/` |
| **Target user** | Anywhere people wait in a line and a staff member calls them: clinics, diagnostic labs, salons, service centres, bank branches, government offices, mobile shops, RTO agents, small canteens. |
| **The one job** | Replace shouting names across a waiting room. |
| **Upsell** | `/products/queue` — the paid page is live with no free counterpart. |

### Why it is cheap to build

`components/tools/FreeDine/KitchenApp.tsx` already proves the two-surface
pattern: an operator app and a separate always-on display that reads the same
IndexedDB and repaints. Queue is that pattern with a much simpler data model. It
is the lowest-risk of the nine after Gym.

### Search intent

*token system software free*, *queue management system free download*,
*token display software for clinic*, *free token number display*,
*customer queue app*, *token calling system*.

### What makes it win

**Voice announcement via the Web Speech API**, in Hindi, English and regional
languages, at zero cost. Commercial token systems charge for exactly this, and
every one of them needs a server. A browser tab that says "Token A forty-two,
counter three" out loud, offline, is a genuinely unmatched free offer.

---

## 2. Two surfaces

This app has two entry points sharing one database — like FreeDine's
`/products/free-restaurant-pos` and `/products/free-restaurant-pos/kitchen`.

| Surface | Route | Runs on |
|---|---|---|
| Counter | `/products/free-queue-system` | Staff phone, tablet, or desk PC |
| Display | `/products/free-queue-system/display` | TV or second monitor in the waiting area |

Cross-tab sync uses a `BroadcastChannel` with a storage-event fallback, plus a
polling floor of 2s so the display never goes stale even if the channel drops.

The display is read-only and must survive being left open for twelve hours: no
memory growth, no accumulating DOM, wake-lock requested where available.

---

## 3. Data model

```ts
/** A queue line. Most businesses have one; banks and RTOs have several. */
export type Service = {
  id: string;
  name: string;              // "New registration", "Payment", "Report collection"
  /** Single letter prefixing the token number: A-42. "" = plain numbers. */
  prefix: string;
  /** Estimated minutes per person; drives the wait estimate. */
  avgServiceMinutes: number;
  colour: string;            // chip colour on the display
  active: boolean;
  sortOrder: number;
  createdAt: string;
};

export type Counter = {
  id: string;
  name: string;              // "Counter 1", "Dr. Mehta", "Chair 2"
  /** Services this counter can serve. Empty = all. */
  serviceIds: string[];
  staffName: string;
  active: boolean;
  createdAt: string;
};

export type TokenStatus =
  | "waiting"
  | "called"       // announced, walking over
  | "serving"
  | "served"
  | "skipped"      // called twice, did not appear
  | "cancelled";

export type Token = {
  id: string;
  serviceId: string;
  /** Per service, per day, from 1. Display value is prefix + number. */
  number: number;
  /** "YYYY-MM-DD" — the reset key. */
  date: string;
  status: TokenStatus;
  priority: boolean;         // senior citizen, emergency, appointment-holder
  counterId: string | null;
  /** Optional, for the WhatsApp notify and the self-service link. */
  customerName: string;
  phone: string;
  note: string;
  issuedAt: string;
  calledAt: string | null;
  servingStartedAt: string | null;
  closedAt: string | null;
  /** Times this token has been recalled. Two recalls → skip is offered. */
  recallCount: number;
  /** Set when the token was issued by the customer's own phone via QR. */
  selfIssued: boolean;
};

export type QueueSettings = {
  id: "main";
  /** Tokens reset to 1 at this hour daily. */
  dailyResetHour: number;
  displayTitle: string;             // "Welcome to Sharma Diagnostics"
  tickerText: string;               // scrolling notice line
  showNextCount: number;            // how many upcoming tokens to list, default 5
  voiceEnabled: boolean;
  voiceLang: string;                // "hi-IN", "en-IN", "mr-IN", "ta-IN"…
  voiceRate: number;                // 0.5–1.5
  /** Spoken pattern; {{token}} and {{counter}} substituted. */
  voiceTemplate: string;
  chimeEnabled: boolean;
  chimeSound: "bell" | "ding" | "chime";
  /** Announce each call this many times. */
  announceRepeat: 1 | 2;
  theme: "light" | "dark" | "high-contrast";
  selfIssueEnabled: boolean;
  messageTemplates: Record<QueueTemplateKey, string>;
  pinHash?: string;
  pinSalt?: string;
  autoLockMinutes?: number;
  lastBackupAt: string | null;
};

export type QueueTemplateKey = "tokenIssued" | "almostYourTurn";
```

Object stores: `services`, `counters`, `tokens`, `queueSettings`.
Index `tokens.date` and `tokens.status` — every query is scoped to today.

---

## 4. Screens

```ts
export type ScreenId = "counter" | "issue" | "history" | "reports" | "settings";
```

### 4.1 Counter (default)

Built for one thumb, standing up.

- **Big current card**: the token this counter is serving right now — number,
  service, elapsed time, customer name if captured.
- **Primary action: `Call next`.** Full-width button. Picks the highest-priority
  oldest `waiting` token for a service this counter serves, sets `called`,
  triggers the display and the announcement.
- **Secondary actions on the current token:** `Recall` (re-announce, increments
  `recallCount`), `Start serving`, `Done`, `Skip`, `Transfer to…` (another
  service or counter).
- **Waiting list** below: next 10 tokens, priority ones flagged and floated,
  each tappable to call out of order (with a confirm, since it jumps the queue).
- **Counter picker** in the header when more than one counter exists; remembered
  per device in `localStorage` so each terminal stays on its own counter.
- **Live stats strip**: waiting count, average wait today, served-by-me today.

### 4.2 Issue

Where tokens are created — usually a receptionist, sometimes the same person.

- Service chips, one tap each; the biggest touch targets in the app.
- Optional name and phone fields, collapsed behind "Add details".
- Priority toggle.
- On issue: show the token number huge for two seconds, offer `Print slip`
  (58mm) and `Send on WhatsApp` when a phone was entered.
- **Estimated wait** shown on issue and printed on the slip:
  `waitingAhead × service.avgServiceMinutes ÷ activeCountersForService`.
- **QR self-issue**: a printable A4 poster with a QR to
  `/products/free-queue-system/view?s=<serviceId>`. The customer's own phone
  issues the token and then shows their live position. Requires the two devices
  to share the queue, so this is the one feature that needs the paid cloud tier
  for true multi-device — in the free app, self-issue works only on the same
  device, and the poster QR instead links to a "show this to the counter" page.
  **See open decision 1.**

### 4.3 Display

Not in the nav — a separate route, opened once and left running.

- **Now serving**: token and counter, at the largest type the viewport allows.
  Auto-scales with `clamp()` so it fills a 55" TV and a 15" monitor equally.
- **Recent calls**: the last three, smaller, below.
- **Next up**: the next `showNextCount` waiting tokens.
- **Ticker**: `tickerText` scrolling along the bottom.
- **Clock** in a corner.
- On a new call: flash the card, play the chime, speak the announcement, repeat
  per `announceRepeat`.
- Fullscreen button; hides all chrome. Requests a screen wake lock.
- Themes: light, dark, and a high-contrast mode for TVs seen from far away.
- Renders with no interactivity, no scroll, and never overflows.

### 4.4 History

Today's tokens in a table: number, service, status, counter, issued, called,
wait, service time. Filterable by service and status. This is where a supervisor
answers "what happened to token A-17".

### 4.5 Reports

- Tokens issued vs served vs skipped, by day.
- **Load by hour** — a bar row that tells the owner when to add staff.
- Average wait and average service time, overall and per counter.
- Counter/staff-wise served counts.
- Service-wise demand split.
- Skipped/no-show rate.
- CSV export.

### 4.6 Settings

Business details · Services · Counters · Display (title, ticker, next-count,
theme) · Announcements (voice on/off, language picker populated from
`speechSynthesis.getVoices()`, rate, template, test button, chime) ·
Daily reset hour · Self-issue · Message templates · Backup & restore ·
Screen lock · Reset.

The voice section needs a prominent **Test announcement** button — voice
availability varies wildly by browser and OS, and the user must confirm it works
on *their* screen before they trust it.

---

## 5. Business rules

| Rule | Definition |
|---|---|
| **Numbering** | Per service, per day, from 1. `date` is derived using `dailyResetHour`, so a clinic open past midnight keeps one logical day. |
| **Call-next order** | `priority` descending, then `issuedAt` ascending, within the services this counter serves. |
| **Skip** | Offered automatically after `recallCount >= 2`. Skipped tokens can be restored to `waiting` at the end of the queue. |
| **Wait estimate** | `ahead × avgServiceMinutes ÷ max(1, activeCounters)`, rounded to 5 minutes, displayed as "about N min". Never shown as an exact promise. |
| **Average wait** | `calledAt − issuedAt` over served tokens today. |
| **Average service time** | `closedAt − servingStartedAt`. Feeds back as a suggested `avgServiceMinutes` in Settings. |
| **Stale display guard** | If the display has not received an update in 10s it re-reads from IndexedDB unconditionally. |

---

## 6. Announcement

```
voiceTemplate default: "Token {{token}}, please proceed to {{counter}}"
Hindi default:         "टोकन {{token}}, कृपया {{counter}} पर जाएं"
```

Spoken via `speechSynthesis` with `voiceLang` and `voiceRate`. The token is
spelled so that `A-42` reads as "A forty-two", not "A dash four two" — split the
prefix from the number and join with a space.

Fallback chain: if no voice is available for `voiceLang`, fall back to any
`en-IN` voice, then the default voice, then chime-only. Never fail silently —
Settings shows which voice will actually be used.

---

## 7. Print outputs

| Output | Paper |
|---|---|
| Token slip | 58mm — big token number, service, estimated wait, time issued, business name |
| QR poster | A4 — "Scan to get your token", QR, business name, instructions |

---

## 8. Reuse map

| Need | Reuse |
|---|---|
| Two-surface app pattern | `components/tools/FreeDine/KitchenApp.tsx` and its route |
| IndexedDB | `lib/pos/db.ts` |
| Business profile | `lib/workspace/index.ts` |
| Slip printing | `lib/pos/receiptPdf.ts` |
| WhatsApp links | `lib/tuition/messages.ts` |
| PIN lock | `lib/pos/pin.ts` |
| Public view route precedent | `app/view/page.tsx` |
| QR rendering | `components/tools/UpiQrGenerator/` (QR component) |

---

## 9. Build phases

**Phase 1** — one service, one counter, issue + call next + display with chime.
This alone is shippable and covers most single-doctor clinics and small salons.

**Phase 2** — multiple services and counters, priority, skip/recall/transfer,
history.

**Phase 3** — voice announcements with language picker, display themes,
fullscreen, wake lock, ticker.

**Phase 4** — reports, token slips, QR poster, WhatsApp notify, marketing page.

---

## 10. Open decisions

1. **Self-issue by QR is the one feature that genuinely needs a server.** Two
   devices cannot share IndexedDB. Options: (a) drop self-issue from the free
   app entirely; (b) ship the QR poster as a "show this at the counter" flow with
   no live position; (c) make it the headline paid feature. Recommendation: (c),
   with (b) as the free placeholder — it makes the upgrade reason concrete and
   honest.
2. **Does the display need to work on a smart TV browser?** Those are often old
   Chromium builds with no `BroadcastChannel` and no `speechSynthesis`. If yes,
   the polling fallback and a chime-only mode become required, not optional.
3. **Should a token carry an appointment link** into the Clinic app when both are
   installed on the same device? The shared workspace makes it possible. It is a
   strong ecosystem story but couples two apps that are meant to stand alone.
   Recommendation: defer to after both ship.
4. **Daily reset hour vs manual reset** — is an automatic reset ever wrong, e.g.
   for a queue that runs across a night shift? Confirm with one real user.
5. **Voice language list** — which languages do we commit to testing? Suggest
   Hindi, English (India), Marathi, Tamil, Telugu, Bengali, Gujarati, Kannada.
