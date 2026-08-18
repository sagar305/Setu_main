// Seed data offered during setup (FR-1.3).
//
// The point of this list is that a new user reaches a printed bill without
// typing a menu first — so it covers a normal Indian restaurant's spread, and
// deliberately includes the shapes people otherwise never discover:
// variations (Half/Full biryani), modifier groups (spice level, add-ons), and
// recipes that follow both.
//
// Recipes ship with it for the same reason. Stock tracking is off by default,
// but when someone switches it on they land on a menu that is already costed,
// with a half plate that genuinely uses less rice and an add-on that genuinely
// costs more cheese — which explains the feature far better than help text.
//
// Prices are in paise; recipe quantities are in each material's base unit
// (grams, millilitres or pieces) and get scaled on the way in.

import type { BaseUnit } from "./units";

export type SampleMaterial = {
  name: string;
  unit: BaseUnit;
  packLabel: string;
  /** Base units in one pack, unscaled. */
  packSize: number;
  /** Warn at or below this, unscaled. 0 = never. */
  reorderLevel: number;
  /**
   * Indicative price of one pack, in paise.
   *
   * Seeded as the opening cost with zero stock on hand, so a new user sees
   * real plate costs and food-cost percentages instead of a menu of ₹0.00.
   * It is a placeholder by design: the first real purchase replaces it
   * outright, because a weighted average of nothing is whatever was bought.
   */
  packPrice: number;
};

/** What a kitchen buys, as opposed to what it sells. */
export const SAMPLE_MATERIALS: SampleMaterial[] = [
  { name: "Basmati rice", unit: "g", packLabel: "5 kg sack", packSize: 5000, reorderLevel: 2000, packPrice: 60000 },
  { name: "Chicken", unit: "g", packLabel: "kg", packSize: 1000, reorderLevel: 2000, packPrice: 22000 },
  { name: "Paneer", unit: "g", packLabel: "kg", packSize: 1000, reorderLevel: 1000, packPrice: 36000 },
  { name: "Onion", unit: "g", packLabel: "kg", packSize: 1000, reorderLevel: 2000, packPrice: 4000 },
  { name: "Tomato", unit: "g", packLabel: "kg", packSize: 1000, reorderLevel: 2000, packPrice: 4000 },
  { name: "Carrot", unit: "g", packLabel: "kg", packSize: 1000, reorderLevel: 1000, packPrice: 5000 },
  { name: "Capsicum", unit: "g", packLabel: "kg", packSize: 1000, reorderLevel: 500, packPrice: 6000 },
  { name: "Mixed vegetables", unit: "g", packLabel: "kg", packSize: 1000, reorderLevel: 1000, packPrice: 6000 },
  { name: "Black dal", unit: "g", packLabel: "kg", packSize: 1000, reorderLevel: 1000, packPrice: 13000 },
  { name: "Wheat flour", unit: "g", packLabel: "5 kg sack", packSize: 5000, reorderLevel: 2000, packPrice: 25000 },
  { name: "Gram flour", unit: "g", packLabel: "kg", packSize: 1000, reorderLevel: 500, packPrice: 9000 },
  { name: "Sugar", unit: "g", packLabel: "kg", packSize: 1000, reorderLevel: 1000, packPrice: 4500 },
  { name: "Milk", unit: "ml", packLabel: "litre", packSize: 1000, reorderLevel: 3000, packPrice: 6000 },
  { name: "Curd", unit: "ml", packLabel: "litre", packSize: 1000, reorderLevel: 1000, packPrice: 7000 },
  { name: "Cream", unit: "ml", packLabel: "500 ml bottle", packSize: 500, reorderLevel: 500, packPrice: 12000 },
  { name: "Ghee", unit: "ml", packLabel: "litre", packSize: 1000, reorderLevel: 500, packPrice: 60000 },
  { name: "Cooking oil", unit: "ml", packLabel: "15 L tin", packSize: 15000, reorderLevel: 3000, packPrice: 195000 },
  { name: "Butter", unit: "g", packLabel: "500 g pack", packSize: 500, reorderLevel: 500, packPrice: 26000 },
  { name: "Cheese", unit: "g", packLabel: "kg", packSize: 1000, reorderLevel: 500, packPrice: 45000 },
  { name: "Spice mix", unit: "g", packLabel: "500 g pack", packSize: 500, reorderLevel: 300, packPrice: 30000 },
  { name: "Tea leaves", unit: "g", packLabel: "500 g pack", packSize: 500, reorderLevel: 250, packPrice: 25000 },
  { name: "Lemon", unit: "pc", packLabel: "dozen", packSize: 12, reorderLevel: 12, packPrice: 6000 },
  { name: "Egg", unit: "pc", packLabel: "tray of 30", packSize: 30, reorderLevel: 12, packPrice: 21000 },
  { name: "Soda", unit: "ml", packLabel: "litre", packSize: 1000, reorderLevel: 2000, packPrice: 4000 },
];

