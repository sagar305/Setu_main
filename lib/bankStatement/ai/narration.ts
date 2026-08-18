// Turning a bank narration into a sentence a language model can understand.
// ---------------------------------------------------------------------------
// `UPI/9033/BigBasket/BBNow` means nothing to a sentence-embedding model: it is
// mostly rails — a channel code, a routing number, a merchant-supplied tag. The
// model needs prose. So before anything is embedded we take the narration apart
// into the pieces an Indian statement actually encodes:
//
//   channel (UPI / IMPS / NEFT / RTGS / ACH / NACH / POS / ATM / ECS / cheque),
//   counterparty (a merchant, or a person for a P2P transfer),
//   the free-text note the payer or merchant attached,
//
// and write them back out as a sentence. `UPI/9033/BigBasket/BBNow` becomes
// "Money paid to BigBasket … an online supermarket …, sent by UPI …, note: BBNow".
//
// This module is pure: no model, no DOM, no network. It runs identically on the
// main thread, inside the worker, and under Node in the tests.

import { normaliseText, sanitiseCell, titleCase } from "@/lib/bankStatement/utils/text";

export type PaymentChannel =
  | "UPI"
  | "IMPS"
  | "NEFT"
  | "RTGS"
  | "ACH"
  | "NACH"
  | "ECS"
  | "CARD"
  | "ATM"
  | "CHEQUE"
  | "CASH"
  | "NETBANKING";

export type NarrationParts = {
  channel?: PaymentChannel;
  /** A business the money went to or came from. */
  merchant?: string;
  /** An individual, when the narration looks like a person-to-person transfer. */
  person?: string;
  /** The free-text tag a payer or merchant attached ("Trip split", "Monthly"). */
  note?: string;
  /** Context words we can state about the counterparty with confidence. */
  context?: string;
  direction: "DEBIT" | "CREDIT";
};

// --- channel detection -----------------------------------------------------

/**
 * Channel markers, longest/most specific first so "NACH" is not read as "ACH"
 * and a POS card swipe is not read as a plain purchase.
 */
const CHANNEL_MARKERS: { channel: PaymentChannel; patterns: RegExp[] }[] = [
  { channel: "UPI", patterns: [/\bUPI\b/, /\bBHIM\b/, /@(?:OKAXIS|OKHDFC|OKICICI|OKSBI|YBL|PAYTM|IBL|AXL|APL)\b/] },
  { channel: "IMPS", patterns: [/\bIMPS\b/, /\bMMT\b/] },
  { channel: "NEFT", patterns: [/\bNEFT\b/] },
  { channel: "RTGS", patterns: [/\bRTGS\b/] },
  { channel: "NACH", patterns: [/\bNACH\b/, /\bE-?MANDATE\b/, /\bMANDATE\b/] },
  { channel: "ACH", patterns: [/\bACH\b/] },
  { channel: "ECS", patterns: [/\bECS\b/, /\bSI\s?DEBIT\b/, /\bSTANDING INSTRUCTION\b/] },
  { channel: "ATM", patterns: [/\bATM\b/, /\bNWD\b/, /\bCDM\b/, /\bAWB\b/] },
  { channel: "CARD", patterns: [/\bPOS\b/, /\bECOM\b/, /\bE-?COM\b/, /\bVISA\b/, /\bRUPAY\b/, /\bMASTERCARD\b/, /\bDEBIT CARD\b/, /\bCREDIT CARD\b/] },
  { channel: "CHEQUE", patterns: [/\bCHQ\b/, /\bCHEQUE\b/, /\bCLG\b/, /\bCTS\b/] },
  { channel: "CASH", patterns: [/\bCASH\b/, /\bBY CASH\b/, /\bTO CASH\b/] },
  { channel: "NETBANKING", patterns: [/\bINB\b/, /\bIB\b(?!\w)/, /\bNETBANKING\b/, /\bNET BANKING\b/, /\bMB\b(?!\w)/] },
];

