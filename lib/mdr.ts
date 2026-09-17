// MDR (Merchant Discount Rate) maths, shared by the MDR calculator and the
// zero-MDR QR splitter.
//
// Two things happen to a card/UPI collection before the money lands:
//   1. the acquirer keeps a percentage of the transaction (plus, sometimes, a
//      flat per-transaction fee) — that is the MDR;
//   2. GST is charged on the MDR itself (18% in India), not on the sale.
//
// Everything here is pure arithmetic on rupees. Nothing in this module talks to
// the network or to storage, so it is safe to unit-test and to import from both
// a calculator tool and a QR tool.

/**
 * Which figure the user typed.
 *
 * - `inclusive` — the amount already includes MDR. The customer pays exactly
 *   what was typed and the merchant receives less than that.
 * - `exclusive` — the amount is what the merchant wants to *land*. The charge
 *   is grossed up so that the net after MDR equals the figure typed.
 */
export type MdrMode = "inclusive" | "exclusive";

export type MdrInput = {
  /** The figure the user typed — read according to `mode`. */
  amount: number;
  mode: MdrMode;
  /** MDR as a percentage of transaction value. */
  ratePct: number;
  /** Flat per-transaction fee in rupees, charged on top of the percentage. */
  fixedFee: number;
  /** GST charged on the MDR itself. 18 in India. */
  gstPct: number;
};

export type MdrResult = {
  /** What the customer is charged. */
  customerPays: number;
  /** MDR before GST — percentage slice plus any flat fee. */
  mdrFee: number;
  gstOnMdr: number;
  /** MDR + GST on it: everything the acquirer keeps. */
  totalDeduction: number;
  /** What actually settles into the merchant's account. */
  youReceive: number;
  /** Total deduction as a percentage of what the customer paid. */
  effectivePct: number;
  /**
   * False when an `exclusive` target can never be reached because the MDR plus
   * its GST eats 100% or more of every rupee charged.
   */
  feasible: boolean;
};