/** One recipe line: how much of a material, per portion. */
export type SampleRecipeLine = { material: string; qty: number };

export type SampleModifier = {
  name: string;
  priceDelta: number;
  /** Added on top of whichever recipe applies. Negative removes. */
  recipe?: SampleRecipeLine[];
};

export type SampleModifierGroup = {
  name: string;
  minSelect: number;
  maxSelect: number;
  options: SampleModifier[];
};

export type SampleItem = {
  name: string;
  price: number;
  foodType: "veg" | "nonveg" | "egg";
  description?: string;
  /** Base recipe, used by any size without one of its own. */
  recipe?: SampleRecipeLine[];
  variations?: { name: string; price: number; recipe?: SampleRecipeLine[] }[];
  modifierGroups?: SampleModifierGroup[];
};

export type SampleCategory = {
  name: string;
  items: SampleItem[];
};

/**
 * Spice level is a required pick with no price difference — and a small but
 * real difference in what it consumes, which is the cheapest way to show that
 * add-ons move stock as well as money.
 */
const SPICE_LEVEL: SampleModifierGroup = {
  name: "Spice level",
  minSelect: 1,
  maxSelect: 1,
  options: [
    { name: "Mild", priceDelta: 0, recipe: [{ material: "Spice mix", qty: 2 }] },
    { name: "Medium", priceDelta: 0, recipe: [{ material: "Spice mix", qty: 4 }] },
    { name: "Spicy", priceDelta: 0, recipe: [{ material: "Spice mix", qty: 7 }] },
  ],
};

const BIRYANI_ADDONS: SampleModifierGroup = {
  name: "Add-ons",
  minSelect: 0,
  maxSelect: 2,
  options: [
    { name: "Extra raita", priceDelta: 3000, recipe: [{ material: "Curd", qty: 80 }] },
    { name: "Boiled egg", priceDelta: 2500, recipe: [{ material: "Egg", qty: 1 }] },
  ],
};

