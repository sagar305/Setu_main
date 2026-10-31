// Keeping a QR menu in step with Free Dine.
//
// The POS already holds the menu the restaurant sells from, so it is the menu
// the diners should scan. Two destinations, both behind a QR that never
// changes once printed:
//
// - Free: the free QR Menu Generator's published menu (/menu/<code>). The menu
//   is stored by the shortener as the same compressed payload the free tool
//   uses, and the edit token kept in this POS's settings is what lets it be
//   repointed. No account.
// - Premium: a Setu QR Menu account (/m/<slug>). The POS pushes its menu with
//   the sync key the owner generated in that app; the backend keeps photos and
//   badges the owner added there.
//
// Everything below is pure apart from the two network calls at the bottom, so
// the payload — and therefore "has anything changed since the last push" — is
// deterministic for a given menu.

import { encodeMenu, type DietTag, type QrMenuData } from "@/lib/qrmenu";
import { ShortenError, shortenPayload, updateShortLink } from "@/lib/toolkit/shortLink";
import { toMajor } from "./money";
import type {
  DineBusiness,
  DineCategory,
  DineMenuItem,
  DineModifier,
  DineModifierGroup,
  DineVariation,
  FoodType,
} from "./types";

export type DineMenuSource = {
  business: DineBusiness | null;
  categories: DineCategory[];
  menuItems: DineMenuItem[];
  variations: DineVariation[];
  modifierGroups: DineModifierGroup[];
  modifiers: DineModifier[];
};

// Field limits of the premium backend. Clipping here rather than letting the
// server refuse keeps one over-long dish name from stopping the whole sync.
const LIMITS = { category: 40, item: 60, option: 40, description: 200, categories: 50, items: 300 };

function clip(value: string, max: number): string {
  return value.trim().slice(0, max);
}

/** 24900 → "249", 24950 → "249.50". The menu shows the number as typed. */
export function priceText(paise: number): string {
  const major = toMajor(paise);
  return Number.isInteger(major) ? String(major) : major.toFixed(2);
}

/**
 * Egg dishes carry no mark rather than a guessed one: the QR menus only know
 * veg and non-veg, and calling an omelette either would mislead someone.
 */
function dietTag(type: FoodType): DietTag {
  return type === "veg" ? "veg" : type === "nonveg" ? "nonveg" : "";
}

const bySort = <T extends { sortOrder: number }>(a: T, b: T) => a.sortOrder - b.sortOrder;

/** Categories in POS order, each with its dishes in POS order. Empty ones dropped. */
function orderedMenu(source: DineMenuSource, includeUnavailable: boolean) {
  const items = [...source.menuItems]
    .filter((item) => item.name.trim() && (includeUnavailable || item.available))
    .sort(bySort);
  return [...source.categories]
    .sort(bySort)
    .map((category) => ({
      category,
      items: items.filter((item) => item.categoryId === category.id),
    }))
    .filter((group) => group.items.length > 0)
    .slice(0, LIMITS.categories);
}

function variationsOf(source: DineMenuSource, itemId: string): DineVariation[] {
  return source.variations.filter((v) => v.menuItemId === itemId && v.name.trim()).sort(bySort);
}

// ---------------------------------------------------------------------------
// Free QR menu
// ---------------------------------------------------------------------------

/** A dish's option groups (add-ons, spice level) with their named choices. */
function optionGroupsOf(source: DineMenuSource, itemId: string) {
  return source.modifierGroups
    .filter((group) => group.menuItemId === itemId)
    .sort(bySort)
    .map((group) => ({
      group,
      options: source.modifiers
        .filter((modifier) => modifier.groupId === group.id && modifier.name.trim())
        .sort(bySort)
        .slice(0, 30),
    }))
    .filter(({ options }) => options.length > 0);
}

/**
 * The free tool's menu shape. Variations become the dish's variant (each with
 * its full price) and option groups follow it as extra groups, priced "+30"
 * on top of the dish; a free choice ("no onion", "mild") shows no price. It
 * has no sold-out badge, so unavailable dishes are left off unless the owner
 * asked to keep them.
 */
export function toFreeQrMenu(source: DineMenuSource, hideUnavailable: boolean): QrMenuData {
  const business = source.business;
  return {
    restaurantName: business?.name.trim() ?? "",
    tagline: "",
    phone: business?.phone.trim() ?? "",
    address: business?.address.trim() ?? "",
    accent: "#26306B",
    categories: orderedMenu(source, !hideUnavailable).map(({ category, items }) => ({
      id: category.id,
      name: clip(category.name, LIMITS.category),
      items: items.map((item) => {
        const variations = variationsOf(source, item.id);
        return {
          id: item.id,
          name: clip(item.name, LIMITS.item),
          price: variations.length > 0 ? "" : priceText(item.price),
          description: clip(item.description, LIMITS.description),
          tag: dietTag(item.foodType),
          variant:
            variations.length > 0
              ? {
                  name: "",
                  options: variations.map((v) => ({
                    name: clip(v.name, LIMITS.option),
                    price: priceText(v.price),
                  })),
                }
              : null,
          extras: optionGroupsOf(source, item.id).map(({ group, options }) => ({
            name: clip(group.name, LIMITS.option),
            options: options.map((modifier) => ({
              name: clip(modifier.name, LIMITS.option),
              price: modifier.priceDelta ? `+${priceText(modifier.priceDelta)}` : "",
            })),
          })),
        };
      }),
    })),
  };
}

