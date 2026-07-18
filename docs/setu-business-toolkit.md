# Setu Business Toolkit

### Product Vision, Roadmap & Ecosystem Specification

> **Status:** Living document. Chapters 1–3 are drafted; 4–9 are structured stubs
> being filled in. Where this document describes data shapes or the tool
> roadmap, the **code is the source of truth** — this prose is a view of it:
>
> | Concern | Source of truth in code |
> |---|---|
> | Shared entities, ownership, permissions | `lib/toolkit/entities.ts` |
> | Tool roadmap + integration catalog | `lib/toolkit/registry.ts` |
> | Storage rules & namespacing | `lib/toolkit/storage.ts` |
> | Schema migrations | `lib/toolkit/migration.ts` |
> | Workspace access + consent | `lib/toolkit/workspace.ts` |

---

## Chapter 1 — Vision

### Why Setu exists

Small businesses in India are surrounded by software that demands a login, an
internet connection, a subscription, and their data — before it gives them
anything back. Setu's free tools invert that. They work the moment they load,
offline, without an account, and the data never leaves the device.

### Long-term mission

Build a collection of business tools that:

- Work completely **independently** — no tool requires another to function.
- Work **offline** whenever possible.
- Require **no login**.
- **Share data only when it improves the experience** — and only with consent.
- **Never force** users into another tool.
- Still **feel like one ecosystem**.

### The four philosophies

1. **Offline-first.** The core promise. If a feature can't work offline, it is a
   candidate for the paid cloud tier, not the free tool (see Chapter 2).
2. **No login.** Identity is the device, not an account. "Signed in" has a Setu
   equivalent: *the device has a workspace*.
3. **The user owns the data.** Everything lives in the browser, on the device,
   and is fully exportable. No cloud in the free tier.
4. **One ecosystem, many independent tools.** Tools are standalone to the
   outside world and modular to the returning user (see the shell model in
   Chapter 3).

### How free tools support the paid platform

Free tools are not loss-leaders for a single product — they build trust, brand
familiarity, and daily habit. Depending on the user's business type, they lead
naturally to the appropriate paid Setu product:

```
Browser POS / QR Menu ─────► Restaurant POS
Invoice / Ledger / Labels ─► Retail POS
Appointment Book ──────────► Clinic Management
Queue Management ──────────► Restaurant / Clinic
```

The funnel target is the **Setu Platform**, routed by business type — encoded
per tool as `paidPath` in `lib/toolkit/registry.ts`.

### Design principles (developer-binding)

| # | Principle | Consequence |
|---|-----------|-------------|
| 1 | Every tool works without any other Setu tool | No hard dependencies between tools |
| 2 | Every tool discovers previously saved data | Read the workspace, offer to import |
| 3 | Never ask twice | Reuse Business Profile, remember consent |
| 4 | The user owns all data | Local only, always exportable, no cloud (free tier) |

---

## Chapter 2 — Product Roadmap

The roadmap's real job is **not** to promise every tool — it is to define the
shared vocabulary so today's tools are built with tomorrow's fields already in
the data model. It is maintained as code in `lib/toolkit/registry.ts`; the
tables below are generated views.

### Tiers

```
Foundation ──► Growth ──► Future ──► Ideas
```

- **Foundation** — everything reads from these; build first.
- **Growth** — high-demand tools that deepen the workspace.
- **Future** — planned, not yet scheduled.
- **Ideas** — vocabulary only, so new tools fit the ecosystem when they come.

### Entry types

Not everything on the roadmap is a destination app. Each entry is tagged:

- **App** — its own route, its own job (e.g. Invoice Generator).
- **Workspace surface** — configuration, not a destination (e.g. Business
  Profile, Logo Manager). Reachable, but felt as settings.
- **Feature** — belongs inside another tool (e.g. Bulk Product Import).

### Built today

| Tool | Category | Funnels to |
|------|----------|-----------|
| Browser Based POS | Sales & Billing | Restaurant POS |
| Invoice Generator | Sales & Billing | Retail POS |
| QR Menu Generator | Restaurant | Restaurant POS |
| UPI QR Generator | Payments | Platform |
| GST Calculator | Finance | Platform |

### Foundation (Phase 1)

Business Profile → Logo Manager → Receipt Designer → Expense Tracker →
Cash Book → Appointment Book → Customer Ledger → Supplier Book.

The **first tool to build** is the **Receipt Designer**: it creates the shared
receipt-template entity that the POS and Invoice both consume — the original
integration that motivated this whole document.

### Growth (Phase 2)

Product Catalog → Barcode Generator → Label Printer → Stock Register →
Purchase Register → Profit Dashboard.

### Dependency ordering

The roadmap is a **graph, not a list** — build owners of shared entities first:

```
Business Profile ─────────────► (every tool)
Product Catalog ──────────────► Barcode · Label Printer · QR Menu · POS
Customer Book ────────────────► Customer Ledger ──► Loyalty Card
Ingredient Inventory ─────────► Recipe Manager ──► Food Cost
Supplier Book ────────────────► Purchase Register ──► Stock Register
```

### Full catalog

The complete categorised list (Business Identity, Sales & Billing, Product
Management, Customer Management, Inventory, Finance, Restaurant, Service,
Marketing, Documents, Utilities, AI) is maintained in the registry. Marketing,
Documents and the utility long-tail are carried as **Ideas** tier until
scheduled.

---

## Chapter 3 — Shared Workspace

### The one store

Instead of every tool inventing its own `localStorage` keys, there is **one
workspace**. It already exists: the POS created an IndexedDB (`POS_DATABASE`)
that doubles as the shared store, reached through `lib/toolkit/workspace.ts`.

