// The classification pipeline (spec §13).
// ---------------------------------------------------------------------------
//   user rule  →  known party  →  keyword pattern  →  structural heuristic  →  uncategorised
//
// Deterministic throughout: same input, same output, no model, no network. The
// confidence returned describes *classification* confidence only — never how
// well the file parsed (decision 20).

import type {
  ClassificationRule,
  ClassificationSource,
  ClassificationType,
  GstFlag,
  Transaction,
} from "@/lib/bankStatement/types";
import { findMatchingRule } from "@/lib/bankStatement/classification/rulesEngine";
import { normaliseText } from "@/lib/bankStatement/utils/text";

export type Classification = {
  category?: string;
  subCategory?: string;
  classificationType: ClassificationType;
  classificationSource: ClassificationSource;
  confidence: number;
  matchedRuleId?: string;
  gstRelevant: GstFlag;
  isTransfer: boolean;
  isCashTransaction: boolean;
};

type Pattern = {
  /** Category id from the default tree. */
  category: string;
  type: ClassificationType;
  keywords: string[];
  /** Only apply to this direction, when the keyword is direction-specific. */
  direction?: "DEBIT" | "CREDIT";
  confidence: number;
  gst?: GstFlag;
};

// Keyword patterns seen in Indian bank narrations. Confidence reflects how
// specific the keyword is: "SALARY" is unambiguous, "PAYMENT" would not be.
const PATTERNS: Pattern[] = [
  // Bank's own charges and interest — structural, very high confidence.
  {
    category: "bank-charges",
    type: "BUSINESS",
    keywords: ["BANK CHARGE", "SERVICE CHARGE", "SMS CHARGE", "AMC CHARGE", "ANNUAL FEE", "PROCESSING FEE", "CHQ RETURN CHARGE", "MIN BAL CHARGE", "IMPS CHARGE", "NEFT CHARGE", "ATM DECLINE", "GST ON CHARGE", "DEBIT CARD FEE"],
    direction: "DEBIT",
    confidence: 95,
  },
  {
    category: "interest-income",
    type: "BUSINESS",
    keywords: ["INT.PD", "INTEREST CREDIT", "INT CREDIT", "SB INT", "FD INTEREST", "CREDIT INTEREST", "INTEREST PAID BY BANK"],
    direction: "CREDIT",
    confidence: 92,
  },
  {
    category: "loan-interest",
    type: "BUSINESS",
    keywords: ["LOAN INT", "INTEREST DEBIT", "INT.COLL", "EMI DEBIT", "LOAN EMI", "HOME LOAN", "TERM LOAN"],
    direction: "DEBIT",
    confidence: 85,
  },

  // Statutory
  {
    category: "gst",
    type: "BUSINESS",
    keywords: ["GST PAYMENT", "GSTN", "GST PMT", "CGST", "SGST", "IGST", "GSTR"],
    confidence: 90,
    gst: "RELEVANT",
  },
  {
    category: "tds",
    type: "BUSINESS",
    keywords: ["TDS", "TAX DEDUCTED", "194C", "194J", "26QB"],
    confidence: 88,
  },
  {
    category: "taxes",
    type: "BUSINESS",
    keywords: ["INCOME TAX", "ADVANCE TAX", "SELF ASSESSMENT TAX", "ITNS", "PROFESSION TAX", "PTAX"],
    confidence: 88,
  },

  // Operating costs
  { category: "salaries", type: "BUSINESS", keywords: ["SALARY", "SAL CREDIT", "PAYROLL", "WAGES", "STIPEND"], direction: "DEBIT", confidence: 92 },
  { category: "rent", type: "BUSINESS", keywords: ["RENT", "LEASE RENT", "SHOP RENT", "OFFICE RENT"], direction: "DEBIT", confidence: 88, gst: "POTENTIAL" },
  { category: "electricity", type: "BUSINESS", keywords: ["ELECTRICITY", "BSES", "MSEB", "TNEB", "TORRENT POWER", "ADANI ELECTRICITY", "POWER BILL", "TATA POWER"], direction: "DEBIT", confidence: 90, gst: "POTENTIAL" },
  { category: "telephone", type: "BUSINESS", keywords: ["AIRTEL", "VODAFONE", "VI POSTPAID", "JIO", "BSNL", "MOBILE BILL", "POSTPAID"], direction: "DEBIT", confidence: 85, gst: "POTENTIAL" },
  { category: "internet", type: "BUSINESS", keywords: ["BROADBAND", "ACT FIBERNET", "HATHWAY", "EXCITEL", "JIOFIBER", "INTERNET BILL"], direction: "DEBIT", confidence: 88, gst: "POTENTIAL" },
  { category: "software", type: "BUSINESS", keywords: ["GOOGLE CLOUD", "GSUITE", "GOOGLE WORKSPACE", "MICROSOFT", "ADOBE", "AWS", "AMAZON WEB", "ZOHO", "TALLY", "RAZORPAY SOFTWARE", "SUBSCRIPTION", "GITHUB", "ATLASSIAN", "SLACK", "ZOOM"], direction: "DEBIT", confidence: 85, gst: "POTENTIAL" },
  { category: "advertising", type: "BUSINESS", keywords: ["GOOGLE ADS", "FACEBOOK ADS", "META PLATFORMS", "ADWORDS", "MARKETING", "ADVERTISEMENT"], direction: "DEBIT", confidence: 88, gst: "POTENTIAL" },
  { category: "travel", type: "BUSINESS", keywords: ["IRCTC", "MAKEMYTRIP", "GOIBIBO", "CLEARTRIP", "INDIGO", "AIR INDIA", "SPICEJET", "UBER", "OLA", "RAPIDO", "YATRA", "REDBUS"], direction: "DEBIT", confidence: 82, gst: "POTENTIAL" },
  { category: "insurance", type: "BUSINESS", keywords: ["INSURANCE", "LIC ", "PREMIUM", "POLICYBAZAAR", "HDFC ERGO", "ICICI LOMBARD", "STAR HEALTH"], direction: "DEBIT", confidence: 85 },
  { category: "professional-fees", type: "BUSINESS", keywords: ["CONSULTANCY", "CONSULTING", "PROFESSIONAL FEE", "AUDIT FEE", "LEGAL FEE", "ADVOCATE", "CHARTERED ACCOUNTANT"], direction: "DEBIT", confidence: 85, gst: "POTENTIAL" },
  { category: "repairs-and-maintenance", type: "BUSINESS", keywords: ["REPAIR", "MAINTENANCE", "SERVICING", "AMC "], direction: "DEBIT", confidence: 80 },
  { category: "office-expenses", type: "BUSINESS", keywords: ["STATIONERY", "PRINTING", "COURIER", "BLUEDART", "DTDC", "OFFICE SUPPL", "PANTRY"], direction: "DEBIT", confidence: 80, gst: "POTENTIAL" },
  { category: "purchases", type: "BUSINESS", keywords: ["PURCHASE", "SUPPLIER", "VENDOR PAYMENT", "TRADERS", "ENTERPRISES", "WHOLESALE", "DISTRIBUTOR"], direction: "DEBIT", confidence: 72, gst: "POTENTIAL" },

  // Income
  // "/INV-4523" and "INV NO 4523" are the same thing written two ways — Indian
  // NEFT/RTGS credits reference the invoice they settle.
  { category: "sales", type: "BUSINESS", keywords: ["SALES", "INVOICE", "INV NO", "INV-", "/INV", "CUSTOMER PAYMENT", "RECEIPT AGAINST"], direction: "CREDIT", confidence: 75, gst: "POTENTIAL" },
  { category: "service-income", type: "BUSINESS", keywords: ["SERVICE INCOME", "CONSULTANCY RECEIPT", "RETAINER", "PROFESSIONAL RECEIPT"], direction: "CREDIT", confidence: 78, gst: "POTENTIAL" },
  { category: "sales", type: "BUSINESS", keywords: ["RAZORPAY", "PAYU", "CCAVENUE", "INSTAMOJO", "STRIPE", "CASHFREE", "PHONEPE MERCHANT", "PAYTM MERCHANT", "BILLDESK"], direction: "CREDIT", confidence: 82, gst: "POTENTIAL" },

  // Transfers and investments
  { category: "credit-card-payment", type: "TRANSFER", keywords: ["CREDIT CARD PAYMENT", "CC PAYMENT", "CARD PAYMENT AUTOPAY", "AUTOPAY CREDIT CARD", "CC BILL"], direction: "DEBIT", confidence: 88 },
  { category: "investment", type: "TRANSFER", keywords: ["MUTUAL FUND", "SIP ", "ZERODHA", "GROWW", "UPSTOX", "ICICI DIRECT", "NIPPON", "SBI MF", "HDFC MF", "AXIS MF", "PPF", "NPS "], confidence: 88 },
  { category: "loan", type: "TRANSFER", keywords: ["LOAN DISBURSE", "LOAN REPAYMENT", "PRINCIPAL REPAY"], confidence: 82 },
  { category: "own-account-transfer", type: "TRANSFER", keywords: ["SELF", "OWN ACCOUNT", "TRANSFER TO SELF", "FUND TRANSFER SELF"], confidence: 85 },

  // Cash
  { category: "cash-deposit", type: "UNKNOWN", keywords: ["CASH DEP", "CASH DEPOSIT", "CDM ", "BY CASH", "CASH RECEIVED"], direction: "CREDIT", confidence: 92 },
  { category: "cash-withdrawal", type: "UNKNOWN", keywords: ["ATM WDL", "ATM CASH", "CASH WDL", "CASH WITHDRAWAL", "TO CASH", "SELF WITHDRAWAL", "NWD "], direction: "DEBIT", confidence: 92 },
];