/** The free menu with the default look; Free Dine itself publishes it branded (lib/qrmenu-pos-link). */
export function freeMenuPayload(source: DineMenuSource, hideUnavailable: boolean): string {
  return encodeMenu(toFreeQrMenu(source, hideUnavailable));
}

// ---------------------------------------------------------------------------
// Premium QR menu
// ---------------------------------------------------------------------------

type PremiumOption = { name: string; price: string; isDefault: boolean };
type PremiumGroup = {
  name: string;
  priceMode: "absolute" | "addon";
  selection: "single" | "multi";
  options: PremiumOption[];
};
export type PremiumCategory = {
  name: string;
  items: {
    name: string;
    price: string;
    description: string;
    tag: DietTag;
    soldOut: boolean;
    variantGroups: PremiumGroup[];
  }[];
};

/**
 * The premium menu shape. Richer than the free one: variations become an
 * "absolute" group (the option is the price), modifier groups become "addon"
 * groups, and a dish switched off at the counter shows as sold out rather
 * than vanishing — so a diner can see it exists, just not tonight.
 */
export function toPremiumCategories(source: DineMenuSource): PremiumCategory[] {
  return orderedMenu(source, true).map(({ category, items }) => ({
    name: clip(category.name, LIMITS.category),
    items: items.slice(0, LIMITS.items).map((item) => {
      const groups: PremiumGroup[] = [];

      const variations = variationsOf(source, item.id);
      if (variations.length > 0) {
        groups.push({
          name: "",
          priceMode: "absolute",
          selection: "single",
          options: variations.slice(0, 30).map((v, index) => ({
            name: clip(v.name, LIMITS.option),
            price: priceText(v.price),
            isDefault: index === 0,
          })),
        });
      }

      for (const { group, options } of optionGroupsOf(source, item.id)) {
        groups.push({
          name: clip(group.name, LIMITS.option),
          priceMode: "addon",
          selection: group.maxSelect > 1 ? "multi" : "single",
          options: options.map((modifier) => ({
            name: clip(modifier.name, LIMITS.option),
            // A free modifier ("no onion") shows no price at all.
            price: modifier.priceDelta ? priceText(modifier.priceDelta) : "",
            isDefault: false,
          })),
        });
      }

      return {
        name: clip(item.name, LIMITS.item),
        price: priceText(item.price),
        description: clip(item.description, LIMITS.description),
        tag: dietTag(item.foodType),
        soldOut: !item.available,
        variantGroups: groups.slice(0, 10),
      };
    }),
  }));
}

export function premiumMenuPayload(source: DineMenuSource): string {
  return JSON.stringify(toPremiumCategories(source));
}

// ---------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------

export class QrSyncError extends Error {
  /** "auth" = the key is wrong or revoked; "plan" = premium has lapsed. */
  reason: "offline" | "auth" | "plan" | "unavailable" | "failed";

  constructor(reason: QrSyncError["reason"], message: string) {
    super(message);
    this.name = "QrSyncError";
    this.reason = reason;
  }
}

export type FreePublishResult = { code: string; editToken: string };

/** First publish creates the code; later ones repoint it. */
export async function publishFreeMenu(
  payload: string,
  existing: FreePublishResult | null
): Promise<FreePublishResult> {
  try {
    if (existing) {
      await updateShortLink(existing.code, payload, existing.editToken);
      return existing;
    }
    const link = await shortenPayload(payload, "menu");
    if (!link.editToken) throw new QrSyncError("failed", "No edit token was returned.");
    return { code: link.code, editToken: link.editToken };
  } catch (error) {
    if (error instanceof QrSyncError) throw error;
    if (error instanceof ShortenError) {
      throw new QrSyncError(error.reason, error.message);
    }
    throw new QrSyncError("failed", "Could not publish the menu.");
  }
}

export type PremiumStatus = {
  businessName: string;
  slug: string;
  menuUrl: string;
  planActive: boolean;
  planExpiresAt: string | null;
  lastSyncAt: string | null;
};

const PROXY = "/api/qr-menu/pos";

async function callPremium(
  path: string,
  key: string,
  init: { method: string; body?: unknown }
): Promise<{ pos: PremiumStatus }> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new QrSyncError("offline", "Updating the QR menu needs an internet connection.");
  }
  let response: Response;
  try {
    response = await fetch(`${PROXY}${path}`, {
      method: init.method,
      headers: { "Content-Type": "application/json", "X-Setu-Pos-Key": key },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      cache: "no-store",
    });
  } catch {
    throw new QrSyncError("failed", "Could not reach Setu QR Menu.");
  }

  const data = (await response.json().catch(() => null)) as
    | ({ pos?: PremiumStatus; error?: string; code?: string } & Record<string, unknown>)
    | null;
  if (response.ok && data?.pos) return { pos: data.pos };

  const message = typeof data?.error === "string" ? data.error : `Request failed (${response.status}).`;
  if (response.status === 401) throw new QrSyncError("auth", message);
  if (response.status === 402) throw new QrSyncError("plan", message);
  if (response.status === 503) throw new QrSyncError("unavailable", message);
  throw new QrSyncError("failed", message);
}

/** Check a pasted key before saving it. */
export function checkPremiumKey(key: string): Promise<{ pos: PremiumStatus }> {
  return callPremium("/status", key, { method: "GET" });
}

export function pushPremiumMenu(key: string, payload: string): Promise<{ pos: PremiumStatus }> {
  return callPremium("/menu", key, {
    method: "PUT",
    body: { categories: JSON.parse(payload) as PremiumCategory[], publish: true },
  });
}
