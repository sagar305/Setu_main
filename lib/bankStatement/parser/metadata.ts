// Pull the statement header (account, period, balances) out of the preamble.
// Account numbers are masked the moment they are read — the full number is
// never stored or logged (§8, §18).

import type { DateFormat } from "@/lib/bankStatement/types";
import { parseDate } from "@/lib/bankStatement/utils/dates";
import { parseAmount } from "@/lib/bankStatement/utils/numbers";
import { maskAccountNumber, sanitiseCell } from "@/lib/bankStatement/utils/text";

export type StatementMetadata = {
  accountHolder?: string;
  accountNumberMasked?: string;
  accountType?: string;
  branch?: string;
  ifsc?: string;
  startDate?: string;
  endDate?: string;
  openingBalance?: number;
  closingBalance?: number;
  currency?: string;
};

export function extractMetadata(text: string, format: DateFormat = "DMY"): StatementMetadata {
  const meta: StatementMetadata = {};
  // Keep line breaks intact: the regexes below deliberately match horizontal
  // whitespace only, so a label cannot capture a value from the next line.
  const head = text
    .slice(0, 6000)
    .split("\n")
    .map((line) => sanitiseCell(line))
    .join("\n");

  const accountNumber = head.match(
    /(?:ACCOUNT|A\/C|AC)[ \t]*(?:NO|NUMBER|#)?\.?[ \t]*:?[ \t]*([X*x•\d][X*x•\d \t-]{5,25}\d)/i
  );
  if (accountNumber) meta.accountNumberMasked = maskAccountNumber(accountNumber[1]);

  const ifsc = head.match(/\b(?:IFSC|IFS[ \t]*CODE|RTGS\/NEFT[ \t]*IFSC)[ \t]*:?[ \t]*([A-Z]{4}0[A-Z0-9]{6})\b/i);
  if (ifsc) meta.ifsc = ifsc[1].toUpperCase();

  const holder = head.match(
    /(?:ACCOUNT[ \t]*(?:HOLDER|NAME)|CUSTOMER[ \t]*NAME|NAME)[ \t]*:?[ \t]*([A-Za-z][A-Za-z.&'\- ]{2,60})/i
  );
  if (holder) meta.accountHolder = holder[1].trim().replace(/\s{2,}/g, " ");

  const branch = head.match(/BRANCH[ \t]*(?:NAME)?[ \t]*:?[ \t]*([A-Za-z][A-Za-z0-9.,'\- ]{2,50})/i);
  if (branch) meta.branch = branch[1].trim();

  const accountType = head.match(
    /\b(SAVINGS?(?:\s*ACCOUNT)?|CURRENT(?:\s*ACCOUNT)?|OD|CASH\s*CREDIT|OVERDRAFT)\b/i
  );
  if (accountType) meta.accountType = accountType[1].replace(/\s+/g, " ").trim();

  const period = head.match(
    /(?:STATEMENT[ \t]*(?:PERIOD|FOR|FROM)|PERIOD|FROM)[ \t]*:?[ \t]*([\d]{1,4}[/\-. ][A-Za-z\d]{1,9}[/\-. ][\d]{2,4})[ \t]*(?:TO|-|–|THROUGH)[ \t]*([\d]{1,4}[/\-. ][A-Za-z\d]{1,9}[/\-. ][\d]{2,4})/i
  );
  if (period) {
    const start = parseDate(period[1], format);
    const end = parseDate(period[2], format);
    if (start) meta.startDate = start;
    if (end) meta.endDate = end;
  }

  // Horizontal whitespace only: a label must not reach across a line break and
  // pick up the first cell of the transaction table below it.
  const opening = head.match(/OPENING[ \t]*BALANCE[ \t]*:?[ \t]*(?:INR|RS\.?|₹)?[ \t]*(\d[\d,]*\.?\d*(?:[ \t]*(?:DR|CR))?)/i);
  if (opening) {
    const value = parseAmount(opening[1]);
    if (value !== null) meta.openingBalance = value;
  }

  const closing = head.match(/CLOSING[ \t]*BALANCE[ \t]*:?[ \t]*(?:INR|RS\.?|₹)?[ \t]*(\d[\d,]*\.?\d*(?:[ \t]*(?:DR|CR))?)/i);
  if (closing) {
    const value = parseAmount(closing[1]);
    if (value !== null) meta.closingBalance = value;
  }

  if (/\bINR\b|₹|\bRUPEES?\b/i.test(head)) meta.currency = "INR";
  else if (/\bUSD\b|\$/.test(head)) meta.currency = "USD";

  return meta;
}