const CASH_KEYWORDS = ["CASH DEP", "CASH DEPOSIT", "CDM ", "ATM WDL", "ATM CASH", "CASH WDL", "CASH WITHDRAWAL", "BY CASH", "TO CASH", "NWD "];
const TRANSFER_KEYWORDS = ["SELF", "OWN ACCOUNT", "TRANSFER TO SELF", "CREDIT CARD PAYMENT", "CC PAYMENT"];

export const CONFIDENCE_BANDS = { high: 90, medium: 70 } as const;

export type ConfidenceBand = "high" | "medium" | "low";

export function confidenceBand(confidence: number | undefined): ConfidenceBand {
  if (confidence === undefined) return "low";
  if (confidence >= CONFIDENCE_BANDS.high) return "high";
  if (confidence >= CONFIDENCE_BANDS.medium) return "medium";
  return "low";
}

export function sourceLabel(source: ClassificationSource): string {
  switch (source) {
    case "RULE":
      return "User rule";
    case "MANUAL":
      return "Set by you";
    case "HEURISTIC":
      return "Pattern match";
    default:
      return "Unclassified";
  }
}

/** A party seen before, from the transactions the CA has already reviewed. */
export type PartyMemory = Map<string, { category: string; classificationType: ClassificationType }>;

/**
 * Build party memory from transactions the CA classified by hand. This is what
 * makes the second statement quicker than the first.
 */
