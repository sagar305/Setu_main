import LZString from "lz-string";

import type { LanguageCode } from "./i18n/config";
import { translate, type TKey } from "./i18n/translate";

// ---------------------------------------------------------------------------
// QR Menu data model
//
// The full menu lives inside the QR code itself (no database). The editor
// works with the verbose types below; before encoding we convert to a compact
// wire format (short keys, tuple items) so more menu fits inside a QR code.
// ---------------------------------------------------------------------------

export type DietTag = "" | "veg" | "nonveg";

export interface QrVariantOption {
  name: string;
  /** A full price, not a difference from the item's price. */
  price: string;
}

/**
 * One user-named set of choices for a dish, e.g. "Size" with Small/Large.
 * The free tool allows a single group per dish; the premium tool allows
 * several. Each option carries its own price, so variants replace the item's
 * single price rather than adding to it.
 */
export interface QrVariant {
  name: string;
  options: QrVariantOption[];
}

export interface QrMenuItem {
  id: string;
  name: string;
  price: string;
  description: string;
  tag: DietTag;
  variant: QrVariant | null;
}

export interface QrMenuCategory {
  id: string;
  name: string;
  items: QrMenuItem[];
}

export interface QrMenuData {
  restaurantName: string;
  tagline: string;
  phone: string;
  address: string;
  accent: string;
  categories: QrMenuCategory[];
}

// Compact wire format: [name, price, description, tag(0|1|2)] with an optional
// 5th element for variants: [groupName, [[optionName, price], ...]].
//
// The 5th element is only written when a dish actually has variants, so menus
// without them encode to exactly the same bytes as before and QR codes printed
// from earlier versions still decode here.
type WireVariant = [string, [string, string][]];
type WireItem =
  | [string, string, string, number]
  | [string, string, string, number, WireVariant];
interface WireCategory {
  n: string;
  i: WireItem[];
}
interface WireMenu {
  v: 1;
  n: string;
  t?: string;
  p?: string;
  a?: string;
  h?: string;
  c: WireCategory[];
}

// QR byte-mode capacity at version 40: M = 2331, L = 2953.
// We switch to the lower error-correction level as the URL grows, and refuse
// to render a QR beyond the L limit (with a small safety margin).
export const QR_CAPACITY_M = 2331;
export const QR_CAPACITY_MAX = 2900;

export const MENU_PATH = "/menu";

export function createId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function createEmptyItem(): QrMenuItem {
  return { id: createId(), name: "", price: "", description: "", tag: "", variant: null };
}

export function createEmptyVariant(): QrVariant {
  return { name: "", options: [{ name: "", price: "" }] };
}

/** Variants replace the single price, so only count ones with a named option. */
export function hasVariant(item: QrMenuItem): boolean {
  return Boolean(item.variant?.options.some((option) => option.name.trim()));
}

export function createEmptyCategory(name = ""): QrMenuCategory {
  return { id: createId(), name, items: [createEmptyItem()] };
}

export function createEmptyMenu(): QrMenuData {
  return {
    restaurantName: "",
    tagline: "",
    phone: "",
    address: "",
    accent: "#26306B",
    categories: [createEmptyCategory()],
  };
}

const TAG_TO_NUM: Record<DietTag, number> = { "": 0, veg: 1, nonveg: 2 };
const NUM_TO_TAG: DietTag[] = ["", "veg", "nonveg"];

function toWire(menu: QrMenuData): WireMenu {
  const wire: WireMenu = {
    v: 1,
    n: menu.restaurantName.trim(),
    c: menu.categories
      .map((category) => ({
        n: category.name.trim(),
        i: category.items
          .filter((item) => item.name.trim())
          .map((item): WireItem => {
            const base: [string, string, string, number] = [
              item.name.trim(),
              item.price.trim(),
              item.description.trim(),
              TAG_TO_NUM[item.tag] ?? 0,
            ];

            const options = (item.variant?.options ?? [])
              .filter((option) => option.name.trim())
              .map((option): [string, string] => [
                option.name.trim(),
                option.price.trim(),
              ]);

            // Omit the element entirely when there are no variants, so menus
            // without them cost nothing extra in the QR payload.
            if (options.length === 0) return base;
            return [...base, [item.variant?.name.trim() ?? "", options]];
          }),
      }))
      .filter((category) => category.n || category.i.length > 0),
  };
  if (menu.tagline.trim()) wire.t = menu.tagline.trim();
  if (menu.phone.trim()) wire.p = menu.phone.trim();
  if (menu.address.trim()) wire.a = menu.address.trim();
  if (menu.accent && menu.accent !== "#26306B") wire.h = menu.accent;
  return wire;
}

function parseWireVariant(raw: WireVariant | undefined): QrVariant | null {
  if (!Array.isArray(raw)) return null;

  const [name, options] = raw;
  if (!Array.isArray(options)) return null;

  const parsed = options
    .filter((option): option is [string, string] => Array.isArray(option))
    .map((option) => ({
      name: typeof option[0] === "string" ? option[0] : "",
      price: typeof option[1] === "string" ? option[1] : "",
    }))
    .filter((option) => option.name);

  if (parsed.length === 0) return null;
  return { name: typeof name === "string" ? name : "", options: parsed };
}

