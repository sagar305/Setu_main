// Builders for the shareable links this app sends to parents.
//
// Every document is compressed into the URL fragment of /view, exactly like
// the Invoice Generator — the receipt or report travels inside the link, so
// nothing is uploaded and the link keeps working offline for the parent.

import {
  buildShareUrl,
  businessToShare,
  type SharedAttendance,
  type SharedDoc,
  type SharedFeeReceipt,
  type SharedMarks,
} from "@/lib/toolkit/shareLink";
import type { Business } from "@/lib/pos/types";
import { percentOf } from "@/lib/tuition/calc";
import {
  formatMonth,
  type FeePayment,
  type MarkRecord,
  type Student,
  type TestRecord,
  type TuitionSettings,
} from "@/lib/tuition/types";

export function feeReceiptDoc(
  business: Business | null,
  student: Student,
  payment: FeePayment,
  balanceAfter: number
): SharedFeeReceipt {
  return {
    t: "fee",
    b: businessToShare(business),
    no: payment.receiptNumber,
    dt: payment.date,
    sn: student.name,
    cp: student.parentPhone || undefined,
    cls: student.classLevel || undefined,
    amt: payment.amount,
    mode: payment.mode,
    tw: payment.appliedTo.map((label) =>
      /^\d{4}-\d{2}$/.test(label) ? formatMonth(label) : label
    ),
    bal: balanceAfter > 0 ? balanceAfter : undefined,
  };
}

export function marksDoc(
  business: Business | null,
  student: Student,
  test: TestRecord,
  mark: MarkRecord,
  stats: { average: number; rank?: number; appeared: number },
  settings: TuitionSettings
): SharedMarks {
  return {
    t: "mrk",
    b: businessToShare(business),
    sn: student.name,
    cp: student.parentPhone || undefined,
    tn: test.name,
    sub: test.subject || undefined,
    dt: test.date,
    mk: mark.marks,
    max: test.maxMarks,
    avg: settings.showClassAverage ? stats.average : undefined,
    rnk: settings.showRank ? stats.rank : undefined,
    outOf: settings.showRank ? stats.appeared : undefined,
    rem: mark.remark || undefined,
  };
}

export function attendanceDoc(
  business: Business | null,
  student: Student,
  periodLabel: string,
  stats: { present: number; total: number; percent: number },
  absentDates: string[]
): SharedAttendance {
  return {
    t: "att",
    b: businessToShare(business),
    sn: student.name,
    cp: student.parentPhone || undefined,
    pd: periodLabel,
    prs: stats.present,
    tot: stats.total,
    pct: stats.percent,
    abs: absentDates.length > 0 ? absentDates : undefined,
  };
}

/** Full /view#d=… link. Client-side only — needs window.location.origin. */
export function shareUrlFor(doc: SharedDoc): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return buildShareUrl(doc, origin);
}

export { percentOf };
