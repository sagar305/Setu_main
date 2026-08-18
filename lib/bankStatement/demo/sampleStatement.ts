// The built-in demo statement (spec §25, decision 19).
// ---------------------------------------------------------------------------
// Synthetic data for a fictional Indian SME, generated deterministically so the
// demo is identical on every machine and the numbers in the marketing copy stay
// true:
//
//     247 transactions · credits ₹18,42,000 · debits ₹15,76,500
//
// This is not, and must never be replaced by, a real bank statement.

import type { BankStatement, Transaction } from "@/lib/bankStatement/types";
import { round2 } from "@/lib/bankStatement/utils/numbers";
import { extractParty } from "@/lib/bankStatement/utils/text";

export const DEMO_STATEMENT_ID = "demo-statement";
export const DEMO_BUSINESS = "Aarav Digital Services";

export const DEMO_TOTALS = {
  count: 247,
  credits: 1842000,
  debits: 1576500,
} as const;

const OPENING_BALANCE = 412500;

/** Deterministic PRNG so the demo never shifts between loads. */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

type Draft = { date: string; narration: string; debit: number; credit: number };

const CLIENTS = [
  "MERIDIAN RETAIL PVT LTD",
  "SUNRISE FOODS LLP",
  "KAVERI TEXTILES",
  "BLUEPEAK CONSULTING",
  "ORION HEALTHCARE PVT LTD",
  "GREENLEAF ORGANICS",
  "NORTHSTAR LOGISTICS",
];

const SUPPLIERS = [
  "VERTEX SUPPLIES",
  "ANAND ENTERPRISES",
  "PRIME HARDWARE TRADERS",
  "SHREE PAPER MART",
];

const STAFF = ["RAHUL MEHTA", "PRIYA NAIR", "IMRAN SHAIKH"];