function fromWire(wire: WireMenu): QrMenuData {
  return {
    restaurantName: typeof wire.n === "string" ? wire.n : "",
    tagline: typeof wire.t === "string" ? wire.t : "",
    phone: typeof wire.p === "string" ? wire.p : "",
    address: typeof wire.a === "string" ? wire.a : "",
    accent: typeof wire.h === "string" ? wire.h : "#26306B",
    categories: (Array.isArray(wire.c) ? wire.c : []).map((category) => ({
      id: createId(),
      name: typeof category.n === "string" ? category.n : "",
      items: (Array.isArray(category.i) ? category.i : []).map((item) => ({
        id: createId(),
        name: typeof item[0] === "string" ? item[0] : "",
        price: typeof item[1] === "string" ? item[1] : "",
        description: typeof item[2] === "string" ? item[2] : "",
        tag: NUM_TO_TAG[item[3]] ?? "",
        // Absent on QR codes generated before variants existed.
        variant: parseWireVariant(item[4]),
      })),
    })),
  };
}

/** Compress the menu into the URL-safe payload stored inside the QR code. */
export function encodeMenu(menu: QrMenuData): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(toWire(menu)));
}

/** Full URL the QR code points to, e.g. https://site.com/menu#m=<payload> */
export function buildMenuUrl(menu: QrMenuData, origin: string): string {
  return `${origin}${MENU_PATH}#m=${encodeMenu(menu)}`;
}

/**
 * Decode a menu from the payload in a scanned URL. Accepts the raw payload or
 * a full hash/query string containing `m=<payload>`. Returns null if the data
 * is missing or malformed.
 */
export function decodeMenu(raw: string): QrMenuData | null {
  let payload = raw.replace(/^[#?]/, "");
  if (payload.includes("=")) {
    const params = new URLSearchParams(payload);
    payload = params.get("m") ?? "";
  }
  if (!payload) return null;

  try {
    const json = LZString.decompressFromEncodedURIComponent(payload);
    if (!json) return null;
    const wire = JSON.parse(json) as WireMenu;
    if (!wire || typeof wire !== "object" || !Array.isArray(wire.c)) return null;
    return fromWire(wire);
  } catch {
    return null;
  }
}

/** Count of items with a name, across all categories. */
export function countMenuItems(menu: QrMenuData): number {
  return menu.categories.reduce(
    (total, category) => total + category.items.filter((item) => item.name.trim()).length,
    0
  );
}

/**
 * The demo menu behind "load sample".
 *
 * Every string in it lands in an editable field, so it is built in the
 * reader's language: a Hindi restaurateur who presses the button to see how
 * the tool works should not be handed an English menu to retype. Dish names
 * are transliterated rather than renamed, because that is what they are called
 * in each of these languages too.
 */
export function createSampleMenu(lang: LanguageCode = "en"): QrMenuData {
  const s = (key: TKey) => translate(lang, key);
  const item = (
    name: TKey,
    price: string,
    description: TKey | null = null,
    tag: DietTag = "veg"
  ): QrMenuItem => ({
    id: createId(),
    name: s(name),
    price,
    description: description ? s(description) : "",
    tag,
    variant: null,
  });

  return {
    restaurantName: s("qmSampleRestaurant"),
    tagline: s("qmSampleTagline"),
    phone: s("qmPhonePlaceholder"),
    address: s("qmSampleAddress"),
    accent: "#26306B",
    categories: [
      {
        id: createId(),
        name: s("qmExampleStarters"),
        items: [
          item("qmSamplePaneerTikka", "249", "qmSampleDescPaneer"),
          item("qmSampleChicken65", "299", "qmSampleDescChicken65", "nonveg"),
          item("qmSampleMasalaPapad", "79"),
        ],
      },
      {
        id: createId(),
        name: s("qmExampleMains"),
        items: [
          item("qmSampleDalMakhani", "279", "qmSampleDescDal"),
          item("qmSampleButterChicken", "349", "qmSampleDescButterChicken", "nonveg"),
          {
            ...item("qmSampleVegBiryani", "", "qmSampleDescBiryani"),
            variant: {
              name: s("qmSampleVarSize"),
              options: [
                { name: s("qmSampleHalf"), price: "229" },
                { name: s("qmSampleFull"), price: "379" },
              ],
            },
          },
        ],
      },
      {
        id: createId(),
        name: s("qmSampleCatBreads"),
        items: [
          item("qmSampleButterNaan", "59"),
          item("qmSampleGarlicNaan", "69"),
          item("qmSampleJeeraRice", "149"),
        ],
      },
      {
        id: createId(),
        name: s("qmSampleCatDesserts"),
        items: [
          item("qmSampleGulabJamun", "99", "qmSampleDescGulab"),
          item("qmSampleMasalaChaas", "59"),
        ],
      },
    ],
  };
}
