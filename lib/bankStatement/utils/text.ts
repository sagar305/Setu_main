// Narration text helpers: normalisation, party extraction, similarity.
// Statement text is untrusted input — it is only ever rendered as text, never
// as HTML (decision 31).

/** Collapse whitespace and upper-case for matching. Never for display. */
export function normaliseText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toUpperCase();
}

/**
 * Drop the control characters a PDF or CSV can smuggle into a narration, and
 * collapse whitespace. Markup safety comes from React escaping everything it
 * renders — this keeps stored text clean, it is not an HTML escaper.
 */
export function sanitiseCell(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
}

const PAYMENT_PREFIXES = [
  "UPI", "IMPS", "NEFT", "RTGS", "ACH", "ATM", "POS", "ECS", "MMT", "INF",
  "BIL", "TPT", "CHQ", "CLG", "EMI", "NACH", "IB", "MB", "BY TRANSFER",
  "TO TRANSFER", "BY CASH", "TO CASH",
];

/**
 * Pull a likely counterparty out of a narration. Bank narrations are mostly
 * delimiter-separated (`UPI/DR/402318/SWIGGY/UTIB/...`), so we drop the rails
 * (channel codes, numeric refs, IFSC-looking tokens) and keep the longest
 * word-ish segment. Returns undefined rather than a guess when nothing looks
 * like a name.
 */
export function extractParty(narration: string): string | undefined {
  const text = sanitiseCell(narration);
  if (!text) return undefined;

  const segments = text
    .split(/[/|\\]|\s-\s|\s{2,}/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const candidates = segments.filter((segment) => {
    const upper = segment.toUpperCase();
    if (upper.length < 3) return false;
    if (/^\d+$/.test(segment)) return false; // pure reference number
    if (/^[A-Z]{4}0[A-Z0-9]{6}$/.test(upper)) return false; // IFSC
    if (/^\d{4,}[A-Z]*$/.test(upper)) return false;
    // A UPI handle (swiggy@axis) repeats the payee with routing noise attached —
    // the bare name is already in the narration and reads better.
    if (segment.includes("@")) return false;
    if (PAYMENT_PREFIXES.includes(upper)) return false;
    if (/^(DR|CR|REF|TXN|PAYMENT|PAYTM QR|QR)$/.test(upper)) return false;
    // Mostly-digits tokens are references, not names.
    const digits = (segment.match(/\d/g) ?? []).length;
    return digits / segment.length < 0.5;
  });

  if (candidates.length === 0) return undefined;

  const best = candidates.reduce((a, b) => (letterCount(b) > letterCount(a) ? b : a));
  const cleaned = best.replace(/\s+/g, " ").trim();
  if (letterCount(cleaned) < 3) return undefined;
  return titleCase(cleaned.slice(0, 60));
}

function letterCount(value: string): number {
  return (value.match(/[A-Za-z]/g) ?? []).length;
}

/**
 * Genuine acronyms that should stay upper-case in a party name. Deliberately a
 * short allowlist: "Pvt Ltd" is how Indian company names are written, so a
 * blanket "short words are acronyms" rule gets the common case wrong.
 */
const ACRONYMS = new Set([
  "LLP", "LLC", "PLC", "HUF", "NGO", "NBFC", "PSU",
  "GST", "TDS", "UPI", "ATM", "NEFT", "RTGS", "IMPS", "EMI", "SIP",
  "HDFC", "ICICI", "SBI", "IDFC", "IDBI", "PNB", "BOB", "RBL", "AU", "IT",
]);

/** Title-case a party name, keeping known acronyms upper-case. */
export function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((word) => {
      const upper = word.toUpperCase();
      if (ACRONYMS.has(upper)) return upper;
      const lower = word.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/** A GSTIN embedded in a narration, if there is one. */
export function extractGstin(narration: string): string | undefined {
  const match = narration
    .toUpperCase()
    .match(/\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}\b/);
  return match ? match[0] : undefined;
}

/** A reference/UTR number embedded in a narration, if there is one. */
export function extractReference(narration: string): string | undefined {
  const match = narration.toUpperCase().match(/\b(?:UTR|REF|RRN|TXN)[:\s/-]*([A-Z0-9]{6,22})\b/);
  if (match) return match[1];
  const bare = narration.match(/\b\d{9,22}\b/);
  return bare ? bare[0] : undefined;
}

/**
 * Token-overlap similarity (Jaccard) in 0–1. Used for fuzzy reconciliation and
 * duplicate detection — deliberately simple and explainable, because a CA has
 * to be able to trust why two rows were called similar.
 */
export function similarity(a: string, b: string): number {
  const tokensA = tokenSet(a);
  const tokensB = tokenSet(b);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let shared = 0;
  for (const token of tokensA) if (tokensB.has(token)) shared += 1;
  return shared / (tokensA.size + tokensB.size - shared);
}

function tokenSet(value: string): Set<string> {
  return new Set(
    normaliseText(value)
      .split(/[^A-Z0-9]+/)
      .filter((token) => token.length >= 3)
  );
}

/** Mask an account number for display and storage — last 4 digits only. */
export function maskAccountNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 4) return `••••${digits}`;
  return `••••${digits.slice(-4)}`;
}
