// What the CA has already taught this browser.
// ---------------------------------------------------------------------------
// When someone moves "ABC RESTAURANT" out of Shopping and into Food &
// Groceries, that is ground truth — better than any similarity score. We keep
// it, keyed by the merchant rather than by the transaction, so the next
// statement carrying the same shop is right the first time.
//
// It never leaves this browser. It is not sent anywhere, it is not merged with
// anyone else's, and "Clear all local data" removes it with everything else.
//
// Stored in IndexedDB rather than localStorage: corrections accumulate for as
// long as the CA keeps working and have no natural bound, which is exactly the
// kind of data localStorage should not be holding. Anything written by an
// earlier version is migrated across on first read and the old key removed.

import { readLocal, writeLocal } from "@/lib/toolkit/storage";
import { loadAiRecord, saveAiRecord } from "@/lib/bankStatement/storage/db";
import { LEARNED_KEY, LEARNED_LIMIT, LEARNED_MIN_COUNT } from "@/lib/bankStatement/ai/config";
import { merchantKey } from "@/lib/bankStatement/ai/narration";
import type { ClassificationType, Transaction } from "@/lib/bankStatement/types";

export type LearnedEntry = {
  /** Merchant key — see merchantKey(). Includes the direction. */
  key: string;
  /** A readable version of the merchant, for the "what have I taught it" list. */
  label: string;
  category: string;
  classificationType: ClassificationType;
  /** How many times the CA has confirmed this same answer. */
  count: number;
  updatedAt: string;
};

export type LearnedMemory = Map<string, LearnedEntry>;

// --- pure operations -------------------------------------------------------

export function toMemory(entries: LearnedEntry[]): LearnedMemory {
  return new Map(entries.map((entry) => [entry.key, entry]));
}

/**
 * Record one correction. Repeating the same answer strengthens it; a different
 * answer replaces it outright and starts the count again — the CA changing
 * their mind is a decision, not a tie to be broken by counting.
 */
export function learn(
  memory: LearnedMemory,
  transaction: Transaction,
  category: string,
  classificationType: ClassificationType,
  now: string
): LearnedMemory {
  const key = merchantKey(transaction.narration, transaction.transactionType);
  const existing = memory.get(key);
  const next = new Map(memory);

  next.set(key, {
    key,
    label: transaction.partyName ?? transaction.narration.slice(0, 60),
    category,
    classificationType,
    count: existing && existing.category === category ? existing.count + 1 : 1,
    updatedAt: now,
  });

  return next;
}

/** Forget one merchant. */
export function unlearn(memory: LearnedMemory, key: string): LearnedMemory {
  const next = new Map(memory);
  next.delete(key);
  return next;
}

/**
 * What this browser has been taught about a transaction, if anything strong
 * enough to act on.
 */
export function recall(memory: LearnedMemory, transaction: Transaction): LearnedEntry | undefined {
  const entry = memory.get(merchantKey(transaction.narration, transaction.transactionType));
  return entry && entry.count >= LEARNED_MIN_COUNT ? entry : undefined;
}

/** Most recently confirmed first, capped. Used when writing to storage. */
export function trim(memory: LearnedMemory): LearnedEntry[] {
  return [...memory.values()]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, LEARNED_LIMIT);
}

// --- persistence -----------------------------------------------------------

const TOOL = "bank-statement-analyzer";

/**
 * Read the corrections, migrating anything an earlier version left in
 * localStorage. The migration runs once: the old key is cleared as soon as its
 * contents are safely in IndexedDB.
 */
export async function readLearned(): Promise<LearnedMemory> {
  let stored: LearnedEntry[] = [];
  try {
    stored = await loadAiRecord<LearnedEntry[]>(LEARNED_KEY, []);
  } catch {
    // IndexedDB blocked (private mode). Fall back to whatever localStorage has
    // rather than losing what the CA taught us for this session.
    return toMemory(readLocal<LearnedEntry[]>(TOOL, LEARNED_KEY, []));
  }

  if (stored.length === 0) {
    const legacy = readLocal<LearnedEntry[]>(TOOL, LEARNED_KEY, []);
    if (legacy.length > 0) {
      try {
        await saveAiRecord(LEARNED_KEY, legacy);
        writeLocal(TOOL, LEARNED_KEY, []);
        return toMemory(legacy);
      } catch {
        return toMemory(legacy);
      }
    }
  }

  return toMemory(stored);
}

export async function writeLearned(memory: LearnedMemory): Promise<void> {
  try {
    await saveAiRecord(LEARNED_KEY, trim(memory));
  } catch {
    // Best effort, as everywhere else in this tool: a browser that refuses
    // storage still categorises, it just forgets between sessions.
  }
}
