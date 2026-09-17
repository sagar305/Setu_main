// MDR (Merchant Discount Rate) maths, shared by the MDR calculator and the
// zero-MDR QR splitter.
//
// Two things happen to a card/UPI collection before the money lands:
//   1. the acquirer keeps a percentage of the transaction (plus, sometimes, a
//      flat per-transaction fee) — that is the MDR;
//   2. GST is charged on the MDR itself (18% in India), not on the sale.
//
// Some rails only charge above a per-transaction threshold, and some cap the
// fee, so both are modelled here rather than left to the caller. UPI merchant
// payments from 15 October 2026 are the case that needs both: 0.4% above
// ₹2,000, on the full amount, capped at ₹300.
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
  /**
   * MDR applies only to transactions *above* this value; at or below it the
   * rail is free. Omit or pass 0 for a rail that charges from the first rupee.
   */
  thresholdAmount?: number;
  /** Ceiling on the MDR before GST. Omit for an uncapped rail. */
  feeCap?: number;
};

export type MdrResult = {
  /** What the customer is charged. */
  customerPays: number;
  /** MDR before GST — percentage slice plus any flat fee, after any cap. */
  mdrFee: number;
  gstOnMdr: number;
  /** MDR + GST on it: everything the acquirer keeps. */
  totalDeduction: number;
  /** What actually settles into the merchant's account. */
  youReceive: number;
  /** Total deduction as a percentage of what the customer paid. */
  effectivePct: number;
  /** True when the charge sits at or under the rail's free threshold. */
  belowThreshold: boolean;
  /** True when the fee would have exceeded the rail's cap and was pinned to it. */
  capApplied: boolean;
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

type Rail = { rate: number; gst: number; fixed: number; threshold: number; cap?: number };

/** Every figure that follows once the charge is fixed. */
function settle(customerPays: number, rail: Rail) {
  const { rate, gst, fixed, threshold, cap } = rail;

  // Below the threshold the rail is free outright — the flat fee goes too.
  const uncapped = customerPays <= threshold ? 0 : customerPays * rate + fixed;
  const capApplied = cap !== undefined && uncapped > cap;

  const mdrFee = toPaise(capApplied ? cap! : uncapped);
  const gstOnMdr = toPaise(mdrFee * gst);
  const totalDeduction = toPaise(mdrFee + gstOnMdr);
  const youReceive = toPaise(customerPays - totalDeduction);

  return {
    mdrFee,
    gstOnMdr,
    totalDeduction,
    youReceive,
    belowThreshold: customerPays <= threshold,
    capApplied,
  };
}

/**
 * Nudge a candidate charge up by a paise at a time until the net clears the
 * target, since rounding the fee can otherwise leave the merchant a paise down.
 * Returns null if it cannot get there in a few passes — that candidate's branch
 * simply does not hold for this target.
 */
function reach(target: number, gross: number, rail: Rail) {
  let charge = ceilPaise(gross);
  let settled = settle(charge, rail);
  for (let guard = 0; guard < 4 && settled.youReceive < target; guard += 1) {
    charge = toPaise(charge + 0.01);
    settled = settle(charge, rail);
  }
  return settled.youReceive < target ? null : { charge, settled };
}

export function calculateMdr({
  amount,
  mode,
  ratePct,
  fixedFee,
  gstPct,
  thresholdAmount = 0,
  feeCap,
}: MdrInput): MdrResult {
  const rail: Rail = {
    rate: Math.max(0, ratePct) / 100,
    gst: Math.max(0, gstPct) / 100,
    fixed: Math.max(0, fixedFee),
    threshold: Math.max(0, thresholdAmount),
    cap: feeCap === undefined ? undefined : Math.max(0, feeCap),
  };
  const typed = Math.max(0, amount);

  const empty: MdrResult = {
    customerPays: 0,
    mdrFee: 0,
    gstOnMdr: 0,
    totalDeduction: 0,
    youReceive: 0,
    effectivePct: 0,
    belowThreshold: true,
    capApplied: false,
    feasible: true,
  };

  if (typed <= 0) return empty;

  let customerPays: number;
  let settled: ReturnType<typeof settle>;

  if (mode === "inclusive") {
    // The charge is exactly what was typed; everything else follows from it.
    customerPays = toPaise(typed);
    settled = settle(customerPays, rail);
  } else {
    // A threshold and a cap make the gross-up piecewise, so rather than reason
    // about which branch applies, solve all three and take the cheapest charge
    // that actually delivers the target.
    //   A — the charge lands under the threshold, so nothing is deducted;
    //   B — the percentage fee applies in full;
    //   C — the fee is pinned at the cap, so the deduction is a constant.
    const candidates: number[] = [typed];

    const denominator = 1 - rail.rate * (1 + rail.gst);
    if (denominator > 0) {
      candidates.push((typed + rail.fixed * (1 + rail.gst)) / denominator);
    }
    if (rail.cap !== undefined) {
      candidates.push(typed + rail.cap * (1 + rail.gst));
    }

    let best: { charge: number; settled: ReturnType<typeof settle> } | null = null;
    for (const candidate of candidates) {
      if (!Number.isFinite(candidate) || candidate <= 0) continue;
      const reached = reach(typed, candidate, rail);
      if (reached && (!best || reached.charge < best.charge)) best = reached;
    }

    if (!best) return { ...empty, feasible: false };
    customerPays = best.charge;
    settled = best.settled;
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
// UPI rail constants
// ---------------------------------------------------------------------------

/**
 * The per-transaction value above which UPI MDR applies. At or below it the
 * merchant pays nothing — the rule that both the preset and the QR splitter
 * below are built around.
 */
export const ZERO_MDR_THRESHOLD = 2000;

/** Ceiling on UPI MDR per transaction — reached at ₹75,000 (0.4% of it). */
export const UPI_MDR_FEE_CAP = 300;

// ---------------------------------------------------------------------------
// Rate presets
// ---------------------------------------------------------------------------

export type MdrPreset = {
  id: string;
  label: string;
  /** Null means "the user supplies the rate" — nothing is pre-filled. */
  ratePct: number | null;
  /** MDR applies only above this transaction value. */
  thresholdAmount?: number;
  /** Ceiling on the MDR before GST. */
  feeCap?: number;
  note?: string;
};

/**
 * Typical Indian acquiring rates, as a starting point rather than a quote —
 * every merchant's actual rate comes from their own acquirer agreement, which
 * is why each one stays editable after it is picked.
 */
export const MDR_PRESETS: MdrPreset[] = [
  {
    id: "upi",
    label: "UPI — merchant payment",
    ratePct: 0.4,
    thresholdAmount: ZERO_MDR_THRESHOLD,
    feeCap: UPI_MDR_FEE_CAP,
    note: "From 15 October 2026, UPI merchant payments above ₹2,000 carry 0.4% MDR on the full amount, capped at ₹300. At or below ₹2,000 there is no MDR, and merchants taking under ₹1 lakh a month by UPI QR stay exempt.",
  },
  {
    id: "upi-autopay",
    label: "UPI Autopay / recurring mandate",
    ratePct: 0,
    note: "NPCI has confirmed recurring UPI mandates carry no MDR, whatever the amount.",
  },
  {
    id: "rupay-debit",
    label: "RuPay debit card",
    ratePct: 0,
    note: "Zero MDR for merchants by regulation.",
  },
  {
    id: "upi-ppi",
    label: "UPI via wallet / PPI",
    ratePct: 1.1,
    thresholdAmount: 2000,
    note: "Interchange has applied to wallet payments above ₹2,000 since 2023, on the full amount rather than just the excess.",
  },
  {
    id: "upi-credit",
    label: "Credit card on UPI",
    ratePct: 1.1,
    thresholdAmount: 2000,
    note: "Interchange applies only above ₹2,000 per transaction — and then on the full amount, not just the excess.",
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
