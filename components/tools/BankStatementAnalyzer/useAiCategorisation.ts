"use client";

// The review screen's side of on-device categorisation.
// ---------------------------------------------------------------------------
// This hook owns the *decisions*: which transactions the model is allowed to
// see, what a score is allowed to do to a row, and what the CA is told
// afterwards. The worker owns the maths; the client owns the plumbing.
//
// Nothing here runs until `categorise()` is called. Importing the hook costs
// one small module — the model, the library and the worker are all behind that
// call, so the analyzer's first paint is exactly what it was before.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAnalyzer } from "@/components/tools/BankStatementAnalyzer/AnalyzerProvider";
import { buildCategoryProfiles } from "@/lib/bankStatement/ai/categoryProfiles";
import { groupSuggestions, needsAiCategorisation } from "@/lib/bankStatement/ai/approval";
import { significantClusters } from "@/lib/bankStatement/ai/clustering";
import {
  buildSuggestion,
  isUnmatchedByAi,
  type CategorySuggestion,
} from "@/lib/bankStatement/ai/categorySuggestion";
import { merchantKey } from "@/lib/bankStatement/ai/narration";
import { CLUSTERING } from "@/lib/bankStatement/ai/config";
import { aiSupported, getAiCategoriser, type AiClientState } from "@/lib/bankStatement/ai/client";
import { outcomeFor } from "@/lib/bankStatement/ai/scoring";
import type { AiRequestItem } from "@/lib/bankStatement/ai/protocol";
import type { Category, Transaction } from "@/lib/bankStatement/types";

export { needsAiCategorisation };

export type AiRunSummary = {
  considered: number;
  /** Suggested with a strong score — still awaiting the CA's approval. */
  confident: number;
  /** Suggested, but close enough to call that the queue says so. */
  tentative: number;
  /** Nothing the model was willing to propose. Left uncategorised. */
  unresolved: number;
};

export type AiRunState = {
  /** What is happening right now, for the progress panel. */
  stage: "idle" | "loading" | "classifying" | "applying" | "grouping";
  current?: number;
  total?: number;
};

