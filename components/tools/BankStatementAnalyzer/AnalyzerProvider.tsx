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
  CategoryGroup,
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
import {
  learn,
  readLearned,
  unlearn,
  writeLearned,
  type LearnedMemory,
} from "@/lib/bankStatement/ai/learned";
import {
  aiApprovedRule,
  findRuleForAnchor,
  ruleAnchor,
} from "@/lib/bankStatement/ai/approval";
import { generateLocalId } from "@/lib/hooks/useLocalStore";
import { merchantKey } from "@/lib/bankStatement/ai/narration";
import { slugifyCategory } from "@/lib/bankStatement/classification/categories";
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
  /**
   * Merchant → category, as taught by the CA's own corrections. Held in state
   * so the review screen can show and undo it; persisted to this browser only.
   */
  learned: LearnedMemory;
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
  /**
   * Settle a suggestion the model made: the CA either confirms it or supplies
   * the right category. Both outcomes write a rule for that merchant, so the
   * model is never asked about it again.
   */
  resolveAiSuggestion: (
    transactions: Transaction[],
    categoryId: string,
    approved: boolean
  ) => Promise<{ ruleSaved: boolean; rows: number }>;
  /**
   * Accept a proposed category: create it, then settle every transaction in the
   * cluster against it exactly as approving a suggestion would.
   */
  createCategoryFromSuggestion: (input: {
    name: string;
    description: string;
    group: CategoryGroup;
    examples: string[];
    transactions: Transaction[];
  }) => Promise<{ created: boolean; categoryId: string; rows: number; reason?: string }>;
  /** Forget one thing the categoriser learned from a correction. */
  forgetLearned: (key: string) => void;
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
    learned: new Map(),
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
        learned: readLearned(),
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

      // The edit is applied here rather than inside the setState updater.
      //
      // React does not promise to run an updater synchronously — it may defer
      // it to the next render — so anything computed inside one is not
      // available to the code that follows. Reading from the state mirror
      // instead makes the new rows available immediately, which is what both
      // the write below and the learning above it depend on.
      const previous = stateRef.current.transactions;
      const next = previous.map((transaction) => {
        if (!target.has(transaction.id)) return transaction;
        return updater({ ...transaction }) ?? transaction;
      });

      // The categories these rows carried before the edit, so a manual change
      // can be recognised as a correction rather than as a repeat.
      const before = new Map(
        previous
          .filter((transaction) => target.has(transaction.id))
          .map((transaction) => [transaction.id, transaction.category])
      );

      // Keep the mirror in step now, not after the next commit, so two edits in
      // quick succession both start from the newer list.
      stateRef.current = { ...stateRef.current, transactions: next };
      setState((current) => ({ ...current, transactions: next }));

      // Learn from what the CA just did. A category they set by hand is ground
      // truth: remember it against the merchant so the next statement carrying
      // the same shop starts out right. Local only — nothing is sent anywhere.
      const corrections = next.filter(
        (transaction) =>
          target.has(transaction.id) &&
          transaction.classificationSource === "MANUAL" &&
          transaction.category !== undefined &&
          transaction.category !== before.get(transaction.id)
      );

      if (corrections.length > 0) {
        const now = new Date().toISOString();
        let memory = stateRef.current.learned;
        for (const transaction of corrections) {
          memory = learn(
            memory,
            transaction,
            transaction.category as string,
            transaction.classificationType,
            now
          );
        }
        writeLearned(memory);
        setState((current) => ({ ...current, learned: memory }));
      }

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
          const classification = classify(transaction, snapshot.rules, memory, snapshot.learned);

          // A rule, a correction or a pattern outranks the semantic model and
          // takes the row over. But when none of them has anything to say, a
          // category the model already found must survive: re-running
          // classification after saving a rule should add answers, never
          // silently delete the ones that were already there.
          const keepAiAnswer =
            classification.classificationSource === "UNCLASSIFIED" &&
            transaction.classificationSource === "AI" &&
            transaction.category !== undefined;

          if (keepAiAnswer) {
            transaction.isHighValue =
              Math.max(transaction.debit, transaction.credit) >=
              snapshot.settings.highValueThreshold;
          } else {
            applyClassification(transaction, classification, snapshot.settings.highValueThreshold);
          }

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

  /**
   * Approving or correcting a suggestion is where the tool actually gets
   * faster. The decision is written twice over:
   *
   *   • as a rule, so classification answers this merchant deterministically
   *     from now on and never reaches the model at all, and
   *   • as a learned correction, so it still applies where a rule cannot be
   *     written safely (a narration with no usable merchant text in it).
   *
   * Both live in this browser only.
   */
  const resolveAiSuggestion = useCallback(
    async (transactions: Transaction[], categoryId: string, approved: boolean) => {
      if (transactions.length === 0 || !categoryId) return { ruleSaved: false, rows: 0 };

      const representative = transactions[0];
      const now = new Date().toISOString();
      const current = stateRef.current;

      // 1 — the rule. Reuse the one this merchant already has rather than
      // stacking a second, otherwise changing your mind leaves both answers in
      // the list and the older one may still win on ties.
      const anchor = ruleAnchor(representative);
      let rules = current.rules;
      let savedRule: ClassificationRule | null = null;

      if (anchor) {
        const existing = findRuleForAnchor(rules, anchor, representative.transactionType);
        savedRule = existing
          ? { ...existing, result: { ...existing.result, category: categoryId }, enabled: true }
          : aiApprovedRule(representative, categoryId, generateLocalId(), now);

        if (savedRule) {
          const withoutOld = rules.filter((rule) => rule.id !== savedRule?.id);
          rules = [...withoutOld, savedRule];
          writeRules(rules);
        }
      }

      // 2 — the learned correction, which covers the rows a rule cannot.
      let memory = current.learned;
      memory = learn(memory, representative, categoryId, representative.classificationType, now);
      writeLearned(memory);

      setState((state) => ({ ...state, rules, learned: memory }));
      stateRef.current = { ...stateRef.current, rules, learned: memory };

      // 3 — the rows themselves, now answered deterministically.
      const ids = transactions.map((transaction) => transaction.id);
      await updateTransactions(
        (transaction) => ({
          ...transaction,
          category: categoryId,
          classificationSource: savedRule ? "RULE" : "MEMORY",
          matchedRuleId: savedRule?.id,
          confidence: savedRule ? 100 : 95,
          needsReview: false,
          aiSimilarity: undefined,
        }),
        ids
      );

      appendAudit(
        approved ? "AI suggestion approved" : "AI suggestion corrected",
        `${ids.length} transaction${ids.length === 1 ? "" : "s"}${savedRule ? " · rule saved" : ""}`
      );
      setState((state) => ({ ...state, audit: readAudit() }));

      return { ruleSaved: savedRule !== null, rows: ids.length };
    },
    [updateTransactions]
  );

  /**
   * Create a category the CA was never offered, and put the cluster in it.
   *
   * The description is carried through deliberately: a category is matched by
   * its description, not its name, so one created here without it would be
   * nearly unmatchable — which is the very problem this is meant to solve. The
   * merchants become its examples for the same reason.
   *
   * Settling then goes through the ordinary approval path, one merchant at a
   * time, so the cluster earns the same rules any other approval would.
   */
  const createCategoryFromSuggestion = useCallback(
    async (input: {
      name: string;
      description: string;
      group: CategoryGroup;
      examples: string[];
      transactions: Transaction[];
    }) => {
      const name = input.name.trim();
      if (name === "") return { created: false, categoryId: "", rows: 0, reason: "A name is required." };

      const current = stateRef.current;
      const categoryId = slugifyCategory(name);
      if (categoryId === "") {
        return { created: false, categoryId: "", rows: 0, reason: "That name cannot be used." };
      }

      const clash = current.categories.find((category) => category.id === categoryId);
      if (clash) {
        return {
          created: false,
          categoryId,
          rows: 0,
          reason: `"${clash.name}" already exists — move these to it instead, or pick another name.`,
        };
      }

      const category: Category = {
        id: categoryId,
        name,
        group: input.group,
        description: input.description.trim() || undefined,
        examples: input.examples.length > 0 ? input.examples : undefined,
        builtIn: false,
        archived: false,
        order: current.categories.reduce((max, entry) => Math.max(max, entry.order), -1) + 1,
      };

      const categories = [...current.categories, category].sort((a, b) => a.order - b.order);
      writeCategories(categories);
      setState((state) => ({ ...state, categories }));
      stateRef.current = { ...stateRef.current, categories };
      appendAudit("Category created from a suggestion", `${name} · ${input.transactions.length} rows`);

      // One merchant at a time, so each gets its own rule rather than one rule
      // that would have to match everything in the cluster at once.
      const byMerchant = new Map<string, Transaction[]>();
      for (const transaction of input.transactions) {
        const key = merchantKey(transaction.narration, transaction.transactionType);
        const bucket = byMerchant.get(key);
        if (bucket) bucket.push(transaction);
        else byMerchant.set(key, [transaction]);
      }

      let rows = 0;
      for (const bucket of byMerchant.values()) {
        const result = await resolveAiSuggestion(bucket, categoryId, false);
        rows += result.rows;
      }

      setState((state) => ({ ...state, audit: readAudit() }));
      return { created: true, categoryId, rows };
    },
    [resolveAiSuggestion]
  );

  const forgetLearned = useCallback((key: string) => {
    const memory = unlearn(stateRef.current.learned, key);
    writeLearned(memory);
    setState((current) => ({ ...current, learned: memory }));
    appendAudit("Learned category forgotten");
    setState((current) => ({ ...current, audit: readAudit() }));
  }, []);

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
      learned: new Map(),
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
      resolveAiSuggestion,
      createCategoryFromSuggestion,
      forgetLearned,
      clearEverything,
      log,
    },
  };

  return <AnalyzerContext.Provider value={value}>{children}</AnalyzerContext.Provider>;
}