export function buildPartyMemory(transactions: Transaction[]): PartyMemory {
  const memory: PartyMemory = new Map();
  for (const transaction of transactions) {
    if (transaction.classificationSource !== "MANUAL") continue;
    if (!transaction.partyName || !transaction.category) continue;
    memory.set(normaliseText(transaction.partyName), {
      category: transaction.category,
      classificationType: transaction.classificationType,
    });
  }
  return memory;
}

export function classify(
  transaction: Transaction,
  rules: ClassificationRule[],
  partyMemory: PartyMemory = new Map()
): Classification {
  const narration = normaliseText(transaction.narration);
  const isCash = CASH_KEYWORDS.some((keyword) => narration.includes(keyword));
  const looksTransfer = TRANSFER_KEYWORDS.some((keyword) => narration.includes(keyword));

  // 1 — user rules win outright.
  const rule = findMatchingRule(transaction, rules);
  if (rule) {
    return {
      category: rule.result.category,
      subCategory: rule.result.subCategory,
      classificationType: rule.result.classificationType ?? "BUSINESS",
      classificationSource: "RULE",
      confidence: 100,
      matchedRuleId: rule.id,
      gstRelevant: rule.result.gstRelevant ?? "NOT_MARKED",
      isTransfer: (rule.result.classificationType ?? "") === "TRANSFER" || looksTransfer,
      isCashTransaction: isCash,
    };
  }

  // 2 — a party this CA has already classified by hand.
  if (transaction.partyName) {
    const remembered = partyMemory.get(normaliseText(transaction.partyName));
    if (remembered) {
      return {
        category: remembered.category,
        classificationType: remembered.classificationType,
        classificationSource: "HEURISTIC",
        confidence: 88,
        gstRelevant: "NOT_MARKED",
        isTransfer: remembered.classificationType === "TRANSFER",
        isCashTransaction: isCash,
      };
    }
  }

  // 3 — keyword patterns.
  let best: { pattern: Pattern; keyword: string } | null = null;
  for (const pattern of PATTERNS) {
    if (pattern.direction && pattern.direction !== transaction.transactionType) continue;
    const keyword = pattern.keywords.find((candidate) => narration.includes(candidate));
    if (!keyword) continue;
    if (!best || pattern.confidence > best.pattern.confidence) best = { pattern, keyword };
  }

  if (best) {
    return {
      category: best.pattern.category,
      classificationType: best.pattern.type,
      classificationSource: "HEURISTIC",
      confidence: best.pattern.confidence,
      gstRelevant: best.pattern.gst ?? "NOT_MARKED",
      isTransfer: best.pattern.type === "TRANSFER",
      isCashTransaction: isCash || best.pattern.category.startsWith("cash-"),
    };
  }

  // 4 — structural heuristics, deliberately low confidence.
  if (isCash) {
    return {
      category: transaction.transactionType === "CREDIT" ? "cash-deposit" : "cash-withdrawal",
      classificationType: "UNKNOWN",
      classificationSource: "HEURISTIC",
      confidence: 75,
      gstRelevant: "NOT_MARKED",
      isTransfer: false,
      isCashTransaction: true,
    };
  }

  // 5 — nothing matched. Say so rather than inventing a category.
  return {
    classificationType: "UNKNOWN",
    classificationSource: "UNCLASSIFIED",
    confidence: 0,
    gstRelevant: "NOT_MARKED",
    isTransfer: looksTransfer,
    isCashTransaction: false,
  };
}

/** Apply a classification to a transaction in place. */
export function applyClassification(
  transaction: Transaction,
  classification: Classification,
  highValueThreshold: number
): void {
  transaction.category = classification.category;
  transaction.subCategory = classification.subCategory;
  transaction.classificationType = classification.classificationType;
  transaction.classificationSource = classification.classificationSource;
  transaction.confidence = classification.confidence;
  transaction.matchedRuleId = classification.matchedRuleId;
  transaction.gstRelevant = classification.gstRelevant;
  transaction.isTransfer = classification.isTransfer;
  transaction.isCashTransaction = classification.isCashTransaction;
  transaction.isHighValue = Math.max(transaction.debit, transaction.credit) >= highValueThreshold;
}
