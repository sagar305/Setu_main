// Unit tests for the parsing primitives — the pieces every statement layout
// depends on, tested against the shapes Indian bank statements actually print.

import { describe, expect, it } from "vitest";
import { amountInWords, groupIndian, parseAmount } from "@/lib/bankStatement/utils/numbers";
import { detectDateFormat, parseDate } from "@/lib/bankStatement/utils/dates";
import { extractGstin, extractParty, maskAccountNumber, similarity } from "@/lib/bankStatement/utils/text";
import { detectDelimiter, parseCsv } from "@/lib/bankStatement/parser/csv";
import { detectMapping, looksLikeHeaderRow } from "@/lib/bankStatement/parser/columns";
import { detectBank, selectAdapter } from "@/lib/bankStatement/parser/banks";

describe("parseAmount", () => {
  it("reads Indian grouping, symbols and accounting negatives", () => {
    expect(parseAmount("1,23,456.78")).toBe(123456.78);
    expect(parseAmount("₹ 2,500")).toBe(2500);
    expect(parseAmount("(1,234.00)")).toBe(-1234);
    expect(parseAmount("1,234.00 Dr")).toBe(-1234);
    expect(parseAmount("1,234.00 Cr")).toBe(1234);
    expect(parseAmount("−500")).toBe(-500); // unicode minus
  });

  it("distinguishes an empty cell from a zero", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("-")).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
    expect(parseAmount("0.00")).toBe(0);
  });

  it("does not read a reference number as an amount", () => {
    expect(parseAmount("N012345678")).toBeNull();
  });
});

describe("Indian number formatting", () => {
  it("groups in lakhs and crores", () => {
    expect(groupIndian(1234567.5)).toBe("12,34,567.50");
    expect(groupIndian(1842000)).toBe("18,42,000.00");
  });

  it("writes amounts in words the Indian way", () => {
    expect(amountInWords(1842000)).toBe("Eighteen Lakh Forty Two Thousand");
    expect(amountInWords(10000000)).toBe("One Crore");
    expect(amountInWords(0)).toBe("Zero");
  });
});

describe("date parsing", () => {
  it("honours the chosen format for ambiguous numeric dates", () => {
    expect(parseDate("01/02/2026", "DMY")).toBe("2026-02-01");
    expect(parseDate("01/02/2026", "MDY")).toBe("2026-01-02");
  });

  it("reads textual and ISO dates without needing a format", () => {
    expect(parseDate("12 Mar 2026")).toBe("2026-03-12");
    expect(parseDate("12-MAR-26")).toBe("2026-03-12");
    expect(parseDate("2026-03-12", "YMD")).toBe("2026-03-12");
  });

  it("rejects impossible dates", () => {
    expect(parseDate("31/02/2026", "DMY")).toBeNull();
    expect(parseDate("not a date")).toBeNull();
  });

  it("proves DMY from a day above 12, and admits ambiguity otherwise", () => {
    expect(detectDateFormat(["13/04/2025", "01/05/2025"])).toEqual({
      format: "DMY",
      ambiguous: false,
    });
    expect(detectDateFormat(["04/13/2025", "05/01/2025"])).toEqual({
      format: "MDY",
      ambiguous: false,
    });
    // Nothing in this sample proves either reading — the CA must be asked.
    expect(detectDateFormat(["01/02/2025", "03/04/2025"])).toEqual({
      format: "DMY",
      ambiguous: true,
    });
  });
});

describe("narration text", () => {
  it("pulls the counterparty out of a UPI-style narration", () => {
    expect(extractParty("UPI/DR/402318/SWIGGY/UTIB/swiggy@axis")).toBe("Swiggy");
    expect(extractParty("NEFT CR/MERIDIAN RETAIL PVT LTD/INV-4101")).toBe("Meridian Retail Pvt Ltd");
  });

  it("returns nothing rather than guessing when there is no name", () => {
    expect(extractParty("123456789/987654321")).toBeUndefined();
  });

  it("finds a GSTIN in a narration", () => {
    expect(extractGstin("PAYMENT 29ABCDE1234F1Z5 GST")).toBe("29ABCDE1234F1Z5");
  });

  it("masks account numbers to the last four digits", () => {
    expect(maskAccountNumber("50100234567890")).toBe("••••7890");
  });

  it("scores narration similarity for fuzzy matching", () => {
    expect(similarity("NEFT DR SALARY RAHUL MEHTA", "NEFT DR SALARY RAHUL MEHTA")).toBe(1);
    expect(similarity("RENT PAYMENT SKYLINE", "GOOGLE ADS MARKETING")).toBe(0);
  });
});