function isoDate(year: number, month: number, day: number): string {
  const safeDay = Math.min(day, new Date(Date.UTC(year, month, 0)).getUTCDate());
  return `${year}-${String(month).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
}

/**
 * Build the month-by-month schedule for FY 2025–26. Amounts are picked from the
 * PRNG in realistic bands; the two balancing entries at the end absorb whatever
 * is needed to land exactly on the published totals.
 */
function buildDrafts(): Draft[] {
  const random = makeRandom(20260413);
  const pick = <T,>(list: T[]): T => list[Math.floor(random() * list.length)];
  const between = (low: number, high: number, step = 100) =>
    Math.round((low + random() * (high - low)) / step) * step;

  const drafts: Draft[] = [];
  const months: { year: number; month: number }[] = [];
  for (let i = 0; i < 12; i += 1) {
    const month = ((3 + i) % 12) + 1; // Apr … Mar
    const year = 3 + i < 12 ? 2025 : 2026;
    months.push({ year, month });
  }

  for (const { year, month } of months) {
    // --- income ------------------------------------------------------------
    const receipts = 3 + Math.floor(random() * 2);
    for (let i = 0; i < receipts; i += 1) {
      const client = pick(CLIENTS);
      drafts.push({
        date: isoDate(year, month, 4 + i * 6 + Math.floor(random() * 3)),
        narration: `NEFT CR/${client}/INV-${month}${String(100 + Math.floor(random() * 800))}`,
        debit: 0,
        credit: between(26000, 54000, 500),
      });
    }

    if (month % 3 === 0) {
      drafts.push({
        date: isoDate(year, month, 28),
        narration: "INT.PD:SB INTEREST CREDIT",
        debit: 0,
        credit: between(900, 2400, 100),
      });
    }

    // --- recurring costs ---------------------------------------------------
    drafts.push({
      date: isoDate(year, month, 5),
      narration: "ACH DR/OFFICE RENT/SKYLINE PROPERTIES",
      debit: 18000,
      credit: 0,
    });

    for (const person of STAFF) {
      drafts.push({
        date: isoDate(year, month, 1),
        narration: `NEFT DR/SALARY/${person}`,
        debit: between(12000, 22000, 500),
        credit: 0,
      });
    }

    drafts.push({
      date: isoDate(year, month, 9),
      narration: "BILLPAY/ELECTRICITY/TORRENT POWER LTD",
      debit: between(2000, 4500, 50),
      credit: 0,
    });
    drafts.push({
      date: isoDate(year, month, 11),
      narration: "BILLPAY/INTERNET/ACT FIBERNET BROADBAND",
      debit: 1199,
      credit: 0,
    });
    drafts.push({
      date: isoDate(year, month, 12),
      narration: "BILLPAY/AIRTEL POSTPAID MOBILE BILL",
      debit: between(700, 1200, 50),
      credit: 0,
    });
    drafts.push({
      date: isoDate(year, month, 14),
      narration: "UPI/DR/GOOGLE WORKSPACE SUBSCRIPTION/HDFC",
      debit: between(900, 1800, 50),
      credit: 0,
    });
    drafts.push({
      date: isoDate(year, month, 16),
      narration: "UPI/DR/GOOGLE ADS/MARKETING SPEND",
      debit: between(3000, 8000, 500),
      credit: 0,
    });

    // --- variable costs ----------------------------------------------------
    const purchases = 2 + Math.floor(random() * 2);
    for (let i = 0; i < purchases; i += 1) {
      drafts.push({
        date: isoDate(year, month, 8 + i * 5 + Math.floor(random() * 3)),
        narration: `RTGS DR/PURCHASE/${pick(SUPPLIERS)}`,
        debit: between(4000, 12000, 500),
        credit: 0,
      });
    }

    const travel = Math.floor(random() * 3);
    for (let i = 0; i < travel; i += 1) {
      drafts.push({
        date: isoDate(year, month, 6 + i * 7),
        narration: random() > 0.5 ? "UPI/DR/UBER INDIA SYSTEMS/TRAVEL" : "UPI/DR/IRCTC RAIL BOOKING",
        debit: between(400, 3000, 50),
        credit: 0,
      });
    }

    drafts.push({
      date: isoDate(year, month, 21),
      narration: "BANK CHARGE:MONTHLY SERVICE CHARGE + GST ON CHARGE",
      debit: between(120, 480, 10),
      credit: 0,
    });

    // --- statutory ---------------------------------------------------------
    drafts.push({
      date: isoDate(year, month, 20),
      narration: `GST PAYMENT/GSTN CHALLAN/${year}${String(month).padStart(2, "0")}`,
      debit: between(3000, 9000, 500),
      credit: 0,
    });
    if (month % 3 === 1) {
      drafts.push({
        date: isoDate(year, month, 7),
        narration: "TDS PAYMENT 194J/ITNS 281",
        debit: between(2000, 6000, 500),
        credit: 0,
      });
    }

    // --- cash --------------------------------------------------------------
    if (random() > 0.45) {
      drafts.push({
        date: isoDate(year, month, 13),
        narration: "CASH DEPOSIT/CDM BRANCH COUNTER",
        debit: 0,
        credit: between(5000, 25000, 500),
      });
    }
    drafts.push({
      date: isoDate(year, month, 24),
      narration: "ATM WDL/SELF WITHDRAWAL/MG ROAD",
      debit: between(1500, 6000, 500),
      credit: 0,
    });

    // --- transfers and the occasional personal item ------------------------
    drafts.push({
      date: isoDate(year, month, 26),
      narration: "UPI/DR/CREDIT CARD PAYMENT AUTOPAY/HDFC CC",
      debit: between(3000, 9000, 500),
      credit: 0,
    });
    if (month % 2 === 0) {
      drafts.push({
        date: isoDate(year, month, 18),
        narration: "SIP/MUTUAL FUND/NIPPON INDIA GROWTH",
        debit: 5000,
        credit: 0,
      });
    }
    if (month % 4 === 2) {
      drafts.push({
        date: isoDate(year, month, 22),
        narration: "UPI/DR/SWIGGY ORDER/PERSONAL",
        debit: between(300, 900, 10),
        credit: 0,
      });
    }
    drafts.push({
      date: isoDate(year, month, 19),
      narration: "UPI/DR/SHREE PAPER MART/OFFICE STATIONERY",
      debit: between(600, 2400, 50),
      credit: 0,
    });
  }

  return drafts;
}

/**
 * Trim or pad to exactly 247 rows, then set the two balancing entries so the
 * credit and debit totals match the published figures to the rupee.
 */
function reconcileToPublishedTotals(drafts: Draft[]): Draft[] {
  const random = makeRandom(90210);
  const rows = [...drafts].sort((a, b) => a.date.localeCompare(b.date));

  // Two rows are reserved as the balancing pair — one on each side.
  const target = DEMO_TOTALS.count - 2;

  // Trim down to size by dropping the smallest *repeated* debits. Never drop
  // the last row of a narration kind: bank charges and the occasional personal
  // spend are the smallest amounts in the file, and they are exactly what a CA
  // opens the Bank Charges and personal/business reports to see.
  // Key on the whole narration with the digits stripped, so "UPI/DR/SWIGGY
  // ORDER/PERSONAL" is its own kind rather than being lumped in with every
  // other UPI debit.
  const kindOf = (row: Draft) => row.narration.replace(/\d+/g, "").slice(0, 40);

  while (rows.length > target) {
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(kindOf(row), (counts.get(kindOf(row)) ?? 0) + 1);

    let candidate = -1;
    for (let i = 0; i < rows.length; i += 1) {
      if (rows[i].debit === 0) continue;
      if ((counts.get(kindOf(rows[i])) ?? 0) <= 1) continue;
      if (candidate === -1 || rows[i].debit < rows[candidate].debit) candidate = i;
    }
    // Every remaining kind is down to its last row — take the smallest debit.
    if (candidate === -1) {
      for (let i = 0; i < rows.length; i += 1) {
        if (rows[i].debit === 0) continue;
        if (candidate === -1 || rows[i].debit < rows[candidate].debit) candidate = i;
      }
    }
    rows.splice(candidate === -1 ? rows.length - 1 : candidate, 1);
  }

  while (rows.length < target) {
    const index = rows.length % 12;
    rows.push({
      date: isoDate(index < 9 ? 2025 : 2026, ((3 + index) % 12) + 1, 17),
      narration: "UPI/DR/OFFICE PANTRY SUPPLIES",
      debit: Math.round((300 + random() * 900) / 10) * 10,
      credit: 0,
    });
  }

  const creditSum = rows.reduce((sum, row) => sum + row.credit, 0);
  const debitSum = rows.reduce((sum, row) => sum + row.debit, 0);

  rows.push({
    date: "2026-03-27",
    narration: `NEFT CR/${CLIENTS[0]}/INV-3928 FINAL SETTLEMENT`,
    debit: 0,
    credit: round2(DEMO_TOTALS.credits - creditSum),
  });
  rows.push({
    date: "2026-03-30",
    narration: `RTGS DR/PURCHASE/${SUPPLIERS[0]} QUARTER END`,
    debit: round2(DEMO_TOTALS.debits - debitSum),
    credit: 0,
  });

  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export type DemoData = { statement: BankStatement; transactions: Transaction[] };

/** Build the demo statement and its transactions. Pure and deterministic. */
export function buildDemoData(): DemoData {
  const rows = reconcileToPublishedTotals(buildDrafts());

  let balance = OPENING_BALANCE;
  const transactions: Transaction[] = rows.map((row, index) => {
    balance = round2(balance + row.credit - row.debit);
    return {
      id: `${DEMO_STATEMENT_ID}-txn-${index + 1}`,
      statementId: DEMO_STATEMENT_ID,
      date: row.date,
      narration: row.narration,
      debit: round2(row.debit),
      credit: round2(row.credit),
      balance,
      currency: "INR",
      transactionType: row.debit > 0 ? "DEBIT" : "CREDIT",
      partyName: extractParty(row.narration),
      classificationType: "UNKNOWN",
      classificationSource: "UNCLASSIFIED",
      sourceRow: index + 1,
      rowStatus: "VALID",
      createdAt: new Date().toISOString(),
    };
  });

  const statement: BankStatement = {
    id: DEMO_STATEMENT_ID,
    fileName: "demo-statement-aarav-digital-services.pdf",
    bankName: "Demo Bank (synthetic)",
    parserId: "demo",
    parserValidated: true,
    accountHolder: DEMO_BUSINESS,
    accountNumberMasked: "••••4417",
    accountType: "Current",
    branch: "MG Road",
    ifsc: "DEMO0001234",
    startDate: transactions[0]?.date,
    endDate: transactions[transactions.length - 1]?.date,
    openingBalance: OPENING_BALANCE,
    closingBalance: balance,
    transactionCount: transactions.length,
    currency: "INR",
    sourceFormat: "PDF",
    importedAt: new Date().toISOString(),
    parseStatus: "VALID",
    validation: {
      extracted: transactions.length,
      resolved: transactions.length,
      warnings: 0,
      unresolved: 0,
      skippedRows: 0,
      balanceChain: { checked: true, breaks: 0, openingMatches: true, closingMatches: true },
      issues: [],
    },
  };

  return { statement, transactions };
}
