// Default category tree (spec §11) — CA/business oriented.
// Users may add, rename, archive and reorder. Built-in categories cannot be
// deleted, and no category in use can be deleted at all (decision 22).
//
// Each category also carries a plain-English description and a few examples.
// Those are what the on-device model embeds when it matches a transaction
// semantically (lib/bankStatement/ai) — a category the model has never been
// told the meaning of can only be matched on its name, so the descriptions are
// load-bearing, not documentation. They are equally the tooltip a human reads.

import type { Category, CategoryGroup } from "@/lib/bankStatement/types";
import type { LanguageCode } from "@/lib/i18n/config";
import { translate, type TKey } from "@/lib/i18n/translate";
import { relabelSeed } from "@/lib/i18n/seed-labels";

type Seed = {
  name: string;
  /**
   * Where the displayed name comes from.
   *
   * The stored name is still English (it is the seed the id is slugged from
   * and what a rename is measured against), so a built-in reads in the
   * reader's language without the stored list having to be rewritten when the
   * language changes.
   */
  nameKey: TKey;
  group: CategoryGroup;
  /**
   * What belongs here, written as prose for the embedding model.
   *
   * Deliberately English in every language: this string is embedded by
   * all-MiniLM (lib/bankStatement/ai), an English sentence model, and matched
   * against English bank narrations. Translating it would quietly cost
   * categorisation accuracy, which is the only thing the field is for. The CA
   * can edit it, and the editor says in their language what it is.
   */
  description: string;
  /** Merchants or narrations a CA would recognise as this category. */
  examples?: string[];
};

