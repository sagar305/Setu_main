# Implementation brief: durable, offline-safe activity tracking

Paste this as the opening message of a fresh Claude Code session on
`claude/user-activity-tracking-wwu8go`.

---

## Goal

Build a first-party analytics pipeline for the Setu Technology site so that
**every event is counted exactly once**, including events generated while the
device is offline, and so that **every page emits enough signal to reconstruct
what a visitor did** — without degrading the offline products in any way.

Three hard requirements, in priority order:

1. **No event is silently lost.** An event created offline, on a flaky 2G
   connection, or one second before the tab is closed must still arrive. When
   an event genuinely cannot be delivered, the system must record *that it was
   dropped* rather than pretending it never existed.
2. **The offline products must not be harmed.** Several tools are explicitly
   offline-first and store real user work in IndexedDB and localStorage.
   Analytics must never compete with them for storage, never block a render,
   never throw into product code, and never transmit anything a user typed.
3. **Full-surface coverage.** Page views on every route change, every click
   that matters, scroll depth, tool milestones, form outcomes and errors —
   without hand-instrumenting two hundred components.

## What already exists (read these first)

| Path | Why it matters |
|---|---|
| `app/layout.tsx:104-118` | Vercel Analytics, Speed Insights, and a bare GA4 install (`G-0FTL28EE7E`) that only fires `gtag('config')`. Soft navigations are not reliably counted today. |
| `lib/tuition/store.tsx:920-990` | **The precedent to follow.** An existing durable queue: skip when `navigator.onLine` is false, debounced flush, re-check for rows re-dirtied mid-flight before clearing, and a `window.addEventListener("online", ...)` flush. Mirror this discipline. |
| `lib/hooks/useLocalStore.ts` | House pattern for localStorage: load once on mount so SSR markup stays deterministic, swallow storage errors, never persist an untouched tool. |
| `lib/pos/db.ts`, `lib/token/db.ts`, `lib/rental/db.ts`, `lib/dine/db.ts`, `lib/bankStatement/storage/db.ts` | Existing IndexedDB stores holding real user work. Analytics gets its **own** database and must never share these. |
| `tests/privacy.test.ts` | Fails the build if `gtag|dataLayer|analytics|posthog|mixpanel|Sentry` or `fetch|XMLHttpRequest|sendBeacon|WebSocket|axios` appear anywhere under `lib/bankStatement/**` or `components/tools/BankStatementAnalyzer/**`. **Do not weaken this test — extend it.** |
| `scripts/check-seo.mjs` | Build gate. Every indexable page needs a title of 30-60 chars, a meta description of 120-160 chars, and exactly one `<h1>`. New legal pages must pass. |
| `app/sitemap.ts`, `components/Footer.tsx` | Where new routes get registered and linked. |
| `app/api/contact/route.ts` | House shape for a route handler: parse, validate, fail with a typed JSON error and a real status code. |

## Ask before building

Do not assume answers to these. Ask, in one round, and wait:

1. **Where do events land?** A first-party `POST /api/events` route is
   non-negotiable (ad blockers eat `gtag`, and a same-origin endpoint is what
   makes delivery guarantees possible). But the sink behind it is open:
   Supabase (a `analytics_events` table — Supabase tooling is already
   available), a hosted product-analytics vendor, or forward server-side to
   GA4 via Measurement Protocol. Recommend one, list the trade-off, let the
   answer decide.
2. **Does GA4 stay?** Options: keep it as-is alongside the new pipeline, keep
   it only for page views and conversions, or retire it once the first-party
   pipeline is trusted. Retiring loses historical continuity.
3. **Consent model.** No banner (relying on India's DPDP Act notice-and-
   grievance model plus a footer opt-out), or an interstitial banner for EU
   traffic. GA4 is already running today without one, so this is a decision
   about an existing exposure, not a new one.
4. **Retention period** for raw events, and whether IP is stored at all
   (recommendation: never store raw IP — derive country server-side from
   request headers and discard).