/** Round to paise, avoiding the float dust that makes totals disagree by ₹0.01. */
function toPaise(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Round up to the next paise. */
function ceilPaise(value: number): number {
  return Math.ceil((value - Number.EPSILON) * 100) / 100;
}

/** Every figure that follows once the charge is fixed. */
function settle(customerPays: number, rate: number, gst: number, fixed: number) {
  const mdrFee = toPaise(customerPays * rate + fixed);
  const gstOnMdr = toPaise(mdrFee * gst);
  const totalDeduction = toPaise(mdrFee + gstOnMdr);
  const youReceive = toPaise(customerPays - totalDeduction);
  return { mdrFee, gstOnMdr, totalDeduction, youReceive };
}

export function calculateMdr({ amount, mode, ratePct, fixedFee, gstPct }: MdrInput): MdrResult {
  const rate = Math.max(0, ratePct) / 100;
  const gst = Math.max(0, gstPct) / 100;
  const fixed = Math.max(0, fixedFee);
  const typed = Math.max(0, amount);

  const empty: MdrResult = {
    customerPays: 0,
    mdrFee: 0,
    gstOnMdr: 0,
    totalDeduction: 0,
    youReceive: 0,
    effectivePct: 0,
    feasible: true,
  };

  if (typed <= 0) return empty;

  let customerPays: number;
  let settled: ReturnType<typeof settle>;

  if (mode === "inclusive") {
    // The charge is exactly what was typed; everything else follows from it.
    customerPays = toPaise(typed);
    settled = settle(customerPays, rate, gst, fixed);
  } else {
    // Solve gross - (gross*rate + fixed)*(1 + gst) = typed for gross.
    const denominator = 1 - rate * (1 + gst);
    if (denominator <= 0) return { ...empty, feasible: false };

    // Round the charge UP to the next paise: the point of this mode is that the
    // target lands in full, so the merchant must never finish a paise short.
    customerPays = ceilPaise((typed + fixed * (1 + gst)) / denominator);
    settled = settle(customerPays, rate, gst, fixed);

    // Rounding the fee to paise can still shave the net under the target by a
    // paise. Nudge the charge up until it clears. Two passes is the worst case.
    for (let guard = 0; guard < 4 && settled.youReceive < typed; guard += 1) {
      customerPays = toPaise(customerPays + 0.01);
      settled = settle(customerPays, rate, gst, fixed);
    }
  }

  const effectivePct = customerPays > 0 ? (settled.totalDeduction / customerPays) * 100 : 0;

  return {
    customerPays,
    ...settled,
    effectivePct,
    feasible: true,
  };
}

// ---------------------------------------------------------------------------
// Rate presets
// ---------------------------------------------------------------------------

export type MdrPreset = {
  id: string;
  label: string;
  /** Null means "the user supplies the rate" — nothing is pre-filled. */
  ratePct: number | null;
  note?: string;
};

/**
 * Typical Indian acquiring rates, as a starting point rather than a quote —
 * every merchant's actual rate comes from their own acquirer agreement, which
 * is why each one stays editable after it is picked.
 */
export const MDR_PRESETS: MdrPreset[] = [
  { id: "upi", label: "UPI — bank account", ratePct: 0, note: "Zero MDR for merchants by regulation." },
  { id: "rupay-debit", label: "RuPay debit card", ratePct: 0, note: "Zero MDR for merchants by regulation." },
  {
    id: "upi-ppi",
    label: "UPI via wallet / PPI",
    ratePct: 1.1,
    note: "Interchange applies only to the part of a transaction above ₹2,000.",
  },
  {
    id: "upi-credit",
    label: "Credit card on UPI",
    ratePct: 1.1,
    note: "Interchange applies only to the part of a transaction above ₹2,000.",
  },
  { id: "debit", label: "Debit card — non-RuPay", ratePct: 0.9 },
  { id: "credit", label: "Credit card", ratePct: 2 },
  { id: "netbanking", label: "Net banking", ratePct: 1.8 },
  { id: "amex", label: "Amex / international card", ratePct: 3.5 },
  { id: "custom", label: "Custom rate", ratePct: null },
];

// ---------------------------------------------------------------------------
// Zero-MDR split
// ---------------------------------------------------------------------------

/**
 * The per-transaction value above which UPI interchange starts to apply on
 * wallet/PPI and credit-on-UPI rails. At or below it the merchant pays nothing.
 */
export const ZERO_MDR_THRESHOLD = 2000;

/**
 * Default ceiling for a single QR. Sits one rupee under the threshold so a
 * transaction never lands exactly on the boundary.
 */
export const DEFAULT_QR_CAP = 1999;

/** Rendering thousands of QR codes helps nobody, so the split stops here. */
export const MAX_QR_CHUNKS = 60;

export type QrSplit = {
  /** Each QR's amount, in rupees. Sums to `total` unless `capped` is true. */
  chunks: number[];
  /** True when the split needed more than MAX_QR_CHUNKS codes and was cut short. */
  capped: boolean;
  /** Total actually covered by `chunks`. */
  covered: number;
  /** Anything left over once the split was cut short. Zero otherwise. */
  shortfall: number;
};

/**
 * Break `total` into the fewest QR codes that each stay at or below `capPerQr`:
 * as many full-cap codes as fit, and the remainder on the last one.
 *
 * Works in paise throughout so the chunks add back up to the total exactly.
 */
export function splitForZeroMdr(total: number, capPerQr: number): QrSplit {
  const empty: QrSplit = { chunks: [], capped: false, covered: 0, shortfall: 0 };

  const totalPaise = Math.round(Math.max(0, total) * 100);
  const capPaise = Math.round(Math.max(0, capPerQr) * 100);
  if (totalPaise <= 0 || capPaise <= 0) return empty;

  const fullChunks = Math.floor(totalPaise / capPaise);
  const remainder = totalPaise - fullChunks * capPaise;

  const needed = fullChunks + (remainder > 0 ? 1 : 0);
  const capped = needed > MAX_QR_CHUNKS;

  const paiseChunks: number[] = [];
  if (capped) {
    for (let i = 0; i < MAX_QR_CHUNKS; i += 1) paiseChunks.push(capPaise);
  } else {
    for (let i = 0; i < fullChunks; i += 1) paiseChunks.push(capPaise);
    if (remainder > 0) paiseChunks.push(remainder);
  }

  const coveredPaise = paiseChunks.reduce((sum, paise) => sum + paise, 0);

  return {
    chunks: paiseChunks.map((paise) => paise / 100),
    capped,
    covered: coveredPaise / 100,
    shortfall: (totalPaise - coveredPaise) / 100,
  };
}
