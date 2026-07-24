// Shared types + derivations for the bookkeeping tools (Chart of Accounts,
// Journal Entry, General Ledger, Trial Balance). The Chart of Accounts and the
// journal are each stored once in localStorage; the ledger and trial balance
// are pure views derived from the journal, so the four tools always agree.

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";

export type Account = {
  id: string;
  code: string;
  name: string;
  type: AccountType;
};

export type JournalLine = {
  id: string;
  accountId: string;
  debit: number;
  credit: number;
};

export type JournalEntry = {
  id: string;
  date: string; // ISO yyyy-mm-dd
  narration: string;
  lines: JournalLine[];
  createdAt: string;
};

export const COA_STORAGE_KEY = "setu-bk-accounts";
export const JOURNAL_STORAGE_KEY = "setu-bk-journal";

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "asset", label: "Asset" },
  { value: "liability", label: "Liability" },
  { value: "equity", label: "Equity" },
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
];

/** Debit-normal account types; the rest are credit-normal. */
export function isDebitNormal(type: AccountType): boolean {
  return type === "asset" || type === "expense";
}

/** A sensible starter chart for a small Indian business. */
export const DEFAULT_ACCOUNTS: Account[] = [
  { id: "a-1000", code: "1000", name: "Cash in Hand", type: "asset" },
  { id: "a-1010", code: "1010", name: "Bank Account", type: "asset" },
  { id: "a-1100", code: "1100", name: "Accounts Receivable (Debtors)", type: "asset" },
  { id: "a-1200", code: "1200", name: "Inventory / Stock", type: "asset" },
  { id: "a-1500", code: "1500", name: "Equipment & Furniture", type: "asset" },
  { id: "a-2000", code: "2000", name: "Accounts Payable (Creditors)", type: "liability" },
  { id: "a-2100", code: "2100", name: "GST Payable", type: "liability" },
  { id: "a-2200", code: "2200", name: "Loans Payable", type: "liability" },
  { id: "a-3000", code: "3000", name: "Owner's Capital", type: "equity" },
  { id: "a-3100", code: "3100", name: "Owner's Drawings", type: "equity" },
  { id: "a-4000", code: "4000", name: "Sales Revenue", type: "income" },
  { id: "a-4100", code: "4100", name: "Other Income", type: "income" },
  { id: "a-5000", code: "5000", name: "Purchases / Cost of Goods Sold", type: "expense" },
  { id: "a-5100", code: "5100", name: "Rent Expense", type: "expense" },
  { id: "a-5200", code: "5200", name: "Salaries & Wages", type: "expense" },
  { id: "a-5300", code: "5300", name: "Electricity & Utilities", type: "expense" },
  { id: "a-5400", code: "5400", name: "Marketing & Advertising", type: "expense" },
  { id: "a-5900", code: "5900", name: "Miscellaneous Expense", type: "expense" },
];

// ---------------------------------------------------------------------------
// Industry chart templates. Each starts from the general small-business chart
// and swaps in the accounts that industry actually uses.
// ---------------------------------------------------------------------------

const acct = (code: string, name: string, type: AccountType): Account => ({
  id: `a-${code}`,
  code,
  name,
  type,
});

export type IndustryTemplate = { id: string; name: string; accounts: Account[] };

