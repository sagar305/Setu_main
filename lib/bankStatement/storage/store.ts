// Tool-local persistence, on top of the repo's namespaced localStorage helper.
// Keys follow the toolkit convention: setu:bank-statement-analyzer:<key>.
//
// What is NOT stored, ever: the imported file itself, a PDF password, or a full
// account number (§18, decisions 12 and 23).

import { readLocal, writeLocal, localKey } from "@/lib/toolkit/storage";
import type {
  AnalyzerSettings,
  AuditEntry,
  BankStatement,
  Category,
  ClassificationRule,
  ReconciliationSession,
  Transaction,
} from "@/lib/bankStatement/types";
import { defaultCategories } from "@/lib/bankStatement/classification/categories";
import {
  clearAll as clearTransactionDb,
  deleteTransactions,
  loadTransactions,
  saveTransactions,
} from "@/lib/bankStatement/storage/db";

export const TOOL = "bank-statement-analyzer";

const KEYS = {
  statements: "statements",
  rules: "rules",
  categories: "categories",
  settings: "settings",
  audit: "audit",
  reconciliation: "reconciliation",
} as const;

export const DEFAULT_SETTINGS: AnalyzerSettings = {
  highValueThreshold: 100000, // ₹1,00,000 (decision 17)
  includeDuplicatesInTotals: false, // decision 16
  reviewConfidenceThreshold: 70, // below "medium" needs review (decision 20)
};

// --- statements ------------------------------------------------------------

export function readStatements(): BankStatement[] {
  return readLocal<BankStatement[]>(TOOL, KEYS.statements, []);
}

export function writeStatements(statements: BankStatement[]): void {
  writeLocal(TOOL, KEYS.statements, statements);
}

// --- transactions (IndexedDB) ---------------------------------------------

export async function readTransactions(statementIds: string[]): Promise<Transaction[]> {
  const batches = await Promise.all(
    statementIds.map((id) => loadTransactions<Transaction>(id))
  );
  return batches.flat();
}

export async function writeTransactions(
  statementId: string,
  transactions: Transaction[]
): Promise<void> {
  await saveTransactions(statementId, transactions);
}

export async function removeStatement(statementId: string): Promise<void> {
  writeStatements(readStatements().filter((statement) => statement.id !== statementId));
  await deleteTransactions(statementId);
}

// --- rules -----------------------------------------------------------------

export function readRules(): ClassificationRule[] {
  return readLocal<ClassificationRule[]>(TOOL, KEYS.rules, []);
}

export function writeRules(rules: ClassificationRule[]): void {
  writeLocal(TOOL, KEYS.rules, rules);
}

// --- categories ------------------------------------------------------------

export function readCategories(): Category[] {
  const stored = readLocal<Category[] | null>(TOOL, KEYS.categories, null);
  return stored && stored.length > 0 ? stored : defaultCategories();
}

export function writeCategories(categories: Category[]): void {
  writeLocal(TOOL, KEYS.categories, categories);
}

// --- settings --------------------------------------------------------------

export function readSettings(): AnalyzerSettings {
  return { ...DEFAULT_SETTINGS, ...readLocal<Partial<AnalyzerSettings>>(TOOL, KEYS.settings, {}) };
}

export function writeSettings(settings: AnalyzerSettings): void {
  writeLocal(TOOL, KEYS.settings, settings);
}

// --- reconciliation --------------------------------------------------------

export function readReconciliation(): ReconciliationSession | null {
  return readLocal<ReconciliationSession | null>(TOOL, KEYS.reconciliation, null);
}

export function writeReconciliation(session: ReconciliationSession | null): void {
  writeLocal(TOOL, KEYS.reconciliation, session);
}

// --- audit log (decision 23) ----------------------------------------------

const AUDIT_LIMIT = 500;

export function readAudit(): AuditEntry[] {
  return readLocal<AuditEntry[]>(TOOL, KEYS.audit, []);
}

/**
 * Append an audit entry. Callers pass a short action plus an optional detail —
 * detail must never carry an account number, a password or a full narration.
 */
export function appendAudit(action: string, detail?: string): void {
  const entries = readAudit();
  entries.unshift({
    id: `audit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    action,
    detail: detail?.slice(0, 120),
  });
  writeLocal(TOOL, KEYS.audit, entries.slice(0, AUDIT_LIMIT));
}

// --- clear everything (§19) ------------------------------------------------

/** Remove every trace of this tool from the browser. */
export async function clearAllLocalData(): Promise<void> {
  if (typeof window !== "undefined") {
    for (const key of Object.values(KEYS)) {
      window.localStorage.removeItem(localKey(TOOL, key));
    }
  }
  await clearTransactionDb();
}
