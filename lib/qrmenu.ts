import LZString from "lz-string";

// ---------------------------------------------------------------------------
// QR Menu data model
//
// The full menu lives inside the QR code itself (no database). The editor
// works with the verbose types below; before encoding we convert to a compact
// wire format (short keys, tuple items) so more menu fits inside a QR code.
// ---------------------------------------------------------------------------

export type DietTag = "" | "veg" | "nonveg";

export interface QrMenuItem {
  id: string;
  name: string;
  price: string;
  description: string;
  tag: DietTag;
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

// Compact wire format: [name, price, description, tag(0|1|2)]
type WireItem = [string, string, string, number];
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
  return { id: createId(), name: "", price: "", description: "", tag: "" };
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
          .map(
            (item): WireItem => [
              item.name.trim(),
              item.price.trim(),
              item.description.trim(),
              TAG_TO_NUM[item.tag] ?? 0,
            ]
          ),
      }))
      .filter((category) => category.n || category.i.length > 0),
  };
  if (menu.tagline.trim()) wire.t = menu.tagline.trim();
  if (menu.phone.trim()) wire.p = menu.phone.trim();
  if (menu.address.trim()) wire.a = menu.address.trim();
  if (menu.accent && menu.accent !== "#26306B") wire.h = menu.accent;
  return wire;
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

export function createSampleMenu(): QrMenuData {
  return {
    restaurantName: "Sharma's Kitchen",
    tagline: "Authentic North Indian flavours since 1998",
    phone: "+91 98765 43210",
    address: "12 MG Road, Indiranagar, Bengaluru",
    accent: "#26306B",
    categories: [
      {
        id: createId(),
        name: "Starters",
        items: [
          {
            id: createId(),
            name: "Paneer Tikka",
            price: "249",
            description: "Char-grilled cottage cheese with mint chutney",
            tag: "veg",
          },
          {
            id: createId(),
            name: "Chicken 65",
            price: "299",
            description: "Spicy deep-fried chicken, curry leaf tempering",
            tag: "nonveg",
          },
          {
            id: createId(),
            name: "Masala Papad",
            price: "79",
            description: "",
            tag: "veg",
          },
        ],
      },
      {
        id: createId(),
        name: "Main Course",
        items: [
          {
            id: createId(),
            name: "Dal Makhani",
            price: "279",
            description: "Slow-cooked black lentils in creamy tomato gravy",
            tag: "veg",
          },
          {
            id: createId(),
            name: "Butter Chicken",
            price: "349",
            description: "Tandoori chicken in rich makhani gravy",
            tag: "nonveg",
          },
          {
            id: createId(),
            name: "Veg Biryani",
            price: "229",
            description: "Fragrant basmati rice with seasonal vegetables",
            tag: "veg",
          },
        ],
      },
      {
        id: createId(),
        name: "Breads & Rice",
        items: [
          { id: createId(), name: "Butter Naan", price: "59", description: "", tag: "veg" },
          { id: createId(), name: "Garlic Naan", price: "69", description: "", tag: "veg" },
          { id: createId(), name: "Jeera Rice", price: "149", description: "", tag: "veg" },
        ],
      },
      {
        id: createId(),
        name: "Desserts & Beverages",
        items: [
          {
            id: createId(),
            name: "Gulab Jamun (2 pc)",
            price: "99",
            description: "Served warm with rabri",
            tag: "veg",
          },
          { id: createId(), name: "Masala Chaas", price: "59", description: "", tag: "veg" },
        ],
      },
    ],
  };
}