export const INDUSTRY_TEMPLATES: IndustryTemplate[] = [
  { id: "general", name: "General small business", accounts: DEFAULT_ACCOUNTS },
  {
    id: "retail",
    name: "Retail / Store",
    accounts: [
      ...DEFAULT_ACCOUNTS,
      acct("1210", "Goods in Transit", "asset"),
      acct("4010", "Online Marketplace Sales", "income"),
      acct("5010", "Freight & Cartage Inward", "expense"),
      acct("5410", "Packaging Material", "expense"),
      acct("5420", "Shop Consumables", "expense"),
    ],
  },
  {
    id: "restaurant",
    name: "Restaurant / F&B",
    accounts: [
      ...DEFAULT_ACCOUNTS,
      acct("1210", "Kitchen Stock (Perishables)", "asset"),
      acct("4010", "Online Order Sales (Zomato/Swiggy)", "income"),
      acct("5010", "Food & Beverage Cost", "expense"),
      acct("5410", "Aggregator Commission", "expense"),
      acct("5420", "Kitchen Fuel (LPG)", "expense"),
      acct("5430", "Cleaning & Consumables", "expense"),
    ],
  },
  {
    id: "services",
    name: "Services / Consulting",
    accounts: [
      ...DEFAULT_ACCOUNTS.filter((a) => a.id !== "a-1200" && a.id !== "a-5000"),
      acct("4010", "Consulting / Service Fees", "income"),
      acct("5010", "Subcontractor Costs", "expense"),
      acct("5410", "Software Subscriptions", "expense"),
      acct("5420", "Travel & Conveyance", "expense"),
      acct("5430", "Professional Fees (CA/Legal)", "expense"),
    ],
  },
  {
    id: "saas",
    name: "SaaS / Software",
    accounts: [
      ...DEFAULT_ACCOUNTS.filter((a) => a.id !== "a-1200" && a.id !== "a-5000"),
      acct("1300", "Deferred Revenue Receivable", "asset"),
      acct("2300", "Deferred / Unearned Revenue", "liability"),
      acct("4010", "Subscription Revenue", "income"),
      acct("5010", "Hosting & Infrastructure", "expense"),
      acct("5410", "Software & API Subscriptions", "expense"),
      acct("5420", "Payment Gateway Fees", "expense"),
    ],
  },
  {
    id: "manufacturing",
    name: "Manufacturing",
    accounts: [
      ...DEFAULT_ACCOUNTS,
      acct("1210", "Raw Materials", "asset"),
      acct("1220", "Work in Progress", "asset"),
      acct("1230", "Finished Goods", "asset"),
      acct("5010", "Direct Labour", "expense"),
      acct("5020", "Factory Overheads", "expense"),
      acct("5410", "Repairs & Maintenance (Plant)", "expense"),
    ],
  },
  {
    id: "ecommerce",
    name: "E-commerce / D2C",
    accounts: [
      ...DEFAULT_ACCOUNTS,
      acct("1210", "Stock with Marketplace Warehouses", "asset"),
      acct("4010", "Marketplace Sales (Amazon/Flipkart)", "income"),
      acct("4020", "Own Website Sales", "income"),
      acct("5010", "Shipping & Fulfilment", "expense"),
      acct("5410", "Marketplace Commission & Fees", "expense"),
      acct("5420", "Returns & Refunds Cost", "expense"),
    ],
  },
];

export function accountLabel(accounts: Account[], id: string): string {
  const a = accounts.find((x) => x.id === id);
  return a ? `${a.code} · ${a.name}` : "(deleted account)";
}

export type LedgerRow = {
  date: string;
  narration: string;
  debit: number;
  credit: number;
  balance: number; // signed in the account's normal direction
};

/** All journal postings for one account, oldest first, with a running balance. */
export function ledgerRows(
  entries: JournalEntry[],
  accounts: Account[],
  accountId: string
): LedgerRow[] {
  const account = accounts.find((a) => a.id === accountId);
  const debitNormal = account ? isDebitNormal(account.type) : true;
  const sorted = [...entries].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)
  );
  const rows: LedgerRow[] = [];
  let balance = 0;
  for (const entry of sorted) {
    for (const line of entry.lines) {
      if (line.accountId !== accountId) continue;
      if (line.debit === 0 && line.credit === 0) continue;
      balance += debitNormal ? line.debit - line.credit : line.credit - line.debit;
      rows.push({
        date: entry.date,
        narration: entry.narration,
        debit: line.debit,
        credit: line.credit,
        balance,
      });
    }
  }
  return rows;
}

export type TrialBalanceRow = {
  account: Account;
  debit: number;
  credit: number;
};

/**
 * Net balance per account, shown on its debit or credit side. Accounts with a
 * zero net balance are omitted, matching standard trial balance presentation.
 */
export function trialBalance(entries: JournalEntry[], accounts: Account[]): TrialBalanceRow[] {
  const net = new Map<string, number>(); // +ve = debit balance
  for (const entry of entries) {
    for (const line of entry.lines) {
      net.set(line.accountId, (net.get(line.accountId) ?? 0) + line.debit - line.credit);
    }
  }
  const rows: TrialBalanceRow[] = [];
  for (const account of accounts) {
    const balance = net.get(account.id) ?? 0;
    if (Math.abs(balance) < 0.005) continue;
    rows.push({
      account,
      debit: balance > 0 ? balance : 0,
      credit: balance < 0 ? -balance : 0,
    });
  }
  return rows;
}
