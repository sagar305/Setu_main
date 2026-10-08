// Journal entry scenario library — real-world transactions with the correct
// debit/credit lines pre-filled against the default Chart of Accounts
// (lib/bookkeeping defaultAccounts ids), a plain-language explanation and the
// most common mistake to avoid. Amounts are illustrative; users edit them.
//
// The structure lives here and the prose lives in ./journalScenarioText, so one
// entry is one set of debits and credits in every language rather than a
// separate library per language. A scenario is identified by its id; its
// category by a key, because both are compared against stored values while the
// labels on screen change with the reader.

import type { LanguageCode } from "@/lib/i18n/config";
import { SCENARIO_TEXT, type ScenarioText } from "./journalScenarioText";

export type ScenarioLine = {
  accountId: string; // id from defaultAccounts
  side: "debit" | "credit";
  amount: number;
};

export type ScenarioId =
  | "cash-sale"
  | "credit-sale"
  | "sales-return"
  | "advance-from-customer"
  | "rent-received"
  | "bad-debt-recovery"
  | "cash-purchase"
  | "credit-purchase"
  | "purchase-return"
  | "rent-paid"
  | "electricity-paid"
  | "marketing-spend"
  | "salary-paid"
  | "salary-accrued"
  | "cash-to-bank"
  | "bank-to-cash"
  | "loan-received"
  | "loan-repaid"
  | "bank-charges"
  | "asset-cash"
  | "asset-credit"
  | "depreciation"
  | "asset-sold"
  | "gst-on-sale"
  | "gst-on-purchase"
  | "gst-paid-govt"
  | "owner-invests"
  | "owner-drawings"
  | "customer-pays"
  | "supplier-paid"
  | "bad-debt-writeoff"
  | "accrued-expense"
  | "closing-stock"
;

export type ScenarioCategory =
  | "sales"
  | "purchases"
  | "payroll"
  | "cashBank"
  | "fixedAssets"
  | "taxes"
  | "equity"
  | "receivables"
  | "adjusting"
;

/** What the entry is: the same debits and credits whoever is reading. */
type ScenarioSpec = {
  id: ScenarioId;
  category: ScenarioCategory;
  lines: ScenarioLine[];
};

/** A scenario as the tool uses it — the entry plus the reader's own wording. */
export type JournalScenario = ScenarioSpec & ScenarioText;

/** The category keys in the order the filter chips show them. */
export const SCENARIO_CATEGORIES: readonly ScenarioCategory[] = [
  "sales",
  "purchases",
  "payroll",
  "cashBank",
  "fixedAssets",
  "taxes",
  "equity",
  "receivables",
  "adjusting",
] as const;

const A = {
  cash: "a-1000",
  bank: "a-1010",
  receivable: "a-1100",
  inventory: "a-1200",
  equipment: "a-1500",
  payable: "a-2000",
  gst: "a-2100",
  loan: "a-2200",
  capital: "a-3000",
  drawings: "a-3100",
  sales: "a-4000",
  otherIncome: "a-4100",
  purchases: "a-5000",
  rent: "a-5100",
  salaries: "a-5200",
  utilities: "a-5300",
  marketing: "a-5400",
  misc: "a-5900",
};