const SEEDS: Seed[] = [
  {
    name: "Sales",
    nameKey: "bsCatSales",
    group: "INCOME",
    description:
      "Revenue received from customers for goods sold, invoices settled and trade receipts collected by the business",
    examples: ["customer payment against invoice", "payment gateway settlement", "RTGS receipt from a buyer"],
  },
  {
    name: "Service Income",
    nameKey: "bsCatServiceIncome",
    group: "INCOME",
    description:
      "Fees received for services rendered, professional retainers, consultancy receipts and contract work billed to clients",
    examples: ["consultancy receipt", "monthly retainer", "professional fees received"],
  },
  {
    name: "Interest Income",
    nameKey: "bsCatInterestIncome",
    group: "INCOME",
    description:
      "Interest credited by the bank on savings balances and fixed deposits, and interest earned on investments",
    examples: ["savings account interest credit", "fixed deposit interest", "INT.PD"],
  },
  {
    name: "Other Income",
    nameKey: "bsCatOtherIncome",
    group: "INCOME",
    description:
      "Money received that is not sales or services: refunds, cashback, reimbursements, incentives and miscellaneous receipts",
    examples: ["refund received", "cashback", "reimbursement"],
  },

  {
    name: "Purchases",
    nameKey: "bsCatPurchases",
    group: "EXPENSE",
    description:
      "Payments to suppliers, vendors, wholesalers and distributors for stock, raw material and goods bought for the business",
    examples: ["supplier payment", "vendor bill settled", "wholesale traders"],
  },
  {
    name: "Salaries",
    nameKey: "bsCatSalaries",
    group: "EXPENSE",
    description:
      "Wages and salary paid out to employees and staff, payroll runs, stipends and staff reimbursements",
    examples: ["salary paid to staff", "payroll transfer", "wages"],
  },
  {
    name: "Rent",
    nameKey: "bsCatRent",
    group: "EXPENSE",
    description:
      "Rent and lease payments for shop, office, godown, warehouse or residential premises",
    examples: ["office rent", "shop rent", "lease rental"],
  },
  {
    name: "Electricity",
    nameKey: "bsCatElectricity",
    group: "EXPENSE",
    description:
      "Electricity and power utility bills paid to the state electricity board or a private power distributor",
    examples: ["BSES", "Tata Power", "MSEB electricity bill"],
  },
  {
    name: "Telephone",
    nameKey: "bsCatTelephone",
    group: "EXPENSE",
    description: "Mobile phone, landline, postpaid and DTH telecom bills",
    examples: ["Airtel postpaid", "Jio recharge", "BSNL landline"],
  },
  {
    name: "Internet",
    nameKey: "bsCatInternet",
    group: "EXPENSE",
    description: "Broadband, fibre and internet connectivity bills for home or office",
    examples: ["ACT Fibernet", "JioFiber", "broadband bill"],
  },
  {
    name: "Travel",
    nameKey: "bsCatTravel",
    group: "EXPENSE",
    description:
      "Travel and transport spending: flights, trains, buses, hotels, taxi and cab rides, fuel and tolls",
    examples: ["IRCTC train ticket", "IndiGo flight", "Uber ride", "hotel booking", "petrol and FASTag"],
  },
  {
    name: "Office Expenses",
    nameKey: "bsCatOfficeExpenses",
    group: "EXPENSE",
    description:
      "Day-to-day running costs of the workplace: stationery, printing, courier, pantry supplies and small office purchases",
    examples: ["stationery", "courier charges", "pantry supplies"],
  },
  {
    name: "Professional Fees",
    nameKey: "bsCatProfessionalFees",
    group: "EXPENSE",
    description:
      "Fees paid to consultants, chartered accountants, lawyers, advocates, auditors and other professionals",
    examples: ["audit fee", "legal fee", "consultancy charges"],
  },
  {
    name: "Bank Charges",
    nameKey: "bsCatBankCharges",
    group: "EXPENSE",
    description:
      "Charges levied by the bank itself: service charges, SMS and card fees, minimum balance penalties, transfer and processing fees",
    examples: ["bank service charge", "IMPS charge", "annual debit card fee"],
  },
  {
    name: "Insurance",
    nameKey: "bsCatInsurance",
    group: "EXPENSE",
    description: "Insurance premiums for life, health, motor, fire and general policies",
    examples: ["LIC premium", "health insurance premium", "motor policy renewal"],
  },
  {
    name: "Advertising",
    nameKey: "bsCatAdvertising",
    group: "EXPENSE",
    description:
      "Marketing, advertising and promotion spending, including online ad platforms and campaign costs",
    examples: ["Google Ads", "Facebook ads", "marketing agency"],
  },
  {
    name: "Repairs & Maintenance",
    nameKey: "bsCatRepairs",
    group: "EXPENSE",
    description:
      "Repair, servicing, upkeep and annual maintenance of premises, machinery, vehicles and equipment",
    examples: ["AC servicing", "vehicle repair", "annual maintenance contract"],
  },
  {
    name: "Software",
    nameKey: "bsCatSoftware",
    group: "EXPENSE",
    description:
      "Business software licences, cloud hosting and SaaS subscriptions used to run the business",
    examples: ["Google Workspace", "AWS hosting", "Zoho", "Tally licence"],
  },
  {
    name: "Taxes",
    nameKey: "bsCatTaxes",
    group: "EXPENSE",
    description:
      "Direct tax payments to the government: income tax, advance tax, self-assessment tax and profession tax",
    examples: ["advance tax challan", "income tax payment", "profession tax"],
  },
  {
    name: "GST",
    nameKey: "bsCatGst",
    group: "EXPENSE",
    description: "Goods and services tax paid: GST challans, CGST, SGST and IGST remittances",
    examples: ["GST payment challan", "GSTN remittance"],
  },
  {
    name: "TDS",
    nameKey: "bsCatTds",
    group: "EXPENSE",
    description: "Tax deducted at source, deposited to the government or deducted by a payer",
    examples: ["TDS payment", "194C deduction", "26QB"],
  },
  {
    name: "Loan Interest",
    nameKey: "bsCatLoanInterest",
    group: "EXPENSE",
    description:
      "The interest portion of borrowing costs charged by a bank or lender on a loan or overdraft",
    examples: ["loan interest debit", "overdraft interest", "interest collected on term loan"],
  },
  {
    name: "Other Expenses",
    nameKey: "bsCatOtherExpenses",
    group: "EXPENSE",
    description:
      "Business spending that does not fit any other expense category, and miscellaneous outgoings",
    examples: ["miscellaneous expense", "sundry payment"],
  },

  // Personal-side categories. A CA reading a proprietor's account meets these
  // constantly, and without them the model has nowhere sensible to put a
  // grocery run or a streaming subscription.
  {
    name: "Food & Groceries",
    nameKey: "bsCatFoodGroceries",
    group: "EXPENSE",
    description:
      "Supermarkets, grocery shopping, fruit and vegetables, household provisions and daily essentials, plus restaurants, cafes, food delivery and meals bought out",
    examples: ["BigBasket", "DMart", "Blinkit instant grocery", "Swiggy or Zomato order", "restaurant bill"],
  },
  {
    name: "Entertainment",
    nameKey: "bsCatEntertainment",
    group: "EXPENSE",
    description:
      "Streaming and content subscriptions, cinema tickets, live events, games and leisure outings",
    examples: ["Netflix monthly subscription", "Spotify", "BookMyShow tickets", "Hotstar"],
  },
  {
    name: "Personal Care & Health",
    nameKey: "bsCatPersonalCare",
    group: "EXPENSE",
    description:
      "Salon, spa and grooming visits, gym and fitness memberships, doctors, clinics, pharmacies and medicines",
    examples: ["Urban Company salon visit", "gym membership", "pharmacy purchase", "doctor consultation"],
  },
  {
    name: "Shopping",
    nameKey: "bsCatShopping",
    group: "EXPENSE",
    description:
      "Retail purchases of clothing, electronics, appliances, furniture and general merchandise, online or in store",
    examples: ["Amazon order", "Flipkart", "Myntra clothing", "electronics retailer"],
  },

  {
    name: "Own Account Transfer",
    nameKey: "bsCatOwnTransfer",
    group: "TRANSFER",
    description:
      "Money moved between accounts belonging to the same person or business — self transfers, sweep-ins and fund movement, not income or expense",
    examples: ["transfer to self", "own account fund transfer"],
  },
  {
    name: "Investment",
    nameKey: "bsCatInvestment",
    group: "TRANSFER",
    description:
      "Money moved into savings and investments: mutual funds, SIPs, stock broking accounts, fixed deposits, PPF and NPS",
    examples: ["mutual fund SIP", "Zerodha transfer", "PPF deposit"],
  },
  {
    name: "Loan",
    nameKey: "bsCatLoan",
    group: "TRANSFER",
    description:
      "Loan principal movement: an EMI or instalment repaid to a bank or finance company, and loan amounts disbursed or borrowed",
    examples: ["Bajaj Finance EMI", "home loan instalment", "loan disbursement received"],
  },
  {
    name: "Credit Card Payment",
    nameKey: "bsCatCreditCard",
    group: "TRANSFER",
    description: "Payment of a credit card bill, including autopay settlement of the card outstanding",
    examples: ["credit card bill payment", "card autopay"],
  },
  {
    name: "Personal Transfer",
    nameKey: "bsCatPersonalTransfer",
    group: "TRANSFER",
    description:
      "Money sent to or received from another individual person — friends and family, splitting a shared bill or a trip, repaying someone",
    examples: ["IMPS P2P to a friend", "trip expense split", "money sent to family"],
  },

  {
    name: "Cash Deposit",
    nameKey: "bsCatCashDeposit",
    group: "CASH",
    description: "Cash paid into the bank account over the counter or at a cash deposit machine",
    examples: ["cash deposit", "CDM deposit", "cash received at branch"],
  },
  {
    name: "Cash Withdrawal",
    nameKey: "bsCatCashWithdrawal",
    group: "CASH",
    description: "Cash taken out of the account at an ATM or over the counter",
    examples: ["ATM withdrawal", "self cash withdrawal"],
  },
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
    nameKey: seed.nameKey,
    group: seed.group,
    description: seed.description,
    examples: seed.examples,
    builtIn: true,
    archived: false,
    order: index,
  }));
}

