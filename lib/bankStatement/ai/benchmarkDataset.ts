// A starter labelled set, for the model comparison.
// ---------------------------------------------------------------------------
// Synthetic, but written in the formats Indian statements actually use: UPI
// with a reference block, IMPS with a purpose code, NEFT/ACH for mandates and
// salary, POS for card swipes. Merchant names are real because the merchants
// are what the model has to recognise; no account number, amount, date or
// person from any real statement appears here.
//
// Thirty-odd rows is enough to see a difference between two models, and far too
// few to trust a decimal place. Replace it with a few hundred anonymised rows
// from real statements before choosing a model — see the benchmark page.

import type { LabelledTransaction } from "@/lib/bankStatement/ai/benchmark";

export const STARTER_DATASET: LabelledTransaction[] = [
  // Groceries and food
  { narration: "UPI/9033/BigBasket/BBNow", direction: "DEBIT", expected: "food-and-groceries" },
  { narration: "UPI/2231/Blinkit/Groceries", direction: "DEBIT", expected: "food-and-groceries" },
  { narration: "UPI/7742/Zepto/Daily", direction: "DEBIT", expected: "food-and-groceries" },
  { narration: "UPI/1123/SWIGGY/Order", direction: "DEBIT", expected: "food-and-groceries" },
  { narration: "POS 4412XXXX8890 DMART AVENUE", direction: "DEBIT", expected: "food-and-groceries" },

  // Entertainment
  { narration: "UPI/5512/Netflix.com/Monthly", direction: "DEBIT", expected: "entertainment" },
  { narration: "UPI/6621/Spotify India/Premium", direction: "DEBIT", expected: "entertainment" },
  { narration: "UPI/9981/BookMyShow/Tickets", direction: "DEBIT", expected: "entertainment" },

  // Personal care and health
  { narration: "UPI/8122/UrbanCompany/Salon", direction: "DEBIT", expected: "personal-care-and-health" },
  { narration: "UPI/3391/Apollo Pharmacy/Medicines", direction: "DEBIT", expected: "personal-care-and-health" },
  { narration: "UPI/4417/CULT FIT/Membership", direction: "DEBIT", expected: "personal-care-and-health" },

  // Travel
  { narration: "UPI/7781/Uber India/Ride", direction: "DEBIT", expected: "travel" },
  { narration: "UPI/2214/IRCTC/Ticket booking", direction: "DEBIT", expected: "travel" },
  { narration: "UPI/9134/Indian Oil/Fuel", direction: "DEBIT", expected: "travel" },
  { narration: "POS 5521XXXX1180 INDIGO AIRLINES", direction: "DEBIT", expected: "travel" },

  // Loans and finance
  { narration: "IMPS/P2A/BAJAJ FIN EMI 8831", direction: "DEBIT", expected: "loan" },
  { narration: "ACH DR/BAJAJ FIN EMI", direction: "DEBIT", expected: "loan" },
  { narration: "NACH DR/HDB FINANCIAL/INSTALMENT", direction: "DEBIT", expected: "loan" },

  // Income
  { narration: "NEFT CR/ACME CORP SAL NOV25", direction: "CREDIT", expected: "salaries" },
  { narration: "RTGS CR/MERIDIAN RETAIL/INV-4523", direction: "CREDIT", expected: "sales" },
  { narration: "NEFT CR/RAZORPAY SETTLEMENT", direction: "CREDIT", expected: "sales" },
  { narration: "INT.PD:SB INTEREST CREDIT", direction: "CREDIT", expected: "interest-income" },

  // Utilities and communications
  { narration: "BILLPAY/TORRENT POWER LTD", direction: "DEBIT", expected: "electricity" },
  { narration: "UPI/1180/Airtel Postpaid/Bill", direction: "DEBIT", expected: "telephone" },
  { narration: "BILLPAY/ACT FIBERNET BROADBAND", direction: "DEBIT", expected: "internet" },

  // Business costs
  { narration: "ACH DR/OFFICE RENT/SKYLINE PROPERTIES", direction: "DEBIT", expected: "rent" },
  { narration: "UPI/7712/Google Workspace/Subscription", direction: "DEBIT", expected: "software" },
  { narration: "UPI/8891/Google Ads/Campaign", direction: "DEBIT", expected: "advertising" },
  { narration: "RTGS DR/PRIME HARDWARE TRADERS/PURCHASE", direction: "DEBIT", expected: "purchases" },
  { narration: "BANK CHARGE:MONTHLY SERVICE CHARGE", direction: "DEBIT", expected: "bank-charges" },
  { narration: "GST PAYMENT/GSTN CHALLAN/202504", direction: "DEBIT", expected: "gst" },

  // Personal transfers and shopping
  { narration: "IMPS/P2P/Ankit Sharma/Trip split", direction: "DEBIT", expected: "personal-transfer" },
  { narration: "UPI/6612/Amazon Pay/Order", direction: "DEBIT", expected: "shopping" },
  { narration: "UPI/3312/Myntra/Clothing", direction: "DEBIT", expected: "shopping" },

  // Cash
  { narration: "ATM WDL/SELF WITHDRAWAL", direction: "DEBIT", expected: "cash-withdrawal" },
  { narration: "CASH DEPOSIT/CDM BRANCH", direction: "CREDIT", expected: "cash-deposit" },
];

/**
 * Parse a pasted set: `narration | direction | expected category id` per line,
 * comma or tab separated. Lets a real anonymised export be dropped in without
 * a build step.
 */
export function parseDataset(text: string): LabelledTransaction[] {
  const rows: LabelledTransaction[] = [];

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    const parts = trimmed.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((part) =>
      part.trim().replace(/^"|"$/g, "")
    );
    if (parts.length < 3) continue;

    const direction = parts[1].toUpperCase() === "CREDIT" ? "CREDIT" : "DEBIT";
    rows.push({ narration: parts[0], direction, expected: parts[2] });
  }

  return rows;
}