export const SAMPLE_MENU: SampleCategory[] = [
  {
    name: "Starters",
    items: [
      {
        name: "Paneer Tikka",
        price: 24000,
        foodType: "veg",
        description: "Cottage cheese, capsicum and onion in the tandoor",
        recipe: [
          { material: "Paneer", qty: 150 },
          { material: "Capsicum", qty: 40 },
          { material: "Onion", qty: 40 },
          { material: "Curd", qty: 30 },
        ],
        modifierGroups: [SPICE_LEVEL],
      },
      {
        name: "Veg Manchurian",
        price: 20000,
        foodType: "veg",
        recipe: [
          { material: "Mixed vegetables", qty: 180 },
          { material: "Gram flour", qty: 40 },
          { material: "Cooking oil", qty: 30 },
        ],
      },
      {
        name: "Chicken 65",
        price: 28000,
        foodType: "nonveg",
        recipe: [
          { material: "Chicken", qty: 200 },
          { material: "Curd", qty: 40 },
          { material: "Cooking oil", qty: 40 },
        ],
        modifierGroups: [SPICE_LEVEL],
      },
    ],
  },
  {
    name: "Main Course",
    items: [
      {
        name: "Paneer Butter Masala",
        price: 28000,
        foodType: "veg",
        recipe: [
          { material: "Paneer", qty: 160 },
          { material: "Tomato", qty: 120 },
          { material: "Onion", qty: 60 },
          { material: "Butter", qty: 25 },
          { material: "Cream", qty: 30 },
        ],
        modifierGroups: [SPICE_LEVEL],
      },
      {
        name: "Dal Makhani",
        price: 24000,
        foodType: "veg",
        recipe: [
          { material: "Black dal", qty: 120 },
          { material: "Butter", qty: 20 },
          { material: "Cream", qty: 25 },
          { material: "Tomato", qty: 60 },
        ],
      },
      {
        name: "Kadai Vegetable",
        price: 26000,
        foodType: "veg",
        recipe: [
          { material: "Mixed vegetables", qty: 200 },
          { material: "Capsicum", qty: 50 },
          { material: "Tomato", qty: 80 },
          { material: "Cooking oil", qty: 25 },
        ],
      },
      {
        name: "Butter Chicken",
        price: 36000,
        foodType: "nonveg",
        recipe: [
          { material: "Chicken", qty: 220 },
          { material: "Tomato", qty: 130 },
          { material: "Butter", qty: 30 },
          { material: "Cream", qty: 40 },
        ],
        modifierGroups: [SPICE_LEVEL],
      },
    ],
  },
  {
    name: "Breads",
    items: [
      {
        name: "Tandoori Roti",
        price: 3500,
        foodType: "veg",
        recipe: [{ material: "Wheat flour", qty: 60 }],
      },
      {
        name: "Butter Naan",
        price: 6000,
        foodType: "veg",
        recipe: [
          { material: "Wheat flour", qty: 80 },
          { material: "Butter", qty: 10 },
        ],
        modifierGroups: [
          {
            name: "Add-ons",
            minSelect: 0,
            maxSelect: 2,
            options: [
              {
                name: "Extra butter",
                priceDelta: 2000,
                recipe: [{ material: "Butter", qty: 15 }],
              },
              { name: "Cheese", priceDelta: 4000, recipe: [{ material: "Cheese", qty: 35 }] },
            ],
          },
        ],
      },
      {
        name: "Garlic Naan",
        price: 8000,
        foodType: "veg",
        recipe: [
          { material: "Wheat flour", qty: 80 },
          { material: "Butter", qty: 12 },
        ],
      },
    ],
  },
  {
    name: "Rice & Biryani",
    items: [
      {
        name: "Jeera Rice",
        price: 18000,
        foodType: "veg",
        recipe: [
          { material: "Basmati rice", qty: 150 },
          { material: "Ghee", qty: 15 },
        ],
      },
      {
        name: "Veg Biryani",
        price: 26000,
        foodType: "veg",
        // The base is the full plate; Half carries its own, lighter recipe.
        recipe: [
          { material: "Basmati rice", qty: 250 },
          { material: "Mixed vegetables", qty: 150 },
          { material: "Ghee", qty: 20 },
          { material: "Curd", qty: 50 },
        ],
        variations: [
          {
            name: "Half",
            price: 18000,
            // Less rice and veg, but the raita portion barely changes — which
            // is exactly why a size gets its own recipe and not a multiplier.
            recipe: [
              { material: "Basmati rice", qty: 150 },
              { material: "Mixed vegetables", qty: 90 },
              { material: "Ghee", qty: 12 },
              { material: "Curd", qty: 45 },
            ],
          },
          { name: "Full", price: 26000 },
        ],
        modifierGroups: [BIRYANI_ADDONS],
      },
      {
        name: "Chicken Biryani",
        price: 32000,
        foodType: "nonveg",
        recipe: [
          { material: "Basmati rice", qty: 250 },
          { material: "Chicken", qty: 200 },
          { material: "Ghee", qty: 20 },
          { material: "Curd", qty: 50 },
        ],
        variations: [
          {
            name: "Half",
            price: 22000,
            recipe: [
              { material: "Basmati rice", qty: 150 },
              { material: "Chicken", qty: 120 },
              { material: "Ghee", qty: 12 },
              { material: "Curd", qty: 45 },
            ],
          },
          { name: "Full", price: 32000 },
        ],
        modifierGroups: [BIRYANI_ADDONS],
      },
    ],
  },
  {
    name: "Beverages",
    items: [
      {
        name: "Masala Chai",
        price: 4000,
        foodType: "veg",
        recipe: [
          { material: "Milk", qty: 100 },
          { material: "Tea leaves", qty: 5 },
          { material: "Sugar", qty: 10 },
        ],
      },
      {
        name: "Fresh Lime Soda",
        price: 7000,
        foodType: "veg",
        recipe: [
          { material: "Lemon", qty: 1 },
          { material: "Soda", qty: 200 },
          { material: "Sugar", qty: 15 },
        ],
      },
      {
        name: "Sweet Lassi",
        price: 9000,
        foodType: "veg",
        recipe: [
          { material: "Curd", qty: 200 },
          { material: "Sugar", qty: 25 },
        ],
      },
    ],
  },
  {
    name: "Desserts",
    items: [
      {
        name: "Gulab Jamun",
        price: 9000,
        foodType: "veg",
        recipe: [
          { material: "Milk", qty: 80 },
          { material: "Sugar", qty: 60 },
          { material: "Wheat flour", qty: 20 },
        ],
      },
      {
        name: "Gajar Halwa",
        price: 12000,
        foodType: "veg",
        recipe: [
          { material: "Carrot", qty: 250 },
          { material: "Milk", qty: 100 },
          { material: "Sugar", qty: 50 },
          { material: "Ghee", qty: 20 },
        ],
      },
    ],
  },
];

/** Default floor seeded on setup (FR-1.4). */
export const DEFAULT_AREA_NAME = "Main Hall";
export const DEFAULT_TABLE_COUNT = 8;
export const DEFAULT_TABLE_SEATS = 4;