/**
 * Reconcile a stored category list with the built-in tree.
 *
 * Two things have to survive a release: the CA's own edits (renames, order,
 * archiving, categories they added) and the descriptions the model needs. So a
 * stored built-in keeps everything the CA chose and gains the description if it
 * predates that field, and built-ins added in a later release are appended
 * rather than resetting the list.
 */
export function mergeWithDefaults(stored: Category[]): Category[] {
  if (stored.length === 0) return defaultCategories();

  const defaults = defaultCategories();
  const byId = new Map(defaults.map((category) => [category.id, category]));

  const merged = stored.map((category) => {
    const seed = byId.get(category.id);
    if (!seed) return category;
    return {
      ...category,
      nameKey: seed.nameKey,
      description: category.description ?? seed.description,
      examples: category.examples ?? seed.examples,
    };
  });

  const known = new Set(merged.map((category) => category.id));
  let order = merged.reduce((max, category) => Math.max(max, category.order), -1);
  for (const seed of defaults) {
    if (known.has(seed.id)) continue;
    order += 1;
    merged.push({ ...seed, order });
  }

  return merged.sort((a, b) => a.order - b.order);
}

const GROUP_KEYS: Record<CategoryGroup, TKey> = {
  INCOME: "bsGroupIncome",
  EXPENSE: "bsGroupExpense",
  TRANSFER: "bsGroupTransfer",
  CASH: "bsGroupCash",
};

export const GROUP_ORDER = Object.keys(GROUP_KEYS) as CategoryGroup[];

export function groupLabel(group: CategoryGroup, lang: LanguageCode): string {
  return translate(lang, GROUP_KEYS[group]);
}

/**
 * How a category reads to this reader.
 *
 * A built-in whose name is still one of ours — in any language we publish —
 * is our label and follows the reader. A name the CA typed over it is theirs
 * and comes back untouched, in every language.
 */
export function categoryLabel(category: Category, lang: LanguageCode): string {
  if (!category.nameKey) return category.name;
  return relabelSeed(category.name, [category.nameKey], lang);
}

/** Look a category up by id, falling back to its own id as the label. */
export function categoryName(
  categories: Category[],
  id: string | undefined,
  lang: LanguageCode
): string {
  if (!id) return translate(lang, "bsUncategorised");
  const found = categories.find((category) => category.id === id);
  return found ? categoryLabel(found, lang) : id;
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
