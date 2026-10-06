// The dictionary key for each shared expense category.
//
// The categories themselves are stored as the English strings in
// EXPENSE_CATEGORIES, because they are identifiers: an expense recorded in one
// language has to group with the same category when the workspace is read in
// another. This is what turns the stored identifier into the reader's language
// for display, and it lives here rather than in the Expense Tracker because
// three tools now show the same stored names.

import type { TKey } from "@/lib/i18n/translate";

export const EXPENSE_CATEGORY_KEYS: Record<string, TKey> = {
  Rent: "expCatRent",
  Salaries: "expCatSalaries",
  Electricity: "expCatElectricity",
  Purchases: "expCatPurchases",
  Transport: "expCatTransport",
  Marketing: "expCatMarketing",
  Maintenance: "expCatMaintenance",
  Other: "expCatOther",
};
