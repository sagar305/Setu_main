"use client";

// The analyzer's shared state, held in one context so the four steps
// (/import, /review, /analyze, /reconcile, /export) survive navigation and a
// browser refresh. Persistence follows decision 5: statements, rules,
// categories, settings and the audit log in namespaced localStorage; the
// transaction volume in this tool's own small IndexedDB.
//
// No Zustand (decision 2) — feature hooks over React state, as the repo does.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  AnalysisResult,
  AnalyzerSettings,
  BankStatement,
  Category,
  ClassificationRule,
  ReconciliationSession,
  Transaction,
} from "@/lib/bankStatement/types";
import {
  DEFAULT_SETTINGS,
  appendAudit,
  clearAllLocalData,
  readAudit,
  readCategories,
  readReconciliation,
  readRules,
  readSettings,
  readStatements,
  readTransactions,
  removeStatement as removeStatementFromStorage,
  writeCategories,
  writeReconciliation,
  writeRules,
  writeSettings,
  writeStatements,
  writeTransactions,
} from "@/lib/bankStatement/storage/store";
import type { AuditEntry } from "@/lib/bankStatement/types";
import { analyse } from "@/lib/bankStatement/analysis";
import { applyClassification, buildPartyMemory, classify } from "@/lib/bankStatement/classification/classifier";
import { markDuplicates } from "@/lib/bankStatement/normalization/deduplicator";
import { mapInChunks } from "@/lib/bankStatement/utils/scheduler";

type AnalyzerState = {
  loaded: boolean;
  statements: BankStatement[];
  transactions: Transaction[];
  categories: Category[];
  rules: ClassificationRule[];
  settings: AnalyzerSettings;
  audit: AuditEntry[];
  reconciliation: ReconciliationSession | null;
  /** Which statements the dashboard and reports cover (decision 13). */
  activeStatementIds: string[];
};

type AnalyzerActions = {
  addStatement: (statement: BankStatement, transactions: Transaction[]) => Promise<void>;
  removeStatement: (statementId: string) => Promise<void>;
  setActiveStatements: (ids: string[]) => void;
  updateTransactions: (updater: (transaction: Transaction) => Transaction | null, ids: string[]) => Promise<void>;
  reclassifyAll: (onProgress?: (current: number, total: number) => void) => Promise<void>;
  saveRule: (rule: ClassificationRule) => Promise<void>;
  deleteRule: (ruleId: string) => void;
  saveCategory: (category: Category) => void;
  archiveCategory: (categoryId: string, archived: boolean) => void;
  deleteCategory: (categoryId: string) => { ok: boolean; inUse: number };
  updateSettings: (settings: AnalyzerSettings) => Promise<void>;
  saveReconciliation: (session: ReconciliationSession | null) => void;
  clearEverything: () => Promise<void>;
  log: (action: string, detail?: string) => void;
};

type AnalyzerContextValue = AnalyzerState & {
  actions: AnalyzerActions;
  activeTransactions: Transaction[];
  activeStatements: BankStatement[];
  analysis: AnalysisResult;
};

const AnalyzerContext = createContext<AnalyzerContextValue | null>(null);

export function useAnalyzer(): AnalyzerContextValue {
  const context = useContext(AnalyzerContext);
  if (!context) throw new Error("useAnalyzer must be used inside AnalyzerProvider");
  return context;
}

