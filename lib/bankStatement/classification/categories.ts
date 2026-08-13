// Default category tree (spec §11) — CA/business oriented.
// Users may add, rename, archive and reorder. Built-in categories cannot be
// deleted, and no category in use can be deleted at all (decision 22).

import type { Category, CategoryGroup } from "@/lib/bankStatement/types";

type Seed = { name: string; group: CategoryGroup };

const SEEDS: Seed[] = [
  { name: "Sales", group: "INCOME" },
  { name: "Service Income", group: "INCOME" },
  { name: "Interest Income", group: "INCOME" },
  { name: "Other Income", group: "INCOME" },

  { name: "Purchases", group: "EXPENSE" },
  { name: "Salaries", group: "EXPENSE" },
  { name: "Rent", group: "EXPENSE" },
  { name: "Electricity", group: "EXPENSE" },
  { name: "Telephone", group: "EXPENSE" },
  { name: "Internet", group: "EXPENSE" },
  { name: "Travel", group: "EXPENSE" },
  { name: "Office Expenses", group: "EXPENSE" },
  { name: "Professional Fees", group: "EXPENSE" },
  { name: "Bank Charges", group: "EXPENSE" },
  { name: "Insurance", group: "EXPENSE" },
  { name: "Advertising", group: "EXPENSE" },
  { name: "Repairs & Maintenance", group: "EXPENSE" },
  { name: "Software", group: "EXPENSE" },
  { name: "Taxes", group: "EXPENSE" },
  { name: "GST", group: "EXPENSE" },
  { name: "TDS", group: "EXPENSE" },
  { name: "Loan Interest", group: "EXPENSE" },
  { name: "Other Expenses", group: "EXPENSE" },

  { name: "Own Account Transfer", group: "TRANSFER" },
  { name: "Investment", group: "TRANSFER" },
  { name: "Loan", group: "TRANSFER" },
  { name: "Credit Card Payment", group: "TRANSFER" },

  { name: "Cash Deposit", group: "CASH" },
  { name: "Cash Withdrawal", group: "CASH" },
];

export function slugifyCategory(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function defaultCategories(): Category[] {
  return SEEDS.map((seed, index) => ({
    id: slugifyCategory(seed.name),
    name: seed.name,
    group: seed.group,
    builtIn: true,
    archived: false,
    order: index,
  }));
}

export const GROUP_LABELS: Record<CategoryGroup, string> = {
  INCOME: "Income",
  EXPENSE: "Expenses",
  TRANSFER: "Transfers",
  CASH: "Cash",
};

/** Look a category up by id, falling back to its own id as the label. */
export function categoryName(categories: Category[], id: string | undefined): string {
  if (!id) return "Uncategorised";
  return categories.find((category) => category.id === id)?.name ?? id;
}

export function categoryGroup(
  categories: Category[],
  id: string | undefined
): CategoryGroup | "UNCATEGORISED" {
  if (!id) return "UNCATEGORISED";
  return categories.find((category) => category.id === id)?.group ?? "UNCATEGORISED";
}

/** Active categories in display order, grouped. */
export function activeCategories(categories: Category[]): Category[] {
  return categories.filter((category) => !category.archived).sort((a, b) => a.order - b.order);
}
