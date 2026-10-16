// Turning extraction findings into prose, at the moment someone reads them.
// ---------------------------------------------------------------------------
// Row and statement issues travel with the data as codes (see IssueCode and
// ReportIssueCode in ./types): written once when a file is parsed, persisted,
// and read back later — possibly by someone working in another language from
// the one the import happened in. Formatting here, rather than at extraction,
// is what lets the same stored statement explain itself to both of them.
//
// Statements imported before the codes existed carry English prose instead.
// Those fall back to that prose rather than going silent: a stale sentence is
// worth more to a CA chasing a broken balance than an empty cell.

import type { IssueCode, ReportIssueCode, ValidationIssue } from "@/lib/bankStatement/types";
import type { AiErrorCode } from "@/lib/bankStatement/ai/client";
import type { AiProgress } from "@/lib/bankStatement/ai/protocol";
import type { LanguageCode } from "@/lib/i18n/config";
import { fill, translate, type TKey } from "@/lib/i18n/translate";

const ROW_ISSUE_KEYS: Record<IssueCode["code"], TKey> = {
  UNREADABLE_DATE: "bsIssUnreadableDate",
  NO_DATE: "bsIssNoDate",
  BOTH_DEBIT_CREDIT: "bsIssBothSides",
  NO_AMOUNT: "bsIssNoAmount",
  NO_NARRATION: "bsIssNoNarration",
  BALANCE_MARKER: "bsIssBalanceMarker",
  ZERO_AMOUNT: "bsIssZeroAmount",
  BALANCE_BREAK: "bsIssBalanceBreak",
  UNRESOLVED: "bsIssUnresolved",
};

/** One row's finding, in this reader's language. */
export function rowIssueLabel(issue: IssueCode, lang: LanguageCode): string {
  const text = translate(lang, ROW_ISSUE_KEYS[issue.code]);
  if (issue.code === "UNREADABLE_DATE") return fill(text, { date: issue.date });
  if (issue.code === "BALANCE_BREAK") {
    return fill(text, {
      expected: issue.expected.toFixed(2),
      found: issue.found.toFixed(2),
    });
  }
  return text;
}

/** A statement-level finding, in this reader's language. */
export function reportIssueLabel(issue: ReportIssueCode, lang: LanguageCode): string {
  switch (issue.code) {
    case "ROW":
      return issue.issue
        ? rowIssueLabel(issue.issue, lang)
        : translate(lang, "bsIssUnresolved");
    case "BALANCE_BREAKS":
      return fill(translate(lang, issue.rows === 1 ? "bsIssBreaks1" : "bsIssBreaksN"), {
        rows: issue.rows,
      });
    case "OPENING_MISMATCH":
      return translate(lang, "bsIssOpeningMismatch");
    case "CLOSING_MISMATCH":
      return translate(lang, "bsIssClosingMismatch");
    case "NOTHING_EXTRACTED":
      return translate(lang, "bsIssNothingExtracted");
    case "SKIPPED_ROWS":
      return fill(translate(lang, issue.rows === 1 ? "bsIssSkipped1" : "bsIssSkippedN"), {
        rows: issue.rows,
      });
  }
}

/**
 * What to show for a validation issue: its code where there is one, and the
 * English sentence stored alongside it where the statement predates them.
 */
export function validationIssueLabel(issue: ValidationIssue, lang: LanguageCode): string {
  return issue.code ? reportIssueLabel(issue.code, lang) : issue.message;
}

/** The same, for a row on a transaction. */
export function transactionIssueLabel(
  transaction: { rowIssueCode?: IssueCode; rowIssue?: string },
  lang: LanguageCode
): string | undefined {
  if (transaction.rowIssueCode) return rowIssueLabel(transaction.rowIssueCode, lang);
  return transaction.rowIssue;
}

/** What the AI panel says while the model is loading. */
export function aiProgressLabel(progress: AiProgress, lang: LanguageCode): string {
  if (progress.code === "PREPARING") return translate(lang, "bsAiPreparing");
  return fill(translate(lang, "bsAiDownloading"), {
    loaded: formatMb(progress.loadedBytes),
    total: formatMb(progress.totalBytes),
  });
}

/**
 * Why categorisation is unavailable.
 *
 * A fault the worker reported comes back as the worker's own description:
 * "the model failed to load" tells a CA more than "something went wrong", and
 * it is the only account of what actually happened.
 */
export function aiErrorLabel(
  code: AiErrorCode | undefined,
  detail: string | undefined,
  lang: LanguageCode
): string | undefined {
  if (code === "UNSUPPORTED") return translate(lang, "bsAiUnsupported");
  if (code === "WORKER_STOPPED") return translate(lang, "bsAiWorkerStopped");
  return detail;
}

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