const SPECS: ScenarioSpec[] = [
  // ---- Sales & Revenue -----------------------------------------------
  {
    id: "cash-sale",
    category: "sales",
    lines: [
      { accountId: A.cash, side: "debit", amount: 10000 },
      { accountId: A.sales, side: "credit", amount: 10000 },
    ],
  },
  {
    id: "credit-sale",
    category: "sales",
    lines: [
      { accountId: A.receivable, side: "debit", amount: 15000 },
      { accountId: A.sales, side: "credit", amount: 15000 },
    ],
  },
  {
    id: "sales-return",
    category: "sales",
    lines: [
      { accountId: A.sales, side: "debit", amount: 2000 },
      { accountId: A.receivable, side: "credit", amount: 2000 },
    ],
  },
  {
    id: "advance-from-customer",
    category: "sales",
    lines: [
      { accountId: A.bank, side: "debit", amount: 5000 },
      { accountId: A.payable, side: "credit", amount: 5000 },
    ],
  },
  {
    id: "rent-received",
    category: "sales",
    lines: [
      { accountId: A.bank, side: "debit", amount: 8000 },
      { accountId: A.otherIncome, side: "credit", amount: 8000 },
    ],
  },
  {
    id: "bad-debt-recovery",
    category: "sales",
    lines: [
      { accountId: A.cash, side: "debit", amount: 3000 },
      { accountId: A.otherIncome, side: "credit", amount: 3000 },
    ],
  },
  // ---- Purchases & Expenses ------------------------------------------
  {
    id: "cash-purchase",
    category: "purchases",
    lines: [
      { accountId: A.purchases, side: "debit", amount: 7000 },
      { accountId: A.cash, side: "credit", amount: 7000 },
    ],
  },
  {
    id: "credit-purchase",
    category: "purchases",
    lines: [
      { accountId: A.purchases, side: "debit", amount: 12000 },
      { accountId: A.payable, side: "credit", amount: 12000 },
    ],
  },
  {
    id: "purchase-return",
    category: "purchases",
    lines: [
      { accountId: A.payable, side: "debit", amount: 2500 },
      { accountId: A.purchases, side: "credit", amount: 2500 },
    ],
  },
  {
    id: "rent-paid",
    category: "purchases",
    lines: [
      { accountId: A.rent, side: "debit", amount: 25000 },
      { accountId: A.bank, side: "credit", amount: 25000 },
    ],
  },
  {
    id: "electricity-paid",
    category: "purchases",
    lines: [
      { accountId: A.utilities, side: "debit", amount: 4500 },
      { accountId: A.cash, side: "credit", amount: 4500 },
    ],
  },
  {
    id: "marketing-spend",
    category: "purchases",
    lines: [
      { accountId: A.marketing, side: "debit", amount: 6000 },
      { accountId: A.bank, side: "credit", amount: 6000 },
    ],
  },
  // ---- Payroll -------------------------------------------------------
  {
    id: "salary-paid",
    category: "payroll",
    lines: [
      { accountId: A.salaries, side: "debit", amount: 60000 },
      { accountId: A.bank, side: "credit", amount: 60000 },
    ],
  },
  {
    id: "salary-accrued",
    category: "payroll",
    lines: [
      { accountId: A.salaries, side: "debit", amount: 60000 },
      { accountId: A.payable, side: "credit", amount: 60000 },
    ],
  },
  // ---- Cash & Bank ---------------------------------------------------
  {
    id: "cash-to-bank",
    category: "cashBank",
    lines: [
      { accountId: A.bank, side: "debit", amount: 20000 },
      { accountId: A.cash, side: "credit", amount: 20000 },
    ],
  },
  {
    id: "bank-to-cash",
    category: "cashBank",
    lines: [
      { accountId: A.cash, side: "debit", amount: 10000 },
      { accountId: A.bank, side: "credit", amount: 10000 },
    ],
  },
  {
    id: "loan-received",
    category: "cashBank",
    lines: [
      { accountId: A.bank, side: "debit", amount: 200000 },
      { accountId: A.loan, side: "credit", amount: 200000 },
    ],
  },
  {
    id: "loan-repaid",
    category: "cashBank",
    lines: [
      { accountId: A.loan, side: "debit", amount: 8000 },
      { accountId: A.misc, side: "debit", amount: 2000 },
      { accountId: A.bank, side: "credit", amount: 10000 },
    ],
  },
  {
    id: "bank-charges",
    category: "cashBank",
    lines: [
      { accountId: A.misc, side: "debit", amount: 500 },
      { accountId: A.bank, side: "credit", amount: 500 },
    ],
  },
  // ---- Fixed Assets --------------------------------------------------
  {
    id: "asset-cash",
    category: "fixedAssets",
    lines: [
      { accountId: A.equipment, side: "debit", amount: 80000 },
      { accountId: A.bank, side: "credit", amount: 80000 },
    ],
  },
  {
    id: "asset-credit",
    category: "fixedAssets",
    lines: [
      { accountId: A.equipment, side: "debit", amount: 50000 },
      { accountId: A.payable, side: "credit", amount: 50000 },
    ],
  },
  {
    id: "depreciation",
    category: "fixedAssets",
    lines: [
      { accountId: A.misc, side: "debit", amount: 10000 },
      { accountId: A.equipment, side: "credit", amount: 10000 },
    ],
  },
  {
    id: "asset-sold",
    category: "fixedAssets",
    lines: [
      { accountId: A.cash, side: "debit", amount: 15000 },
      { accountId: A.equipment, side: "credit", amount: 15000 },
    ],
  },
  // ---- Taxes ---------------------------------------------------------
  {
    id: "gst-on-sale",
    category: "taxes",
    lines: [
      { accountId: A.cash, side: "debit", amount: 11800 },
      { accountId: A.sales, side: "credit", amount: 10000 },
      { accountId: A.gst, side: "credit", amount: 1800 },
    ],
  },
  {
    id: "gst-on-purchase",
    category: "taxes",
    lines: [
      { accountId: A.purchases, side: "debit", amount: 10000 },
      { accountId: A.gst, side: "debit", amount: 1800 },
      { accountId: A.payable, side: "credit", amount: 11800 },
    ],
  },
  {
    id: "gst-paid-govt",
    category: "taxes",
    lines: [
      { accountId: A.gst, side: "debit", amount: 5000 },
      { accountId: A.bank, side: "credit", amount: 5000 },
    ],
  },
  // ---- Equity & Owner ------------------------------------------------
  {
    id: "owner-invests",
    category: "equity",
    lines: [
      { accountId: A.bank, side: "debit", amount: 100000 },
      { accountId: A.capital, side: "credit", amount: 100000 },
    ],
  },
  {
    id: "owner-drawings",
    category: "equity",
    lines: [
      { accountId: A.drawings, side: "debit", amount: 15000 },
      { accountId: A.cash, side: "credit", amount: 15000 },
    ],
  },
  // ---- Receivables & Payables ----------------------------------------
  {
    id: "customer-pays",
    category: "receivables",
    lines: [
      { accountId: A.bank, side: "debit", amount: 15000 },
      { accountId: A.receivable, side: "credit", amount: 15000 },
    ],
  },
  {
    id: "supplier-paid",
    category: "receivables",
    lines: [
      { accountId: A.payable, side: "debit", amount: 12000 },
      { accountId: A.bank, side: "credit", amount: 12000 },
    ],
  },
  {
    id: "bad-debt-writeoff",
    category: "receivables",
    lines: [
      { accountId: A.misc, side: "debit", amount: 4000 },
      { accountId: A.receivable, side: "credit", amount: 4000 },
    ],
  },
  // ---- Adjusting Entries ---------------------------------------------
  {
    id: "accrued-expense",
    category: "adjusting",
    lines: [
      { accountId: A.misc, side: "debit", amount: 3000 },
      { accountId: A.payable, side: "credit", amount: 3000 },
    ],
  },
  {
    id: "closing-stock",
    category: "adjusting",
    lines: [
      { accountId: A.inventory, side: "debit", amount: 30000 },
      { accountId: A.purchases, side: "credit", amount: 30000 },
    ],
  },
];

/** The scenario library, worded for one reader. */
export function journalScenarios(lang: LanguageCode = "en"): JournalScenario[] {
  const book = SCENARIO_TEXT[lang] ?? SCENARIO_TEXT.en;
  return SPECS.map((spec) => ({ ...spec, ...(book.scenarios[spec.id] ?? SCENARIO_TEXT.en.scenarios[spec.id]) }));
}

/** What to call a category on screen. */
export function scenarioCategoryLabel(
  category: ScenarioCategory,
  lang: LanguageCode = "en"
): string {
  const book = SCENARIO_TEXT[lang] ?? SCENARIO_TEXT.en;
  return book.categories[category] ?? SCENARIO_TEXT.en.categories[category];
}
