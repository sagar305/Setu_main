// Seed menu offered during setup (FR-1.3).
//
// The point of this list is that a new user reaches a printed bill without
// typing a menu first — so it covers a normal Indian restaurant's spread, and
// deliberately includes the two shapes people otherwise never discover:
// variations (Half/Full biryani) and modifier groups (spice level, add-ons).
//
// Prices are in paise and are plausible mid-market 2026 figures. Everything
// here is editable the moment setup finishes.

export type SampleModifier = { name: string; priceDelta: number };

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
  variations?: { name: string; price: number }[];
  modifierGroups?: SampleModifierGroup[];
};

export type SampleCategory = {
  name: string;
  items: SampleItem[];
};

const SPICE_LEVEL: SampleModifierGroup = {
  name: "Spice level",
  minSelect: 1,
  maxSelect: 1,
  options: [
    { name: "Mild", priceDelta: 0 },
    { name: "Medium", priceDelta: 0 },
    { name: "Spicy", priceDelta: 0 },
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
        modifierGroups: [SPICE_LEVEL],
      },
      { name: "Veg Manchurian", price: 20000, foodType: "veg" },
      {
        name: "Chicken 65",
        price: 28000,
        foodType: "nonveg",
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
        modifierGroups: [SPICE_LEVEL],
      },
      { name: "Dal Makhani", price: 24000, foodType: "veg" },
      { name: "Kadai Vegetable", price: 26000, foodType: "veg" },
      {
        name: "Butter Chicken",
        price: 36000,
        foodType: "nonveg",
        modifierGroups: [SPICE_LEVEL],
      },
    ],
  },
  {
    name: "Breads",
    items: [
      { name: "Tandoori Roti", price: 3500, foodType: "veg" },
      {
        name: "Butter Naan",
        price: 6000,
        foodType: "veg",
        modifierGroups: [
          {
            name: "Add-ons",
            minSelect: 0,
            maxSelect: 2,
            options: [
              { name: "Extra butter", priceDelta: 2000 },
              { name: "Cheese", priceDelta: 4000 },
            ],
          },
        ],
      },
      { name: "Garlic Naan", price: 8000, foodType: "veg" },
    ],
  },
  {
    name: "Rice & Biryani",
    items: [
      { name: "Jeera Rice", price: 18000, foodType: "veg" },
      {
        name: "Veg Biryani",
        price: 26000,
        foodType: "veg",
        variations: [
          { name: "Half", price: 18000 },
          { name: "Full", price: 26000 },
        ],
        modifierGroups: [
          {
            name: "Add-ons",
            minSelect: 0,
            maxSelect: 2,
            options: [
              { name: "Extra raita", priceDelta: 3000 },
              { name: "Boiled egg", priceDelta: 2500 },
            ],
          },
        ],
      },
      {
        name: "Chicken Biryani",
        price: 32000,
        foodType: "nonveg",
        variations: [
          { name: "Half", price: 22000 },
          { name: "Full", price: 32000 },
        ],
        modifierGroups: [
          {
            name: "Add-ons",
            minSelect: 0,
            maxSelect: 2,
            options: [
              { name: "Extra raita", priceDelta: 3000 },
              { name: "Boiled egg", priceDelta: 2500 },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "Beverages",
    items: [
      { name: "Masala Chai", price: 4000, foodType: "veg" },
      { name: "Fresh Lime Soda", price: 7000, foodType: "veg" },
      { name: "Sweet Lassi", price: 9000, foodType: "veg" },
    ],
  },
  {
    name: "Desserts",
    items: [
      { name: "Gulab Jamun", price: 9000, foodType: "veg" },
      { name: "Gajar Halwa", price: 12000, foodType: "veg" },
    ],
  },
];

/** Default floor seeded on setup (FR-1.4). */
export const DEFAULT_AREA_NAME = "Main Hall";
export const DEFAULT_TABLE_COUNT = 8;
export const DEFAULT_TABLE_SEATS = 4;