/** How each channel reads in a sentence. */
const CHANNEL_PHRASE: Record<PaymentChannel, string> = {
  UPI: "a UPI digital wallet payment",
  IMPS: "an IMPS instant bank transfer",
  NEFT: "a NEFT bank transfer",
  RTGS: "an RTGS high value bank transfer",
  ACH: "an ACH auto-debit collection",
  NACH: "a NACH auto-debit mandate, usually a recurring instalment or subscription",
  ECS: "an ECS standing instruction auto-debit",
  CARD: "a debit or credit card payment at a merchant",
  ATM: "an ATM cash machine transaction",
  CHEQUE: "a cheque clearing",
  CASH: "a cash counter transaction at the bank",
  NETBANKING: "an internet banking transfer",
};

export function detectChannel(narration: string): PaymentChannel | undefined {
  const text = normaliseText(narration);
  for (const marker of CHANNEL_MARKERS) {
    if (marker.patterns.some((pattern) => pattern.test(text))) return marker.channel;
  }
  return undefined;
}

// --- transfer sub-type -----------------------------------------------------

/**
 * IMPS/NEFT narrations carry a two-letter purpose code. P2P is person to
 * person; P2A / P2M is an account or a merchant. It is the only reliable signal
 * in the string that a counterparty is a human being rather than a business.
 */
function transferKind(text: string): "PERSON" | "ACCOUNT" | undefined {
  if (/\bP2P\b/.test(text)) return "PERSON";
  if (/\bP2A\b/.test(text) || /\bP2M\b/.test(text)) return "ACCOUNT";
  return undefined;
}

// --- counterparty and note -------------------------------------------------

/** Segments that are rails, not names. */
const RAIL_TOKENS = new Set([
  "UPI", "IMPS", "NEFT", "RTGS", "ACH", "NACH", "ECS", "POS", "ATM", "CDM", "NWD",
  "CHQ", "CLG", "CTS", "MMT", "INB", "IB", "MB", "INF", "BIL", "TPT", "EMI",
  "DR", "CR", "P2P", "P2A", "P2M", "REF", "REFNO", "TXN", "UTR", "RRN", "QR",
  "PAYMENT", "PAYTM QR", "COLLECT", "PAY", "TO", "BY", "FROM", "TRANSFER",
  "DEBIT", "CREDIT", "CARD", "VISA", "RUPAY", "MASTERCARD", "ECOM", "E-COM",
  "SI", "ACH DR", "ACH CR", "NA", "OTHERS", "PAYMENT FROM PHONE",
]);

