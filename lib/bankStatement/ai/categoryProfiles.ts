// Categories, as the embedding model sees them.
// ---------------------------------------------------------------------------
// One sentence per category, written in the same register as the sentence a
// narration is turned into (./narration.ts). Both sides of the cosine
// comparison then read like short descriptions of a kind of spending, which is
// what makes the similarity between them mean anything.
//
// Pure — no model, no DOM. The worker imports it; so do the tests.

import type { Category } from "@/lib/bankStatement/types";

export type CategoryProfile = {
  id: string;
  name: string;
  /** The text that gets embedded. */
  text: string;
  /**
   * Which side of the ledger this category can appear on. A salary *paid* and a
   * salary *received* are different categories, and no amount of semantic
   * similarity should be allowed to confuse them, so direction is enforced
   * before the model is consulted rather than hoped for afterwards.
   */
  directions: ("DEBIT" | "CREDIT")[];
};

const BOTH: ("DEBIT" | "CREDIT")[] = ["DEBIT", "CREDIT"];
const DEBIT_ONLY: ("DEBIT" | "CREDIT")[] = ["DEBIT"];
const CREDIT_ONLY: ("DEBIT" | "CREDIT")[] = ["CREDIT"];

/**
 * Categories whose direction is narrower than their group implies. Everything
 * else follows the group: income is a credit, expenses are debits, transfers
 * and cash can go either way.
 */
const DIRECTION_OVERRIDES: Record<string, ("DEBIT" | "CREDIT")[]> = {
  "cash-deposit": CREDIT_ONLY,
  "cash-withdrawal": DEBIT_ONLY,
  "other-income": CREDIT_ONLY,
  "other-expenses": DEBIT_ONLY,
};

function directionsFor(category: Category): ("DEBIT" | "CREDIT")[] {
  const override = DIRECTION_OVERRIDES[category.id];
  if (override) return override;
  if (category.group === "INCOME") return CREDIT_ONLY;
  if (category.group === "EXPENSE") return DEBIT_ONLY;
  return BOTH;
}

/**
 * The sentence describing one category.
 *
 * A category the CA added themselves has no description, so it is embedded on
 * its name and group alone. That works, but poorly — which is why the category
 * manager offers a description field and says what it is for.
 */
export function categoryProfileText(category: Category): string {
  const pieces = [`${category.name}`];
  if (category.description) pieces.push(category.description);
  if (category.examples && category.examples.length > 0) {
    pieces.push(`for example ${category.examples.join(", ")}`);
  }
  return `${pieces.join(" — ")}.`;
}

/** Build the profiles the worker embeds. Archived categories are left out. */
export function buildCategoryProfiles(categories: Category[]): CategoryProfile[] {
  return categories
    .filter((category) => !category.archived)
    .sort((a, b) => a.order - b.order)
    .map((category) => ({
      id: category.id,
      name: category.name,
      text: categoryProfileText(category),
      directions: directionsFor(category),
    }));
}

/**
 * A cheap identity for a set of profiles, so the worker can tell whether the
 * embeddings it already holds are still the right ones. Renaming a category or
 * editing its description changes this; reordering the list does not change
 * what any category *means*, but it is included anyway because the cost of a
 * spurious recompute is a few hundred milliseconds and the cost of a stale
 * embedding is a wrong category.
 */
export function profilesFingerprint(profiles: CategoryProfile[]): string {
  return profiles.map((profile) => `${profile.id}:${profile.text.length}:${profile.text}`).join("|");
}