export function AnalyzerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AnalyzerState>({
    loaded: false,
    statements: [],
    transactions: [],
    categories: [],
    rules: [],
    settings: DEFAULT_SETTINGS,
    audit: [],
    reconciliation: null,
    activeStatementIds: [],
  });

  // A mirror of the latest state so stable callbacks can read it without
  // being re-created on every change.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Guards the one-time load so React 18 strict mode does not double-read.
  const loadedOnce = useRef(false);

  useEffect(() => {
    if (loadedOnce.current) return;
    loadedOnce.current = true;

    let cancelled = false;
    (async () => {
      const statements = readStatements();
      let transactions: Transaction[] = [];
      try {
        transactions = await readTransactions(statements.map((statement) => statement.id));
      } catch {
        // IndexedDB blocked (private mode, or storage disabled). The tool still
        // works for this session — the CA just has to re-import.
        transactions = [];
      }
      if (cancelled) return;
      setState({
        loaded: true,
        statements,
        transactions,
        categories: readCategories(),
        rules: readRules(),
        settings: readSettings(),
        audit: readAudit(),
        reconciliation: readReconciliation(),
        activeStatementIds: statements.map((statement) => statement.id),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const log = useCallback((action: string, detail?: string) => {
    appendAudit(action, detail);
    setState((current) => ({ ...current, audit: readAudit() }));
  }, []);

  const addStatement = useCallback(
    async (statement: BankStatement, incoming: Transaction[]) => {
      setState((current) => {
        const statements = [...current.statements.filter((s) => s.id !== statement.id), statement];
        const others = current.transactions.filter((t) => t.statementId !== statement.id);
        const combined = [...others, ...incoming].sort((a, b) => a.date.localeCompare(b.date));

        // Duplicates are found across the whole session, not per file, so an
        // overlapping period between two statements is caught (decision 13).
        markDuplicates(combined);

        writeStatements(statements);
        return {
          ...current,
          statements,
          transactions: combined,
          activeStatementIds: statements.map((s) => s.id),
        };
      });

      await writeTransactions(statement.id, incoming);
      appendAudit("Statement imported", `${statement.fileName} · ${statement.transactionCount} rows`);
      setState((current) => ({ ...current, audit: readAudit() }));
    },
    []
  );

  const removeStatement = useCallback(async (statementId: string) => {
    await removeStatementFromStorage(statementId);
    setState((current) => ({
      ...current,
      statements: current.statements.filter((s) => s.id !== statementId),
      transactions: current.transactions.filter((t) => t.statementId !== statementId),
      activeStatementIds: current.activeStatementIds.filter((id) => id !== statementId),
    }));
    appendAudit("Statement removed");
    setState((current) => ({ ...current, audit: readAudit() }));
  }, []);

  const setActiveStatements = useCallback((ids: string[]) => {
    setState((current) => ({ ...current, activeStatementIds: ids }));
  }, []);

  /** Apply an edit to the given transactions and persist the affected files. */
  const updateTransactions = useCallback(
    async (updater: (transaction: Transaction) => Transaction | null, ids: string[]) => {
      const target = new Set(ids);
      let next: Transaction[] = [];

      setState((current) => {
        next = current.transactions.map((transaction) => {
          if (!target.has(transaction.id)) return transaction;
          return updater({ ...transaction }) ?? transaction;
        });
        return { ...current, transactions: next };
      });

      // Persist only the statements whose rows actually changed.
      const touched = new Set(
        next.filter((transaction) => target.has(transaction.id)).map((t) => t.statementId)
      );
      for (const statementId of touched) {
        await writeTransactions(
          statementId,
          next.filter((transaction) => transaction.statementId === statementId)
        );
      }
    },
    []
  );

  const persistAll = useCallback(async (transactions: Transaction[]) => {
    const byStatement = new Map<string, Transaction[]>();
    for (const transaction of transactions) {
      const bucket = byStatement.get(transaction.statementId);
      if (bucket) bucket.push(transaction);
      else byStatement.set(transaction.statementId, [transaction]);
    }
    for (const [statementId, rows] of byStatement) {
      await writeTransactions(statementId, rows);
    }
  }, []);

  /**
   * Re-run the classifier over everything, preserving manual decisions — a CA's
   * own call always outranks a rule or a pattern.
   */
  const reclassifyAll = useCallback(
    async (onProgress?: (current: number, total: number) => void) => {
      const snapshot = stateRef.current;
      const memory = buildPartyMemory(snapshot.transactions);
      const pending = snapshot.transactions.filter((t) => t.classificationSource !== "MANUAL");

      await mapInChunks(
        pending,
        (transaction) => {
          const classification = classify(transaction, snapshot.rules, memory);
          applyClassification(transaction, classification, snapshot.settings.highValueThreshold);
          return transaction;
        },
        { chunkSize: 400, onProgress }
      );

      const next = [...snapshot.transactions];
      setState((current) => ({ ...current, transactions: next }));
      await persistAll(next);
    },
    [persistAll]
  );

  const saveRule = useCallback(
    async (rule: ClassificationRule) => {
      let rules: ClassificationRule[] = [];
      setState((current) => {
        rules = [...current.rules.filter((existing) => existing.id !== rule.id), rule];
        writeRules(rules);
        return { ...current, rules };
      });
      appendAudit("Rule saved", rule.name);
      setState((current) => ({ ...current, audit: readAudit() }));
    },
    []
  );

  const deleteRule = useCallback((ruleId: string) => {
    setState((current) => {
      const rules = current.rules.filter((rule) => rule.id !== ruleId);
      writeRules(rules);
      return { ...current, rules };
    });
    appendAudit("Rule deleted");
    setState((current) => ({ ...current, audit: readAudit() }));
  }, []);

  const saveCategory = useCallback((category: Category) => {
    setState((current) => {
      const categories = [...current.categories.filter((c) => c.id !== category.id), category].sort(
        (a, b) => a.order - b.order
      );
      writeCategories(categories);
      return { ...current, categories };
    });
  }, []);

  const archiveCategory = useCallback((categoryId: string, archived: boolean) => {
    setState((current) => {
      const categories = current.categories.map((category) =>
        category.id === categoryId ? { ...category, archived } : category
      );
      writeCategories(categories);
      return { ...current, categories };
    });
    appendAudit(archived ? "Category archived" : "Category restored", categoryId);
    setState((current) => ({ ...current, audit: readAudit() }));
  }, []);

  /**
   * Deleting is refused while transactions still use the category — the CA is
   * told how many and asked to move them first (decision 22).
   */
  const deleteCategory = useCallback((categoryId: string): { ok: boolean; inUse: number } => {
    const current = stateRef.current;
    const inUse = current.transactions.filter((t) => t.category === categoryId).length;
    if (inUse > 0) return { ok: false, inUse };

    const category = current.categories.find((c) => c.id === categoryId);
    if (!category || category.builtIn) return { ok: false, inUse: 0 };

    const categories = current.categories.filter((c) => c.id !== categoryId);
    writeCategories(categories);
    setState((state) => ({ ...state, categories }));
    appendAudit("Category deleted", categoryId);
    setState((state) => ({ ...state, audit: readAudit() }));
    return { ok: true, inUse: 0 };
  }, []);

  const updateSettings = useCallback(async (settings: AnalyzerSettings) => {
    writeSettings(settings);
    const current = stateRef.current;
    // The high-value flag is derived from the threshold, so it has to follow it.
    const next = current.transactions.map((transaction) => ({
      ...transaction,
      isHighValue: Math.max(transaction.debit, transaction.credit) >= settings.highValueThreshold,
    }));
    setState((state) => ({ ...state, settings, transactions: next }));
    await persistAll(next);
  }, [persistAll]);

  const saveReconciliation = useCallback((session: ReconciliationSession | null) => {
    writeReconciliation(session);
    setState((current) => ({ ...current, reconciliation: session }));
  }, []);

  const clearEverything = useCallback(async () => {
    await clearAllLocalData();
    setState({
      loaded: true,
      statements: [],
      transactions: [],
      categories: readCategories(),
      rules: [],
      settings: DEFAULT_SETTINGS,
      audit: [],
      reconciliation: null,
      activeStatementIds: [],
    });
  }, []);

  const activeStatements = useMemo(
    () => state.statements.filter((statement) => state.activeStatementIds.includes(statement.id)),
    [state.statements, state.activeStatementIds]
  );

  const activeTransactions = useMemo(
    () =>
      state.transactions.filter((transaction) =>
        state.activeStatementIds.includes(transaction.statementId)
      ),
    [state.transactions, state.activeStatementIds]
  );

  const analysis = useMemo(
    () => analyse(activeTransactions, state.categories, state.settings),
    [activeTransactions, state.categories, state.settings]
  );

  const value: AnalyzerContextValue = {
    ...state,
    activeStatements,
    activeTransactions,
    analysis,
    actions: {
      addStatement,
      removeStatement,
      setActiveStatements,
      updateTransactions,
      reclassifyAll,
      saveRule,
      deleteRule,
      saveCategory,
      archiveCategory,
      deleteCategory,
      updateSettings,
      saveReconciliation,
      clearEverything,
      log,
    },
  };

  return <AnalyzerContext.Provider value={value}>{children}</AnalyzerContext.Provider>;
}