```
workspace/
  business            products         customers
  categories          orders           order_items
  inventory           payments         settings
  (planned) suppliers · invoices · receipt_templates ·
            expenses · cashbook · appointments · ledger · assets
```

### Two-tier storage (the rule that prevents drift)

| Tier | Holds | Lives in |
|------|-------|----------|
| **Shared workspace data** | business, products, customers, orders… | IndexedDB via `lib/toolkit/workspace` |
| **Tool-local UI drafts** | unsaved forms, "last template used" | namespaced `localStorage` (`setu:<tool>:<key>`) |

Shared data is canonical and backed up as one unit. Tool-local drafts are
throwaway and never part of the backup. A tool must **never** copy a shared
entity into its own local store — that is exactly the duplication this spec
exists to kill. (Today's Invoice Generator still does this; migrating it is the
first proof of the pattern.)

### Same-origin: an architectural rule, not a preference

IndexedDB and `localStorage` are origin-scoped. Every tool **must** be served
from `setutechnology.com/...`. A tool on `pos.setutechnology.com` silently loses
the shared workspace. This is non-negotiable and enforced by convention +
`STORAGE_RULES.singleOrigin` in `lib/toolkit/storage.ts`.

### Consent — discover, ask, then read

A tool discovers the workspace (`hasWorkspace()`), **asks** the user before
connecting, then reads. Consent is remembered per tool (`hasConsent` /
`grantConsent`) so we honour "never ask twice." Import is offered, never
automatic.

### The shell: standalone to the world, modular to the user

The unresolved question — *separate apps or one app?* — is resolved by binding
the shell to workspace presence, not to the URL:

```
Visitor from Google → /tools/invoice-generator, hasWorkspace() == false
    → clean standalone tool, no app chrome. SEO + independence intact.

Returning user with a workspace → same URL, hasWorkspace() == true
    → the same page renders inside the Setu Workspace shell:
      module switcher, workspace status, suggested tools.
```

Same tool, same URL — the chrome upgrades when a workspace exists. This is the
Gmail/Contacts model: separately reachable, unified once "signed in."
**Hard rule: the shell is chrome, never a dependency.** Strip it away and every
tool must still fully work (Principle 1).

### Workspace backup (mandatory)

One click exports the **entire** workspace (business, products, customers,
templates, expenses, everything). Future tools' entities join the backup
automatically because they live in the same store. In a no-cloud model, this is
the user's only safety net — device loss must not mean data loss.

---

## Chapter 4 — Business Objects

> Normative schemas live in `lib/pos/types.ts` (canonical record shapes) and
> `lib/toolkit/entities.ts` (ownership, permissions, the `EntityMeta` envelope).

Each shared object carries an ownership envelope (`createdByTool`, `createdAt`,
`updatedAt`, `schemaVersion`) so we always know who created it and which schema
it was written against. Objects to be specified in full here: Business, Product,
Customer, Supplier, Invoice, Order, Receipt Template, Expense, Appointment,
Ledger entry, Inventory log, Payment.

**Known gap to close:** the live `Business` type carries `taxNumber` but not
separate PAN, website, timezone, receipt footer, or terms. The "single source of
truth" Business Profile needs these fields — tracked as a Foundation task, not
invented silently.

*(Full field-by-field tables: to be written.)*

---

## Chapter 5 — Integration Rules

- **One owner per entity.** Every shared entity has exactly one *primary editor*
  tool; all others read and may edit within the permission model. Encoded as
  `primaryEditor` in `lib/toolkit/entities.ts`.
- **Permission tiers:** `read` · `update` · `dangerous`. "Dangerous" operations
  (delete a product, change stock, change GST settings) are declared **on the
  entity**, not decided per tool, and the workspace layer enforces the
  confirmation. See `requiresConfirmation()`.
- **Import, never auto-merge.** Offer to import; let the user choose.
- **Dedup on import:** match products by SKU/barcode, customers by phone,
  suppliers by GSTIN. *(Rules to be finalised here.)*

---

## Chapter 6 — Integration Catalog

A view of the `integrations` declared in `lib/toolkit/registry.ts`
(`integrationCatalog()`), rendered as a table. Selected entries:

| Tool A | Tool B | Better UX |
|--------|--------|-----------|
| Receipt Designer | Browser POS | POS prints bills using a saved template |
| Receipt Designer | Invoice Generator | Invoice reuses the same branding |
| Browser POS | Invoice Generator | Import products & customers |
| Browser POS | UPI QR Generator | Use the business UPI at checkout |
| Browser POS | Customer Ledger | Open a customer's credit history |
| Product Catalog | QR Menu | Menu syncs with product updates |
| Appointment Book | Invoice Generator | Invoice after the appointment |
| Appointment Book | Queue Management | Walk-in → appointment |
| Expense Tracker | Profit Dashboard | Profit uses actual expenses |
| Business Profile | Every tool | Auto-fill business details |

*(Full catalog generated from the registry.)*

---

## Chapter 7 — Developer Standards

Shipping checklist (each answer must be "yes"): works offline? works without
login? reuses the workspace? asks before importing? user can export? user can
delete? suggests related tools? creates reusable objects with an ownership
envelope? *(Full standards: to be written.)*

---

## Chapter 8 — UI Standards

Every tool provides: empty state, import data, export data, suggested tools,
recent activity, workspace status. The two-mode shell (Chapter 3) is the shared
frame. *(Component-level standards: to be written.)*

---

## Chapter 9 — Offline Storage Standards

Normative rules live in `lib/toolkit/storage.ts` and `lib/toolkit/migration.ts`:
two-tier model, single-origin rule, namespaced local keys, central migration
layer (workspace version → tools always receive the latest shape).
*(Quota strategy for image-heavy entities and backup format: to be written.)*