5. **Grievance officer name and contact** for the privacy page. DPDP Act
   requires a named contact; `sagarbansal305@gmail.com` is a placeholder unless
   confirmed.
6. **Legal page copy** — draft it, or is there existing approved wording?

## Architecture

### `lib/analytics/` — the pipeline

Pure, framework-free, unit-testable. No React imports.

- **`types.ts`** — the `AnalyticsEvent` shape. Every event carries:
  `event_id` (UUID v4, the server's idempotency key), `seq` (monotonic per
  visitor, so ordering survives out-of-order flushes), `name`, `props`,
  `client_ts` (captured at creation — this is what keeps offline events
  truthful), `visitor_id`, `session_id`, `visit_number`, `visitor_type`,
  `path`, `referrer`. The server adds `server_ts` and `received_offline_delay`.
- **`visitor.ts`** — identity and session. A `setu_vid` UUID in localStorage;
  `firstSeen`, `lastSeen`, `visitCount`. Derive `visitor_type: "new" |
  "returning"`, `visit_number`, `days_since_first`. Sessions roll over after
  30 minutes of inactivity or at UTC midnight, held in `sessionStorage`.
  Handle the case where storage is blocked entirely (private mode, Brave
  hardened) by degrading to an in-memory ephemeral id rather than throwing.
- **`queue.ts`** — a durable FIFO queue in a **dedicated IndexedDB database
  named `setu_analytics`**, separate from every product database.
  - localStorage is the wrong home for this: it is synchronous, ~5 MB, and
    shared with invoice drafts and statement data. A user parked on the token
    or POS screen offline for three hours could generate thousands of events
    and evict real work. This is the single most important decision in the
    brief — do not put the queue in localStorage.
  - Write to the queue **before** any network attempt. Delete a row **only**
    after a 2xx acknowledging its `event_id`.
  - Hard cap the queue (start at 2,000 events / ~5 MB). On overflow, evict
    oldest-first and increment a persisted `dropped_count`, which rides along
    on the next successful flush as a `queue_overflow` event. Loss becomes
    visible instead of silent.
- **`transport.ts`** — flush logic.
  - Batch up to N events per request. `fetch` with `keepalive: true` normally;
    `navigator.sendBeacon` on the `visibilitychange → hidden` and `pagehide`
    paths, since those are the only ones that survive a tab close.
  - Exponential backoff with jitter, capped. A circuit breaker after
    consecutive failures stops the retry loop from burning battery and data on
    a metered Indian mobile connection — that is a product concern, not just an
    engineering one.
  - Never `await` a flush from anything on a render or interaction path.
- **`index.ts`** — the only public surface: `trackEvent(name, props?)`.
  Fire-and-forget, synchronous-looking, swallows every error. No component
  anywhere imports `gtag`, `fetch`, or the queue directly.

### `components/analytics/` — the React layer

- **`AnalyticsProvider.tsx`** (client) mounted once in `app/layout.tsx`:
  - Fires `page_view` on every `usePathname()` change. Fix the GA4 install at
    the same time: `send_page_view: false` in the config, page views fired
    explicitly. **`useSearchParams()` must sit inside a `<Suspense>` boundary
    or `next build` fails with a CSR-bailout error** — this is the most common
    way this feature breaks the build.
  - One delegated `click` listener in the capture phase on `document`. It reads
    a `data-analytics="..."` attribute from the nearest ancestor that has one.
    For any `<a>` or `<button>` without one, it falls back to a generic event
    carrying tag, role, `href`, and a truncated accessible label. This
    fallback is what delivers "every page is detectable" without editing 200
    components.
  - Scroll depth (25/50/75/100, once each per page), time-on-page on exit,
    outbound-link and file-download clicks, `window.onerror` /
    `unhandledrejection`.
  - Flush triggers: `online`, `visibilitychange`, `pagehide`, a periodic timer,
    and a queue-depth threshold.
  - Honour opt-out: a stored opt-out flag, `navigator.doNotTrack`, and Global
    Privacy Control. When opted out, `trackEvent` becomes a no-op and the
    queue is cleared.

