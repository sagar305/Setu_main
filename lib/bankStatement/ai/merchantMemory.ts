// Merchants we already know the answer for.
// ---------------------------------------------------------------------------
// Netflix is Entertainment. BigBasket is groceries. Running a neural network to
// discover that is a waste of a second and a watt, and it produces a *less*
// certain answer than simply knowing it.
//
// So this is a deterministic layer that sits above the model: a canonical
// merchant name in, a category id out. It reuses the merchant lexicon that
// already exists for enriching embeddings (narration.ts) rather than repeating
// its match tokens — that table knows "BBNOW" means BigBasket, and this one
// knows BigBasket is groceries. One list of merchants, two questions asked of
// it.
//
// Pure, and entirely client-side. Nothing here is fetched or reported.

import type { Category, TransactionType } from "@/lib/bankStatement/types";
import { merchantContext } from "@/lib/bankStatement/ai/narration";

export type MerchantMatch = {
  merchant: string;
  categoryId: string;
  /** Which side of the ledger this mapping was meant for. */
  direction: TransactionType;
};

type Mapping = {
  /** Category when the money went out. */
  debit?: string;
  /** Category when the money came in — usually different, sometimes absent. */
  credit?: string;
};

/**
 * Canonical merchant → category, keyed by the names merchantContext() produces.
 *
 * Direction is separated on purpose. A payment gateway paying a business is
 * Sales; the same gateway charging it a fee is Bank Charges. Collapsing the two
 * would misfile every settlement in the statement, which is exactly the kind of
 * error a CA would have to unpick by hand.
 */
const MERCHANT_CATEGORIES: Record<string, Mapping> = {
  // Food and groceries
  BigBasket: { debit: "food-and-groceries" },
  Blinkit: { debit: "food-and-groceries" },
  Zepto: { debit: "food-and-groceries" },
  DMart: { debit: "food-and-groceries" },
  supermarket: { debit: "food-and-groceries" },
  "Swiggy Instamart": { debit: "food-and-groceries" },
  "food delivery": { debit: "food-and-groceries" },
  cafe: { debit: "food-and-groceries" },

  // Entertainment
  Netflix: { debit: "entertainment" },
  "music streaming": { debit: "entertainment" },
  "video streaming": { debit: "entertainment" },
  cinema: { debit: "entertainment" },

  // Travel and transport
  "ride hailing": { debit: "travel" },
  IRCTC: { debit: "travel" },
  "travel booking": { debit: "travel" },
  airline: { debit: "travel" },
  "fuel and tolls": { debit: "travel" },

  // Utilities and communications
  telecom: { debit: "telephone" },
  broadband: { debit: "internet" },
  "electricity board": { debit: "electricity" },
  "gas utility": { debit: "other-expenses" },

  // Shopping
  "online shopping": { debit: "shopping" },
  "electronics retailer": { debit: "shopping" },
  "retail store": { debit: "shopping" },

  // Services and health
  "Urban Company": { debit: "personal-care-and-health" },
  pharmacy: { debit: "personal-care-and-health" },
  "health and fitness": { debit: "personal-care-and-health" },

  // Finance
  "Bajaj Finance": { debit: "loan" },
  "finance company": { debit: "loan" },
  "investment platform": { debit: "investment" },
  insurance: { debit: "insurance" },

  // A gateway settling collections is income; charging a fee is not.
  "payment gateway": { debit: "bank-charges", credit: "sales" },

  // Business
  "software vendor": { debit: "software" },
  "advertising platform": { debit: "advertising" },

  // The app store sells both subscriptions and business software; without
  // knowing which, Entertainment is the more common answer for a personal
  // account and the CA can correct it once.
  "app store": { debit: "entertainment" },
};

/**
 * What we already know about this narration, if anything.
 *
 * Returns nothing rather than a guess: an unrecognised merchant is the model's
 * job, and a wrong deterministic answer is worse than no answer because it
 * never reaches the model to be reconsidered.
 */
export function merchantCategory(
  narration: string,
  direction: TransactionType
): MerchantMatch | undefined {
  const known = merchantContext(narration);
  if (!known) return undefined;

  const mapping = MERCHANT_CATEGORIES[known.canonical];
  if (!mapping) return undefined;

  const categoryId = direction === "DEBIT" ? mapping.debit : mapping.credit;
  if (!categoryId) return undefined;

  return { merchant: known.canonical, categoryId, direction };
}

/**
 * The same lookup, refused when the CA does not actually have that category.
 *
 * Categories can be renamed, archived or deleted, and a shipped mapping that
 * points at one they removed would file transactions into a category that does
 * not exist. Where that happens the transaction falls through to the model,
 * which can only choose from categories that are really there.
 */
export function merchantCategoryFor(
  narration: string,
  direction: TransactionType,
  categories: Category[]
): MerchantMatch | undefined {
  const match = merchantCategory(narration, direction);
  if (!match) return undefined;

  const category = categories.find((entry) => entry.id === match.categoryId);
  return category && !category.archived ? match : undefined;
}

/** How many merchants ship with an answer — reported in the AI panel. */
export const KNOWN_MERCHANT_COUNT = Object.keys(MERCHANT_CATEGORIES).length;
