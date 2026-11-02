// What's new: one list of what we shipped, read by every place that announces it.
//
// Two audiences, two kinds of marker:
//
// - The website (server-rendered) tags new tools and products "New" and
//   products that gained a feature "Updated". It has no visitor to remember,
//   so a tag simply lasts NEW_FOR_DAYS from the launch date, measured at build
//   time — the tag goes away on the first deploy after that.
//
// - Inside the apps (Browser Based POS, Free Dine), existing customers get a
//   trail from the screen they use every day down to the feature: a card on
//   the home screen, a dot on the nav tab, a count on the settings section and
//   a pill on the row itself. lib/hooks/useWhatsNew.ts remembers, per device,
//   what has been dismissed or visited.
//
// Shipping the next feature means adding one entry here; every marker follows.

import type { TKey } from "@/lib/i18n/translate";

/** How long anything stays "New" or "Updated". */
export const NEW_FOR_DAYS = 45;

const DAY_MS = 86_400_000;

/** True while a launch dated `addedOn` (yyyy-mm-dd) is still inside the window. */
export function isFresh(addedOn: string, now: number = Date.now()): boolean {
  const start = Date.parse(`${addedOn}T00:00:00Z`);
  if (Number.isNaN(start)) return false;
  return now >= start && now - start < NEW_FOR_DAYS * DAY_MS;
}

// ---- Website ---------------------------------------------------------------

/** Standalone tools (by slug in content/en/tools.json) and their launch dates. */
export const NEW_TOOLS: Record<string, string> = {
  "supplier-ledger": "2026-10-31",
};

/** Products (by id in content/en/products.json) launched recently. */
export const NEW_PRODUCTS: Record<string, string> = {
  "tb-analyzer": "2026-10-24",
};

/** Existing products that gained a feature, keyed by product id. */
export const UPDATED_PRODUCTS: Record<string, string> = {
  "browser-pos": "2026-10-31",
  "free-dine": "2026-10-30",
};

export function isNewTool(slug: string, now?: number): boolean {
  const addedOn = NEW_TOOLS[slug];
  return Boolean(addedOn && isFresh(addedOn, now));
}

/** "new", "updated" or null for a product card on /products. */
export function productTag(id: string, now?: number): "new" | "updated" | null {
  const launched = NEW_PRODUCTS[id];
  if (launched && isFresh(launched, now)) return "new";
  const updated = UPDATED_PRODUCTS[id];
  if (updated && isFresh(updated, now)) return "updated";
  return null;
}

/**
 * What's new strips on the product pages (English-only pages), newest first.
 * An entry drops off by itself once it is past the window.
 */
export type ProductNote = { addedOn: string; title: string; body: string; href: string; cta: string };

export const PRODUCT_NOTES: Record<string, ProductNote[]> = {
  "browser-pos": [
    {
      addedOn: "2026-10-31",
      title: "Supplier Ledger",
      body: "See what you owe each supplier. Credit purchases from the Purchase Register post as bills, and payments settle them bill by bill.",
      href: "/tools/supplier-ledger",
      cta: "Open Supplier Ledger",
    },
    {
      addedOn: "2026-10-31",
      title: "Accounts Payable Aging",
      body: "Pull unpaid credit purchases straight from the Purchase Register; marking one paid records it in the Supplier Ledger.",
      href: "/tools/accounts-payable-aging",
      cta: "Open Payables Aging",
    },
  ],
  "free-dine": [
    {
      addedOn: "2026-10-30",
      title: "A QR menu that keeps itself up to date",
      body: "Turn on the QR menu in Settings. Every dish, price or sold-out change reaches the menu diners scan within seconds — the printed QR never changes.",
      href: "#dine-app",
      cta: "Open Free Dine → Settings → QR menu",
    },
  ],
};

export function productNotes(id: string, now?: number): ProductNote[] {
  return (PRODUCT_NOTES[id] ?? []).filter((note) => isFresh(note.addedOn, now));
}

// ---- Inside the apps ---------------------------------------------------------

export type WhatsNewApp = "pos" | "dine";

export type AppUpdate = {
  /** Stable id; what the device remembers as dismissed or visited. */
  id: string;
  app: WhatsNewApp;
  /** Release date, yyyy-mm-dd. */
  addedOn: string;
  title: TKey;
  body: TKey;
  /** Label of the button that takes the owner to the feature. */
  cta: TKey;
  /** Where the feature lives: a nav screen id, and the element id to scroll to. */
  target: { screen: string; anchor: string };
  /**
   * POS connected-tool slugs this update introduces. Each one gets a "New"
   * pill in Settings → Connected tools until it is switched on.
   */
  features?: string[];
};

export const APP_UPDATES: AppUpdate[] = [
  {
    id: "pos-supplier-ledger",
    app: "pos",
    addedOn: "2026-10-31",
    title: "wnPosSupplierTitle",
    body: "wnPosSupplierBody",
    cta: "wnShowMe",
    target: { screen: "settings", anchor: "connected-tools" },
    features: ["supplier-ledger", "accounts-payable-aging"],
  },
  {
    id: "dine-qr-sync",
    app: "dine",
    addedOn: "2026-10-30",
    title: "wnDineQrTitle",
    body: "wnDineQrBody",
    cta: "wnDineQrCta",
    target: { screen: "settings", anchor: "qr-menu" },
  },
];

/**
 * The updates this business should hear about.
 *
 * Only ones released after the business was set up on this device: to someone
 * who started yesterday, everything is new, and twenty "New" pills would teach
 * them to ignore the one that matters. Also drops anything past its window.
 */
export function updatesFor(
  app: WhatsNewApp,
  businessCreatedAt: string | undefined,
  now: number = Date.now()
): AppUpdate[] {
  const since = businessCreatedAt ? Date.parse(businessCreatedAt) : Number.NaN;
  return APP_UPDATES.filter((update) => {
    if (update.app !== app || !isFresh(update.addedOn, now)) return false;
    // A business with no readable creation date is treated as existing.
    if (Number.isNaN(since)) return true;
    return since < Date.parse(`${update.addedOn}T00:00:00Z`);
  });
}

/** Whether a POS connected tool was introduced by a still-fresh update. */
export function isNewPosTool(slug: string, now?: number): boolean {
  return APP_UPDATES.some(
    (update) => update.app === "pos" && update.features?.includes(slug) && isFresh(update.addedOn, now)
  );
}