### `app/api/events/route.ts` — collection

- Validate the batch shape and reject anything malformed with a typed error.
- **Deduplicate on `event_id`** — the queue guarantees at-least-once delivery,
  so the server is what makes it effectively-once. A replayed batch must be a
  no-op.
- Enrich server-side from request headers: country, coarse device class,
  `server_ts`. Never persist a raw IP address.
- Return the list of accepted `event_id`s so the client knows precisely which
  rows to delete. A blanket 200 is not good enough — a partial write would
  otherwise drop events.
- Rate-limit per visitor so the endpoint cannot be turned into a write
  amplifier.

### Instrumentation coverage

Add `data-analytics` attributes to: primary nav, all footer links, every
calculator CTA and result-copy action, every tool open and export/download,
book-demo and contact form start / submit / success / error, pricing table
interactions, product-page CTAs, and search submissions. Add tool milestone
events (`tool_opened`, `tool_completed`) at the page wrapper level.

## Non-negotiable constraints

- **No analytics import inside offline product code.** Not in
  `lib/bankStatement/**`, `components/tools/BankStatementAnalyzer/**`,
  `lib/pos/**`, `lib/token/**`, `lib/clinic/**`, `lib/rental/**`,
  `lib/dine/**`, or `lib/tuition/**`. Instrument these from their page or route
  wrapper instead. The bank statement analyzer's on-device promise is a
  marketing asset — do not spend it on a click counter.
- **Extend `tests/privacy.test.ts`**, do not relax it. Add the other
  offline product trees to its scanned set so this boundary is enforced for
  them too, and add a new test asserting the analytics module never reads
  `.value`, `.textContent`, or `.innerText` from arbitrary elements — only
  whitelisted `data-*` attributes. No user-entered value may ever enter a
  payload.
- **Storage budget.** Analytics gets a hard ceiling and yields to product data.
  If IndexedDB is unavailable or full, degrade to in-memory and keep the site
  working.
- **Never block.** No `await` on analytics in any render, effect that gates UI,
  or event handler that produces a user-visible result.

## Legal pages

Create `/privacy` and `/terms`.

- Register both in `app/sitemap.ts`; link both in `components/Footer.tsx`.
- Both must clear `scripts/check-seo.mjs`: title 30-60 chars, description
  120-160 chars, exactly one `<h1>`.
- The privacy page must accurately describe what is actually collected — GA4,
  Vercel Analytics, the first-party event pipeline, and the localStorage /
  IndexedDB the tools use for the user's own work — plus retention, the DPDP
  Act rights and named grievance contact, and an explicit statement that tool
  data (invoices, bank statements, POS records) never leaves the device.
- Include a working **opt-out control on the privacy page** that sets the flag
  the pipeline honours. Verify it actually stops collection.

## Testing

- **Vitest** (`tests/analytics/`, Node environment) for the pure layer: queue
  ordering, FIFO eviction and `dropped_count`, dedupe key generation, session
  rollover at the 30-minute boundary and at midnight, backoff schedule,
  new-vs-returning derivation, opt-out short-circuit.
- **Playwright** (`tests/e2e/`) for what only exists in a browser: use
  `context.setOffline(true)`, generate events across several navigations, go
  back online, and assert every event arrives exactly once and in order. Also
  assert a tab closed mid-session flushes via `sendBeacon`.
- `npm run build` must pass, including `check:seo`, `check:pricing`,
  `check:dine`, and `npm test`.

## Deliverable

Work on `claude/user-activity-tracking-wwu8go`. Commit in reviewable steps —
pipeline, React layer, API route, instrumentation, legal pages, tests — rather
than one large commit. Do not open a pull request unless asked.

Report honestly at the end: what is covered, what is not, and any event class
that can still be lost with the delivery guarantees as built.
