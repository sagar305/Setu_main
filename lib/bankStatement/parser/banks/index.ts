// Bank adapters.
// ---------------------------------------------------------------------------
// IMPORTANT (decision 11 / spec §30): every adapter below is declared
// `validated: false`. That flag is not decoration — it is the honesty switch
// for the whole tool:
//
//   • detection may still name the bank (it reads the letterhead text, which is
//     safe), and the adapter's *hints* are applied as hints only;
//   • the UI must label the parse as "generic layout" and tell the CA the
//     bank-specific adapter has not been verified;
//   • no adapter may claim it "supports" a bank's real-world layout variants
//     until it has been proven against anonymised fixtures.
//
// To promote an adapter: add anonymised fixtures under tests/fixtures/<bank>/
// with an expected-output JSON, make the golden test pass, then flip
// `validated` to true here. Nothing else in the code needs to change.

import type { ColumnMapping, DateFormat } from "@/lib/bankStatement/types";

export type BankAdapter = {
  id: string;
  name: string;
  /** Patterns matched against the statement's first-page text. */
  detect: RegExp[];
  /**
   * Layout hints applied when this bank is detected. Treated as a starting
   * point for detection, never as a guarantee, while `validated` is false.
   */
  hints: {
    dateFormat?: DateFormat;
    /** Header synonyms peculiar to this bank, matched case-insensitively. */
    headerAliases?: { field: keyof ColumnMapping; pattern: RegExp }[];
  };
  /** Proven against real anonymised statements? See the note above. */
  validated: boolean;
};

export const GENERIC_ADAPTER: BankAdapter = {
  id: "generic",
  name: "Generic layout",
  detect: [],
  hints: { dateFormat: "DMY" },
  // The generic path is the one we actually test, against synthetic fixtures.
  validated: true,
};

export const BANK_ADAPTERS: BankAdapter[] = [
  {
    id: "hdfc",
    name: "HDFC Bank",
    detect: [/HDFC\s*BANK/i, /\bHDFCB\b/],
    hints: {
      dateFormat: "DMY",
      headerAliases: [
        { field: "narration", pattern: /^NARRATION$/i },
        { field: "reference", pattern: /^CHQ\.?\s*\/?\s*REF\.?\s*NO\.?$/i },
        { field: "debit", pattern: /^WITHDRAWAL\s*AMT\.?$/i },
        { field: "credit", pattern: /^DEPOSIT\s*AMT\.?$/i },
        { field: "balance", pattern: /^CLOSING\s*BALANCE$/i },
        { field: "valueDate", pattern: /^VALUE\s*DT\.?$/i },
      ],
    },
    validated: false,
  },
  {
    id: "sbi",
    name: "State Bank of India",
    detect: [/STATE\s*BANK\s*OF\s*INDIA/i, /\bSBIN\b/],
    hints: {
      dateFormat: "DMY",
      headerAliases: [
        { field: "narration", pattern: /^DESCRIPTION$/i },
        { field: "reference", pattern: /^REF\.?\s*NO\.?\s*\/?\s*CHEQUE\s*NO\.?$/i },
        { field: "debit", pattern: /^DEBIT$/i },
        { field: "credit", pattern: /^CREDIT$/i },
        { field: "balance", pattern: /^BALANCE$/i },
      ],
    },
    validated: false,
  },
  {
    id: "icici",
    name: "ICICI Bank",
    detect: [/ICICI\s*BANK/i, /\bICIC\b/],
    hints: {
      dateFormat: "DMY",
      headerAliases: [
        { field: "narration", pattern: /^TRANSACTION\s*REMARKS$/i },
        { field: "debit", pattern: /^WITHDRAWAL\s*AMOUNT\s*\(INR\s*\)$/i },
        { field: "credit", pattern: /^DEPOSIT\s*AMOUNT\s*\(INR\s*\)$/i },
        { field: "balance", pattern: /^BALANCE\s*\(INR\s*\)$/i },
      ],
    },
    validated: false,
  },
  {
    id: "axis",
    name: "Axis Bank",
    detect: [/AXIS\s*BANK/i, /\bUTIB\b/],
    hints: {
      dateFormat: "DMY",
      headerAliases: [
        { field: "narration", pattern: /^PARTICULARS$/i },
        { field: "debit", pattern: /^DEBIT$/i },
        { field: "credit", pattern: /^CREDIT$/i },
        { field: "balance", pattern: /^BALANCE$/i },
        { field: "reference", pattern: /^CHQ\s*NO$/i },
      ],
    },
    validated: false,
  },
  {
    id: "kotak",
    name: "Kotak Mahindra Bank",
    detect: [/KOTAK\s*MAHINDRA/i, /\bKKBK\b/],
    hints: { dateFormat: "DMY" },
    validated: false,
  },
  {
    id: "pnb",
    name: "Punjab National Bank",
    detect: [/PUNJAB\s*NATIONAL\s*BANK/i, /\bPUNB\b/],
    hints: { dateFormat: "DMY" },
    validated: false,
  },
  {
    id: "bob",
    name: "Bank of Baroda",
    detect: [/BANK\s*OF\s*BARODA/i, /\bBARB\b/],
    hints: { dateFormat: "DMY" },
    validated: false,
  },
  {
    id: "yesbank",
    name: "Yes Bank",
    detect: [/YES\s*BANK/i, /\bYESB\b/],
    hints: { dateFormat: "DMY" },
    validated: false,
  },
];

/** Identify the bank from the statement's own text. Never guesses. */
export function detectBank(text: string): BankAdapter | null {
  const head = text.slice(0, 4000);
  for (const adapter of BANK_ADAPTERS) {
    if (adapter.detect.some((pattern) => pattern.test(head))) return adapter;
  }
  return null;
}

/** The adapter to parse with, plus the bank we think produced the statement. */
export function selectAdapter(text: string): { adapter: BankAdapter; detected: BankAdapter | null } {
  const detected = detectBank(text);
  // Until an adapter is validated we parse with the generic engine and only
  // carry the detected bank's hints — we never take its layout on trust.
  if (detected && detected.validated) return { adapter: detected, detected };
  return { adapter: GENERIC_ADAPTER, detected };
}
