// Shared types + derivations for the bookkeeping tools (Chart of Accounts,
// Journal Entry, General Ledger, Trial Balance). The Chart of Accounts and the
// journal are each stored once in localStorage; the ledger and trial balance
// are pure views derived from the journal, so the four tools always agree.

import type { LanguageCode } from "./i18n/config";
import { translate, type TKey } from "./i18n/translate";

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

export const ACCOUNT_TYPES: { value: AccountType; label: TKey }[] = [
  { value: "asset", label: "bkTypeAsset" },
  { value: "liability", label: "bkTypeLiability" },
  { value: "equity", label: "bkTypeEquity" },
  { value: "income", label: "bkTypeIncome" },
  { value: "expense", label: "bkTypeExpense" },
];

/** Debit-normal account types; the rest are credit-normal. */
export function isDebitNormal(type: AccountType): boolean {
  return type === "asset" || type === "expense";
}

/**
 * A sensible starter chart for a small business.
 *
 * Seeded into the shared Chart of Accounts the first time someone opens one of
 * the bookkeeping tools, so it is built in the reader's language: these names
 * land in the chart they then edit, and the ledger, journal and trial balance
 * all read them back from there.
 *
 * The codes and ids are identifiers and stay as written — a journal posted in
 * one language still points at the right account in another.
 */
const STARTER_CHART: { code: string; name: TKey; type: AccountType }[] = [
  { code: "1000", name: "bkAcCashInHand", type: "asset" },
  { code: "1010", name: "bkAcBankAccount", type: "asset" },
  { code: "1100", name: "bkAcReceivable", type: "asset" },
  { code: "1200", name: "bkAcInventory", type: "asset" },
  { code: "1500", name: "bkAcEquipment", type: "asset" },
  { code: "2000", name: "bkAcPayable", type: "liability" },
  { code: "2100", name: "bkAcGstPayable", type: "liability" },
  { code: "2200", name: "bkAcLoansPayable", type: "liability" },
  { code: "3000", name: "bkAcOwnersCapital", type: "equity" },
  { code: "3100", name: "bkAcOwnersDrawings", type: "equity" },
  { code: "4000", name: "bkAcSalesRevenue", type: "income" },
  { code: "4100", name: "bkAcOtherIncome", type: "income" },
  { code: "5000", name: "bkAcPurchases", type: "expense" },
  { code: "5100", name: "bkAcRent", type: "expense" },
  { code: "5200", name: "bkAcSalaries", type: "expense" },
  { code: "5300", name: "bkAcUtilities", type: "expense" },
  { code: "5400", name: "bkAcMarketing", type: "expense" },
  { code: "5900", name: "bkAcMisc", type: "expense" },
];

export function defaultAccounts(lang: LanguageCode = "en"): Account[] {
  return STARTER_CHART.map(({ code, name, type }) => ({
    id: `a-${code}`,
    code,
    name: translate(lang, name),
    type,
  }));
}

// ---------------------------------------------------------------------------
// Industry chart templates. Each starts from the starter chart and swaps in
// the accounts that industry actually uses. Built per language for the same
// reason as the starter chart: loading one writes these names into the chart.
// ---------------------------------------------------------------------------

type TemplateExtra = { code: string; name: TKey; type: AccountType };

type TemplateSpec = {
  id: string;
  name: TKey;
  /** ids dropped from the starter chart because this industry has no use for them. */
  without?: string[];
  extras: TemplateExtra[];
};

const TEMPLATE_SPECS: TemplateSpec[] = [
  { id: "general", name: "bkTplGeneral", extras: [] },
  {
    id: "retail",
    name: "bkTplRetail",
    extras: [
      { code: "1210", name: "bkAcGoodsInTransit", type: "asset" },
      { code: "4010", name: "bkAcMarketplaceSales", type: "income" },
      { code: "5010", name: "bkAcFreightInward", type: "expense" },
      { code: "5410", name: "bkAcPackaging", type: "expense" },
      { code: "5420", name: "bkAcShopConsumables", type: "expense" },
    ],
  },
  {
    id: "restaurant",
    name: "bkTplRestaurant",
    extras: [
      { code: "1210", name: "bkAcKitchenStock", type: "asset" },
      { code: "4010", name: "bkAcOnlineOrderSales", type: "income" },
      { code: "5010", name: "bkAcFoodCost", type: "expense" },
      { code: "5410", name: "bkAcAggregatorCommission", type: "expense" },
      { code: "5420", name: "bkAcKitchenFuel", type: "expense" },
      { code: "5430", name: "bkAcCleaning", type: "expense" },
    ],
  },
  {
    id: "services",
    name: "bkTplServices",
    without: ["a-1200", "a-5000"],
    extras: [
      { code: "4010", name: "bkAcConsultingFees", type: "income" },
      { code: "5010", name: "bkAcSubcontractor", type: "expense" },
      { code: "5410", name: "bkAcSoftwareSubs", type: "expense" },
      { code: "5420", name: "bkAcTravel", type: "expense" },
      { code: "5430", name: "bkAcProfessionalFees", type: "expense" },
    ],
  },
  {
    id: "saas",
    name: "bkTplSaas",
    without: ["a-1200", "a-5000"],
    extras: [
      { code: "1300", name: "bkAcDeferredReceivable", type: "asset" },
      { code: "2300", name: "bkAcDeferredRevenue", type: "liability" },
      { code: "4010", name: "bkAcSubscriptionRevenue", type: "income" },
      { code: "5010", name: "bkAcHosting", type: "expense" },
      { code: "5410", name: "bkAcApiSubs", type: "expense" },
      { code: "5420", name: "bkAcGatewayFees", type: "expense" },
    ],
  },
  {
    id: "manufacturing",
    name: "bkTplManufacturing",
    extras: [
      { code: "1210", name: "bkAcRawMaterials", type: "asset" },
      { code: "1220", name: "bkAcWip", type: "asset" },
      { code: "1230", name: "bkAcFinishedGoods", type: "asset" },
      { code: "5010", name: "bkAcDirectLabour", type: "expense" },
      { code: "5020", name: "bkAcFactoryOverheads", type: "expense" },
      { code: "5410", name: "bkAcPlantRepairs", type: "expense" },
    ],
  },
  {
    id: "ecommerce",
    name: "bkTplEcommerce",
    extras: [
      { code: "1210", name: "bkAcMarketplaceStock", type: "asset" },
      { code: "4010", name: "bkAcMarketplaceSales2", type: "income" },
      { code: "4020", name: "bkAcOwnWebsiteSales", type: "income" },
      { code: "5010", name: "bkAcShipping", type: "expense" },
      { code: "5410", name: "bkAcMarketplaceCommission", type: "expense" },
      { code: "5420", name: "bkAcReturnsCost", type: "expense" },
    ],
  },
];

export type IndustryTemplate = { id: string; name: string; accounts: Account[] };

export function industryTemplates(lang: LanguageCode = "en"): IndustryTemplate[] {
  const starter = defaultAccounts(lang);
  return TEMPLATE_SPECS.map(({ id, name, without, extras }) => ({
    id,
    name: translate(lang, name),
    accounts: [
      ...(without ? starter.filter((a) => !without.includes(a.id)) : starter),
      ...extras.map(({ code, name: key, type }) => ({
        id: `a-${code}`,
        code,
        name: translate(lang, key),
        type,
      })),
    ],
  }));
}

export function accountLabel(accounts: Account[], id: string, lang: LanguageCode = "en"): string {
  const a = accounts.find((x) => x.id === id);
  return a ? `${a.code} · ${a.name}` : translate(lang, "bkDeletedAccount");
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
