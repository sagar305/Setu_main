import { describe, expect, it } from "vitest";
import { decodeMenu } from "@/lib/qrmenu";
import {
  freeMenuPayload,
  premiumMenuPayload,
  priceText,
  toFreeQrMenu,
  toPremiumCategories,
  type DineMenuSource,
} from "@/lib/dine/qrMenuSync";
import type { DineMenuItem } from "@/lib/dine/types";

const at = "2026-01-01T00:00:00.000Z";

function item(id: string, name: string, extra: Partial<DineMenuItem> = {}): DineMenuItem {
  return {
    id,
    name,
    categoryId: "mains",
    price: 24900,
    taxRate: null,
    taxInclusive: true,
    foodType: "veg",
    available: true,
    description: "",
    imageDataUrl: "",
    sortOrder: 0,
    createdAt: at,
    updatedAt: at,
    ...extra,
  };
}

function source(): DineMenuSource {
  return {
    business: {
      id: "main",
      name: "Sharma's Kitchen",
      phone: "9876543210",
      address: "MG Road",
      email: "",
      currency: "INR",
      gstin: "",
      logoDataUrl: "",
      upiId: "",
      timezone: "Asia/Kolkata",
      createdAt: at,
    },
    categories: [
      { id: "mains", name: "Mains", sortOrder: 1, createdAt: at },
      { id: "starters", name: "Starters", sortOrder: 0, createdAt: at },
      { id: "empty", name: "Empty", sortOrder: 2, createdAt: at },
    ],
    menuItems: [
      item("dal", "Dal Makhani", { sortOrder: 1, price: 27950 }),
      item("biryani", "Biryani", { sortOrder: 0, foodType: "nonveg" }),
      item("tikka", "Paneer Tikka", { categoryId: "starters" }),
      item("omelette", "Omelette", { categoryId: "starters", foodType: "egg", available: false }),
    ],
    variations: [
      { id: "full", menuItemId: "biryani", name: "Full", price: 37900, sortOrder: 1 },
      { id: "half", menuItemId: "biryani", name: "Half", price: 22900, sortOrder: 0 },
    ],
    modifierGroups: [
      { id: "g1", menuItemId: "tikka", name: "Extras", minSelect: 0, maxSelect: 3, sortOrder: 0 },
    ],
    modifiers: [
      { id: "m1", groupId: "g1", name: "Extra cheese", priceDelta: 3000, sortOrder: 0 },
      { id: "m2", groupId: "g1", name: "No onion", priceDelta: 0, sortOrder: 1 },
    ],
  };
}

describe("priceText", () => {
  it("drops the paise only when there are none", () => {
    expect(priceText(24900)).toBe("249");
    expect(priceText(24950)).toBe("249.50");
  });
});

describe("toFreeQrMenu", () => {
  it("keeps POS order, drops empty categories and hides switched-off dishes", () => {
    const menu = toFreeQrMenu(source(), true);
    expect(menu.restaurantName).toBe("Sharma's Kitchen");
    expect(menu.categories.map((c) => c.name)).toEqual(["Starters", "Mains"]);
    expect(menu.categories[0].items.map((i) => i.name)).toEqual(["Paneer Tikka"]);
    expect(menu.categories[1].items.map((i) => i.name)).toEqual(["Biryani", "Dal Makhani"]);
  });

  it("turns variations into the variant group, in order", () => {
    const biryani = toFreeQrMenu(source(), true).categories[1].items[0];
    expect(biryani.price).toBe("");
    expect(biryani.tag).toBe("nonveg");
    expect(biryani.variant?.options).toEqual([
      { name: "Half", price: "229" },
      { name: "Full", price: "379" },
    ]);
  });

  it("shows option groups after the variant, with add-on prices", () => {
    const tikka = toFreeQrMenu(source(), true).categories[0].items[0];
    expect(tikka.price).toBe("249");
    expect(tikka.variant).toBeNull();
    expect(tikka.extras).toEqual([
      {
        name: "Extras",
        options: [
          { name: "Extra cheese", price: "+30" },
          { name: "No onion", price: "" },
        ],
      },
    ]);
  });

  it("round-trips option groups through the QR payload", () => {
    const decoded = decodeMenu(freeMenuPayload(source(), true));
    expect(decoded?.categories[0].items[0].extras?.[0].options[0]).toEqual({
      name: "Extra cheese",
      price: "+30",
    });
    // A dish with only a variant keeps the old 5-element encoding.
    expect(decoded?.categories[1].items[0].extras).toEqual([]);
  });

  it("can keep switched-off dishes, with egg left unmarked", () => {
    const starters = toFreeQrMenu(source(), false).categories[0];
    expect(starters.items.map((i) => [i.name, i.tag])).toEqual([
      ["Paneer Tikka", "veg"],
      ["Omelette", ""],
    ]);
  });

  it("encodes to a payload the free menu page can read back", () => {
    const decoded = decodeMenu(freeMenuPayload(source(), true));
    expect(decoded?.categories[1].items[1]).toMatchObject({ name: "Dal Makhani", price: "279.50" });
  });

  it("is stable, so an unchanged menu is never re-sent", () => {
    expect(freeMenuPayload(source(), true)).toBe(freeMenuPayload(source(), true));
    expect(premiumMenuPayload(source())).toBe(premiumMenuPayload(source()));
  });
});

describe("toPremiumCategories", () => {
  it("shows switched-off dishes as sold out instead of hiding them", () => {
    const starters = toPremiumCategories(source())[0];
    expect(starters.items.map((i) => [i.name, i.soldOut])).toEqual([
      ["Paneer Tikka", false],
      ["Omelette", true],
    ]);
  });

  it("maps variations to an absolute group and modifiers to an add-on group", () => {
    const [starters, mains] = toPremiumCategories(source());
    expect(mains.items[0].variantGroups).toEqual([
      {
        name: "",
        priceMode: "absolute",
        selection: "single",
        options: [
          { name: "Half", price: "229", isDefault: true },
          { name: "Full", price: "379", isDefault: false },
        ],
      },
    ]);
    expect(starters.items[0].variantGroups).toEqual([
      {
        name: "Extras",
        priceMode: "addon",
        selection: "multi",
        options: [
          { name: "Extra cheese", price: "30", isDefault: false },
          { name: "No onion", price: "", isDefault: false },
        ],
      },
    ]);
  });

  it("clips fields to the premium API's limits", () => {
    const long = source();
    long.menuItems = [item("x", "A".repeat(100), { description: "d".repeat(500) })];
    const dish = toPremiumCategories(long)[0].items[0];
    expect(dish.name).toHaveLength(60);
    expect(dish.description).toHaveLength(200);
  });
});

describe("free menu wire format", () => {
  it("encodes a menu without extras to the same bytes as before", async () => {
    const { encodeMenu } = await import("@/lib/qrmenu");
    const LZString = (await import("lz-string")).default;
    const menu = toFreeQrMenu({ ...source(), modifierGroups: [], modifiers: [] }, true);
    const wire = JSON.parse(LZString.decompressFromEncodedURIComponent(encodeMenu(menu)));
    // [name, price, description, tag] or + variant — never a 6th element.
    for (const category of wire.c) {
      for (const item of category.i) expect(item.length).toBeLessThanOrEqual(5);
    }
  });

  it("formats add-on prices for diners", async () => {
    const { displayPrice } = await import("@/lib/qrmenu");
    expect(displayPrice("249")).toBe("₹249");
    expect(displayPrice("+30")).toBe("+₹30");
    expect(displayPrice("MRP")).toBe("MRP");
  });
});