describe("delimited files", () => {
  it("detects the delimiter", () => {
    expect(detectDelimiter("a,b,c\n1,2,3")).toBe(",");
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(detectDelimiter("a\tb\tc\n1\t2\t3")).toBe("\t");
  });

  it("honours quoted fields containing the delimiter", () => {
    const rows = parseCsv('Date,Narration,Amount\n01/04/2025,"PAYMENT, FINAL",500');
    expect(rows[1].cells).toEqual(["01/04/2025", "PAYMENT, FINAL", "500"]);
  });
});

describe("column detection", () => {
  it("recognises a header row and maps the columns", () => {
    const headers = [
      "Txn Date",
      "Value Date",
      "Narration",
      "Chq/Ref No",
      "Withdrawal Amt.",
      "Deposit Amt.",
      "Closing Balance",
    ];
    expect(looksLikeHeaderRow(headers)).toBe(true);
    expect(detectMapping(headers, [])).toMatchObject({
      date: 0,
      valueDate: 1,
      narration: 2,
      reference: 3,
      debit: 4,
      credit: 5,
      balance: 6,
    });
  });

  it("falls back to the data when there is no usable header", () => {
    const rows = [
      { cells: ["01/04/2025", "NEFT CR MERIDIAN RETAIL", "", "50000.00", "175000.00"] },
      { cells: ["02/04/2025", "ACH DR OFFICE RENT", "18000.00", "", "157000.00"] },
    ];
    const mapping = detectMapping([], rows);
    expect(mapping.date).toBe(0);
    expect(mapping.narration).toBe(1);
  });
});

describe("bank adapters", () => {
  it("names the bank from the statement letterhead", () => {
    expect(detectBank("HDFC BANK LTD\nStatement of account")?.id).toBe("hdfc");
    expect(detectBank("STATE BANK OF INDIA")?.id).toBe("sbi");
    expect(detectBank("Some other bank")).toBeNull();
  });

  // The honesty rule (decision 11): until an adapter is proven against real
  // anonymised fixtures it must not be used to parse, even when detected.
  it("parses with the generic engine while an adapter is unvalidated", () => {
    const { adapter, detected } = selectAdapter("HDFC BANK LTD");
    expect(detected?.id).toBe("hdfc");
    expect(detected?.validated).toBe(false);
    expect(adapter.id).toBe("generic");
  });
});

describe("header synonyms — the shapes real statements use", () => {
  // Every one of these failed to map on a real statement.
  it("ignores currency decoration in the header", () => {
    expect(detectMapping(["Txn Date", "Description", "Debit (₹)", "Credit (₹)", "Balance (₹)"], [])).toMatchObject({
      date: 0,
      narration: 1,
      debit: 2,
      credit: 3,
      balance: 4,
    });
    expect(detectMapping(["Date", "Particulars", "Debit (Rs.)", "Credit (Rs.)", "Balance (INR)"], [])).toMatchObject({
      debit: 2,
      credit: 3,
      balance: 4,
    });
    expect(detectMapping(["Date", "Details", "Amount (₹)"], [])).toMatchObject({ amount: 2 });
  });

  it("reads a reference header written in either order", () => {
    expect(detectMapping(["Date", "Narration", "Chq/Ref No", "Amount"], []).reference).toBe(2);
    expect(detectMapping(["Date", "Narration", "Ref No./Cheque No.", "Amount"], []).reference).toBe(2);
    expect(detectMapping(["Date", "Narration", "Cheque No./Ref No.", "Amount"], []).reference).toBe(2);
  });

  it("recognises a header row whose amount columns carry a rupee sign", () => {
    expect(
      looksLikeHeaderRow(["Txn Date", "Value Date", "Description", "Ref No./Cheque No.", "Branch Code", "Debit (₹)", "Credit (₹)", "Balance (₹)"])
    ).toBe(true);
  });

  // A branch or office code is a short integer with no decimal point. Treated
  // as money, it was inferred as the debit column and shifted every real debit
  // into credit — a silent sign inversion.
  it("does not infer a short code column as an amount", () => {
    const rows = [
      { cells: ["01/12/2025", "UPI/PAYMENT", "2216", "1248.00", "124232.00"] },
      { cells: ["02/12/2025", "NEFT CREDIT", "4430", "2499.00", "121733.00"] },
      { cells: ["03/12/2025", "ATM WITHDRAWAL", "9922", "5000.00", "116733.00"] },
    ];
    const mapping = detectMapping([], rows);
    expect(mapping.debit).not.toBe(2);
    expect(mapping.credit).not.toBe(2);
    expect(mapping.amount).not.toBe(2);
  });
});