function splitSegments(narration: string): string[] {
  return sanitiseCell(narration)
    .split(/[/|\\:;*]|\s-\s|\s{2,}/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

/** True when a segment is a reference number, an IFSC, a masked card, a date. */
function isRail(segment: string): boolean {
  const upper = segment.toUpperCase();
  if (upper.length < 2) return true;
  if (RAIL_TOKENS.has(upper)) return true;
  if (/^\d+$/.test(upper)) return true;
  if (/^[A-Z]{4}0[A-Z0-9]{6}$/.test(upper)) return true; // IFSC
  if (/^X+\d+$/.test(upper)) return true; // masked card
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(upper)) return true; // a date
  if (upper.includes("@")) return true; // UPI handle — the payee name is elsewhere
  const digits = (segment.match(/\d/g) ?? []).length;
  return digits / segment.length >= 0.5;
}

const LETTERS = /[A-Za-z]/g;

function letterCount(value: string): number {
  return (value.match(LETTERS) ?? []).length;
}

/**
 * A person's name, as an Indian statement writes it: two or three words, all
 * letters, none of them a corporate suffix. Deliberately conservative — calling
 * a merchant a person costs more than leaving a person unnamed.
 */
const COMPANY_MARKERS = /\b(PVT|PRIVATE|LTD|LIMITED|LLP|INC|CORP|CORPORATION|COMPANY|ENTERPRISE|ENTERPRISES|TRADERS|INDUSTRIES|SERVICES|SOLUTIONS|TECHNOLOGIES|TECH|STORE|STORES|MART|SHOP|RETAIL|FOODS|MOTORS|FINANCE|FIN|BANK|INSURANCE|HOSPITAL|CLINIC|PHARMACY|SUPERMARKET)\b/;

function looksLikePerson(segment: string): boolean {
  const upper = segment.toUpperCase();
  if (COMPANY_MARKERS.test(upper)) return false;
  if (/\d/.test(segment)) return false;
  const words = segment.trim().split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  return words.every((word) => /^[A-Za-z.]{1,20}$/.test(word));
}

/**
 * Pull the counterparty and the payer's note out of a narration.
 *
 * Statements put the counterparty in the longest word-ish segment and the note,
 * when there is one, in the segment after it — `UPI/9033/BigBasket/BBNow`,
 * `IMPS/P2P/Ankit Sharma/Trip split`. So we take the richest segment as the
 * name and treat a shorter trailing segment as the note.
 */
export function splitCounterparty(narration: string): {
  name?: string;
  note?: string;
  isPerson: boolean;
} {
  const segments = splitSegments(narration);
  const kind = transferKind(normaliseText(narration));

  const candidates = segments
    .map((segment, index) => ({ segment, index }))
    .filter(({ segment }) => !isRail(segment) && letterCount(segment) >= 3);

  if (candidates.length === 0) return { isPerson: false };

  // The name is the segment carrying the most letters; ties go to the earlier
  // one, because banks put the counterparty before the payer's own note.
  const best = candidates.reduce((a, b) => (letterCount(b.segment) > letterCount(a.segment) ? b : a));
  const name = best.segment.replace(/\s+/g, " ").trim();

  const after = candidates.find(({ index }) => index > best.index);
  const note = after && letterCount(after.segment) >= 3 ? after.segment.replace(/\s+/g, " ").trim() : undefined;

  const isPerson = kind === "PERSON" || (kind !== "ACCOUNT" && looksLikePerson(name));

  return { name: titleCase(name.slice(0, 60)), note: note?.slice(0, 60), isPerson };
}

// --- merchant context ------------------------------------------------------

/**
 * What a handful of very common Indian merchants actually *are*.
 * ---------------------------------------------------------------------------
 * This is NOT the classifier, and nothing here names a category. It exists
 * because "BBNow" and "Bajaj Fin" are opaque strings: the model cannot know
 * what BigBasket sells any more than it knows what BBNow is. Adding "an online
 * supermarket and grocery delivery service" to the sentence gives the embedding
 * something to be similar *to* — the model still decides which category wins,
 * and a merchant missing from this list is embedded on its name alone.
 *
 * Keys are matched as substrings of the normalised narration.
 */
const MERCHANT_CONTEXT: { match: string[]; canonical: string; context: string }[] = [
  // Groceries and food
  { match: ["BIGBASKET", "BBNOW", "BB DAILY", "BBDAILY"], canonical: "BigBasket", context: "an online supermarket delivering groceries, fruit, vegetables and household essentials" },
  { match: ["BLINKIT", "GROFERS"], canonical: "Blinkit", context: "an instant grocery delivery service for daily household essentials" },
  { match: ["ZEPTO"], canonical: "Zepto", context: "an instant grocery and daily essentials delivery service" },
  { match: ["DMART", "D MART", "AVENUE SUPERMART"], canonical: "DMart", context: "a supermarket chain selling groceries and household goods" },
  { match: ["RELIANCE FRESH", "RELIANCE SMART", "MORE RETAIL", "SPENCER", "STAR BAZAAR"], canonical: "supermarket", context: "a supermarket selling groceries and household provisions" },
  { match: ["SWIGGY INSTAMART", "INSTAMART"], canonical: "Swiggy Instamart", context: "an instant grocery delivery service" },
  { match: ["SWIGGY", "ZOMATO", "DOMINOS", "MCDONALD", "KFC", "PIZZA HUT", "BURGER KING", "BARBEQUE", "EATFIT", "FAASOS", "BEHROUZ"], canonical: "food delivery", context: "a restaurant or food delivery order, a meal bought out" },
  { match: ["STARBUCKS", "CAFE COFFEE", "CCD", "CHAAYOS", "THIRD WAVE"], canonical: "cafe", context: "a coffee shop or cafe" },

  // Subscriptions and entertainment
  { match: ["NETFLIX"], canonical: "Netflix", context: "a monthly video streaming entertainment subscription" },
  { match: ["SPOTIFY", "GAANA", "WYNK", "JIOSAAVN"], canonical: "music streaming", context: "a monthly music streaming entertainment subscription" },
  { match: ["HOTSTAR", "DISNEY", "PRIME VIDEO", "SONYLIV", "ZEE5", "JIOCINEMA", "JIO HOTSTAR"], canonical: "video streaming", context: "a video streaming entertainment subscription" },
  { match: ["BOOKMYSHOW", "PVR", "INOX", "CINEPOLIS"], canonical: "cinema", context: "cinema tickets, a movie or a live event" },
  { match: ["YOUTUBE PREMIUM", "GOOGLE PLAY", "APPLE.COM", "ITUNES", "APP STORE"], canonical: "app store", context: "an app store or digital media subscription" },

  // Transport and travel
  { match: ["UBER", "OLA ", "OLACABS", "RAPIDO", "BLUSMART", "NAMMA YATRI"], canonical: "ride hailing", context: "a taxi, cab or bike ride within the city" },
  { match: ["IRCTC", "INDIAN RAILWAY"], canonical: "IRCTC", context: "railway train ticket booking for travel" },
  { match: ["MAKEMYTRIP", "GOIBIBO", "CLEARTRIP", "YATRA", "EASEMYTRIP", "REDBUS", "IXIGO"], canonical: "travel booking", context: "travel booking for flights, hotels or buses" },
  { match: ["INDIGO", "AIR INDIA", "SPICEJET", "AKASA", "VISTARA"], canonical: "airline", context: "an airline flight ticket for travel" },
  { match: ["FASTAG", "IOCL", "HPCL", "BPCL", "INDIAN OIL", "BHARAT PETROLEUM", "HP PETROL", "SHELL"], canonical: "fuel and tolls", context: "vehicle fuel, petrol, diesel or a highway toll" },

  // Utilities and telecom
  { match: ["AIRTEL", "JIO", "VODAFONE", "VI POSTPAID", "BSNL", "IDEA POSTPAID"], canonical: "telecom", context: "a mobile phone, broadband or DTH telecom bill" },
  { match: ["ACT FIBERNET", "HATHWAY", "EXCITEL", "JIOFIBER", "TIKONA"], canonical: "broadband", context: "a home or office internet broadband bill" },
  { match: ["BSES", "MSEB", "TNEB", "TORRENT POWER", "ADANI ELECTRICITY", "TATA POWER", "MSEDCL", "APSPDCL", "CESC"], canonical: "electricity board", context: "an electricity power utility bill" },
  { match: ["INDANE", "HP GAS", "BHARATGAS", "MAHANAGAR GAS", "GUJARAT GAS"], canonical: "gas utility", context: "a cooking gas or piped gas utility bill" },

  // Shopping
  { match: ["AMAZON", "FLIPKART", "MYNTRA", "AJIO", "MEESHO", "NYKAA", "TATA CLIQ", "SNAPDEAL"], canonical: "online shopping", context: "an online shopping marketplace order for goods, clothing or electronics" },
  { match: ["CROMA", "RELIANCE DIGITAL", "VIJAY SALES"], canonical: "electronics retailer", context: "an electronics and appliances retailer" },
  { match: ["DECATHLON", "LIFESTYLE", "SHOPPERS STOP", "PANTALOONS", "WESTSIDE", "ZARA", "H AND M", "UNIQLO"], canonical: "retail store", context: "a clothing and lifestyle retail store" },

  // Services, health, personal care
  { match: ["URBANCOMPANY", "URBAN COMPANY", "URBANCLAP"], canonical: "Urban Company", context: "an at-home services booking for a salon, spa, cleaning or repair visit" },
  { match: ["APOLLO", "PHARMEASY", "1MG", "NETMEDS", "MEDPLUS", "WELLNESS FOREVER"], canonical: "pharmacy", context: "a pharmacy, chemist or medicine purchase" },
  { match: ["PRACTO", "CULT.FIT", "CULTFIT", "CUREFIT", "GOLD GYM", "GYM"], canonical: "health and fitness", context: "a doctor, clinic, gym or fitness membership" },

  // Finance
  { match: ["BAJAJ FIN", "BAJAJ FINSERV", "BAJAJ FINANCE"], canonical: "Bajaj Finance", context: "a non-banking finance company collecting a loan instalment or EMI repayment" },
  { match: ["HDB FINANCIAL", "TATA CAPITAL", "SHRIRAM FIN", "MUTHOOT", "MANNAPURAM", "CHOLAMANDALAM"], canonical: "finance company", context: "a lender collecting a loan instalment or EMI repayment" },
  { match: ["ZERODHA", "GROWW", "UPSTOX", "ANGEL ONE", "ICICI DIRECT", "KUVERA", "COIN DCX", "SMALLCASE"], canonical: "investment platform", context: "a stock broking or mutual fund investment platform" },
  { match: ["LIC ", "HDFC ERGO", "ICICI LOMBARD", "STAR HEALTH", "POLICYBAZAAR", "MAX LIFE", "TATA AIG"], canonical: "insurance", context: "an insurance policy premium" },
  { match: ["RAZORPAY", "PAYU", "CCAVENUE", "INSTAMOJO", "CASHFREE", "BILLDESK", "STRIPE"], canonical: "payment gateway", context: "a payment gateway settling collections from customers" },

  // Business software
  { match: ["GOOGLE CLOUD", "GOOGLE WORKSPACE", "GSUITE", "AWS", "AMAZON WEB", "MICROSOFT", "ADOBE", "ZOHO", "TALLY", "GITHUB", "ATLASSIAN", "SLACK", "ZOOM", "NOTION", "FIGMA"], canonical: "software vendor", context: "a business software or cloud hosting subscription" },
  { match: ["GOOGLE ADS", "ADWORDS", "FACEBOOK ADS", "META PLATFORMS", "LINKEDIN ADS"], canonical: "advertising platform", context: "online advertising and marketing spend" },
];

/** Known context for a narration, if we happen to recognise the merchant. */
export function merchantContext(narration: string): { canonical: string; context: string } | undefined {
  const text = normaliseText(narration);
  for (const entry of MERCHANT_CONTEXT) {
    if (entry.match.some((token) => text.includes(token))) {
      return { canonical: entry.canonical, context: entry.context };
    }
  }
  return undefined;
}

// --- purpose hints ---------------------------------------------------------

/**
 * Words the narration itself supplies about *why* money moved. These are the
 * payer's own words ("SAL NOV25", "EMI", "RENT"), so they belong in the
 * sentence — again as context for the model, not as a category decision.
 */
const PURPOSE_HINTS: { pattern: RegExp; phrase: string }[] = [
  { pattern: /\bSAL(?:ARY)?\b|\bPAYROLL\b|\bWAGES\b|\bSTIPEND\b/, phrase: "salary or payroll" },
  { pattern: /\bEMI\b|\bINSTAL?MENT\b|\bLOAN REPAY/, phrase: "a loan instalment or EMI repayment" },
  { pattern: /\bRENT\b|\bLEASE\b/, phrase: "rent for premises" },
  { pattern: /\bINV(?:OICE)?[-\s.]?\d|\bBILL NO\b|\bINV NO\b/, phrase: "settlement of an invoice or bill" },
  { pattern: /\bREFUND\b|\bREVERSAL\b|\bRETURN\b/, phrase: "a refund or reversal" },
  { pattern: /\bGST\b|\bCGST\b|\bSGST\b|\bIGST\b|\bTDS\b|\bTAX\b|\bCHALLAN\b/, phrase: "a statutory tax payment" },
  { pattern: /\bCHARGE[S]?\b|\bFEE[S]?\b|\bCOMMISSION\b/, phrase: "a fee or service charge" },
  { pattern: /\bINT(?:EREST)?\.?(?:PD|COLL)?\b/, phrase: "interest" },
  { pattern: /\bSIP\b|\bMUTUAL FUND\b|\bMF\b/, phrase: "a recurring investment" },
  { pattern: /\bPREMIUM\b|\bPOLICY\b/, phrase: "an insurance premium" },
  { pattern: /\bSPLIT\b|\bSHARE\b|\bSETTLE\b/, phrase: "splitting a shared expense between friends" },
  { pattern: /\bTRIP\b|\bTOUR\b|\bHOTEL\b|\bFLIGHT\b|\bTICKET\b/, phrase: "travel" },
  { pattern: /\bSUBSCRIPTION\b|\bMONTHLY\b|\bRENEWAL\b|\bAUTOPAY\b/, phrase: "a recurring subscription" },
  { pattern: /\bSALON\b|\bSPA\b|\bGROOMING\b/, phrase: "a salon or personal grooming service" },
  { pattern: /\bREPAIR\b|\bSERVICE\b|\bMAINTENANCE\b/, phrase: "repair or maintenance work" },
];

function purposeHints(narration: string): string[] {
  const text = normaliseText(narration);
  const found: string[] = [];
  for (const hint of PURPOSE_HINTS) {
    if (hint.pattern.test(text)) found.push(hint.phrase);
    if (found.length === 3) break;
  }
  return found;
}

// --- the public surface ----------------------------------------------------

export function parseNarration(
  narration: string,
  direction: "DEBIT" | "CREDIT"
): NarrationParts {
  const channel = detectChannel(narration);
  const { name, note, isPerson } = splitCounterparty(narration);
  const known = merchantContext(narration);

  return {
    channel,
    merchant: isPerson ? undefined : (known?.canonical ?? name),
    person: isPerson ? name : undefined,
    note,
    context: known?.context,
    direction,
  };
}

/**
 * The sentence that actually gets embedded.
 *
 * Phrased to sit in the same register as a category description (see
 * ./categoryProfiles.ts) — both sides of the cosine comparison read like a
 * short description of a kind of spending, which is what makes the similarity
 * mean something.
 */
export function narrationToSentence(
  narration: string,
  direction: "DEBIT" | "CREDIT",
  parts: NarrationParts = parseNarration(narration, direction)
): string {
  const pieces: string[] = [];

  const flow = direction === "DEBIT" ? "Money paid out" : "Money received";
  if (parts.person) {
    pieces.push(
      direction === "DEBIT"
        ? `${flow} to an individual person named ${parts.person}`
        : `${flow} from an individual person named ${parts.person}`
    );
  } else if (parts.merchant) {
    pieces.push(
      direction === "DEBIT"
        ? `${flow} to ${parts.merchant}`
        : `${flow} from ${parts.merchant}`
    );
  } else {
    pieces.push(flow);
  }

  if (parts.context) pieces.push(parts.context);
  if (parts.channel) pieces.push(`paid by ${CHANNEL_PHRASE[parts.channel]}`);

  const hints = purposeHints(narration);
  if (hints.length > 0) pieces.push(`this looks like ${hints.join(" and ")}`);

  if (parts.note && parts.note !== parts.merchant && parts.note !== parts.person) {
    pieces.push(`the payment note says "${parts.note}"`);
  }

  return `${pieces.join(", ")}.`;
}

/**
 * A stable key for "the same merchant again", used to cache embeddings and to
 * look up what the CA taught us last time. Two narrations from the same shop
 * with different reference numbers must produce the same key, so the digits and
 * the rails are stripped out.
 */
export function merchantKey(narration: string, direction: "DEBIT" | "CREDIT"): string {
  const parts = parseNarration(narration, direction);
  const known = merchantContext(narration);
  const anchor = known?.canonical ?? parts.merchant ?? parts.person;

  if (anchor) return `${direction}:${normaliseText(anchor)}`;

  // Nothing name-like in there. Fall back to the narration with every number
  // removed, so at least repeated identical formats collapse together.
  const stripped = normaliseText(narration).replace(/\d+/g, "").replace(/[^A-Z ]+/g, " ").replace(/\s+/g, " ").trim();
  return `${direction}:${stripped.slice(0, 60)}`;
}