export function useAiCategorisation() {
  const { activeTransactions, categories, settings, actions } = useAnalyzer();

  const [client, setClient] = useState<AiClientState>({ phase: "idle" });
  const [run, setRun] = useState<AiRunState>({ stage: "idle" });
  const [summary, setSummary] = useState<AiRunSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newCategories, setNewCategories] = useState<CategorySuggestion[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const running = useRef(false);

  // Subscribing does not create the worker — the client only does that when
  // something asks it to start.
  useEffect(() => getAiCategoriser().subscribe(setClient), []);

  const profiles = useMemo(() => buildCategoryProfiles(categories), [categories]);

  const pending = useMemo(
    () => activeTransactions.filter(needsAiCategorisation),
    [activeTransactions]
  );

  /** Suggestions the model has already made, grouped by merchant, awaiting approval. */
  const awaitingApproval = useMemo(() => groupSuggestions(activeTransactions), [activeTransactions]);

  const supported = aiSupported();

  const categorise = useCallback(async () => {
    if (running.current || pending.length === 0) return;
    running.current = true;
    setError(null);
    setSummary(null);

    const byId = new Map<string, Category>(categories.map((category) => [category.id, category]));

    try {
      setRun({ stage: "loading" });

      const items: AiRequestItem[] = pending.map((transaction) => ({
        id: transaction.id,
        // Only these three fields leave the page, and only into a worker in
        // this same browser. No amounts, no balances, no account details.
        narration: transaction.narration,
        direction: transaction.transactionType,
      }));

      const results = await getAiCategoriser().classify(items, profiles, (current, total) =>
        setRun({ stage: "classifying", current, total })
      );

      setRun({ stage: "applying" });

      const thresholds = { auto: settings.aiAutoThreshold, review: settings.aiReviewThreshold };
      const patches = new Map<string, Partial<Transaction>>();
      const tally: AiRunSummary = {
        considered: results.length,
        confident: 0,
        tentative: 0,
        unresolved: 0,
      };

      for (const result of results) {
        const outcome = result.categoryId ? outcomeFor(result.score, thresholds) : "NONE";

        if (outcome === "NONE" || !result.categoryId) {
          tally.unresolved += 1;
          // Nothing is applied, but the best similarity is kept: it is what
          // makes the thresholds tunable against a real statement later.
          patches.set(result.id, { aiSimilarity: result.similarity, needsReview: true });
          continue;
        }

        const group = byId.get(result.categoryId)?.group;
        if (outcome === "AUTO") tally.confident += 1;
        else tally.tentative += 1;

        patches.set(result.id, {
          category: result.categoryId,
          classificationSource: "AI",
          confidence: result.score,
          aiSimilarity: result.similarity,
          // Every suggestion the model makes waits for the CA, however high it
          // scored. The score decides how it is presented and how it is sorted;
          // it never decides on its own that a row is finished.
          needsReview: true,
          // What kind of money it is, the model can say. Whose money it is —
          // business or personal — it cannot, so that stays for the CA.
          classificationType: group === "TRANSFER" ? "TRANSFER" : "UNKNOWN",
          isTransfer: group === "TRANSFER",
        });
      }

      await actions.updateTransactions(
        (transaction) => {
          const patch = patches.get(transaction.id);
          return patch ? { ...transaction, ...patch } : transaction;
        },
        [...patches.keys()]
      );

      // The rows the model declined are not just failures — taken together they
      // are the shape of a category the list does not have. Ask the worker to
      // group them, reusing the embeddings it just computed.
      const unresolved = pending.filter((transaction) => {
        const patch = patches.get(transaction.id);
        return patch !== undefined && patch.category === undefined;
      });

      if (unresolved.length >= CLUSTERING.minMerchants) {
        setRun({ stage: "grouping" });
        try {
          const clusters = await getAiCategoriser().clusterUnmatched(
            unresolved.map((transaction) => ({
              id: transaction.id,
              narration: transaction.narration,
              direction: transaction.transactionType,
            })),
            profiles
          );

          const byKey = new Map<string, Transaction[]>();
          for (const transaction of unresolved) {
            const key = merchantKey(transaction.narration, transaction.transactionType);
            const bucket = byKey.get(key);
            if (bucket) bucket.push(transaction);
            else byKey.set(key, [transaction]);
          }

          setNewCategories(
            significantClusters(clusters, CLUSTERING.minMerchants, CLUSTERING.maxSuggestions)
              .map((keys) => buildSuggestion(keys.flatMap((key) => byKey.get(key) ?? [])))
              .filter((suggestion) => suggestion.transactions.length > 0)
          );
        } catch {
          // Finding missing categories is a bonus pass. If it fails, the
          // categorisation the CA actually asked for still stands.
          setNewCategories([]);
        }
      }

      setSummary(tally);
      actions.log(
        "AI categorisation run",
        `${tally.confident + tally.tentative} suggested for review · ${tally.unresolved} left`
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setRun({ stage: "idle" });
      running.current = false;
    }
  }, [actions, categories, pending, profiles, settings.aiAutoThreshold, settings.aiReviewThreshold]);

  /**
   * Download the model, and do nothing else.
   *
   * Kept as its own action, deliberately: the download is the one moment this
   * feature touches the network, so it gets its own button and its own press.
   * A CA who wants to satisfy themselves that their statement is not being
   * uploaded can do it here — download, disconnect, then categorise — and the
   * separation is what makes that check possible.
   */
  const download = useCallback(async () => {
    setError(null);
    try {
      await getAiCategoriser().start(profiles);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  }, [profiles]);

  const cancel = useCallback(() => {
    getAiCategoriser().cancelAll();
    setRun({ stage: "idle" });
    running.current = false;
  }, []);

  return {
    supported,
    client,
    run,
    summary,
    error,
    pendingCount: pending.length,
    awaitingApproval,
    /** Categories the list appears to be missing, drawn from what fit nothing. */
    newCategories: newCategories.filter((suggestion) => !dismissed.has(suggestion.key)),
    dismissSuggestion: (key: string) =>
      setDismissed((current) => new Set(current).add(key)),
    clearSuggestion: (key: string) =>
      setNewCategories((current) => current.filter((suggestion) => suggestion.key !== key)),
    busy: run.stage !== "idle",
    categorise,
    download,
    cancel,
    /** True once the model is loaded — nothing else will be downloaded. */
    ready: client.phase === "ready",
  };
}
